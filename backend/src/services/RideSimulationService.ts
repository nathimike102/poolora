/**
 * RideSimulationService.ts
 *
 * Development tool for trying a whole ride on one phone. A bot plays the other
 * side of the trip and a simulated car drives the ride's real route, sending
 * location updates through the same path as a driver's phone, so the rider
 * app sees live movement, "driver is nearby" alerts, start and completion.
 *
 * - As a rider: a bot driver posts a ride from where you are, your seat is
 *   confirmed, and the car drives to you, starts the trip, and completes it.
 * - As a driver: a bot rider requests a seat on your ride (paid from its
 *   wallet). You accept and start the ride in the app, then "Simulate drive"
 *   moves your car along the route instead of your real GPS.
 *
 * Runs are kept in memory, so they only work with a single backend instance.
 * Disabled in production unless ENABLE_RIDE_SIMULATION=true.
 */

import { Types } from 'mongoose';
import { config } from '../config';
import { Ride, type IRide } from '../models/Ride';
import { Booking } from '../models/Booking';
import { User, type IUser } from '../models/User';
import { Wallet } from '../models/Wallet';
import { SocketGateway } from '../sockets/SocketGateway';
import {
  BookingStatus,
  KYCStatus,
  RecurringPattern,
  RideStatus,
  RideType,
  UserCapability,
  VehicleType,
} from '../types';
import { AppError, AuthorizationError, ConflictError, NotFoundError } from '../utils/AppError';
import { toGeoPoint } from '../utils/helpers';
import { bearing, decodePolyline, pathLengthKm, resample, type LatLng } from '../utils/routeGeometry';
import { logger } from '../utils/logger';
import { EventBridge } from '../events';
import { RideService } from './RideService';
import { BookingService } from './BookingService';
import { WalletService } from './WalletService';
import { getRoute, reverseGeocode } from './MapsService';

type Place = LatLng & { address: string };

const BOT_DRIVER_PHONE = '+910000000001';
const BOT_RIDER_PHONE = '+910000000002';

/** Koramangala → Indiranagar, used when the app sends no location. */
const DEFAULT_PICKUP: LatLng = { lat: 12.9352, lng: 77.6245 };

const TICK_MS = 2000;
/** Speed reported to riders while moving; drives the ETA in approach alerts. */
const REPORTED_SPEED_KMH = 35;
/** Cap on ticks per leg so a demo takes a minute or two whatever the distance. */
const MAX_TICKS = { approach: 25, trip: 45 };
/** Ticks spent stopped at the pickup; standing still close by reads as "arrived". */
const PICKUP_WAIT_TICKS = 4;

type Phase = 'approaching' | 'at_pickup' | 'on_trip' | 'arrived' | 'done' | 'stopped';

interface Run {
  rideId: string;
  driverId: string;
  stopped: boolean;
}

// ─── Geometry ────────────────────────────────────────────────────────────────

/** Positions for one leg: at most `maxTicks` moves, about one real tick of driving each. */
function legPositions(path: LatLng[], maxTicks: number): LatLng[] {
  const metresPerTick = (REPORTED_SPEED_KMH / 3.6) * (TICK_MS / 1000);
  const steps = Math.min(maxTicks, Math.max(5, Math.ceil((pathLengthKm(path) * 1000) / metresPerTick)));
  return resample(path, steps);
}

async function roadPath(from: LatLng, to: LatLng): Promise<LatLng[]> {
  try {
    const route = await getRoute(from, to);
    const decoded = route.polyline ? decodePolyline(route.polyline) : [];
    if (decoded.length >= 2) return decoded;
  } catch (error) {
    logger.warn('Simulation falling back to a straight line', { error: (error as Error).message });
  }
  return [from, to];
}

function pointOf(location: { coordinates: number[] }): LatLng {
  return { lng: location.coordinates[0], lat: location.coordinates[1] };
}

