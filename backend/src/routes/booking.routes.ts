import { Router } from 'express';
import { BookingController } from '../controllers/BookingController';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createBookingSchema } from '../validators';

const router = Router();

router.use(authenticate);

// List bookings — MUST be before /:id
router.get('/as-rider', BookingController.getRiderBookings);
router.get('/as-driver', BookingController.getDriverBookings);

// Create booking
router.post('/', validate(createBookingSchema), BookingController.createBooking);

// Booking actions
router.post('/:id/confirm', BookingController.confirmBooking);
router.post('/:id/reject', BookingController.rejectBooking);
router.post('/:id/cancel', BookingController.cancelBooking);
router.post('/:id/complete', BookingController.completeBooking);

export default router;
