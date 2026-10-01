import { Router } from 'express';
import { RideController } from '../controllers/RideController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireActiveAccount } from '../middlewares/accountStatus.middleware';
import { requireDriverVerification } from '../middlewares/capability.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createRideSchema, updateRideSchema, priceSuggestionSchema, searchRideSchema, updateDriverLocationSchema, tripPositionSchema } from '../validators';

const router = Router();

// All ride routes require authentication
router.use(authenticate);

// Search MUST be before /:id to avoid route conflict
router.get('/search', validate(searchRideSchema), RideController.searchRides);

// Upcoming rides booked by the rider — MUST be before /:id
router.get('/upcoming', RideController.getUpcomingRides);

// Driver's own rides — MUST be before /:id
router.get('/my-rides', RideController.getMyRides);

// Demand prediction — AI-powered insights for drivers
router.get('/demand-prediction', RideController.getDemandPrediction);

// Suggested seat price for a route (UC-D02) — MUST be before /:id
router.get('/price-suggestion', validate(priceSuggestionSchema), RideController.priceSuggestion);

// Driver live tracking updates (recommended every 5 seconds)
router.post(
	'/driver/location',
	requireDriverVerification(),
	validate(updateDriverLocationSchema),
	RideController.updateDriverLocation,
);

// Any phone on a ride in progress, from the app's background task: the car
// (driver) every 5 s, riders from pickup to drop. Stored as the trip trail.
router.post('/:id/position', validate(tripPositionSchema), RideController.tripPosition);

// Create ride — requires verified driver
router.post('/', requireDriverVerification(), requireActiveAccount, validate(createRideSchema), RideController.createRide);

// Single ride
router.get('/:id', RideController.getRide);

// Ride actions
router.patch('/:id', requireDriverVerification(), validate(updateRideSchema), RideController.updateRide);
router.post('/:id/cancel', RideController.cancelRide);
router.post('/:id/message', requireDriverVerification(), RideController.messageRiders);
router.post('/:id/start', requireDriverVerification(), RideController.startRide);
router.post('/:id/complete', requireDriverVerification(), RideController.completeRide);
router.post('/:id/optimize', requireDriverVerification(), RideController.optimizeRoute);

export default router;