async function placeAt(point: LatLng, fallback: string): Promise<Place> {
  try {
    const found = await reverseGeocode(point.lat, point.lng);
    // Full OSM addresses are long; the first few parts read like a place name
    const address = found.formattedAddress.split(', ').slice(0, 3).join(', ');
    return { ...point, address: address || fallback };
  } catch {
    return { ...point, address: fallback };
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class RideSimulationService {
  private static runs = new Map<string, Run>();

  private rideService = new RideService();
  private bookingService = new BookingService();
  private walletService = new WalletService();

  private assertEnabled(): void {
    if (!config.simulation.enabled) {
      throw new AppError('Ride simulation is turned off on this server', 404, 'SIMULATION_DISABLED');
    }
  }

  /**
   * You are the rider. A bot driver posts a ride starting where you are,
   * your seat is confirmed, and the car drives to you and then to the drop.
   */
  async simulateAsRider(
    riderId: string,
    input: { near?: LatLng; dropoff?: LatLng },
  ): Promise<{ rideId: string; bookingId: string }> {
    this.assertEnabled();
    const rider = await User.findById(riderId);
    if (!rider) throw new NotFoundError('User');

    const pickupPoint = input.near ?? DEFAULT_PICKUP;
    const dropPoint = input.dropoff ?? { lat: pickupPoint.lat + 0.03, lng: pickupPoint.lng + 0.02 };
    const [pickup, dropoff] = await Promise.all([
      placeAt(pickupPoint, 'Your location'),
      placeAt(dropPoint, 'Simulated drop'),
    ]);

    const driver = await this.botDriver();
    await this.clearBotRides(driver._id.toString());

    const ride = await this.rideService.createRide(driver._id.toString(), {
      rideType: RideType.CAR_POOL,
      vehicleId: driver.vehicles[0]._id!.toString(),
      pickup,
      dropoff,
      departureTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      totalSeats: 3,
      pricePerSeat: 80,
      recurring: RecurringPattern.NONE,
      preferences: {} as IRide['preferences'],
    }, { skipCreationRules: true });

    // Confirmed straight away: payment is not part of what is being tried out
    const booking = await Booking.create({
      ride: ride._id,
      rider: riderId,
      driver: driver._id,
      status: BookingStatus.CONFIRMED,
      seatsBooked: 1,
      pickup: { location: toGeoPoint(pickup.lng, pickup.lat), address: pickup.address },
      dropoff: { location: toGeoPoint(dropoff.lng, dropoff.lat), address: dropoff.address },
      estimatedFare: ride.pricePerSeat,
      matchScore: 1,
    });
    await Ride.updateOne({ _id: ride._id }, { $inc: { availableSeats: -1 } });

    EventBridge.publish('booking-events', {
      eventType: 'booking.confirmed',
      data: { bookingId: booking._id, riderId, driverId: driver._id.toString() },
    });

    // The car starts about 2 km south of the pickup and drives to it
    const approachStart = { lat: pickup.lat - 0.016, lng: pickup.lng - 0.004 };
    const [approach, trip] = await Promise.all([
      roadPath(approachStart, pickup),
      this.tripPath(ride),
    ]);

    this.launch(ride._id.toString(), driver._id.toString(), {
      approach: legPositions(approach, MAX_TICKS.approach),
      trip: legPositions(trip, MAX_TICKS.trip),
      botDriver: true,
    });

    return { rideId: ride._id.toString(), bookingId: booking._id.toString() };
  }

  /**
   * You are the driver. A bot rider asks for a seat on your ride (or on a new
   * one starting where you are). Accept it in the app, start the ride, then
   * use driveRide to move the car.
   */
  async simulateAsDriver(
    driverId: string,
    input: { rideId?: string; near?: LatLng },
  ): Promise<{ rideId: string; bookingId: string }> {
    this.assertEnabled();
    const driver = await User.findById(driverId);
    if (!driver) throw new NotFoundError('User');
    if (driver.kyc.status !== KYCStatus.APPROVED || !driver.capabilities.includes(UserCapability.DRIVER)) {
      throw new ConflictError('Finish driver verification before simulating a ride as a driver');
    }
    if (driver.vehicles.length === 0) {
      throw new ConflictError('Add a vehicle before simulating a ride as a driver');
    }

    let ride: IRide | null;
    if (input.rideId) {
      ride = await Ride.findById(input.rideId);
      if (!ride) throw new NotFoundError('Ride');
      if (ride.driver.toString() !== driverId) throw new AuthorizationError('That is not your ride');
      if (ride.status !== RideStatus.SCHEDULED && ride.status !== RideStatus.ACTIVE) {
        throw new ConflictError('Pick a ride that has not started yet');
      }
    } else {
      const pickupPoint = input.near ?? DEFAULT_PICKUP;
      const [pickup, dropoff] = await Promise.all([
        placeAt(pickupPoint, 'Your location'),
        placeAt({ lat: pickupPoint.lat + 0.03, lng: pickupPoint.lng + 0.02 }, 'Simulated drop'),
      ]);
      ride = await this.rideService.createRide(driverId, {
        rideType: RideType.CAR_POOL,
        vehicleId: driver.vehicles[0]._id!.toString(),
        pickup,
        dropoff,
        departureTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        totalSeats: 3,
        pricePerSeat: 80,
        recurring: RecurringPattern.NONE,
        preferences: {} as IRide['preferences'],
      }, { skipCreationRules: true });
    }
    if (ride.availableSeats < 1) throw new ConflictError('That ride has no free seats');

    const rider = await this.botRider();
    const botRiderId = rider._id.toString();
    // Old simulated requests would hit the pending-request limit
    await Booking.updateMany(
      { rider: botRiderId, status: BookingStatus.PENDING },
      { $set: { status: BookingStatus.CANCELLED } },
    );
    await this.walletService.getOrCreateWallet(botRiderId);
    await Wallet.updateOne({ userId: botRiderId }, { $max: { balance: 10000 }, $set: { isLocked: false } });

    const { booking } = await this.bookingService.createBooking(botRiderId, {
      rideId: ride._id.toString(),
      seatsBooked: 1,
      pickup: { ...pointOf(ride.pickup.location), address: ride.pickup.address },
      dropoff: { ...pointOf(ride.dropoff.location), address: ride.dropoff.address },
      useWallet: true,
    });

    return { rideId: ride._id.toString(), bookingId: booking._id.toString() };
  }

  /** Drive your in-progress ride from pickup to drop without real GPS. */
  async driveRide(rideId: string, driverId: string): Promise<{ estimatedSeconds: number }> {
    this.assertEnabled();
    const ride = await Ride.findById(rideId);
    if (!ride) throw new NotFoundError('Ride');
    if (ride.driver.toString() !== driverId) throw new AuthorizationError('That is not your ride');
    if (ride.status !== RideStatus.IN_PROGRESS) {
      throw new ConflictError('Start the ride before simulating the drive');
    }

    const trip = legPositions(await this.tripPath(ride), MAX_TICKS.trip);
    this.launch(rideId, driverId, { approach: [], trip, botDriver: false });
    return { estimatedSeconds: Math.round((trip.length * TICK_MS) / 1000) };
  }

  /** Stop a running simulation. The ride keeps whatever status it reached. */
  async stop(rideId: string, userId: string): Promise<boolean> {
    const run = RideSimulationService.runs.get(rideId);
    if (!run) return false;
    // The driver, or the rider of a bot-driven ride, may stop it
    const isRider = await Booking.exists({ ride: rideId, rider: userId });
    if (run.driverId !== userId && !isRider) throw new AuthorizationError('That is not your ride');
    run.stopped = true;
    RideSimulationService.runs.delete(rideId);
    return true;
  }

  isEnabled(): boolean {
    return config.simulation.enabled;
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async tripPath(ride: IRide): Promise<LatLng[]> {
    const decoded = ride.routePolyline ? decodePolyline(ride.routePolyline) : [];
    if (decoded.length >= 2) return decoded;
    return roadPath(pointOf(ride.pickup.location), pointOf(ride.dropoff.location));
  }

  private launch(
    rideId: string,
    driverId: string,
    plan: { approach: LatLng[]; trip: LatLng[]; botDriver: boolean },
  ): void {
    const existing = RideSimulationService.runs.get(rideId);
    if (existing) existing.stopped = true;
    const run: Run = { rideId, driverId, stopped: false };
    RideSimulationService.runs.set(rideId, run);

    this.drive(run, plan)
      .catch((error: Error) => logger.error('Ride simulation failed', { rideId, error: error.message }))
      .finally(() => {
        if (RideSimulationService.runs.get(rideId) === run) RideSimulationService.runs.delete(rideId);
      });
  }

  private async drive(run: Run, plan: { approach: LatLng[]; trip: LatLng[]; botDriver: boolean }): Promise<void> {
    const gateway = SocketGateway.getInstance();
    const wait = () => new Promise((resolve) => setTimeout(resolve, TICK_MS));
    let bookingIds = await this.confirmedBookingIds(run.rideId);

    const send = async (point: LatLng, next: LatLng | undefined, phase: Phase, progress: number) => {
      const speed = next && (phase === 'approaching' || phase === 'on_trip') ? REPORTED_SPEED_KMH : 0;
      const heading = next ? bearing(point, next) : 0;
      for (const bookingId of bookingIds) {
        try {
          await gateway.handleDriverLocationUpdate(run.driverId, {
            bookingId,
            location: point,
            speed,
            heading,
            accuracy: 5,
            timestamp: Date.now(),
          });
        } catch (error) {
          logger.warn('Simulated location update rejected', { bookingId, error: (error as Error).message });
        }
      }
      gateway.getIO().to(`user:${run.driverId}`).emit('ride:simulation', {
        rideId: run.rideId,
        phase,
        progress,
        location: point,
        heading,
      });
    };

    const rideStillOpen = async () => {
      const ride = await Ride.findById(run.rideId).select('status').lean();
      return Boolean(ride) && ride!.status !== RideStatus.CANCELLED && ride!.status !== RideStatus.COMPLETED;
    };

    // 1. Drive to the pickup, then wait there
    for (let i = 0; i < plan.approach.length && !run.stopped; i++) {
      await send(plan.approach[i], plan.approach[i + 1], 'approaching', 0);
      await wait();
    }
    if (plan.approach.length) {
      const pickup = plan.approach[plan.approach.length - 1];
      for (let i = 0; i < PICKUP_WAIT_TICKS && !run.stopped; i++) {
        await send(pickup, undefined, 'at_pickup', 0);
        await wait();
      }
    }
    if (run.stopped || !(await rideStillOpen())) return;

    // 2. The bot driver sets off; a real driver already tapped Start
    if (plan.botDriver) {
      await this.rideService.startRide(run.rideId, run.driverId);
      bookingIds = await this.confirmedBookingIds(run.rideId);
    }

    // 3. Pickup to drop
    for (let i = 0; i < plan.trip.length && !run.stopped; i++) {
      if (i > 0 && i % 5 === 0 && !(await rideStillOpen())) return;
      const phase: Phase = i === plan.trip.length - 1 ? 'arrived' : 'on_trip';
      await send(plan.trip[i], plan.trip[i + 1], phase, (i + 1) / plan.trip.length);
      await wait();
    }
    if (run.stopped) return;

    // 4. The bot driver ends the trip; a real driver taps Complete themselves
    if (plan.botDriver && (await rideStillOpen())) {
      await this.rideService.completeRide(run.rideId, run.driverId);
    }
    gateway.getIO().to(`user:${run.driverId}`).emit('ride:simulation', {
      rideId: run.rideId,
      phase: 'done' satisfies Phase,
      progress: 1,
    });
  }

  private async confirmedBookingIds(rideId: string): Promise<string[]> {
    const bookings = await Booking.find({ ride: rideId, status: BookingStatus.CONFIRMED }).select('_id').lean();
    return bookings.map((b) => b._id.toString());
  }

  /** Close rides a previous bot run left open, so the per-driver ride limit is never hit. */
  private async clearBotRides(botDriverId: string): Promise<void> {
    const open = await Ride.find({
      driver: botDriverId,
      status: { $in: [RideStatus.SCHEDULED, RideStatus.ACTIVE, RideStatus.IN_PROGRESS] },
    }).select('_id');
    if (!open.length) return;
    const ids = open.map((r) => r._id);
    for (const id of ids) {
      const run = RideSimulationService.runs.get(id.toString());
      if (run) run.stopped = true;
    }
    await Ride.updateMany(
      { _id: { $in: ids } },
      { $set: { status: RideStatus.CANCELLED, cancelledAt: new Date(), cancellationReason: 'Simulation replaced' } },
    );
    await Booking.updateMany(
      { ride: { $in: ids }, status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] } },
      { $set: { status: BookingStatus.CANCELLED } },
    );
  }

  private async botDriver(): Promise<IUser> {
    const existing = await User.findOne({ phone: BOT_DRIVER_PHONE });
    if (existing && existing.vehicles.length) return existing;
    const vehicle = {
      _id: new Types.ObjectId(),
      make: 'Maruti',
      model: 'Dzire',
      year: 2022,
      color: 'White',
      plateNumber: 'KA01SIM001',
      vehicleType: VehicleType.SEDAN,
      hasAC: true,
      registrationDocUrl: 'https://example.com/simulated-rc.pdf',
      insuranceDocUrl: 'https://example.com/simulated-insurance.pdf',
    };
    return User.findOneAndUpdate(
      { phone: BOT_DRIVER_PHONE },
      {
        $set: {
          name: 'Sim Driver',
          capabilities: [UserCapability.DRIVER, UserCapability.RIDER],
          kyc: { status: KYCStatus.APPROVED },
          vehicles: [vehicle],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ) as Promise<IUser>;
  }

  private async botRider(): Promise<IUser> {
    return User.findOneAndUpdate(
      { phone: BOT_RIDER_PHONE },
      { $setOnInsert: { name: 'Sim Rider', capabilities: [UserCapability.RIDER] } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ) as Promise<IUser>;
  }
}
