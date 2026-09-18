import { Router } from 'express';
import { ParcelPoolingController } from '../controllers/ParcelPoolingController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireCapability } from '../middlewares/capability.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
  createParcelValidator,
  acceptParcelValidator,
  deliverParcelValidator,
  cancelParcelValidator,
  trackParcelValidator,
  listParcelsValidator,
} from '../validators';
import { UserCapability } from '../types';

const router = Router();

router.use(authenticate);

/**
 * POST /api/v1/parcels/create
 * Create a new parcel pooling request
 */
router.post('/create', validate(createParcelValidator), ParcelPoolingController.createParcelRequest);

/**
 * POST /api/v1/parcels/:id/accept
 * Accept a parcel delivery request (assigned driver only)
 */
router.post(
  '/:id/accept',
  requireCapability(UserCapability.DRIVER),
  validate(acceptParcelValidator),
  ParcelPoolingController.acceptParcelRequest,
);

/**
 * POST /api/v1/parcels/:id/pickup
 * Mark parcel as picked up (assigned driver only)
 */
router.post(
  '/:id/pickup',
  requireCapability(UserCapability.DRIVER),
  validate(acceptParcelValidator),
  ParcelPoolingController.pickupParcel,
);

/**
 * POST /api/v1/parcels/:id/deliver
 * Complete parcel delivery with proof and the recipient's delivery code
 */
router.post(
  '/:id/deliver',
  requireCapability(UserCapability.DRIVER),
  validate(deliverParcelValidator),
  ParcelPoolingController.completeDelivery,
);

/**
 * GET /api/v1/parcels/track/:trackingNumber
 * Track parcel by tracking number (sender, receiver, driver or admin)
 */
router.get('/track/:trackingNumber', validate(trackParcelValidator), ParcelPoolingController.trackParcel);

/**
 * GET /api/v1/parcels
 * List user's parcels
 */
router.get('/', validate(listParcelsValidator), ParcelPoolingController.listParcels);

/**
 * POST /api/v1/parcels/:id/cancel
 * Cancel parcel delivery (sender only)
 */
router.post('/:id/cancel', validate(cancelParcelValidator), ParcelPoolingController.cancelParcel);

export default router;
