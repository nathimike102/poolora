import { Router } from 'express';
import { ParcelPoolingController } from '../controllers/ParcelPoolingController';
import { authenticate } from '../middlewares/auth.middleware';
import { requireActiveAccount } from '../middlewares/accountStatus.middleware';
import { requireCapability } from '../middlewares/capability.middleware';
import { validate } from '../middlewares/validation.middleware';
import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ParcelEvidenceService } from '../services/ParcelEvidenceService';
import { sendSuccess } from '../utils/helpers';
import type { AuthenticatedRequest } from '../types';
import {
  createParcelValidator,
  parcelQuoteValidator,
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
router.get('/quote', validate(parcelQuoteValidator), ParcelPoolingController.quote);
router.post('/create', requireActiveAccount, validate(createParcelValidator), ParcelPoolingController.createParcelRequest);

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
 * POST /api/v1/parcels/:id/reject
 * Decline a parcel request (assigned driver only); the sender is refunded
 */
router.post(
  '/:id/reject',
  requireCapability(UserCapability.DRIVER),
  validate(cancelParcelValidator),
  ParcelPoolingController.rejectParcelRequest,
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

// ── Photo proof (UC-P03) and claims (UC-P05) ─────────────────────────────────

const evidence = new ParcelEvidenceService();
const viewer = (req: Request) => {
  const { user } = req as AuthenticatedRequest;
  return { userId: user.userId, capabilities: user.capabilities };
};
const run = (fn: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await fn(req), status, req.requestId);
  } catch (error) {
    next(error);
  }
};
const parcelId = Joi.string().hex().length(24).required();

/** POST /parcels/:id/photos — { stage, data (base64 JPEG or PNG, up to 5 MB), lat?, lng? } */
router.post(
  '/:id/photos',
  validate({
    params: Joi.object({ id: parcelId }),
    body: Joi.object({
      stage: Joi.string().valid('pickup', 'delivery', 'claim').required(),
      data: Joi.string().max(7_000_000).required(),
      lat: Joi.number().min(-90).max(90),
      lng: Joi.number().min(-180).max(180),
    }),
  }),
  run((req) => evidence.addPhoto(String(req.params.id), viewer(req).userId, req.body), 201),
);

router.get('/:id/photos', validate({ params: Joi.object({ id: parcelId }) }), run((req) => evidence.listPhotos(String(req.params.id), viewer(req))));

/** GET /parcels/:id/photos/:photoId — the image (sender, recipient, driver or admin) */
router.get(
  '/:id/photos/:photoId',
  validate({ params: Joi.object({ id: parcelId, photoId: parcelId }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = await evidence.photoFile(String(req.params.id), String(req.params.photoId), viewer(req));
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.status(200).send(file.body);
    } catch (error) {
      next(error);
    }
  },
);

/** POST /parcels/:id/claims — { kind: damaged|lost, description, amount, photoIds[] } */
router.post(
  '/:id/claims',
  validate({
    params: Joi.object({ id: parcelId }),
    body: Joi.object({
      kind: Joi.string().valid('damaged', 'lost').required(),
      description: Joi.string().trim().min(10).max(2000).required(),
      amount: Joi.number().min(1).max(1_000_000).required(),
      photoIds: Joi.array().items(Joi.string().hex().length(24)).max(6).default([]),
    }),
  }),
  run((req) => evidence.fileClaim(String(req.params.id), viewer(req).userId, req.body), 201),
);

router.get('/:id/claims', validate({ params: Joi.object({ id: parcelId }) }), run((req) => evidence.claimsForParcel(String(req.params.id), viewer(req))));

export default router;
