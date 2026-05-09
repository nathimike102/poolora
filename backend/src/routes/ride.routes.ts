import { Router } from 'express';
import { RideController } from '../controllers/RideController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireDriverVerification } from '../middlewares/capability.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createRideSchema, searchRideSchema, updateDriverLocationSchema } from '../validators';

const router = Router();

// All ride routes require authentication
router.use(authenticate);

// Search MUST be before /:id to avoid route conflict
router.get('/search', validate(searchRideSchema), RideController.searchRides);

// Upcoming rides booked by the rider — MUST be before /:id
router.get('/upcoming', RideController.getUpcomingRides);

// Driver's own rides — MUST be before /:id
router.get('/my-rides', RideController.getMyRides);

// Driver live tracking updates (recommended every 5 seconds)
router.post(
	'/driver/location',
	requireDriverVerification(),
	validate(updateDriverLocationSchema),
	RideController.updateDriverLocation,
);

// Create ride — requires verified driver
router.post('/', requireDriverVerification(), validate(createRideSchema), RideController.createRide);

// Single ride
router.get('/:id', RideController.getRide);

// Ride actions
router.post('/:id/cancel', RideController.cancelRide);
router.post('/:id/complete', requireDriverVerification(), RideController.completeRide);

export default router;

