import { Router } from 'express';
import authRoutes from './auth.routes';
import rideRoutes from './ride.routes';
import bookingRoutes from './booking.routes';
import paymentRoutes from './payment.routes';
import chatRoutes from './chat.routes';
import safetyRoutes from './safety.routes';
import ratingRoutes from './rating.routes';
import walletRoutes from './wallet.routes';
import mapsRoutes from './maps.routes';
import userRoutes from './user.routes';
import notificationRoutes from './notification.routes';
import parcelRoutes from './parcel.routes';
import adminRoutes from './admin.routes';
import trackRoutes from './track.routes';
import uploadRoutes from './upload.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/rides', rideRoutes);
router.use('/bookings', bookingRoutes);
router.use('/parcels', parcelRoutes);
router.use('/payments', paymentRoutes);
router.use('/chat', chatRoutes);
router.use('/safety', safetyRoutes);
router.use('/ratings', ratingRoutes);
router.use('/wallet', walletRoutes);
router.use('/maps', mapsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/track', trackRoutes);
router.use('/uploads', uploadRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'success',
    code: 200,
    data: { 
      service: 'mobility-backend',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
    requestId: '', 
  });
}); 

export default router;
