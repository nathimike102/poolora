/**
 * ParcelEvidenceService.ts
 *
 * Photo proof for parcels (UC-P03) and claims for damaged or lost parcels
 * (UC-P05).
 *
 * Photos: the driver photographs the parcel at pickup and at delivery (both
 * required unless PARCEL_PHOTO_PROOF=optional); the sender or recipient adds
 * photos to a claim. Photos go to S3 when AWS keys are set, otherwise into
 * MongoDB, so they work on any setup. Only the people on the parcel and
 * admins can open them.
 *
 * Claims: damage within 7 days of delivery; loss once a picked-up parcel is
 * 24 hours past its expected delivery. Insured parcels are covered up to
 * their declared value, others up to the delivery charge. With an insurer's
 * API configured (INSURANCE_CLAIMS_URL) the claim is also sent there. An
 * admin decides; approved claims are paid into the claimant's wallet.
 */

import { Types } from 'mongoose';
import axios from 'axios';
import { PutObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { ParcelPooling, IParcelPooling } from '../models/ParcelPooling';
import { ParcelPhoto, IParcelPhoto } from '../models/ParcelPhoto';
import { ParcelClaim } from '../models/ParcelClaim';
import '../models/User'; // claims populate their claimant
import { BookingStatus, UserCapability } from '../types';
import { config } from '../config';
import { AppError, AuthorizationError, ConflictError, NotFoundError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { audit } from './AuditService';
import { NotificationService } from './NotificationService';
import { WalletService } from './WalletService';
import { money } from '../config/region';

export type PhotoStage = IParcelPhoto['stage'];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PER_STAGE: Record<PhotoStage, number> = { pickup: 3, delivery: 3, claim: 6 };
const HOUR = 3_600_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

let s3client: S3Client | null = null;
const s3Enabled = () => Boolean(config.aws.accessKeyId && config.aws.secretAccessKey);
function s3(): S3Client {
  s3client ??= new S3Client({
    region: config.aws.region,
    credentials: { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey },
  });
  return s3client;
}

/** JPEG or PNG, judged by the file's first bytes rather than what the client says */
function sniff(buf: Buffer): IParcelPhoto['contentType'] | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

type Viewer = { userId: string; capabilities?: string[] };
const isAdmin = (v: Viewer) => Boolean(v.capabilities?.includes(UserCapability.ADMIN));
const party = (p: IParcelPooling, userId: string) =>
  [p.sender, p.receiver, p.driver].some((id) => id && id.toString() === userId);

async function tell(userId: string, title: string, body: string, data: Record<string, string>) {
  const n = new NotificationService();
  await Promise.allSettled([
    n.createNotification(userId, title, body, 'system', data),
    n.sendPushNotification(userId, title, body, { type: 'parcel', ...data }),
  ]);
}

export class ParcelEvidenceService {
  private wallet = new WalletService();

  // ── Photos (UC-P03) ───────────────────────────────────────────────────────

  async addPhoto(parcelId: string, userId: string, input: { stage: PhotoStage; data: string; lat?: number; lng?: number }) {
    const parcel = await this.parcel(parcelId);
    const { stage } = input;
    if (stage === 'pickup' || stage === 'delivery') {
      if (parcel.driver.toString() !== userId) throw new AuthorizationError('Only the driver takes pickup and delivery photos');
      if (parcel.status !== BookingStatus.CONFIRMED) throw new ConflictError('This parcel is not being delivered');
      if (stage === 'pickup' && parcel.actualPickupTime) throw new ConflictError('The parcel has already been picked up');
      if (stage === 'delivery' && !parcel.actualPickupTime) throw new ConflictError('Pick the parcel up first');
    } else if (![parcel.sender, parcel.receiver].some((id) => id?.toString() === userId)) {
      throw new AuthorizationError('Only the sender or recipient can add claim photos');
    }
    if ((await ParcelPhoto.countDocuments({ parcel: parcel._id, stage, uploadedBy: userId })) >= MAX_PER_STAGE[stage]) {
      throw new AppError(`At most ${MAX_PER_STAGE[stage]} photos here`, 409, 'TOO_MANY_PHOTOS');
    }

    const buf = Buffer.from(String(input.data ?? '').replace(/^data:image\/\w+;base64,/, ''), 'base64');
    if (!buf.length) throw new AppError('The photo is empty', 422, 'VALIDATION_ERROR');
    if (buf.length > MAX_PHOTO_BYTES) throw new AppError('The photo is over 5 MB; take it again at a lower quality', 413, 'PHOTO_TOO_LARGE');
    const contentType = sniff(buf);
    if (!contentType) throw new AppError('Send a JPEG or PNG photo', 415, 'UNSUPPORTED_FILE_TYPE');

    const location = Number.isFinite(input.lat) && Number.isFinite(input.lng)
      ? { type: 'Point' as const, coordinates: [Number(input.lng), Number(input.lat)] as [number, number] }
      : undefined;
    const base = { parcel: parcel._id, stage, uploadedBy: new Types.ObjectId(userId), contentType, bytes: buf.length, location };

    let photo: IParcelPhoto | null = null;
    if (s3Enabled()) {
      const key = `parcels/${parcel._id}/${stage}/${uuidv4()}.${contentType === 'image/png' ? 'png' : 'jpg'}`;
      try {
        await s3().send(new PutObjectCommand({ Bucket: config.aws.s3Bucket, Key: key, Body: buf, ContentType: contentType, ServerSideEncryption: 'AES256' }));
        photo = await ParcelPhoto.create({ ...base, storage: 's3', s3Key: key });
      } catch (error) {
        // The driver is standing at the pickup: keep the photo rather than fail
        logger.error('Parcel photo upload to S3 failed; stored in the database', { parcelId, error: (error as Error).message });
      }
    }
    photo ??= await ParcelPhoto.create({ ...base, storage: 'db', data: buf });
    return { photo: this.view(photo) };
  }

  async listPhotos(parcelId: string, viewer: Viewer) {
    const parcel = await this.parcel(parcelId);
    if (!party(parcel, viewer.userId) && !isAdmin(viewer)) throw new NotFoundError('Parcel');
    const photos = await ParcelPhoto.find({ parcel: parcel._id }).sort({ createdAt: 1 });
    return { photos: photos.map((p) => this.view(p)) };
  }

  /** The image itself, for the app and the web admin */
  async photoFile(parcelId: string, photoId: string, viewer: Viewer): Promise<{ contentType: string; body: Buffer }> {
    const parcel = await this.parcel(parcelId);
    if (!party(parcel, viewer.userId) && !isAdmin(viewer)) throw new NotFoundError('Photo');
    if (!Types.ObjectId.isValid(photoId)) throw new NotFoundError('Photo');
    const photo = await ParcelPhoto.findOne({ _id: photoId, parcel: parcel._id }).select('+data');
    if (!photo) throw new NotFoundError('Photo');
    if (photo.storage === 'db') return { contentType: photo.contentType, body: Buffer.from(photo.data!) };
    const res = await s3().send(new GetObjectCommand({ Bucket: config.aws.s3Bucket, Key: photo.s3Key }));
    const body = Buffer.from(await res.Body!.transformToByteArray());
    return { contentType: photo.contentType, body };
  }

  /** Throws unless the driver has photographed the parcel for this stage */
  async requirePhoto(parcel: IParcelPooling, stage: 'pickup' | 'delivery') {
    if (!config.parcel.photoProofRequired) return;
    if (!(await ParcelPhoto.exists({ parcel: parcel._id, stage, uploadedBy: parcel.driver }))) {
      throw new AppError(`Take a photo of the parcel at ${stage} first`, 409, 'PHOTO_REQUIRED');
    }
  }

  private view(p: IParcelPhoto) {
    return {
      id: p._id.toString(),
      stage: p.stage,
      uploadedBy: p.uploadedBy.toString(),
      bytes: p.bytes,
      takenAt: p.createdAt,
      location: p.location?.coordinates ? { lat: p.location.coordinates[1], lng: p.location.coordinates[0] } : undefined,
      path: `/parcels/${p.parcel}/photos/${p._id}`,
    };
  }

  // ── Claims (UC-P05) ───────────────────────────────────────────────────────

  async fileClaim(parcelId: string, userId: string, input: { kind: 'damaged' | 'lost'; description: string; amount: number; photoIds?: string[] }) {
    const parcel = await this.parcel(parcelId);
    if (![parcel.sender, parcel.receiver].some((id) => id?.toString() === userId)) {
      throw new AuthorizationError('Only the sender or recipient can claim for this parcel');
    }
    const now = Date.now();
    if (input.kind === 'damaged') {
      if (parcel.status !== BookingStatus.COMPLETED || !parcel.actualDeliveryTime) throw new ConflictError('Damage can be claimed once the parcel is delivered');
      if (now - parcel.actualDeliveryTime.getTime() > config.parcel.claimWindowDays * 24 * HOUR) {
        throw new ConflictError(`Damage must be claimed within ${config.parcel.claimWindowDays} days of delivery`);
      }
    } else {
      const overdue = parcel.actualPickupTime && !parcel.actualDeliveryTime
        && now - new Date(parcel.estimatedDeliveryTime).getTime() > config.parcel.lostAfterHours * HOUR;
      if (!overdue) throw new ConflictError(`A parcel can be claimed as lost ${config.parcel.lostAfterHours} hours after it was due, if it has not arrived`);
    }
    if (await ParcelClaim.exists({ parcel: parcel._id, status: { $in: ['submitted', 'with_insurer', 'approved'] } })) {
      throw new ConflictError('A claim for this parcel is already open or paid');
    }

    const insured = Boolean(parcel.insuranceValue && parcel.insuranceValue > 0);
    const coverLimit = round2(insured ? parcel.insuranceValue! : parcel.estimatedCost);
    const amount = round2(Number(input.amount));
    if (!(amount >= 1)) throw new AppError('Say how much you are claiming', 422, 'VALIDATION_ERROR');
    if (amount > coverLimit) {
      throw new AppError(`This parcel is covered up to ${money(coverLimit)}${insured ? ' (its declared value)' : ' (the delivery charge; it was not insured)'}`, 422, 'OVER_COVER');
    }
    const photoIds = [...new Set(input.photoIds ?? [])].filter((id) => Types.ObjectId.isValid(id));
    const photos = await ParcelPhoto.find({ _id: { $in: photoIds }, parcel: parcel._id, stage: 'claim', uploadedBy: userId }).select('_id');
    if (input.kind === 'damaged' && !photos.length) throw new AppError('Add at least one photo of the damage', 422, 'PHOTO_REQUIRED');

    const claim = await ParcelClaim.create({
      parcel: parcel._id,
      claimant: new Types.ObjectId(userId),
      kind: input.kind,
      description: input.description.trim().slice(0, 2000),
      amountClaimed: amount,
      coverLimit,
      insured,
      photos: photos.map((p) => p._id),
    });

    const reference = await this.sendToInsurer(claim._id.toString(), parcel, { kind: input.kind, amount, description: claim.description, photos: photos.length });
    if (reference) {
      claim.status = 'with_insurer';
      claim.insurerReference = reference;
      await claim.save();
    }
    await tell(userId, 'Claim received', `We have your ${input.kind} parcel claim for ${money(amount)}. We will tell you when it is decided.`, { parcelId });
    return { claim };
  }

  async claimsForParcel(parcelId: string, viewer: Viewer) {
    const parcel = await this.parcel(parcelId);
    if (!party(parcel, viewer.userId) && !isAdmin(viewer)) throw new NotFoundError('Parcel');
    return { claims: await ParcelClaim.find({ parcel: parcel._id }).sort({ createdAt: -1 }).lean() };
  }

  async adminList(status = 'open'): Promise<{ claims: Array<Record<string, unknown>>; insurerConnected: boolean }> {
    const filter = status === 'open' ? { status: { $in: ['submitted', 'with_insurer'] } } : status === 'all' ? {} : { status };
    const claims = await ParcelClaim.find(filter)
      .sort({ createdAt: status === 'open' ? 1 : -1 })
      .limit(100)
      .populate('claimant', 'name phone')
      .populate('parcel', 'trackingNumber parcelType estimatedCost insuranceValue status actualPickupTime actualDeliveryTime estimatedDeliveryTime pickupLocation.address deliveryLocation.address driver sender')
      .populate('decidedBy', 'name')
      .lean();
    const parcelIds = claims.map((c) => (c.parcel as unknown as { _id: Types.ObjectId })?._id).filter(Boolean);
    const photos = await ParcelPhoto.find({ parcel: { $in: parcelIds } }).sort({ createdAt: 1 });
    const byParcel = new Map<string, ReturnType<ParcelEvidenceService['view']>[]>();
    for (const p of photos) {
      const list = byParcel.get(p.parcel.toString()) ?? [];
      list.push(this.view(p));
      byParcel.set(p.parcel.toString(), list);
    }
    return {
      claims: claims.map((c): Record<string, unknown> => ({ ...c, evidence: byParcel.get(String((c.parcel as unknown as { _id: Types.ObjectId })?._id)) ?? [] })),
      insurerConnected: Boolean(config.insurance.claimsUrl),
    };
  }

  /** An admin approves (paying into the claimant's wallet) or rejects a claim */
  async decide(claimId: string, adminId: string, input: { decision: 'approve' | 'reject'; payout?: number; note: string; insurerReference?: string }) {
    if (!Types.ObjectId.isValid(claimId)) throw new NotFoundError('Claim');
    const note = String(input.note ?? '').trim();
    if (note.length < 5) throw new AppError('Explain the decision in a few words; the claimant sees it', 422, 'VALIDATION_ERROR');
    const claim = await ParcelClaim.findById(claimId);
    if (!claim) throw new NotFoundError('Claim');
    if (!['submitted', 'with_insurer'].includes(claim.status)) throw new ConflictError('This claim has already been decided');

    const approve = input.decision === 'approve';
    const payout = approve ? round2(Number(input.payout ?? claim.amountClaimed)) : 0;
    if (approve && (!(payout > 0) || payout > claim.coverLimit)) {
      throw new AppError(`Pay between ${money(1)} and ${money(claim.coverLimit)}`, 422, 'VALIDATION_ERROR');
    }
    const decided = await ParcelClaim.findOneAndUpdate(
      { _id: claim._id, status: { $in: ['submitted', 'with_insurer'] } },
      {
        $set: {
          status: approve ? 'approved' : 'rejected',
          payout,
          decidedBy: new Types.ObjectId(adminId),
          decidedAt: new Date(),
          decisionNote: note,
          ...(input.insurerReference ? { insurerReference: String(input.insurerReference).slice(0, 100) } : {}),
        },
      },
      { new: true },
    );
    if (!decided) throw new ConflictError('This claim has already been decided');
    if (approve) {
      await this.wallet.credit(claim.claimant.toString(), payout, `Parcel claim ${claim._id}: ${claim.kind} parcel`, `parcel_claim_${claim._id}`);
    }
    await audit(adminId, approve ? 'parcel_claim.approve' : 'parcel_claim.reject', 'parcel', claim.parcel.toString(), note, { claimId, payout });
    await tell(
      claim.claimant.toString(),
      approve ? 'Claim approved' : 'Claim not approved',
      approve ? `${money(payout)} has been added to your Siham wallet. ${note}` : note,
      { parcelId: claim.parcel.toString() },
    );
    return { claim: decided };
  }

  /** Sends the claim to the insurer's API when one is configured; returns its reference */
  private async sendToInsurer(claimId: string, parcel: IParcelPooling, c: { kind: string; amount: number; description: string; photos: number }) {
    if (!config.insurance.claimsUrl) return undefined;
    try {
      const { data } = await axios.post(
        config.insurance.claimsUrl,
        {
          externalId: claimId,
          trackingNumber: parcel.trackingNumber,
          kind: c.kind,
          amountClaimed: c.amount,
          declaredValue: parcel.insuranceValue ?? 0,
          premium: parcel.insuranceCost ?? 0,
          description: c.description,
          photoCount: c.photos,
          pickedUpAt: parcel.actualPickupTime,
          deliveredAt: parcel.actualDeliveryTime,
        },
        { timeout: 10_000, headers: config.insurance.apiKey ? { Authorization: `Bearer ${config.insurance.apiKey}` } : {} },
      );
      return String(data?.reference ?? data?.id ?? data?.claimId ?? '') || undefined;
    } catch (error) {
      logger.error('Insurer claim submission failed; the claim stays with admins', { claimId, error: (error as Error).message });
      return undefined;
    }
  }

  private async parcel(parcelId: string) {
    if (!Types.ObjectId.isValid(parcelId)) throw new NotFoundError('Parcel');
    const parcel = await ParcelPooling.findById(parcelId);
    if (!parcel) throw new NotFoundError('Parcel');
    return parcel;
  }
}
