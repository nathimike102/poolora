/**
 * seed.ts — Dumps realistic fake data into MongoDB for all models.
 * Run: npm run seed (from backend/)
 */

import dotenv from 'dotenv';
import { migrateToPaynow } from '../src/migrations/migrateToPaynow';

dotenv.config();

import mongoose, { Types } from 'mongoose';
import { User } from '../src/models/User';
import { Ride } from '../src/models/Ride';
import { encodePolyline } from '../src/utils/routeGeometry';
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

// Harare-area lat/lng pairs: [lng, lat]
const LOCATIONS = {
  borrowdale:      { coords: [31.0950, -17.7600], address: 'Borrowdale, Harare' },
  avondale:     { coords: [31.0400, -17.8000], address: 'Avondale, Harare' },
  mountPleasant:       { coords: [31.0500, -17.7700], address: 'Mount Pleasant, Harare' },
  ruwa:       { coords: [31.2450, -17.8900], address: 'Ruwa' },
  chitungwiza:     { coords: [31.0750, -18.0130], address: 'Chitungwiza' },
  cbd:  { coords: [31.0490, -17.8290], address: 'Harare CBD' },
  mabvuku:    { coords: [31.1300, -17.8290], address: 'Mabvuku, Harare' },
  mbare:       { coords: [31.0360, -17.8550], address: 'Mbare, Harare' },
  highlands:       { coords: [31.0850, -17.7950], address: 'Highlands, Harare' },
  epworth:       { coords: [31.1450, -17.8900], address: 'Epworth' },
  belgravia:       { coords: [31.0430, -17.8130], address: 'Belgravia, Harare' },
  westgate:       { coords: [30.9850, -17.7780], address: 'Westgate, Harare' },
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

  // Drop indexes left from Razorpay, which would reject Paynow payments
  await migrateToPaynow(mongoose.connection.db!);

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
      phone: '+263776543210', email: 'tendai.moyo@example.com', name: 'Tendai Moyo',
      dateOfBirth: new Date('1990-04-12'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=arjun',
      capabilities: [UserCapability.DRIVER, UserCapability.RIDER],
      kyc: {
        status: KYCStatus.APPROVED,
        drivingLicenseUrl: 'https://example.com/docs/licence-1.pdf',
        licenseNumber: '1234567AB',
        submittedAt: daysAgo(60), reviewedAt: daysAgo(55),
      },
      vehicles: [{
        _id: oid(), make: 'Toyota', model: 'Axio', year: 2021,
        color: 'White', plateNumber: 'AAB1234',
        vehicleType: VehicleType.SEDAN, hasAC: true,
        registrationDocUrl: 'https://example.com/reg/aab1234.pdf',
        insuranceDocUrl: 'https://example.com/ins/aab1234.pdf',
        photos: ['https://example.com/photos/axio1.jpg'],
      }],
      emergencyContacts: [{ name: 'Rudo Moyo', phone: '+263776543211', relation: 'Wife' }],
      stats: {
        totalRidesAsDriver: 128, totalRidesAsRider: 15,
        totalEarnings: 542, totalSpent: 32,
        avgRatingAsDriver: 4.7, avgRatingAsRider: 4.5,
        totalRatingsAsDriver: 120, totalRatingsAsRider: 12,
        cancellationRate: 0.03, acceptanceRate: 0.95,
      },
      fcmTokens: ['fcm_token_driver_001'],
      lastKnownLocation: geoPoint('avondale'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: driverIds[1], firebaseUid: 'fbUid_driver_002',
      phone: '+263776543220', email: 'nyasha.ncube@example.com', name: 'Nyasha Ncube',
      dateOfBirth: new Date('1988-09-25'), gender: 'female',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=kavitha',
      capabilities: [UserCapability.DRIVER, UserCapability.RIDER],
      kyc: {
        status: KYCStatus.APPROVED,
        drivingLicenseUrl: 'https://example.com/docs/licence-2.pdf',
        licenseNumber: '9876543AB',
        submittedAt: daysAgo(90), reviewedAt: daysAgo(85),
      },
      vehicles: [{
        _id: oid(), make: 'Honda', model: 'Fit', year: 2022,
        color: 'Silver', plateNumber: 'ACD5678',
        vehicleType: VehicleType.SEDAN, hasAC: true,
        registrationDocUrl: 'https://example.com/reg/acd5678.pdf',
        insuranceDocUrl: 'https://example.com/ins/acd5678.pdf',
        photos: ['https://example.com/photos/fit1.jpg'],
      }],
      emergencyContacts: [{ name: 'Farai Ncube', phone: '+263776543221', relation: 'Husband' }],
      stats: {
        totalRidesAsDriver: 87, totalRidesAsRider: 5,
        totalEarnings: 385, totalSpent: 18,
        avgRatingAsDriver: 4.9, avgRatingAsRider: 4.8,
        totalRatingsAsDriver: 85, totalRatingsAsRider: 5,
        cancellationRate: 0.01, acceptanceRate: 0.98,
      },
      fcmTokens: ['fcm_token_driver_002'],
      lastKnownLocation: geoPoint('borrowdale'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: driverIds[2], firebaseUid: 'fbUid_driver_003',
      phone: '+263776543230', email: 'tatenda.dube@example.com', name: 'Tatenda Dube',
      dateOfBirth: new Date('1985-01-30'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=rohit',
      capabilities: [UserCapability.DRIVER],
      kyc: {
        status: KYCStatus.APPROVED,
        drivingLicenseUrl: 'https://example.com/docs/licence-3.pdf',
        licenseNumber: '5551234AB',
        submittedAt: daysAgo(120), reviewedAt: daysAgo(115),
      },
      vehicles: [
        {
          _id: oid(), make: 'Toyota', model: 'Wish', year: 2020,
          color: 'Grey', plateNumber: 'AEF9012',
          vehicleType: VehicleType.MINIVAN, hasAC: true,
          registrationDocUrl: 'https://example.com/reg/aef9012.pdf',
          insuranceDocUrl: 'https://example.com/ins/aef9012.pdf',
          photos: ['https://example.com/photos/wish1.jpg'],
        },
        {
          _id: oid(), make: 'Honda', model: 'CG125', year: 2019,
          color: 'Black', plateNumber: 'AGH3456',
          vehicleType: VehicleType.BIKE, hasAC: false,
          registrationDocUrl: 'https://example.com/reg/agh3456.pdf',
          insuranceDocUrl: 'https://example.com/ins/agh3456.pdf',
          photos: ['https://example.com/photos/cg125_1.jpg'],
        },
      ],
      emergencyContacts: [{ name: 'Chipo Dube', phone: '+263776543231', relation: 'Mother' }],
      stats: {
        totalRidesAsDriver: 210, totalRidesAsRider: 0,
        totalEarnings: 920, totalSpent: 0,
        avgRatingAsDriver: 4.6, avgRatingAsRider: 0,
        totalRatingsAsDriver: 200, totalRatingsAsRider: 0,
        cancellationRate: 0.05, acceptanceRate: 0.90,
      },
      fcmTokens: ['fcm_token_driver_003'],
      lastKnownLocation: geoPoint('ruwa'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: driverIds[3], firebaseUid: 'fbUid_driver_004',
      phone: '+263776543240', email: 'tapiwa.sibanda@example.com', name: 'Tapiwa Sibanda',
      dateOfBirth: new Date('1992-07-08'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=deepak',
      capabilities: [UserCapability.DRIVER, UserCapability.RIDER],
      kyc: {
        status: KYCStatus.APPROVED,
        drivingLicenseUrl: 'https://example.com/docs/licence-4.pdf',
        licenseNumber: '4441212AB',
        submittedAt: daysAgo(45), reviewedAt: daysAgo(42),
      },
      vehicles: [{
        _id: oid(), make: 'Mazda', model: 'Demio', year: 2023,
        color: 'Blue', plateNumber: 'AIJ7890',
        vehicleType: VehicleType.HATCHBACK, hasAC: true,
        registrationDocUrl: 'https://example.com/reg/aij7890.pdf',
        insuranceDocUrl: 'https://example.com/ins/aij7890.pdf',
        photos: ['https://example.com/photos/demio1.jpg'],
      }],
      emergencyContacts: [{ name: 'Rumbidzai Sibanda', phone: '+263776543241', relation: 'Sister' }],
      stats: {
        totalRidesAsDriver: 42, totalRidesAsRider: 20,
        totalEarnings: 182, totalSpent: 41,
        avgRatingAsDriver: 4.4, avgRatingAsRider: 4.3,
        totalRatingsAsDriver: 40, totalRatingsAsRider: 18,
        cancellationRate: 0.07, acceptanceRate: 0.88,
      },
      fcmTokens: ['fcm_token_driver_004'],
      lastKnownLocation: geoPoint('mountPleasant'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: driverIds[4], firebaseUid: 'fbUid_driver_005',
      phone: '+263776543250', email: 'themba.mpofu@example.com', name: 'Themba Mpofu',
      dateOfBirth: new Date('1983-11-15'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=suresh',
      capabilities: [UserCapability.DRIVER],
      kyc: {
        status: KYCStatus.PENDING,
        drivingLicenseUrl: 'https://example.com/docs/licence-5.pdf',
        licenseNumber: '7779999AB',
        submittedAt: daysAgo(3),
      },
      vehicles: [{
        _id: oid(), make: 'Nissan', model: 'X-Trail', year: 2022,
        color: 'Red', plateNumber: 'AKL2345',
        vehicleType: VehicleType.SUV, hasAC: true,
        registrationDocUrl: 'https://example.com/reg/akl2345.pdf',
        insuranceDocUrl: 'https://example.com/ins/akl2345.pdf',
        photos: ['https://example.com/photos/xtrail1.jpg'],
      }],
      emergencyContacts: [{ name: 'Nomsa Mpofu', phone: '+263776543251', relation: 'Wife' }],
      stats: {
        totalRidesAsDriver: 12, totalRidesAsRider: 0,
        totalEarnings: 58, totalSpent: 0,
        avgRatingAsDriver: 4.2, avgRatingAsRider: 0,
        totalRatingsAsDriver: 10, totalRatingsAsRider: 0,
        cancellationRate: 0.08, acceptanceRate: 0.85,
      },
      fcmTokens: ['fcm_token_driver_005'],
      lastKnownLocation: geoPoint('epworth'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },

    // ── Riders ──────────────────────────────────────────────────
    {
      _id: riderIds[0], firebaseUid: 'fbUid_rider_001',
      phone: '+263776500001', email: 'kudzai.mutasa@example.com', name: 'Kudzai Mutasa',
      dateOfBirth: new Date('1998-03-20'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=aarav',
      capabilities: [UserCapability.RIDER],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [{ name: 'Blessing Mutasa', phone: '+263776500002', relation: 'Father' }],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 34,
        totalEarnings: 0, totalSpent: 82,
        avgRatingAsDriver: 0, avgRatingAsRider: 4.6,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 30,
        cancellationRate: 0.06, acceptanceRate: 1,
      },
      fcmTokens: ['fcm_token_rider_001'],
      lastKnownLocation: geoPoint('highlands'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: riderIds[1], firebaseUid: 'fbUid_rider_002',
      phone: '+263776500010', email: 'tariro.chirwa@example.com', name: 'Tariro Chirwa',
      dateOfBirth: new Date('1995-06-14'), gender: 'female',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=pooja',
      capabilities: [UserCapability.RIDER],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [{ name: 'Tinashe Chirwa', phone: '+263776500011', relation: 'Brother' }],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 22,
        totalEarnings: 0, totalSpent: 51,
        avgRatingAsDriver: 0, avgRatingAsRider: 4.8,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 20,
        cancellationRate: 0.02, acceptanceRate: 1,
      },
      fcmTokens: ['fcm_token_rider_002'],
      lastKnownLocation: geoPoint('mbare'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: riderIds[2], firebaseUid: 'fbUid_rider_003',
      phone: '+263776500020', email: 'sipho.nkomo@example.com', name: 'Sipho Nkomo',
      dateOfBirth: new Date('2000-12-01'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=nikhil',
      capabilities: [UserCapability.RIDER],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [{ name: 'Thandiwe Nkomo', phone: '+263776500021', relation: 'Mother' }],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 8,
        totalEarnings: 0, totalSpent: 19,
        avgRatingAsDriver: 0, avgRatingAsRider: 4.5,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 7,
        cancellationRate: 0.12, acceptanceRate: 1,
      },
      fcmTokens: ['fcm_token_rider_003'],
      lastKnownLocation: geoPoint('mabvuku'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: riderIds[3], firebaseUid: 'fbUid_rider_004',
      phone: '+263776500030', email: 'vimbai.marufu@example.com', name: 'Vimbai Marufu',
      dateOfBirth: new Date('1993-08-17'), gender: 'female',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=sneha',
      capabilities: [UserCapability.RIDER],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [{ name: 'Takudzwa Marufu', phone: '+263776500031', relation: 'Husband' }],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 51,
        totalEarnings: 0, totalSpent: 123,
        avgRatingAsDriver: 0, avgRatingAsRider: 4.9,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 48,
        cancellationRate: 0.02, acceptanceRate: 1,
      },
      fcmTokens: ['fcm_token_rider_004'],
      lastKnownLocation: geoPoint('belgravia'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: riderIds[4], firebaseUid: 'fbUid_rider_005',
      phone: '+263776500040', email: 'simba.gumbo@example.com', name: 'Simba Gumbo',
      dateOfBirth: new Date('1991-02-28'), gender: 'male',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=kiran',
      capabilities: [UserCapability.RIDER],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [{ name: 'Fadzai Gumbo', phone: '+263776500041', relation: 'Wife' }],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 17,
        totalEarnings: 0, totalSpent: 42,
        avgRatingAsDriver: 0, avgRatingAsRider: 4.3,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 14,
        cancellationRate: 0.05, acceptanceRate: 1,
      },
      fcmTokens: ['fcm_token_rider_005'],
      lastKnownLocation: geoPoint('westgate'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },
    {
      _id: riderIds[5], firebaseUid: 'fbUid_rider_006',
      phone: '+263776500050', email: 'chiedza.banda@example.com', name: 'Chiedza Banda',
      dateOfBirth: new Date('1997-05-09'), gender: 'female',
      profilePhotoUrl: 'https://i.pravatar.cc/150?u=fatima',
      capabilities: [UserCapability.RIDER],
      kyc: { status: KYCStatus.NONE },
      vehicles: [],
      emergencyContacts: [{ name: 'Tafadzwa Banda', phone: '+263776500051', relation: 'Brother' }],
      stats: {
        totalRidesAsDriver: 0, totalRidesAsRider: 29,
        totalEarnings: 0, totalSpent: 68,
        avgRatingAsDriver: 0, avgRatingAsRider: 4.7,
        totalRatingsAsDriver: 0, totalRatingsAsRider: 26,
        cancellationRate: 0.03, acceptanceRate: 1,
      },
      fcmTokens: ['fcm_token_rider_006'],
      lastKnownLocation: geoPoint('chitungwiza'),
      isActive: true, isSuspended: false, otpAttempts: 0,
    },

    // ── Admin ────────────────────────────────────────────────────
    {
      _id: adminId, firebaseUid: 'fbUid_admin_001',
      phone: '+263770000001', email: 'admin@siham.app', name: 'Platform Admin',
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
      vehicle: { vehicleId: driver0Vehicle, vehicleType: VehicleType.SEDAN, hasAC: true, plateNumber: 'AAB1234' },
      pickup:  { location: geoPoint('avondale'),    address: LOCATIONS.avondale.address },
      dropoff: { location: geoPoint('cbd'), address: LOCATIONS.cbd.address },
      waypoints: [],
      departureTime: daysAgo(5),
      estimatedArrivalTime: new Date(daysAgo(5).getTime() + 55 * 60000),
      estimatedDurationMins: 55,
      estimatedDistanceKm: 18.4,
      pricePerSeat: 1.8,
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
      vehicle: { vehicleId: driver1Vehicle, vehicleType: VehicleType.SEDAN, hasAC: true, plateNumber: 'ACD5678' },
      pickup:  { location: geoPoint('borrowdale'),  address: LOCATIONS.borrowdale.address },
      dropoff: { location: geoPoint('mountPleasant'),   address: LOCATIONS.mountPleasant.address },
      waypoints: [{ location: geoPoint('highlands'), address: LOCATIONS.highlands.address, order: 1 }],
      departureTime: daysAgo(3),
      estimatedArrivalTime: new Date(daysAgo(3).getTime() + 45 * 60000),
      estimatedDurationMins: 45,
      estimatedDistanceKm: 14.2,
      pricePerSeat: 1.5,
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
      vehicle: { vehicleId: driver2Vehicle, vehicleType: VehicleType.MINIVAN, hasAC: true, plateNumber: 'AEF9012' },
      pickup:  { location: geoPoint('ruwa'),  address: LOCATIONS.ruwa.address },
      dropoff: { location: geoPoint('belgravia'),  address: LOCATIONS.belgravia.address },
      waypoints: [],
      departureTime: daysAgo(7),
      estimatedArrivalTime: new Date(daysAgo(7).getTime() + 70 * 60000),
      estimatedDurationMins: 70,
      estimatedDistanceKm: 28.6,
      pricePerSeat: 3.2,
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
      vehicle: { vehicleId: driver0Vehicle, vehicleType: VehicleType.SEDAN, hasAC: true, plateNumber: 'AAB1234' },
      pickup:  { location: geoPoint('mbare'),   address: LOCATIONS.mbare.address },
      dropoff: { location: geoPoint('chitungwiza'), address: LOCATIONS.chitungwiza.address },
      waypoints: [],
      departureTime: daysAgo(2),
      estimatedArrivalTime: new Date(daysAgo(2).getTime() + 80 * 60000),
      estimatedDurationMins: 80,
      estimatedDistanceKm: 32.1,
      pricePerSeat: 4,
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
      vehicle: { vehicleId: driver3Vehicle, vehicleType: VehicleType.HATCHBACK, hasAC: true, plateNumber: 'AIJ7890' },
      pickup:  { location: geoPoint('mountPleasant'),  address: LOCATIONS.mountPleasant.address },
      dropoff: { location: geoPoint('westgate'),  address: LOCATIONS.westgate.address },
      waypoints: [],
      departureTime: new Date(Date.now() - 20 * 60000),
      estimatedArrivalTime: hoursFromNow(1),
      estimatedDurationMins: 50,
      estimatedDistanceKm: 22.7,
      pricePerSeat: 2,
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
      vehicle: { vehicleId: driver1Vehicle, vehicleType: VehicleType.SEDAN, hasAC: true, plateNumber: 'ACD5678' },
      pickup:  { location: geoPoint('epworth'),    address: LOCATIONS.epworth.address },
      dropoff: { location: geoPoint('cbd'), address: LOCATIONS.cbd.address },
      waypoints: [],
      departureTime: hoursFromNow(2),
      estimatedArrivalTime: hoursFromNow(3),
      estimatedDurationMins: 60,
      estimatedDistanceKm: 24.5,
      pricePerSeat: 2.5,
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
      vehicle: { vehicleId: driver2Vehicle, vehicleType: VehicleType.MINIVAN, hasAC: true, plateNumber: 'AEF9012' },
      pickup:  { location: geoPoint('mabvuku'), address: LOCATIONS.mabvuku.address },
      dropoff: { location: geoPoint('cbd'), address: LOCATIONS.cbd.address },
      waypoints: [{ location: geoPoint('avondale'), address: LOCATIONS.avondale.address, order: 1 }],
      departureTime: hoursFromNow(24),
      estimatedArrivalTime: hoursFromNow(26),
      estimatedDurationMins: 90,
      estimatedDistanceKm: 38.0,
      pricePerSeat: 2.8,
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
      vehicle: { vehicleId: driver4Vehicle, vehicleType: VehicleType.SUV, hasAC: true, plateNumber: 'AKL2345' },
      pickup:  { location: geoPoint('epworth'),  address: LOCATIONS.epworth.address },
      dropoff: { location: geoPoint('ruwa'),  address: LOCATIONS.ruwa.address },
      waypoints: [],
      departureTime: daysAgo(1),
      estimatedArrivalTime: new Date(daysAgo(1).getTime() + 40 * 60000),
      estimatedDurationMins: 40,
      estimatedDistanceKm: 15.3,
      pricePerSeat: 1.3,
      availableSeats: 3,
      totalSeats: 3,
      recurring: RecurringPattern.NONE,
      preferences: { womenOnly: false, smokingAllowed: true, petsAllowed: false, luggageSize: 'none', maxDetourMins: 5 },
      cancelledAt: daysAgo(1),
      cancellationReason: 'Driver had a personal emergency',
    },
  ];

  // A straight-line polyline between the ends, so search along the route works
  for (const ride of ridesPayload as Array<{ pickup: { location: { coordinates: number[] } }; dropoff: { location: { coordinates: number[] } }; routePolyline?: string }>) {
    const at = (p: { location: { coordinates: number[] } }) => ({ lat: p.location.coordinates[1], lng: p.location.coordinates[0] });
    ride.routePolyline = encodePolyline([at(ride.pickup), at(ride.dropoff)]);
  }
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
      pickup:  { location: geoPoint('avondale'),    address: LOCATIONS.avondale.address },
      dropoff: { location: geoPoint('cbd'), address: LOCATIONS.cbd.address },
      estimatedFare: 1.8, finalFare: 1.8,
      matchScore: 92,
      paymentMethod: 'online',
      driverEarnings: 1.53, platformFee: 0.27,
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
      pickup:  { location: geoPoint('avondale'),    address: LOCATIONS.avondale.address },
      dropoff: { location: geoPoint('cbd'), address: LOCATIONS.cbd.address },
      estimatedFare: 1.8, finalFare: 1.8,
      matchScore: 88,
      paymentMethod: 'online',
      driverEarnings: 1.53, platformFee: 0.27,
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
      pickup:  { location: geoPoint('borrowdale'), address: LOCATIONS.borrowdale.address },
      dropoff: { location: geoPoint('mountPleasant'),  address: LOCATIONS.mountPleasant.address },
      estimatedFare: 1.5, finalFare: 1.5,
      matchScore: 95,
      paymentMethod: 'online',
      driverEarnings: 1.27, platformFee: 0.23,
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
      pickup:  { location: geoPoint('ruwa'), address: LOCATIONS.ruwa.address },
      dropoff: { location: geoPoint('belgravia'), address: LOCATIONS.belgravia.address },
      estimatedFare: 6.4, finalFare: 6.4,
      matchScore: 78,
      paymentMethod: 'online',
      driverEarnings: 5.44, platformFee: 0.96,
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
      pickup:  { location: geoPoint('mbare'),   address: LOCATIONS.mbare.address },
      dropoff: { location: geoPoint('chitungwiza'), address: LOCATIONS.chitungwiza.address },
      estimatedFare: 4, finalFare: 4,
      matchScore: 85,
      paymentMethod: 'online',
      driverEarnings: 3.4, platformFee: 0.6,
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
      pickup:  { location: geoPoint('mountPleasant'), address: LOCATIONS.mountPleasant.address },
      dropoff: { location: geoPoint('westgate'), address: LOCATIONS.westgate.address },
      estimatedFare: 2, finalFare: undefined,
      matchScore: 90,
      paymentMethod: 'online',
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
      pickup:  { location: geoPoint('epworth'),     address: LOCATIONS.epworth.address },
      dropoff: { location: geoPoint('cbd'), address: LOCATIONS.cbd.address },
      estimatedFare: 2.5,
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
      pickup:  { location: geoPoint('epworth'), address: LOCATIONS.epworth.address },
      dropoff: { location: geoPoint('ruwa'), address: LOCATIONS.ruwa.address },
      estimatedFare: 1.3,
      matchScore: 70,
      paymentMethod: 'online',
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
      pickup:  { location: geoPoint('mabvuku'),   address: LOCATIONS.mabvuku.address },
      dropoff: { location: geoPoint('cbd'), address: LOCATIONS.cbd.address },
      estimatedFare: 2.8,
      matchScore: 75,
      paymentMethod: 'online',
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
      amount: 1.8, currency: 'USD', status: PaymentStatus.CAPTURED,
      method: PaymentMethod.ECOCASH,
      reference: 'BK-seed-00001', paynowReference: '14000001',
      driverPayout: 1.53, platformCommission: 0.27, platformCommissionRate: 0.15,
      settlementStatus: 'settled' as const, settlementDate: daysAgo(4),
      metadata: { rideType: 'car_pool', seats: 1 },
      idempotencyKey: 'idem_pay_001',
    },
    {
      booking: bookingIds[1], rider: riderIds[3], driver: driverIds[0],
      amount: 1.8, currency: 'USD', status: PaymentStatus.CAPTURED,
      method: PaymentMethod.CARD,
      reference: 'BK-seed-00002', paynowReference: '14000002',
      driverPayout: 1.53, platformCommission: 0.27, platformCommissionRate: 0.15,
      settlementStatus: 'settled' as const, settlementDate: daysAgo(4),
      metadata: { rideType: 'car_pool', seats: 1 },
      idempotencyKey: 'idem_pay_002',
    },
    {
      booking: bookingIds[2], rider: riderIds[1], driver: driverIds[1],
      amount: 1.5, currency: 'USD', status: PaymentStatus.CAPTURED,
      method: PaymentMethod.WALLET,
      reference: 'BK-seed-00003', paynowReference: '14000003',
      driverPayout: 1.27, platformCommission: 0.23, platformCommissionRate: 0.15,
      settlementStatus: 'settled' as const, settlementDate: daysAgo(2),
      metadata: { rideType: 'car_pool', seats: 1 },
      idempotencyKey: 'idem_pay_003',
    },
    {
      booking: bookingIds[3], rider: riderIds[4], driver: driverIds[2],
      amount: 6.4, currency: 'USD', status: PaymentStatus.CAPTURED,
      method: PaymentMethod.ECOCASH,
      reference: 'BK-seed-00004', paynowReference: '14000004',
      driverPayout: 5.44, platformCommission: 0.96, platformCommissionRate: 0.15,
      settlementStatus: 'settled' as const, settlementDate: daysAgo(6),
      metadata: { rideType: 'trip_pool', seats: 2 },
      idempotencyKey: 'idem_pay_004',
    },
    {
      booking: bookingIds[4], rider: riderIds[2], driver: driverIds[0],
      amount: 4, currency: 'USD', status: PaymentStatus.CAPTURED,
      method: PaymentMethod.ONEMONEY,
      reference: 'BK-seed-00005', paynowReference: '14000005',
      driverPayout: 3.4, platformCommission: 0.6, platformCommissionRate: 0.15,
      settlementStatus: 'settled' as const, settlementDate: daysAgo(1),
      metadata: { rideType: 'parcel_pool', seats: 1 },
      idempotencyKey: 'idem_pay_005',
    },
    {
      booking: bookingIds[5], rider: riderIds[5], driver: driverIds[3],
      amount: 2, currency: 'USD', status: PaymentStatus.AUTHORIZED,
      method: PaymentMethod.ECOCASH,
      reference: 'BK-seed-00006', paynowReference: '14000006',
      driverPayout: 1.7, platformCommission: 0.3, platformCommissionRate: 0.15,
      settlementStatus: 'pending' as const,
      metadata: { rideType: 'car_pool', seats: 1 },
      idempotencyKey: 'idem_pay_006',
    },
    {
      booking: bookingIds[7], rider: riderIds[3], driver: driverIds[4],
      amount: 1.3, currency: 'USD', status: PaymentStatus.REFUNDED,
      method: PaymentMethod.ECOCASH,
      reference: 'BK-seed-late-1',
      refundId: 'rfnd_seed_00001', refundAmount: 1.3,
      refundReason: 'Driver cancelled ride',
      driverPayout: 0, platformCommission: 0, platformCommissionRate: 0.15,
      settlementStatus: 'settled' as const,
      metadata: { rideType: 'car_pool', seats: 1 },
      idempotencyKey: 'idem_pay_007',
    },
    {
      booking: bookingIds[8], rider: riderIds[2], driver: driverIds[2],
      amount: 2.8, currency: 'USD', status: PaymentStatus.FAILED,
      reference: 'BK-seed-late-2',
      driverPayout: 0, platformCommission: 0, platformCommissionRate: 0.15,
      settlementStatus: 'pending' as const,
      failureReason: 'EcoCash payment cancelled',
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
    { _id: walletIds[driverIds[0].toString()], userId: driverIds[0], balance: 23.4, coinBalance: 580, tier: RewardTier.GOLD,     totalRidesCompleted: 128, lifetimeTopUp: 50, lifetimeSpent: 32, lifetimeCoinsEarned: 640,  lifetimeCoinsConverted: 60,  isLocked: false },
    { _id: walletIds[driverIds[1].toString()], userId: driverIds[1], balance: 18.2, coinBalance: 340, tier: RewardTier.SILVER,   totalRidesCompleted: 87,  lifetimeTopUp: 30, lifetimeSpent: 18, lifetimeCoinsEarned: 435,  lifetimeCoinsConverted: 95,  isLocked: false },
    { _id: walletIds[driverIds[2].toString()], userId: driverIds[2], balance: 45, coinBalance: 920, tier: RewardTier.PLATINUM, totalRidesCompleted: 210, lifetimeTopUp: 20, lifetimeSpent: 8,  lifetimeCoinsEarned: 1050, lifetimeCoinsConverted: 130, isLocked: false },
    { _id: walletIds[driverIds[3].toString()], userId: driverIds[3], balance: 6.8,  coinBalance: 120, tier: RewardTier.BRONZE,   totalRidesCompleted: 42,  lifetimeTopUp: 20, lifetimeSpent: 41, lifetimeCoinsEarned: 210,  lifetimeCoinsConverted: 90,  isLocked: false },
    { _id: walletIds[driverIds[4].toString()], userId: driverIds[4], balance: 3.2,  coinBalance: 60,  tier: RewardTier.BRONZE,   totalRidesCompleted: 12,  lifetimeTopUp: 10, lifetimeSpent: 2,  lifetimeCoinsEarned: 60,   lifetimeCoinsConverted: 0,   isLocked: false },
    // Riders
    { _id: walletIds[riderIds[0].toString()], userId: riderIds[0], balance: 15, coinBalance: 210, tier: RewardTier.SILVER, totalRidesCompleted: 34, lifetimeTopUp: 100, lifetimeSpent: 82,  lifetimeCoinsEarned: 340, lifetimeCoinsConverted: 130, isLocked: false },
    { _id: walletIds[riderIds[1].toString()], userId: riderIds[1], balance: 9,  coinBalance: 155, tier: RewardTier.SILVER, totalRidesCompleted: 22, lifetimeTopUp: 60,  lifetimeSpent: 51,  lifetimeCoinsEarned: 220, lifetimeCoinsConverted: 65,  isLocked: false },
    { _id: walletIds[riderIds[2].toString()], userId: riderIds[2], balance: 4.5,  coinBalance: 40,  tier: RewardTier.BRONZE, totalRidesCompleted: 8,  lifetimeTopUp: 25,  lifetimeSpent: 19,  lifetimeCoinsEarned: 80,  lifetimeCoinsConverted: 40,  isLocked: false },
    { _id: walletIds[riderIds[3].toString()], userId: riderIds[3], balance: 32, coinBalance: 480, tier: RewardTier.GOLD,   totalRidesCompleted: 51, lifetimeTopUp: 150, lifetimeSpent: 123, lifetimeCoinsEarned: 510, lifetimeCoinsConverted: 30,  isLocked: false },
    { _id: walletIds[riderIds[4].toString()], userId: riderIds[4], balance: 7.5,  coinBalance: 90,  tier: RewardTier.BRONZE, totalRidesCompleted: 17, lifetimeTopUp: 50,  lifetimeSpent: 42,  lifetimeCoinsEarned: 170, lifetimeCoinsConverted: 80,  isLocked: false },
    { _id: walletIds[riderIds[5].toString()], userId: riderIds[5], balance: 12, coinBalance: 200, tier: RewardTier.SILVER, totalRidesCompleted: 29, lifetimeTopUp: 80,  lifetimeSpent: 68,  lifetimeCoinsEarned: 290, lifetimeCoinsConverted: 90,  isLocked: false },
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
      type: WalletTransactionType.TOPUP, amount: 20, balanceBefore: 0, balanceAfter: 20,
      status: WalletTransactionStatus.COMPLETED, gatewayReference: 'WT-seed-001',
      description: 'Wallet top-up via EcoCash', idempotencyKey: 'wt_idem_001',
    },
    // Rider 0 — debit for ride
    {
      wallet: walletIds[riderIds[0].toString()], userId: riderIds[0],
      type: WalletTransactionType.DEBIT, amount: 1.8, balanceBefore: 20, balanceAfter: 18.2,
      status: WalletTransactionStatus.COMPLETED, bookingId: bookingIds[0],
      description: 'Ride payment — Avondale to Harare CBD', idempotencyKey: 'wt_idem_002',
    },
    // Driver 0 — credit for completed ride
    {
      wallet: walletIds[driverIds[0].toString()], userId: driverIds[0],
      type: WalletTransactionType.TOPUP, amount: 1.53, balanceBefore: 21.87, balanceAfter: 23.4,
      status: WalletTransactionStatus.COMPLETED, bookingId: bookingIds[0],
      description: 'Ride earnings — Avondale to Harare CBD', idempotencyKey: 'wt_idem_003',
    },
    // Rider 1 — top-up via card
    {
      wallet: walletIds[riderIds[1].toString()], userId: riderIds[1],
      type: WalletTransactionType.TOPUP, amount: 10, balanceBefore: 5, balanceAfter: 15,
      status: WalletTransactionStatus.COMPLETED, gatewayReference: 'WT-seed-002',
      description: 'Wallet top-up via card', idempotencyKey: 'wt_idem_004',
    },
    // Rider 1 — coin conversion
    {
      wallet: walletIds[riderIds[1].toString()], userId: riderIds[1],
      type: WalletTransactionType.COIN_CONVERSION, amount: 0.65, balanceBefore: 15, balanceAfter: 15.65,
      status: WalletTransactionStatus.COMPLETED, coinsConverted: 650,
      description: '650 coins converted to US$0.65 wallet balance', idempotencyKey: 'wt_idem_005',
    },
    // Rider 3 — top-up
    {
      wallet: walletIds[riderIds[3].toString()], userId: riderIds[3],
      type: WalletTransactionType.TOPUP, amount: 50, balanceBefore: 0, balanceAfter: 50,
      status: WalletTransactionStatus.COMPLETED, gatewayReference: 'WT-seed-003',
      description: 'Wallet top-up via EcoCash', idempotencyKey: 'wt_idem_006',
    },
    // Rider 3 — refund
    {
      wallet: walletIds[riderIds[3].toString()], userId: riderIds[3],
      type: WalletTransactionType.REFUND, amount: 1.3, balanceBefore: 30.7, balanceAfter: 32,
      status: WalletTransactionStatus.COMPLETED, bookingId: bookingIds[7],
      description: 'Refund — Driver cancelled ride', idempotencyKey: 'wt_idem_007',
    },
    // Driver 2 — top-up (pending)
    {
      wallet: walletIds[driverIds[2].toString()], userId: driverIds[2],
      type: WalletTransactionType.TOPUP, amount: 8, balanceBefore: 37, balanceAfter: 45,
      status: WalletTransactionStatus.PENDING, gatewayReference: 'WT-seed-004',
      description: 'Wallet top-up via OneMoney', idempotencyKey: 'wt_idem_008',
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
      type: CoinTransactionType.EARNED, coins: 18, balanceBefore: 1.92, balanceAfter: 2.1,
      bookingId: bookingIds[0],
      description: 'Coins earned for completing ride', expiresAt: hoursFromNow(24 * 365),
    },
    // Rider 0 — bonus coins
    {
      wallet: walletIds[riderIds[0].toString()], userId: riderIds[0],
      type: CoinTransactionType.BONUS, coins: 50, balanceBefore: 1.42, balanceAfter: 1.92,
      description: 'Welcome bonus coins', expiresAt: hoursFromNow(24 * 365),
    },
    // Rider 3 — earned coins
    {
      wallet: walletIds[riderIds[3].toString()], userId: riderIds[3],
      type: CoinTransactionType.EARNED, coins: 64, balanceBefore: 4.16, balanceAfter: 4.8,
      bookingId: bookingIds[3],
      description: 'Coins earned for completing trip-pool ride', expiresAt: hoursFromNow(24 * 365),
    },
    // Rider 1 — converted coins
    {
      wallet: walletIds[riderIds[1].toString()], userId: riderIds[1],
      type: CoinTransactionType.CONVERTED, coins: 650, balanceBefore: 8.05, balanceAfter: 1.55,
      walletTransactionId: walletTxs[4]._id,
      description: 'Converted 650 coins to US$0.65',
    },
    // Driver 2 — earned coins
    {
      wallet: walletIds[driverIds[2].toString()], userId: driverIds[2],
      type: CoinTransactionType.EARNED, coins: 64, balanceBefore: 8.56, balanceAfter: 9.2,
      bookingId: bookingIds[3],
      description: 'Driver coins for completing trip-pool ride', expiresAt: hoursFromNow(24 * 365),
    },
    // Driver 0 — bonus for first 100 rides milestone
    {
      wallet: walletIds[driverIds[0].toString()], userId: driverIds[0],
      type: CoinTransactionType.BONUS, coins: 100, balanceBefore: 4.8, balanceAfter: 5.8,
      description: '100-ride milestone bonus',
    },
    // Rider 5 — earned and spent coins
    {
      wallet: walletIds[riderIds[5].toString()], userId: riderIds[5],
      type: CoinTransactionType.EARNED, coins: 29, balanceBefore: 2.61, balanceAfter: 2.9,
      description: 'Coins earned for referral reward', expiresAt: hoursFromNow(24 * 365),
    },
    {
      wallet: walletIds[riderIds[5].toString()], userId: riderIds[5],
      type: CoinTransactionType.SPENT, coins: 90, balanceBefore: 2.9, balanceAfter: 2,
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
      score: 5, tags: ['cleanliness', 'punctuality', 'safety', 'comfort'], comment: 'Best carpooling experience! Nyasha is an awesome driver.',
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
    { booking: bookingIds[0], sender: riderIds[0],  receiver: driverIds[0], content: 'Hi Tendai! I am at the pickup spot, by the service station.', contentType: 'text', isRead: true,  readAt: daysAgo(5) },
    { booking: bookingIds[0], sender: driverIds[0], receiver: riderIds[0],  content: 'Coming in 2 minutes, white Axio AEA1234 🚗', contentType: 'text', isRead: true,  readAt: daysAgo(5) },
    { booking: bookingIds[0], sender: riderIds[0],  receiver: driverIds[0], content: 'Okay, I can see you!', contentType: 'text', isRead: true,  readAt: daysAgo(5) },
    // Chat for booking 2
    { booking: bookingIds[2], sender: riderIds[1],  receiver: driverIds[1], content: 'Hello Nyasha, just confirming the pickup in Borrowdale?', contentType: 'text', isRead: true,  readAt: daysAgo(3) },
    { booking: bookingIds[2], sender: driverIds[1], receiver: riderIds[1],  content: 'Yes, I will be outside Borrowdale Village at 8:30 AM sharp. Silver Toyota Corolla.', contentType: 'text', isRead: true,  readAt: daysAgo(3) },
    { booking: bookingIds[2], sender: riderIds[1],  receiver: driverIds[1], content: 'Perfect, see you then!', contentType: 'text', isRead: true,  readAt: daysAgo(3) },
    // Chat for active booking 5
    { booking: bookingIds[5], sender: driverIds[3], receiver: riderIds[5],  content: 'Chiedza, I am 5 minutes away. Please be ready.', contentType: 'text', isRead: true,  readAt: new Date(Date.now() - 25 * 60000) },
    { booking: bookingIds[5], sender: riderIds[5],  receiver: driverIds[3], content: 'Yes, waiting at the main gate!', contentType: 'text', isRead: true,  readAt: new Date(Date.now() - 24 * 60000) },
    { booking: bookingIds[5], sender: driverIds[3], receiver: riderIds[5],  content: 'Great, on my way!', contentType: 'text', isRead: false },
    // Chat for pending booking 6
    { booking: bookingIds[6], sender: riderIds[0],  receiver: driverIds[1], content: 'Hi, please confirm if pickup at the Epworth turn-off is fine.', contentType: 'text', isRead: false },
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
      triggerLocation: geoPoint('belgravia'),
      locationHistory: [
        { location: geoPoint('belgravia'), timestamp: daysAgo(7) },
        { location: geoPoint('mbare'), timestamp: new Date(daysAgo(7).getTime() + 5 * 60000) },
      ],
      audioRecordingUrls: ['https://example.com/sos/audio/sos_001.mp3'],
      screenshotUrls: ['https://example.com/sos/screenshots/sos_001.jpg'],
      emergencyContactsNotified: [
        { name: 'Fadzai Gumbo', phone: '+263776500041', notifiedAt: daysAgo(7), method: 'sms' as const },
      ],
      adminNotifiedAt: daysAgo(7),
      adminAssignee: adminId,
      liveTrackingUrl: 'https://siham.vercel.app/sos/live/sos_001',
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
      triggerLocation: geoPoint('westgate'),
      locationHistory: [
        { location: geoPoint('mountPleasant'), timestamp: new Date(Date.now() - 15 * 60000) },
        { location: geoPoint('westgate'), timestamp: new Date(Date.now() - 10 * 60000) },
      ],
      audioRecordingUrls: [],
      screenshotUrls: [],
      emergencyContactsNotified: [
        { name: 'Tafadzwa Banda', phone: '+263776500051', notifiedAt: new Date(Date.now() - 10 * 60000), method: 'call' as const },
      ],
      adminNotifiedAt: new Date(Date.now() - 9 * 60000),
      adminAssignee: adminId,
      liveTrackingUrl: 'https://siham.vercel.app/sos/live/sos_002',
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
