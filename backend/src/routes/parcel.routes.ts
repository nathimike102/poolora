import { Router } from 'express';
import { ParcelPoolingController } from '../controllers/ParcelPoolingController';
import { requireAuth, requireCapability } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createParcelValidator, acceptParcelValidator } from '../validators';

const router = Router();

/**
 * POST /api/v1/parcels/create
 * Create a new parcel pooling request
 */
router.post(
  '/create',
  requireAuth(),
  validate(createParcelValidator),
  ParcelPoolingController.createParcelRequest
);

/**
 * POST /api/v1/parcels/:id/accept
 * Accept a parcel delivery request
 */
router.post(
  '/:id/accept',
  requireAuth(),
  requireCapability('driver'),
  ParcelPoolingController.acceptParcelRequest
);

/**
 * POST /api/v1/parcels/:id/pickup
 * Mark parcel as picked up
 */
router.post(
  '/:id/pickup',
  requireAuth(),
  requireCapability('driver'),
  ParcelPoolingController.pickupParcel
);

/**
 * POST /api/v1/parcels/:id/deliver
 * Complete parcel delivery with proof
 */
router.post(
  '/:id/deliver',
  requireAuth(),
  requireCapability('driver'),
  ParcelPoolingController.completeDelivery
);

/**
 * GET /api/v1/parcels/track/:trackingNumber
 * Track parcel by tracking number
 */
router.get(
  '/track/:trackingNumber',
  requireAuth(),
  ParcelPoolingController.trackParcel
);

/**
 * GET /api/v1/parcels
 * List user's parcels
 */
router.get(
  '/',
  requireAuth(),
  ParcelPoolingController.listParcels
);

/**
 * POST /api/v1/parcels/:id/cancel
 * Cancel parcel delivery
 */
router.post(
  '/:id/cancel',
  requireAuth(),
  ParcelPoolingController.cancelParcel
);

export default router;