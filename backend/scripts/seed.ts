/**
 * seed.ts — Dumps realistic fake data into MongoDB for all models.
 * Run: npx ts-node scripts/seed.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose, { Types } from 'mongoose';
import { User } from '../src/models/User';
import { Ride } from '../src/models/Ride';
import { Booking } from '../src/models/Booking';
import { Payment } from '../src/models/Payment';
import { Wallet } from '../src/models/Wallet';
import { WalletTransaction } from '../src/models/WalletTransaction';
import { CoinLedger } from '../src/models/CoinLedger';
import { Rating } from '../src/models/Rating';
import { Message } from '../src/models/Message';
import { EmergencyRecord } from '../src/models/EmergencyRecord';

import {
  UserCapability, KYCStatus, VehicleType,
  RideStatus, RideType, RecurringPattern,
  BookingStatus, PaymentStatus, PaymentMethod,
  SOSStatus, RewardTier,
  WalletTransactionType, WalletTransactionStatus,
  CoinTransactionType,
} from '../src/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const oid = () => new Types.ObjectId();

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function hoursFromNow(h: number) {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d;
}

// ─── Static seed data ─────────────────────────────────────────────────────────

// Mumbai-area lat/lng pairs: [lng, lat]
const LOCATIONS = {
  bandra:      { coords: [72.8347, 19.0596], address: 'Bandra West, Mumbai' },
  andheri:     { coords: [72.8479, 19.1136], address: 'Andheri East, Mumbai' },
  powai:       { coords: [72.9055, 19.1176], address: 'Powai, Mumbai' },
  thane:       { coords: [72.9781, 19.2183], address: 'Thane West, Thane' },
  belapur:     { coords: [73.0297, 19.0221], address: 'CBD Belapur, Navi Mumbai' },
  churchgate:  { coords: [72.8258, 18.9322], address: 'Churchgate, Mumbai' },
  borivali:    { coords: [72.8567, 19.2289], address: 'Borivali West, Mumbai' },
  dadar:       { coords: [72.8419, 19.0178], address: 'Dadar, Mumbai' },
  kurla:       { coords: [72.8799, 19.0728], address: 'Kurla West, Mumbai' },
  vashi:       { coords: [73.0071, 19.0771], address: 'Vashi, Navi Mumbai' },
  worli:       { coords: [72.8178, 18.9969], address: 'Worli, Mumbai' },
  malad:       { coords: [72.8474, 19.1871], address: 'Malad West, Mumbai' },
};

type LocationKey = keyof typeof LOCATIONS;

function geoPoint(key: LocationKey) {
  return { type: 'Point' as const, coordinates: LOCATIONS[key].coords as [number, number] };
}

// ─── Main Seed ────────────────────────────────────────────────────────────────

async function seed() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/mobility';
  console.log(`\n🌱  Connecting to: ${mongoUri.replace(/:([^@]+)@/, ':****@')}\n`);

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  console.log('✅  MongoDB connected\n');

  // ── Wipe existing data ──
  console.log('🗑   Clearing collections…');
  await Promise.all([
    User.deleteMany({}),
    Ride.deleteMany({}),
    Booking.deleteMany({}),
    Payment.deleteMany({}),
    Wallet.deleteMany({}),
    WalletTransaction.deleteMany({}),
    CoinLedger.deleteMany({}),
    Rating.deleteMany({}),
    Message.deleteMany({}),
    EmergencyRecord.deleteMany({}),
  ]);
  console.log('✅  Collections cleared\n');

  // ════════════════════════════════════════════════════════════════
  // 1. USERS
  // ════════════════════════════════════════════════════════════════
  console.log('👤  Seeding Users…');

  const driverIds = Array.from({ length: 5 }, () => oid());
  const riderIds  = Array.from({ length: 6 }, () => oid());
  const adminId   = oid();

  const usersPayload = [
    // ── Drivers ──────────────────────────────────────────────────
    {
      _id: driverIds[0], firebaseUid: 'fbUid_driver_001',
      phone: '+919876543210', email: 'arjun.sharma@example.com', name: 'Arjun Sharma',
      dateOfBirth: new Date('1990-04-12'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=arjun',
      capabilities: [UserCapability.DRIVER, UserCapability.RIDER],
      kyc: {
        status: KYCStatus.APPROVED,
        drivingLicenseUrl: 'https://example.com/docs/mh01-2018-1234567.pdf',
        licenseNumber: 'MH01-2018-1234567',
        submittedAt: daysAgo(60), reviewedAt: daysAgo(55),
      },
      vehicles: [{
        _id: oid(), make: 'Maruti', model: 'Swift Dzire', year: 2021,
        color: 'White', plateNumber: 'MH01AB1234',
        vehicleType: VehicleType.SEDAN, hasAC: true,
        registrationDocUrl: 'https://example.com/reg/mh01ab1234.pdf',
        insuranceDocUrl: 'https://example.com/ins/mh01ab1234.pdf',
        photos: ['https://example.com/photos/dzire1.jpg'],
      }],
      emergencyContacts: [{ name: 'Priya Sharma', phone: '+919876543211', relation: 'Wife' }],
      stats: {
        totalRidesAsDriver: 128, totalRidesAsRider: 15,
        totalEarnings: 54200, totalSpent: 3200,
        avgRatingAsDriver: 4.7, avgRatingAsRider: 4.5,
        totalRatingsAsDriver: 120, totalRatingsAsRider: 12,
        cancellationRate: 0.03, acceptanceRate: 0.95,
      },
      fcmTokens: ['fcm_token_driver_001'],
      lastKnownLocation: geoPoint('andheri'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: driverIds[1], firebaseUid: 'fbUid_driver_002',
      phone: '+919876543220', email: 'kavitha.nair@example.com', name: 'Kavitha Nair',
      dateOfBirth: new Date('1988-09-25'), gender: 'female',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=kavitha',
      capabilities: [UserCapability.DRIVER, UserCapability.RIDER],
      kyc: {
        status: KYCStatus.APPROVED,
        drivingLicenseUrl: 'https://example.com/docs/mh04-2016-9876543.pdf',
        licenseNumber: 'MH04-2016-9876543',
        submittedAt: daysAgo(90), reviewedAt: daysAgo(85),
      },
      vehicles: [{
        _id: oid(), make: 'Honda', model: 'City', year: 2022,
        color: 'Silver', plateNumber: 'MH04CD5678',
        vehicleType: VehicleType.SEDAN, hasAC: true,
        registrationDocUrl: 'https://example.com/reg/mh04cd5678.pdf',
        insuranceDocUrl: 'https://example.com/ins/mh04cd5678.pdf',
        photos: ['https://example.com/photos/city1.jpg'],
      }],
      emergencyContacts: [{ name: 'Rajesh Nair', phone: '+919876543221', relation: 'Husband' }],
      stats: {
        totalRidesAsDriver: 87, totalRidesAsRider: 5,
        totalEarnings: 38500, totalSpent: 1800,
        avgRatingAsDriver: 4.9, avgRatingAsRider: 4.8,
        totalRatingsAsDriver: 85, totalRatingsAsRider: 5,
        cancellationRate: 0.01, acceptanceRate: 0.98,
      },
      fcmTokens: ['fcm_token_driver_002'],
      lastKnownLocation: geoPoint('bandra'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: driverIds[2], firebaseUid: 'fbUid_driver_003',
      phone: '+919876543230', email: 'rohit.mehta@example.com', name: 'Rohit Mehta',
      dateOfBirth: new Date('1985-01-30'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=rohit',
      capabilities: [UserCapability.DRIVER],
      kyc: {
        status: KYCStatus.APPROVED,
        drivingLicenseUrl: 'https://example.com/docs/mh02-2015-5551234.pdf',
        licenseNumber: 'MH02-2015-5551234',
        submittedAt: daysAgo(120), reviewedAt: daysAgo(115),
      },
      vehicles: [
        {
          _id: oid(), make: 'Toyota', model: 'Innova Crysta', year: 2020,
          color: 'Grey', plateNumber: 'MH02EF9012',
          vehicleType: VehicleType.SUV, hasAC: true,
          registrationDocUrl: 'https://example.com/reg/mh02ef9012.pdf',
          insuranceDocUrl: 'https://example.com/ins/mh02ef9012.pdf',
          photos: ['https://example.com/photos/innova1.jpg'],
        },
        {
          _id: oid(), make: 'Bajaj', model: 'Pulsar 150', year: 2019,
          color: 'Black', plateNumber: 'MH02GH3456',
          vehicleType: VehicleType.BIKE, hasAC: false,
          registrationDocUrl: 'https://example.com/reg/mh02gh3456.pdf',
          insuranceDocUrl: 'https://example.com/ins/mh02gh3456.pdf',
          photos: ['https://example.com/photos/pulsar1.jpg'],
        },
      ],
      emergencyContacts: [{ name: 'Sunita Mehta', phone: '+919876543231', relation: 'Mother' }],
      stats: {
        totalRidesAsDriver: 210, totalRidesAsRider: 0,
        totalEarnings: 92000, totalSpent: 0,
        avgRatingAsDriver: 4.6, avgRatingAsRider: 0,
        totalRatingsAsDriver: 200, totalRatingsAsRider: 0,
        cancellationRate: 0.05, acceptanceRate: 0.90,
      },
      fcmTokens: ['fcm_token_driver_003'],
      lastKnownLocation: geoPoint('thane'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: driverIds[3], firebaseUid: 'fbUid_driver_004',
      phone: '+919876543240', email: 'deepak.patel@example.com', name: 'Deepak Patel',
      dateOfBirth: new Date('1992-07-08'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=deepak',
      capabilities: [UserCapability.DRIVER, UserCapability.RIDER],
      kyc: {
        status: KYCStatus.APPROVED,
        drivingLicenseUrl: 'https://example.com/docs/mh03-2019-4441212.pdf',
        licenseNumber: 'MH03-2019-4441212',
        submittedAt: daysAgo(45), reviewedAt: daysAgo(42),
      },
      vehicles: [{
        _id: oid(), make: 'Hyundai', model: 'i20', year: 2023,
        color: 'Blue', plateNumber: 'MH03IJ7890',
        vehicleType: VehicleType.HATCHBACK, hasAC: true,
        registrationDocUrl: 'https://example.com/reg/mh03ij7890.pdf',
        insuranceDocUrl: 'https://example.com/ins/mh03ij7890.pdf',
        photos: ['https://example.com/photos/i20_1.jpg'],
      }],
      emergencyContacts: [{ name: 'Meena Patel', phone: '+919876543241', relation: 'Sister' }],
      stats: {
        totalRidesAsDriver: 42, totalRidesAsRider: 20,
        totalEarnings: 18200, totalSpent: 4100,
        avgRatingAsDriver: 4.4, avgRatingAsRider: 4.3,
        totalRatingsAsDriver: 40, totalRatingsAsRider: 18,
        cancellationRate: 0.07, acceptanceRate: 0.88,
      },
      fcmTokens: ['fcm_token_driver_004'],
      lastKnownLocation: geoPoint('powai'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: driverIds[4], firebaseUid: 'fbUid_driver_005',
      phone: '+919876543250', email: 'suresh.kumar@example.com', name: 'Suresh Kumar',
      dateOfBirth: new Date('1983-11-15'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=suresh',
      capabilities: [UserCapability.DRIVER],
      kyc: {
        status: KYCStatus.PENDING,
        drivingLicenseUrl: 'https://example.com/docs/mh05-2020-7779999.pdf',
        licenseNumber: 'MH05-2020-7779999',
        submittedAt: daysAgo(3),
      },
      vehicles: [{
        _id: oid(), make: 'Tata', model: 'Nexon', year: 2022,
        color: 'Red', plateNumber: 'MH05KL2345',
        vehicleType: VehicleType.SUV, hasAC: true,
        registrationDocUrl: 'https://example.com/reg/mh05kl2345.pdf',
        insuranceDocUrl: 'https://example.com/ins/mh05kl2345.pdf',
        photos: ['https://example.com/photos/nexon1.jpg'],
      }],
      emergencyContacts: [{ name: 'Lalitha Kumar', phone: '+919876543251', relation: 'Wife' }],
      stats: {
        totalRidesAsDriver: 12, totalRidesAsRider: 0,
        totalEarnings: 5800, totalSpent: 0,
        avgRatingAsDriver: 4.2, avgRatingAsRider: 0,
        totalRatingsAsDriver: 10, totalRatingsAsRider: 0,
        cancellationRate: 0.08, acceptanceRate: 0.85,
      },
      fcmTokens: ['fcm_token_driver_005'],
      lastKnownLocation: geoPoint('vashi'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },

    // ── Riders ──────────────────────────────────────────────────
    {
      _id: riderIds[0], firebaseUid: 'fbUid_rider_001',
      phone: '+919876500001', email: 'aarav.singh@example.com', name: 'Aarav Singh',
      dateOfBirth: new Date('1998-03-20'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=aarav',
      capabilities: [UserCapability.RIDER],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [{ name: 'Ramesh Singh', phone: '+919876500002', relation: 'Father' }],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 34,
        totalEarnings: 0, totalSpent: 8200,
        avgRatingAsDriver: 0, avgRatingAsRider: 4.6,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 30,
        cancellationRate: 0.06, acceptanceRate: 1,
      },
      fcmTokens: ['fcm_token_rider_001'],
      lastKnownLocation: geoPoint('kurla'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: riderIds[1], firebaseUid: 'fbUid_rider_002',
      phone: '+919876500010', email: 'pooja.verma@example.com', name: 'Pooja Verma',
      dateOfBirth: new Date('1995-06-14'), gender: 'female',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=pooja',
      capabilities: [UserCapability.RIDER],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [{ name: 'Sanjay Verma', phone: '+919876500011', relation: 'Brother' }],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 22,
        totalEarnings: 0, totalSpent: 5100,
        avgRatingAsDriver: 0, avgRatingAsRider: 4.8,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 20,
        cancellationRate: 0.02, acceptanceRate: 1,
      },
      fcmTokens: ['fcm_token_rider_002'],
      lastKnownLocation: geoPoint('dadar'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: riderIds[2], firebaseUid: 'fbUid_rider_003',
      phone: '+919876500020', email: 'nikhil.joshi@example.com', name: 'Nikhil Joshi',
      dateOfBirth: new Date('2000-12-01'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=nikhil',
      capabilities: [UserCapability.RIDER],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [{ name: 'Anita Joshi', phone: '+919876500021', relation: 'Mother' }],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 8,
        totalEarnings: 0, totalSpent: 1900,
        avgRatingAsDriver: 0, avgRatingAsRider: 4.5,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 7,
        cancellationRate: 0.12, acceptanceRate: 1,
      },
      fcmTokens: ['fcm_token_rider_003'],
      lastKnownLocation: geoPoint('borivali'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: riderIds[3], firebaseUid: 'fbUid_rider_004',
      phone: '+919876500030', email: 'sneha.desai@example.com', name: 'Sneha Desai',
      dateOfBirth: new Date('1993-08-17'), gender: 'female',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=sneha',
      capabilities: [UserCapability.RIDER],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [{ name: 'Vivek Desai', phone: '+919876500031', relation: 'Husband' }],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 51,
        totalEarnings: 0, totalSpent: 12300,
        avgRatingAsDriver: 0, avgRatingAsRider: 4.9,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 48,
        cancellationRate: 0.02, acceptanceRate: 1,
      },
      fcmTokens: ['fcm_token_rider_004'],
      lastKnownLocation: geoPoint('worli'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: riderIds[4], firebaseUid: 'fbUid_rider_005',
      phone: '+919876500040', email: 'kiran.rao@example.com', name: 'Kiran Rao',
      dateOfBirth: new Date('1991-02-28'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=kiran',
      capabilities: [UserCapability.RIDER],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [{ name: 'Usha Rao', phone: '+919876500041', relation: 'Wife' }],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 17,
        totalEarnings: 0, totalSpent: 4200,
        avgRatingAsDriver: 0, avgRatingAsRider: 4.3,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 14,
        cancellationRate: 0.05, acceptanceRate: 1,
      },
      fcmTokens: ['fcm_token_rider_005'],
      lastKnownLocation: geoPoint('malad'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: riderIds[5], firebaseUid: 'fbUid_rider_006',
      phone: '+919876500050', email: 'fatima.khan@example.com', name: 'Fatima Khan',
      dateOfBirth: new Date('1997-05-09'), gender: 'female',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=fatima',
      capabilities: [UserCapability.RIDER],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [{ name: 'Imran Khan', phone: '+919876500051', relation: 'Brother' }],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 29,
        totalEarnings: 0, totalSpent: 6800,
        avgRatingAsDriver: 0, avgRatingAsRider: 4.7,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 26,
        cancellationRate: 0.03, acceptanceRate: 1,
      },
      fcmTokens: ['fcm_token_rider_006'],
      lastKnownLocation: geoPoint('belapur'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },

    // ── Admin ────────────────────────────────────────────────────
    {
      _id: adminId, firebaseUid: 'fbUid_admin_001',
      phone: '+919000000001', email: 'admin@onepiece.app', name: 'Platform Admin',
      capabilities: [UserCapability.ADMIN],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 0,
        totalEarnings: 0, totalSpent: 0,
        avgRatingAsDriver: 0, avgRatingAsRider: 0,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 0,
        cancellationRate: 0, acceptanceRate: 1,
      },
      fcmTokens: [],
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
  ];

  const users = await User.insertMany(usersPayload as any);
  console.log(`   ✅  ${users.length} Users inserted`);

  // ════════════════════════════════════════════════════════════════
  // 2. RIDES
  // ════════════════════════════════════════════════════════════════
  console.log('🚗  Seeding Rides…');

  const driver0Vehicle = (usersPayload[0].vehicles[0] as any)._id as Types.ObjectId;
  const driver1Vehicle = (usersPayload[1].vehicles[0] as any)._id as Types.ObjectId;
  const driver2Vehicle = (usersPayload[2].vehicles[0] as any)._id as Types.ObjectId;
  const driver3Vehicle = (usersPayload[3].vehicles[0] as any)._id as Types.ObjectId;
  const driver4Vehicle = (usersPayload[4].vehicles[0] as any)._id as Types.ObjectId;

  const rideIds = Array.from({ length: 8 }, () => oid());

  const ridesPayload = [
    // ── Completed rides ──────────────────────────────────────────
    {
      _id: rideIds[0],
      driver: driverIds[0],
      rideType: RideType.CAR_POOL,
      status: RideStatus.COMPLETED,
      vehicle: { vehicleId: driver0Vehicle, vehicleType: VehicleType.SEDAN, hasAC: true, plateNumber: 'MH01AB1234' },
      pickup:  { location: geoPoint('andheri'),    address: LOCATIONS.andheri.address },
      dropoff: { location: geoPoint('churchgate'), address: LOCATIONS.churchgate.address },
      waypoints: [],
      departureTime: daysAgo(5),
      estimatedArrivalTime: new Date(daysAgo(5).getTime() + 55 * 60000),
      estimatedDurationMins: 55,
      estimatedDistanceKm: 18.4,
      routePolyline: 'encodedPolylineAndheriToChurchgate',
      pricePerSeat: 180,
      availableSeats: 0,
      totalSeats: 3,
      recurring: RecurringPattern.WEEKDAYS,
      preferences: { womenOnly: false, smokingAllowed: false, petsAllowed: false, luggageSize: 'small', maxDetourMins: 5 },
      completedAt: new Date(daysAgo(5).getTime() + 60 * 60000),
    },
    {
      _id: rideIds[1],
      driver: driverIds[1],
      rideType: RideType.CAR_POOL,
      status: RideStatus.COMPLETED,
      vehicle: { vehicleId: driver1Vehicle, vehicleType: VehicleType.SEDAN, hasAC: true, plateNumber: 'MH04CD5678' },
      pickup:  { location: geoPoint('bandra'),  address: LOCATIONS.bandra.address },
      dropoff: { location: geoPoint('powai'),   address: LOCATIONS.powai.address },
      waypoints: [{ location: geoPoint('kurla'), address: LOCATIONS.kurla.address, order: 1 }],
      departureTime: daysAgo(3),
      estimatedArrivalTime: new Date(daysAgo(3).getTime() + 45 * 60000),
      estimatedDurationMins: 45,
      estimatedDistanceKm: 14.2,
      routePolyline: 'encodedPolylineBandraToPowaiviaKurla',
      pricePerSeat: 150,
      availableSeats: 0,
      totalSeats: 3,
      recurring: RecurringPattern.NONE,
      preferences: { womenOnly: true, smokingAllowed: false, petsAllowed: false, luggageSize: 'none', maxDetourMins: 8 },
      completedAt: new Date(daysAgo(3).getTime() + 48 * 60000),
    },
    {
      _id: rideIds[2],
      driver: driverIds[2],
      rideType: RideType.TRIP_POOL,
      status: RideStatus.COMPLETED,
      vehicle: { vehicleId: driver2Vehicle, vehicleType: VehicleType.SUV, hasAC: true, plateNumber: 'MH02EF9012' },
      pickup:  { location: geoPoint('thane'),  address: LOCATIONS.thane.address },
      dropoff: { location: geoPoint('worli'),  address: LOCATIONS.worli.address },
      waypoints: [],
      departureTime: daysAgo(7),
      estimatedArrivalTime: new Date(daysAgo(7).getTime() + 70 * 60000),
      estimatedDurationMins: 70,
      estimatedDistanceKm: 28.6,
      routePolyline: 'encodedPolylineThaneToWorli',
      pricePerSeat: 320,
      availableSeats: 0,
      totalSeats: 5,
      recurring: RecurringPattern.NONE,
      preferences: { womenOnly: false, smokingAllowed: false, petsAllowed: true, luggageSize: 'medium', maxDetourMins: 10 },
      completedAt: new Date(daysAgo(7).getTime() + 75 * 60000),
    },
    {
      _id: rideIds[3],
      driver: driverIds[0],
      rideType: RideType.PARCEL_POOL,
      status: RideStatus.COMPLETED,
      vehicle: { vehicleId: driver0Vehicle, vehicleType: VehicleType.SEDAN, hasAC: true, plateNumber: 'MH01AB1234' },
      pickup:  { location: geoPoint('dadar'),   address: LOCATIONS.dadar.address },
      dropoff: { location: geoPoint('belapur'), address: LOCATIONS.belapur.address },
      waypoints: [],
      departureTime: daysAgo(2),
      estimatedArrivalTime: new Date(daysAgo(2).getTime() + 80 * 60000),
      estimatedDurationMins: 80,
      estimatedDistanceKm: 32.1,
      routePolyline: 'encodedPolylineDadarToBelapur',
      pricePerSeat: 400,
      availableSeats: 0,
      totalSeats: 2,
      recurring: RecurringPattern.NONE,
      preferences: { womenOnly: false, smokingAllowed: false, petsAllowed: false, luggageSize: 'large', maxDetourMins: 15 },
      parcelInfo: { maxWeightKg: 10, maxDimensions: { length: 50, width: 40, height: 30 }, fragile: false },
      completedAt: new Date(daysAgo(2).getTime() + 85 * 60000),
    },

    // ── Active / In-Progress rides ──────────────────────────────
    {
      _id: rideIds[4],
      driver: driverIds[3],
      rideType: RideType.CAR_POOL,
      status: RideStatus.IN_PROGRESS,
      vehicle: { vehicleId: driver3Vehicle, vehicleType: VehicleType.HATCHBACK, hasAC: true, plateNumber: 'MH03IJ7890' },
      pickup:  { location: geoPoint('powai'),  address: LOCATIONS.powai.address },
      dropoff: { location: geoPoint('malad'),  address: LOCATIONS.malad.address },
      waypoints: [],
      departureTime: new Date(Date.now() - 20 * 60000),
      estimatedArrivalTime: hoursFromNow(1),
      estimatedDurationMins: 50,
      estimatedDistanceKm: 22.7,
      routePolyline: 'encodedPolylinePowaiToMalad',
      pricePerSeat: 200,
      availableSeats: 1,
      totalSeats: 3,
      recurring: RecurringPattern.NONE,
      preferences: { womenOnly: false, smokingAllowed: false, petsAllowed: false, luggageSize: 'small', maxDetourMins: 5 },
    },
    {
      _id: rideIds[5],
      driver: driverIds[1],
      rideType: RideType.CAR_POOL,
      status: RideStatus.ACTIVE,
      vehicle: { vehicleId: driver1Vehicle, vehicleType: VehicleType.SEDAN, hasAC: true, plateNumber: 'MH04CD5678' },
      pickup:  { location: geoPoint('vashi'),    address: LOCATIONS.vashi.address },
      dropoff: { location: geoPoint('churchgate'), address: LOCATIONS.churchgate.address },
      waypoints: [],
      departureTime: hoursFromNow(2),
      estimatedArrivalTime: hoursFromNow(3),
      estimatedDurationMins: 60,
      estimatedDistanceKm: 24.5,
      routePolyline: 'encodedPolylineVashiToChurchgate',
      pricePerSeat: 250,
      availableSeats: 2,
      totalSeats: 3,
      recurring: RecurringPattern.WEEKDAYS,
      preferences: { womenOnly: true, smokingAllowed: false, petsAllowed: false, luggageSize: 'none', maxDetourMins: 5 },
    },

    // ── Scheduled rides ─────────────────────────────────────────
    {
      _id: rideIds[6],
      driver: driverIds[2],
      rideType: RideType.CAR_POOL,
      status: RideStatus.SCHEDULED,
      vehicle: { vehicleId: driver2Vehicle, vehicleType: VehicleType.SUV, hasAC: true, plateNumber: 'MH02EF9012' },
      pickup:  { location: geoPoint('borivali'), address: LOCATIONS.borivali.address },
      dropoff: { location: geoPoint('churchgate'), address: LOCATIONS.churchgate.address },
      waypoints: [{ location: geoPoint('andheri'), address: LOCATIONS.andheri.address, order: 1 }],
      departureTime: hoursFromNow(24),
      estimatedArrivalTime: hoursFromNow(26),
      estimatedDurationMins: 90,
      estimatedDistanceKm: 38.0,
      routePolyline: 'encodedPolylineBorivaliToChurchgate',
      pricePerSeat: 280,
      availableSeats: 4,
      totalSeats: 4,
      recurring: RecurringPattern.DAILY,
      preferences: { womenOnly: false, smokingAllowed: false, petsAllowed: false, luggageSize: 'small', maxDetourMins: 10 },
    },

    // ── Cancelled ride ───────────────────────────────────────────
    {
      _id: rideIds[7],
      driver: driverIds[4],
      rideType: RideType.CAR_POOL,
      status: RideStatus.CANCELLED,
      vehicle: { vehicleId: driver4Vehicle, vehicleType: VehicleType.SUV, hasAC: true, plateNumber: 'MH05KL2345' },
      pickup:  { location: geoPoint('vashi'),  address: LOCATIONS.vashi.address },
      dropoff: { location: geoPoint('thane'),  address: LOCATIONS.thane.address },
      waypoints: [],
      departureTime: daysAgo(1),
      estimatedArrivalTime: new Date(daysAgo(1).getTime() + 40 * 60000),
      estimatedDurationMins: 40,
      estimatedDistanceKm: 15.3,
      routePolyline: 'encodedPolylineVashiToThane',
      pricePerSeat: 130,
      availableSeats: 3,
      totalSeats: 3,
      recurring: RecurringPattern.NONE,
      preferences: { womenOnly: false, smokingAllowed: true, petsAllowed: false, luggageSize: 'none', maxDetourMins: 5 },
      cancelledAt: daysAgo(1),
      cancellationReason: 'Driver had a personal emergency',
    },
  ];

  const rides = await Ride.insertMany(ridesPayload as any);
  console.log(`   ✅  ${rides.length} Rides inserted`);

  // ════════════════════════════════════════════════════════════════
  // 3. BOOKINGS
  // ════════════════════════════════════════════════════════════════
  console.log('📋  Seeding Bookings…');

  const bookingIds = Array.from({ length: 9 }, () => oid());

  const bookingsPayload = [
    // ── Completed bookings (linked to completed rides) ──────────
    {
      _id: bookingIds[0],
      ride: rideIds[0], rider: riderIds[0], driver: driverIds[0],
      status: BookingStatus.COMPLETED, seatsBooked: 1,
      pickup:  { location: geoPoint('andheri'),    address: LOCATIONS.andheri.address },
      dropoff: { location: geoPoint('churchgate'), address: LOCATIONS.churchgate.address },
      estimatedFare: 180, finalFare: 180,
      matchScore: 92,
      razorpayOrderId: 'order_seed_00001',
      razorpayPaymentId: 'pay_seed_00001',
      driverEarnings: 153, platformFee: 27,
      settlementStatus: 'settled' as const,
      settlementDate: daysAgo(4),
      riderConfirmedPickup: true, riderConfirmedDropoff: true,
      driverConfirmedPickup: true, driverConfirmedDropoff: true,
      actualPickupTime: daysAgo(5),
      actualDropoffTime: new Date(daysAgo(5).getTime() + 57 * 60000),
    },
    {
      _id: bookingIds[1],
      ride: rideIds[0], rider: riderIds[3], driver: driverIds[0],
      status: BookingStatus.COMPLETED, seatsBooked: 1,
      pickup:  { location: geoPoint('andheri'),    address: LOCATIONS.andheri.address },
      dropoff: { location: geoPoint('churchgate'), address: LOCATIONS.churchgate.address },
      estimatedFare: 180, finalFare: 180,
      matchScore: 88,
      razorpayOrderId: 'order_seed_00002',
      razorpayPaymentId: 'pay_seed_00002',
      driverEarnings: 153, platformFee: 27,
      settlementStatus: 'settled' as const,
      settlementDate: daysAgo(4),
      riderConfirmedPickup: true, riderConfirmedDropoff: true,
      driverConfirmedPickup: true, driverConfirmedDropoff: true,
      actualPickupTime: daysAgo(5),
      actualDropoffTime: new Date(daysAgo(5).getTime() + 57 * 60000),
    },
    {
      _id: bookingIds[2],
      ride: rideIds[1], rider: riderIds[1], driver: driverIds[1],
      status: BookingStatus.COMPLETED, seatsBooked: 1,
      pickup:  { location: geoPoint('bandra'), address: LOCATIONS.bandra.address },
      dropoff: { location: geoPoint('powai'),  address: LOCATIONS.powai.address },
      estimatedFare: 150, finalFare: 150,
      matchScore: 95,
      razorpayOrderId: 'order_seed_00003',
      razorpayPaymentId: 'pay_seed_00003',
      driverEarnings: 127.50, platformFee: 22.50,
      settlementStatus: 'settled' as const,
      settlementDate: daysAgo(2),
      riderConfirmedPickup: true, riderConfirmedDropoff: true,
      driverConfirmedPickup: true, driverConfirmedDropoff: true,
      actualPickupTime: daysAgo(3),
      actualDropoffTime: new Date(daysAgo(3).getTime() + 47 * 60000),
    },
    {
      _id: bookingIds[3],
      ride: rideIds[2], rider: riderIds[4], driver: driverIds[2],
      status: BookingStatus.COMPLETED, seatsBooked: 2,
      pickup:  { location: geoPoint('thane'), address: LOCATIONS.thane.address },
      dropoff: { location: geoPoint('worli'), address: LOCATIONS.worli.address },
      estimatedFare: 640, finalFare: 640,
      matchScore: 78,
      razorpayOrderId: 'order_seed_00004',
      razorpayPaymentId: 'pay_seed_00004',
      driverEarnings: 544, platformFee: 96,
      settlementStatus: 'settled' as const,
      settlementDate: daysAgo(6),
      riderConfirmedPickup: true, riderConfirmedDropoff: true,
      driverConfirmedPickup: true, driverConfirmedDropoff: true,
      actualPickupTime: daysAgo(7),
      actualDropoffTime: new Date(daysAgo(7).getTime() + 73 * 60000),
    },
    {
      _id: bookingIds[4],
      ride: rideIds[3], rider: riderIds[2], driver: driverIds[0],
      status: BookingStatus.COMPLETED, seatsBooked: 1,
      pickup:  { location: geoPoint('dadar'),   address: LOCATIONS.dadar.address },
      dropoff: { location: geoPoint('belapur'), address: LOCATIONS.belapur.address },
      estimatedFare: 400, finalFare: 400,
      matchScore: 85,
      razorpayOrderId: 'order_seed_00005',
      razorpayPaymentId: 'pay_seed_00005',
      driverEarnings: 340, platformFee: 60,
      settlementStatus: 'settled' as const,
      settlementDate: daysAgo(1),
      riderConfirmedPickup: true, riderConfirmedDropoff: true,
      driverConfirmedPickup: true, driverConfirmedDropoff: true,
      actualPickupTime: daysAgo(2),
      actualDropoffTime: new Date(daysAgo(2).getTime() + 83 * 60000),
    },

    // ── Active / In-Progress bookings ───────────────────────────
    {
      _id: bookingIds[5],
      ride: rideIds[4], rider: riderIds[5], driver: driverIds[3],
      status: BookingStatus.CONFIRMED, seatsBooked: 1,
      pickup:  { location: geoPoint('powai'), address: LOCATIONS.powai.address },
      dropoff: { location: geoPoint('malad'), address: LOCATIONS.malad.address },
      estimatedFare: 200, finalFare: undefined,
      matchScore: 90,
      razorpayOrderId: 'order_seed_00006',
      razorpayPaymentId: 'pay_seed_00006',
      driverEarnings: undefined, platformFee: undefined,
      settlementStatus: 'pending' as const,
      riderConfirmedPickup: true, riderConfirmedDropoff: false,
      driverConfirmedPickup: true, driverConfirmedDropoff: false,
      actualPickupTime: new Date(Date.now() - 18 * 60000),
    },

    // ── Pending bookings ─────────────────────────────────────────
    {
      _id: bookingIds[6],
      ride: rideIds[5], rider: riderIds[0], driver: driverIds[1],
      status: BookingStatus.PENDING, seatsBooked: 1,
      pickup:  { location: geoPoint('vashi'),     address: LOCATIONS.vashi.address },
      dropoff: { location: geoPoint('churchgate'), address: LOCATIONS.churchgate.address },
      estimatedFare: 250,
      matchScore: 82,
      settlementStatus: 'pending' as const,
      riderConfirmedPickup: false, riderConfirmedDropoff: false,
      driverConfirmedPickup: false, driverConfirmedDropoff: false,
    },

    // ── Cancelled booking ─────────────────────────────────────
    {
      _id: bookingIds[7],
      ride: rideIds[7], rider: riderIds[3], driver: driverIds[4],
      status: BookingStatus.CANCELLED, seatsBooked: 1,
      pickup:  { location: geoPoint('vashi'), address: LOCATIONS.vashi.address },
      dropoff: { location: geoPoint('thane'), address: LOCATIONS.thane.address },
      estimatedFare: 130,
      matchScore: 70,
      razorpayOrderId: 'order_seed_00007',
      settlementStatus: 'pending' as const,
      cancelledBy: driverIds[4],
      cancellationReason: 'Driver cancelled — personal emergency',
      cancelledAt: daysAgo(1),
      riderConfirmedPickup: false, riderConfirmedDropoff: false,
      driverConfirmedPickup: false, driverConfirmedDropoff: false,
    },

    // ── Payment failed booking ───────────────────────────────────
    {
      _id: bookingIds[8],
      ride: rideIds[6], rider: riderIds[2], driver: driverIds[2],
      status: BookingStatus.PAYMENT_FAILED, seatsBooked: 1,
      pickup:  { location: geoPoint('borivali'),   address: LOCATIONS.borivali.address },
      dropoff: { location: geoPoint('churchgate'), address: LOCATIONS.churchgate.address },
      estimatedFare: 280,
      matchScore: 75,
      razorpayOrderId: 'order_seed_00008',
      settlementStatus: 'pending' as const,
      riderConfirmedPickup: false, riderConfirmedDropoff: false,
      driverConfirmedPickup: false, driverConfirmedDropoff: false,
    },
  ];

  const bookings = await Booking.insertMany(bookingsPayload as any);
  console.log(`   ✅  ${bookings.length} Bookings inserted`);

  // ════════════════════════════════════════════════════════════════
  // 4. PAYMENTS
  // ════════════════════════════════════════════════════════════════
  console.log('💳  Seeding Payments…');

  const paymentsPayload = [
    {
      booking: bookingIds[0], rider: riderIds[0], driver: driverIds[0],
      amount: 180, currency: 'INR', status: PaymentStatus.CAPTURED,
      method: PaymentMethod.UPI,
      razorpayOrderId: 'order_seed_00001', razorpayPaymentId: 'pay_seed_00001',
      razorpaySignature: 'sig_seed_00001',
      driverPayout: 153, platformCommission: 27, platformCommissionRate: 0.15,
      settlementStatus: 'settled' as const, settlementDate: daysAgo(4),
      metadata: { rideType: 'car_pool', seats: 1 },
      idempotencyKey: 'idem_pay_001',
    },
    {
      booking: bookingIds[1], rider: riderIds[3], driver: driverIds[0],
      amount: 180, currency: 'INR', status: PaymentStatus.CAPTURED,
      method: PaymentMethod.CARD,
      razorpayOrderId: 'order_seed_00002', razorpayPaymentId: 'pay_seed_00002',
      razorpaySignature: 'sig_seed_00002',
      driverPayout: 153, platformCommission: 27, platformCommissionRate: 0.15,
      settlementStatus: 'settled' as const, settlementDate: daysAgo(4),
      metadata: { rideType: 'car_pool', seats: 1 },
      idempotencyKey: 'idem_pay_002',
    },
    {
      booking: bookingIds[2], rider: riderIds[1], driver: driverIds[1],
      amount: 150, currency: 'INR', status: PaymentStatus.CAPTURED,
      method: PaymentMethod.WALLET,
      razorpayOrderId: 'order_seed_00003', razorpayPaymentId: 'pay_seed_00003',
      razorpaySignature: 'sig_seed_00003',
      driverPayout: 127.50, platformCommission: 22.50, platformCommissionRate: 0.15,
      settlementStatus: 'settled' as const, settlementDate: daysAgo(2),
      metadata: { rideType: 'car_pool', seats: 1 },
      idempotencyKey: 'idem_pay_003',
    },
    {
      booking: bookingIds[3], rider: riderIds[4], driver: driverIds[2],
      amount: 640, currency: 'INR', status: PaymentStatus.CAPTURED,
      method: PaymentMethod.UPI,
      razorpayOrderId: 'order_seed_00004', razorpayPaymentId: 'pay_seed_00004',
      razorpaySignature: 'sig_seed_00004',
      driverPayout: 544, platformCommission: 96, platformCommissionRate: 0.15,
      settlementStatus: 'settled' as const, settlementDate: daysAgo(6),
      metadata: { rideType: 'trip_pool', seats: 2 },
      idempotencyKey: 'idem_pay_004',
    },
    {
      booking: bookingIds[4], rider: riderIds[2], driver: driverIds[0],
      amount: 400, currency: 'INR', status: PaymentStatus.CAPTURED,
      method: PaymentMethod.NETBANKING,
      razorpayOrderId: 'order_seed_00005', razorpayPaymentId: 'pay_seed_00005',
      razorpaySignature: 'sig_seed_00005',
      driverPayout: 340, platformCommission: 60, platformCommissionRate: 0.15,
      settlementStatus: 'settled' as const, settlementDate: daysAgo(1),
      metadata: { rideType: 'parcel_pool', seats: 1 },
      idempotencyKey: 'idem_pay_005',
    },
    {
      booking: bookingIds[5], rider: riderIds[5], driver: driverIds[3],
      amount: 200, currency: 'INR', status: PaymentStatus.AUTHORIZED,
      method: PaymentMethod.UPI,
      razorpayOrderId: 'order_seed_00006', razorpayPaymentId: 'pay_seed_00006',
      driverPayout: 170, platformCommission: 30, platformCommissionRate: 0.15,
      settlementStatus: 'pending' as const,
      metadata: { rideType: 'car_pool', seats: 1 },
      idempotencyKey: 'idem_pay_006',
    },
    {
      booking: bookingIds[7], rider: riderIds[3], driver: driverIds[4],
      amount: 130, currency: 'INR', status: PaymentStatus.REFUNDED,
      method: PaymentMethod.UPI,
      razorpayOrderId: 'order_seed_00007',
      refundId: 'rfnd_seed_00001', refundAmount: 130,
      refundReason: 'Driver cancelled ride',
      driverPayout: 0, platformCommission: 0, platformCommissionRate: 0.15,
      settlementStatus: 'settled' as const,
      metadata: { rideType: 'car_pool', seats: 1 },
      idempotencyKey: 'idem_pay_007',
    },
    {
      booking: bookingIds[8], rider: riderIds[2], driver: driverIds[2],
      amount: 280, currency: 'INR', status: PaymentStatus.FAILED,
      razorpayOrderId: 'order_seed_00008',
      driverPayout: 0, platformCommission: 0, platformCommissionRate: 0.15,
      settlementStatus: 'pending' as const,
      failureReason: 'Payment declined by bank',
      metadata: { rideType: 'car_pool', seats: 1 },
      idempotencyKey: 'idem_pay_008',
    },
  ];

  const payments = await Payment.insertMany(paymentsPayload as any);
  console.log(`   ✅  ${payments.length} Payments inserted`);

  // ════════════════════════════════════════════════════════════════
  // 5. WALLETS
  // ════════════════════════════════════════════════════════════════
  console.log('👛  Seeding Wallets…');

  const walletIds: Record<string, Types.ObjectId> = {};
  const allUserIds = [...driverIds, ...riderIds];
  allUserIds.forEach(id => { walletIds[id.toString()] = oid(); });

  const walletsPayload = [
    // Drivers
    { _id: walletIds[driverIds[0].toString()], userId: driverIds[0], balance: 2340, coinBalance: 580, tier: RewardTier.GOLD,     totalRidesCompleted: 128, lifetimeTopUp: 5000, lifetimeSpent: 3200, lifetimeCoinsEarned: 640,  lifetimeCoinsConverted: 60,  isLocked: false },
    { _id: walletIds[driverIds[1].toString()], userId: driverIds[1], balance: 1820, coinBalance: 340, tier: RewardTier.SILVER,   totalRidesCompleted: 87,  lifetimeTopUp: 3000, lifetimeSpent: 1800, lifetimeCoinsEarned: 435,  lifetimeCoinsConverted: 95,  isLocked: false },
    { _id: walletIds[driverIds[2].toString()], userId: driverIds[2], balance: 4500, coinBalance: 920, tier: RewardTier.PLATINUM, totalRidesCompleted: 210, lifetimeTopUp: 2000, lifetimeSpent: 800,  lifetimeCoinsEarned: 1050, lifetimeCoinsConverted: 130, isLocked: false },
    { _id: walletIds[driverIds[3].toString()], userId: driverIds[3], balance: 680,  coinBalance: 120, tier: RewardTier.BRONZE,   totalRidesCompleted: 42,  lifetimeTopUp: 2000, lifetimeSpent: 4100, lifetimeCoinsEarned: 210,  lifetimeCoinsConverted: 90,  isLocked: false },
    { _id: walletIds[driverIds[4].toString()], userId: driverIds[4], balance: 320,  coinBalance: 60,  tier: RewardTier.BRONZE,   totalRidesCompleted: 12,  lifetimeTopUp: 1000, lifetimeSpent: 200,  lifetimeCoinsEarned: 60,   lifetimeCoinsConverted: 0,   isLocked: false },
    // Riders
    { _id: walletIds[riderIds[0].toString()], userId: riderIds[0], balance: 1500, coinBalance: 210, tier: RewardTier.SILVER, totalRidesCompleted: 34, lifetimeTopUp: 10000, lifetimeSpent: 8200,  lifetimeCoinsEarned: 340, lifetimeCoinsConverted: 130, isLocked: false },
    { _id: walletIds[riderIds[1].toString()], userId: riderIds[1], balance: 900,  coinBalance: 155, tier: RewardTier.SILVER, totalRidesCompleted: 22, lifetimeTopUp: 6000,  lifetimeSpent: 5100,  lifetimeCoinsEarned: 220, lifetimeCoinsConverted: 65,  isLocked: false },
    { _id: walletIds[riderIds[2].toString()], userId: riderIds[2], balance: 450,  coinBalance: 40,  tier: RewardTier.BRONZE, totalRidesCompleted: 8,  lifetimeTopUp: 2500,  lifetimeSpent: 1900,  lifetimeCoinsEarned: 80,  lifetimeCoinsConverted: 40,  isLocked: false },
    { _id: walletIds[riderIds[3].toString()], userId: riderIds[3], balance: 3200, coinBalance: 480, tier: RewardTier.GOLD,   totalRidesCompleted: 51, lifetimeTopUp: 15000, lifetimeSpent: 12300, lifetimeCoinsEarned: 510, lifetimeCoinsConverted: 30,  isLocked: false },
    { _id: walletIds[riderIds[4].toString()], userId: riderIds[4], balance: 750,  coinBalance: 90,  tier: RewardTier.BRONZE, totalRidesCompleted: 17, lifetimeTopUp: 5000,  lifetimeSpent: 4200,  lifetimeCoinsEarned: 170, lifetimeCoinsConverted: 80,  isLocked: false },
    { _id: walletIds[riderIds[5].toString()], userId: riderIds[5], balance: 1200, coinBalance: 200, tier: RewardTier.SILVER, totalRidesCompleted: 29, lifetimeTopUp: 8000,  lifetimeSpent: 6800,  lifetimeCoinsEarned: 290, lifetimeCoinsConverted: 90,  isLocked: false },
  ];

  const wallets = await Wallet.insertMany(walletsPayload as any);
  console.log(`   ✅  ${wallets.length} Wallets inserted`);

  // ════════════════════════════════════════════════════════════════
  // 6. WALLET TRANSACTIONS
  // ════════════════════════════════════════════════════════════════
  console.log('💰  Seeding WalletTransactions…');

  const walletTxPayload = [
    // Rider 0 — top-up
    {
      wallet: walletIds[riderIds[0].toString()], userId: riderIds[0],
      type: WalletTransactionType.TOPUP, amount: 2000, balanceBefore: 0, balanceAfter: 2000,
      status: WalletTransactionStatus.COMPLETED, razorpayOrderId: 'wt_order_001', razorpayPaymentId: 'wt_pay_001',
      description: 'Wallet top-up via UPI', idempotencyKey: 'wt_idem_001',
    },
    // Rider 0 — debit for ride
    {
      wallet: walletIds[riderIds[0].toString()], userId: riderIds[0],
      type: WalletTransactionType.DEBIT, amount: 180, balanceBefore: 2000, balanceAfter: 1820,
      status: WalletTransactionStatus.COMPLETED, bookingId: bookingIds[0],
      description: 'Ride payment — Andheri to Churchgate', idempotencyKey: 'wt_idem_002',
    },
    // Driver 0 — credit for completed ride
    {
      wallet: walletIds[driverIds[0].toString()], userId: driverIds[0],
      type: WalletTransactionType.TOPUP, amount: 153, balanceBefore: 2187, balanceAfter: 2340,
      status: WalletTransactionStatus.COMPLETED, bookingId: bookingIds[0],
      description: 'Ride earnings — Andheri to Churchgate', idempotencyKey: 'wt_idem_003',
    },
    // Rider 1 — top-up via card
    {
      wallet: walletIds[riderIds[1].toString()], userId: riderIds[1],
      type: WalletTransactionType.TOPUP, amount: 1000, balanceBefore: 500, balanceAfter: 1500,
      status: WalletTransactionStatus.COMPLETED, razorpayOrderId: 'wt_order_002', razorpayPaymentId: 'wt_pay_002',
      description: 'Wallet top-up via Card', idempotencyKey: 'wt_idem_004',
    },
    // Rider 1 — coin conversion
    {
      wallet: walletIds[riderIds[1].toString()], userId: riderIds[1],
      type: WalletTransactionType.COIN_CONVERSION, amount: 65, balanceBefore: 1500, balanceAfter: 1565,
      status: WalletTransactionStatus.COMPLETED, coinsConverted: 650,
      description: '650 coins converted to ₹65 wallet balance', idempotencyKey: 'wt_idem_005',
    },
    // Rider 3 — top-up
    {
      wallet: walletIds[riderIds[3].toString()], userId: riderIds[3],
      type: WalletTransactionType.TOPUP, amount: 5000, balanceBefore: 0, balanceAfter: 5000,
      status: WalletTransactionStatus.COMPLETED, razorpayOrderId: 'wt_order_003', razorpayPaymentId: 'wt_pay_003',
      description: 'Wallet top-up via UPI', idempotencyKey: 'wt_idem_006',
    },
    // Rider 3 — refund
    {
      wallet: walletIds[riderIds[3].toString()], userId: riderIds[3],
      type: WalletTransactionType.REFUND, amount: 130, balanceBefore: 3070, balanceAfter: 3200,
      status: WalletTransactionStatus.COMPLETED, bookingId: bookingIds[7],
      description: 'Refund — Driver cancelled ride', idempotencyKey: 'wt_idem_007',
    },
    // Driver 2 — top-up (pending)
    {
      wallet: walletIds[driverIds[2].toString()], userId: driverIds[2],
      type: WalletTransactionType.TOPUP, amount: 800, balanceBefore: 3700, balanceAfter: 4500,
      status: WalletTransactionStatus.PENDING, razorpayOrderId: 'wt_order_004',
      description: 'Wallet top-up via Netbanking', idempotencyKey: 'wt_idem_008',
    },
  ];

  const walletTxs = await WalletTransaction.insertMany(walletTxPayload as any);
  console.log(`   ✅  ${walletTxs.length} WalletTransactions inserted`);

  // ════════════════════════════════════════════════════════════════
  // 7. COIN LEDGER
  // ════════════════════════════════════════════════════════════════
  console.log('🪙  Seeding CoinLedger…');

  const coinLedgerPayload = [
    // Rider 0 — earned coins on booking
    {
      wallet: walletIds[riderIds[0].toString()], userId: riderIds[0],
      type: CoinTransactionType.EARNED, coins: 18, balanceBefore: 192, balanceAfter: 210,
      bookingId: bookingIds[0],
      description: 'Coins earned for completing ride', expiresAt: hoursFromNow(24 * 365),
    },
    // Rider 0 — bonus coins
    {
      wallet: walletIds[riderIds[0].toString()], userId: riderIds[0],
      type: CoinTransactionType.BONUS, coins: 50, balanceBefore: 142, balanceAfter: 192,
      description: 'Welcome bonus coins', expiresAt: hoursFromNow(24 * 365),
    },
    // Rider 3 — earned coins
    {
      wallet: walletIds[riderIds[3].toString()], userId: riderIds[3],
      type: CoinTransactionType.EARNED, coins: 64, balanceBefore: 416, balanceAfter: 480,
      bookingId: bookingIds[3],
      description: 'Coins earned for completing trip-pool ride', expiresAt: hoursFromNow(24 * 365),
    },
    // Rider 1 — converted coins
    {
      wallet: walletIds[riderIds[1].toString()], userId: riderIds[1],
      type: CoinTransactionType.CONVERTED, coins: 650, balanceBefore: 805, balanceAfter: 155,
      walletTransactionId: walletTxs[4]._id,
      description: 'Converted 650 coins to ₹65',
    },
    // Driver 2 — earned coins
    {
      wallet: walletIds[driverIds[2].toString()], userId: driverIds[2],
      type: CoinTransactionType.EARNED, coins: 64, balanceBefore: 856, balanceAfter: 920,
      bookingId: bookingIds[3],
      description: 'Driver coins for completing trip-pool ride', expiresAt: hoursFromNow(24 * 365),
    },
    // Driver 0 — bonus for first 100 rides milestone
    {
      wallet: walletIds[driverIds[0].toString()], userId: driverIds[0],
      type: CoinTransactionType.BONUS, coins: 100, balanceBefore: 480, balanceAfter: 580,
      description: '100-ride milestone bonus',
    },
    // Rider 5 — earned and spent coins
    {
      wallet: walletIds[riderIds[5].toString()], userId: riderIds[5],
      type: CoinTransactionType.EARNED, coins: 29, balanceBefore: 261, balanceAfter: 290,
      description: 'Coins earned for referral reward', expiresAt: hoursFromNow(24 * 365),
    },
    {
      wallet: walletIds[riderIds[5].toString()], userId: riderIds[5],
      type: CoinTransactionType.SPENT, coins: 90, balanceBefore: 290, balanceAfter: 200,
      description: 'Coins redeemed for ride discount',
    },
  ];

  const coinLedger = await CoinLedger.insertMany(coinLedgerPayload as any);
  console.log(`   ✅  ${coinLedger.length} CoinLedger entries inserted`);

  // ════════════════════════════════════════════════════════════════
  // 8. RATINGS
  // ════════════════════════════════════════════════════════════════
  console.log('⭐  Seeding Ratings…');

  const ratingsPayload = [
    // Rider rates driver (completed booking 0)
    {
      booking: bookingIds[0], ride: rideIds[0],
      rater: riderIds[0], ratee: driverIds[0], raterRole: 'rider',
      score: 5, tags: ['cleanliness', 'punctuality', 'driving'], comment: 'Fantastic driver! Very punctual and the car was spotless.',
      isValidated: true, isFlagged: false,
    },
    // Driver rates rider (completed booking 0)
    {
      booking: bookingIds[0], ride: rideIds[0],
      rater: driverIds[0], ratee: riderIds[0], raterRole: 'driver',
      score: 5, tags: ['politeness', 'communication'], comment: 'Great rider, ready on time!',
      isValidated: true, isFlagged: false,
    },
    // Rider rates driver (booking 1 — same ride)
    {
      booking: bookingIds[1], ride: rideIds[0],
      rater: riderIds[3], ratee: driverIds[0], raterRole: 'rider',
      score: 4, tags: ['driving', 'comfort'], comment: 'Good ride, comfortable car.',
      isValidated: true, isFlagged: false,
    },
    // Rider rates driver (booking 2)
    {
      booking: bookingIds[2], ride: rideIds[1],
      rater: riderIds[1], ratee: driverIds[1], raterRole: 'rider',
      score: 5, tags: ['cleanliness', 'punctuality', 'safety', 'comfort'], comment: 'Best carpooling experience! Kavitha is an awesome driver.',
      isValidated: true, isFlagged: false,
    },
    // Driver rates rider (booking 2)
    {
      booking: bookingIds[2], ride: rideIds[1],
      rater: driverIds[1], ratee: riderIds[1], raterRole: 'driver',
      score: 5, tags: ['politeness'], comment: 'Very polite and well-behaved passenger.',
      isValidated: true, isFlagged: false,
    },
    // Rider rates driver (booking 3 — 2 seats)
    {
      booking: bookingIds[3], ride: rideIds[2],
      rater: riderIds[4], ratee: driverIds[2], raterRole: 'rider',
      score: 4, tags: ['navigation', 'vehicle_condition'], comment: 'Good trip, took a slight detour but arrived safely.',
      isValidated: true, isFlagged: false,
    },
    // Rider rates driver (booking 4 — parcel)
    {
      booking: bookingIds[4], ride: rideIds[3],
      rater: riderIds[2], ratee: driverIds[0], raterRole: 'rider',
      score: 5, tags: ['punctuality', 'communication'], comment: 'Parcel delivered safely, all good!',
      isValidated: true, isFlagged: false,
    },
    // Flagged/negative rating
    {
      booking: bookingIds[3], ride: rideIds[2],
      rater: driverIds[2], ratee: riderIds[4], raterRole: 'driver',
      score: 2, tags: ['communication'], comment: 'Rider was not ready on time and was rude.',
      isValidated: false, isFlagged: true, flagReason: 'Potential misuse of rating system — under review',
    },
  ];

  const ratings = await Rating.insertMany(ratingsPayload as any);
  console.log(`   ✅  ${ratings.length} Ratings inserted`);

  // ════════════════════════════════════════════════════════════════
  // 9. MESSAGES
  // ════════════════════════════════════════════════════════════════
  console.log('💬  Seeding Messages…');

  const messagesPayload = [
    // Chat for booking 0
    { booking: bookingIds[0], sender: riderIds[0],  receiver: driverIds[0], content: 'Hi Arjun! I am at the pickup spot — near the petrol pump.', contentType: 'text', isRead: true,  readAt: daysAgo(5) },
    { booking: bookingIds[0], sender: driverIds[0], receiver: riderIds[0],  content: 'Coming in 2 minutes, white Swift Dzire MH01AB1234 🚗', contentType: 'text', isRead: true,  readAt: daysAgo(5) },
    { booking: bookingIds[0], sender: riderIds[0],  receiver: driverIds[0], content: 'Okay, I can see you!', contentType: 'text', isRead: true,  readAt: daysAgo(5) },
    // Chat for booking 2
    { booking: bookingIds[2], sender: riderIds[1],  receiver: driverIds[1], content: 'Hello Kavitha, just confirming the pickup at Bandra?', contentType: 'text', isRead: true,  readAt: daysAgo(3) },
    { booking: bookingIds[2], sender: driverIds[1], receiver: riderIds[1],  content: 'Yes, I will be outside Bandra station (west side) at 8:30 AM sharp. Silver Honda City.', contentType: 'text', isRead: true,  readAt: daysAgo(3) },
    { booking: bookingIds[2], sender: riderIds[1],  receiver: driverIds[1], content: 'Perfect, see you then!', contentType: 'text', isRead: true,  readAt: daysAgo(3) },
    // Chat for active booking 5
    { booking: bookingIds[5], sender: driverIds[3], receiver: riderIds[5],  content: 'Fatima, I am 5 minutes away. Please be ready.', contentType: 'text', isRead: true,  readAt: new Date(Date.now() - 25 * 60000) },
    { booking: bookingIds[5], sender: riderIds[5],  receiver: driverIds[3], content: 'Yes, waiting at the main gate!', contentType: 'text', isRead: true,  readAt: new Date(Date.now() - 24 * 60000) },
    { booking: bookingIds[5], sender: driverIds[3], receiver: riderIds[5],  content: 'Great, on my way!', contentType: 'text', isRead: false },
    // Chat for pending booking 6
    { booking: bookingIds[6], sender: riderIds[0],  receiver: driverIds[1], content: 'Hi, please confirm if pickup from Vashi station is fine.', contentType: 'text', isRead: false },
  ];

  const messages = await Message.insertMany(messagesPayload as any);
  console.log(`   ✅  ${messages.length} Messages inserted`);

  // ════════════════════════════════════════════════════════════════
  // 10. EMERGENCY RECORDS
  // ════════════════════════════════════════════════════════════════
  console.log('🆘  Seeding EmergencyRecords…');

  const emergencyRecordsPayload = [
    // Resolved SOS
    {
      booking: bookingIds[3], ride: rideIds[2],
      triggeredBy: riderIds[4],
      status: SOSStatus.RESOLVED,
      triggerLocation: geoPoint('worli'),
      locationHistory: [
        { location: geoPoint('worli'), timestamp: daysAgo(7) },
        { location: geoPoint('dadar'), timestamp: new Date(daysAgo(7).getTime() + 5 * 60000) },
      ],
      audioRecordingUrls: ['https://example.com/sos/audio/sos_001.mp3'],
      screenshotUrls: ['https://example.com/sos/screenshots/sos_001.jpg'],
      emergencyContactsNotified: [
        { name: 'Usha Rao', phone: '+919876500041', notifiedAt: daysAgo(7), method: 'sms' as const },
      ],
      adminNotifiedAt: daysAgo(7),
      adminAssignee: adminId,
      liveTrackingUrl: 'https://app.onepiece.com/sos/live/sos_001',
      timeline: [
        { event: 'SOS_TRIGGERED', timestamp: daysAgo(7), details: 'User pressed SOS button' },
        { event: 'CONTACTS_NOTIFIED', timestamp: new Date(daysAgo(7).getTime() + 1 * 60000), details: 'SMS sent to emergency contact' },
        { event: 'ADMIN_NOTIFIED', timestamp: new Date(daysAgo(7).getTime() + 2 * 60000), details: 'Admin dashboard alerted' },
        { event: 'RESOLVED', timestamp: new Date(daysAgo(7).getTime() + 15 * 60000), details: 'User confirmed false alarm' },
      ],
      resolvedAt: new Date(daysAgo(7).getTime() + 15 * 60000),
      resolutionNotes: 'User pressed SOS accidentally — confirmed safe by phone.',
    },
    // Active / triggered SOS
    {
      booking: bookingIds[5], ride: rideIds[4],
      triggeredBy: riderIds[5],
      status: SOSStatus.ACKNOWLEDGED,
      triggerLocation: geoPoint('malad'),
      locationHistory: [
        { location: geoPoint('powai'), timestamp: new Date(Date.now() - 15 * 60000) },
        { location: geoPoint('malad'), timestamp: new Date(Date.now() - 10 * 60000) },
      ],
      audioRecordingUrls: [],
      screenshotUrls: [],
      emergencyContactsNotified: [
        { name: 'Imran Khan', phone: '+919876500051', notifiedAt: new Date(Date.now() - 10 * 60000), method: 'call' as const },
      ],
      adminNotifiedAt: new Date(Date.now() - 9 * 60000),
      adminAssignee: adminId,
      liveTrackingUrl: 'https://app.onepiece.com/sos/live/sos_002',
      timeline: [
        { event: 'SOS_TRIGGERED', timestamp: new Date(Date.now() - 10 * 60000), details: 'User pressed SOS in-app' },
        { event: 'CONTACTS_NOTIFIED', timestamp: new Date(Date.now() - 9 * 60000), details: 'Call placed to emergency contact' },
        { event: 'ADMIN_ACKNOWLEDGED', timestamp: new Date(Date.now() - 8 * 60000), details: 'Admin is monitoring live' },
      ],
    },
  ];

  const emergencyRecords = await EmergencyRecord.insertMany(emergencyRecordsPayload as any);
  console.log(`   ✅  ${emergencyRecords.length} EmergencyRecords inserted`);

  // ─── Summary ──────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log('  🎉  SEED COMPLETE — snapshot');
  console.log('══════════════════════════════════════════════════');
  console.log(`  Users             : ${usersPayload.length}  (5 drivers · 6 riders · 1 admin)`);
  console.log(`  Rides             : ${ridesPayload.length}  (4 completed · 1 in-progress · 1 active · 1 scheduled · 1 cancelled)`);
  console.log(`  Bookings          : ${bookingsPayload.length}  (5 completed · 1 confirmed · 1 pending · 1 cancelled · 1 payment-failed)`);
  console.log(`  Payments          : ${paymentsPayload.length}  (5 captured · 1 authorized · 1 refunded · 1 failed)`);
  console.log(`  Wallets           : ${walletsPayload.length}`);
  console.log(`  WalletTransactions: ${walletTxPayload.length}`);
  console.log(`  CoinLedger        : ${coinLedgerPayload.length}`);
  console.log(`  Ratings           : ${ratingsPayload.length}`);
  console.log(`  Messages          : ${messagesPayload.length}`);
  console.log(`  EmergencyRecords  : ${emergencyRecordsPayload.length}  (1 resolved · 1 acknowledged)`);
  console.log('══════════════════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('\n❌  Seed failed:', err);
  process.exit(1);
});
