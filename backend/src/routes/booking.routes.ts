import { Router } from 'express';
import { BookingController } from '../controllers/BookingController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireActiveAccount } from '../middlewares/accountStatus.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createBookingSchema } from '../validators';

const router = Router();

router.use(authenticate);

// List bookings — MUST be before /:id
router.get('/as-rider', BookingController.getRiderBookings);
router.get('/as-driver', BookingController.getDriverBookings);

// Create booking
router.post('/quote', validate(createBookingSchema), BookingController.quote);
router.post('/', requireActiveAccount, validate(createBookingSchema), BookingController.createBooking);

// Booking actions
router.get('/:id/cancellation-quote', BookingController.getCancellationQuote);
router.get('/:id/receipt', BookingController.receipt);
router.post('/:id/receipt/email', BookingController.emailReceipt);
router.post('/:id/share', BookingController.share);
router.post('/:id/confirm', BookingController.confirmBooking);
router.post('/:id/reject', BookingController.rejectBooking);
router.post('/:id/cancel', BookingController.cancelBooking);
router.post('/:id/complete', BookingController.completeBooking);

// Per-rider steps during the ride (UC-D04, UC-D07)
router.post('/:id/arrived', BookingController.arrived);
// The driver enters the rider's 4-digit pickup code (body: pin)
router.post('/:id/picked-up', BookingController.pickedUp);
// The rider confirms they are in the car, when the code cannot be exchanged
router.post('/:id/in-car', BookingController.riderInCar);
router.post('/:id/dropped-off', BookingController.droppedOff);
router.post('/:id/no-show', BookingController.noShow);

export default router;
