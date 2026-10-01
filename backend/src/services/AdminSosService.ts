/**
 * AdminSosService.ts
 *
 * The web admin's view of SOS incidents (UC-A03): every incident, not only
 * active ones, with the rider, driver and ride in one place, and a
 * communications log kept on the incident's timeline.
 */

import { Types } from 'mongoose';
import { EmergencyRecord } from '../models/EmergencyRecord';
import { Message } from '../models/Message';
import { CallLog } from '../models/CallLog';
import { GatewayCharge } from '../models/GatewayCharge';
import { WithdrawalRequest } from '../models/WithdrawalRequest';
import { Booking } from '../models/Booking';
import { User } from '../models/User';
import { SOSStatus } from '../types';
import { AppError, NotFoundError } from '../utils/AppError';
import { audit } from './AuditService';
import { SafetyService } from './SafetyService';
import { REGION } from '../config/region';

const PERSON = 'name phone email gender profilePhotoUrl emergencyContacts stats warnings isSuspended isBlocked identity.status kyc.licenseNumber kyc.status createdAt';

export class AdminSosService {
  private safety = new SafetyService();

  async list(params: { status?: string; page: number; limit: number }) {
    const filter: Record<string, unknown> = {};
    if (params.status === 'open') filter.status = { $in: [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED] };
    else if (params.status) filter.status = params.status;
    const [incidents, total] = await Promise.all([
      EmergencyRecord.find(filter)
        .select('status riskLevel monitoringState triggerLocation missedCheckIns createdAt resolvedAt policeNotifiedAt triggeredBy booking userSafeAt lostContactAt cancelledAt contactsState adminAssignee')
        .populate('triggeredBy', 'name phone')
        .sort({ createdAt: -1 })
        .skip((params.page - 1) * params.limit)
        .limit(params.limit)
        .lean(),
      EmergencyRecord.countDocuments(filter),
    ]);
    return { incidents, total, page: params.page, limit: params.limit };
  }

  async detail(id: string) {
    const record = await EmergencyRecord.findById(id).lean();
    if (!record) throw new NotFoundError('Emergency record');
    const booking = await Booking.findById(record.booking)
      .populate('ride', 'pickup dropoff departureTime startedAt status vehicle routePolyline')
      .lean();
    const [rider, driver] = await Promise.all([
      booking ? User.findById(booking.rider).select(PERSON).lean() : null,
      booking ? User.findById(booking.driver).select(PERSON).lean() : null,
    ]);
    const triggeredByRole = booking && record.triggeredBy.toString() === booking.rider.toString() ? 'rider' : 'driver';
    // Earlier SOS from the same person (UC-R07: false alarms are tracked). Shown
    // to the team, never used to hold back a response or warn automatically.
    const since = new Date(Date.now() - 90 * 86_400_000);
    const [earlier, falseAlarms] = await Promise.all([
      EmergencyRecord.countDocuments({ triggeredBy: record.triggeredBy, _id: { $ne: record._id }, createdAt: { $gte: since } }),
      EmergencyRecord.countDocuments({ triggeredBy: record.triggeredBy, _id: { $ne: record._id }, status: SOSStatus.FALSE_ALARM, createdAt: { $gte: since } }),
    ]);
    // Stored recordings are private: 15-minute links for the admin to play them
    const { presignSosDownload } = await import('./UploadService');
    const sign = (url: string) => (url.startsWith('s3://') ? presignSosDownload(url).catch(() => null) : Promise.resolve(url));
    const evidence = [
      ...(await Promise.all((record.audioRecordingUrls ?? []).map(async (u) => ({ type: 'audio' as const, url: await sign(u) })))),
      ...(await Promise.all((record.screenshotUrls ?? []).map(async (u) => ({ type: 'screenshot' as const, url: await sign(u) })))),
    ];
    const identify = booking ? await this.identification(record, booking) : null;
    return { record, booking, rider, driver, triggeredByRole, history: { days: 90, earlier, falseAlarms }, emergencyNumbers: REGION.emergency, evidence, ...identify };
  }

  /**
   * What the team (and the police) need to find and identify everyone on the
   * ride: the car in full, every other rider (a witness, or an accomplice),
   * the mobile money numbers each person has used (registered to a real
   * name), the chat and calls between them, and where every phone went.
   */
  private async identification(
    record: { ride: Types.ObjectId; booking: Types.ObjectId; createdAt: Date },
    booking: { _id: Types.ObjectId; rider: Types.ObjectId; driver: Types.ObjectId; ride: unknown },
  ) {
    const ride = booking.ride as { _id: Types.ObjectId; startedAt?: Date; vehicle?: { vehicleId: Types.ObjectId; plateNumber: string } } | null;
    const [driverDoc, others, messages, calls] = await Promise.all([
      User.findById(booking.driver).select('vehicles').lean(),
      Booking.find({ ride: record.ride, _id: { $ne: booking._id }, status: { $in: ['confirmed', 'completed'] } })
        .select('rider status pickup.address dropoff.address actualPickupTime actualDropoffTime')
        .populate('rider', 'name phone profilePhotoUrl identity.status')
        .lean(),
      Message.find({ booking: booking._id }).select('sender content contentType createdAt').sort({ createdAt: 1 }).limit(200).lean(),
      CallLog.find({ booking: booking._id }).select('caller callee status createdAt recordingDurationSec').sort({ createdAt: 1 }).lean(),
    ]);

    const car = driverDoc?.vehicles?.find((v) => String(v._id) === String(ride?.vehicle?.vehicleId));
    const { presignKycDownload } = await import('./UploadService');
    const photos = await Promise.all((car?.photos ?? []).map((p) => presignKycDownload(p).catch(() => null)));
    const vehicle = car
      ? {
        make: car.make, model: car.model, color: car.color, year: car.year, plateNumber: car.plateNumber, vehicleType: car.vehicleType, photos: photos.filter(Boolean),
        // The car's own GPS tracker, which keeps reporting when every phone is off
        tracker: car.tracker ? { deviceId: car.tracker.deviceId, lastReportAt: car.tracker.lastReportAt ?? null } : null,
      }
      : ride?.vehicle ? { plateNumber: ride.vehicle.plateNumber, photos: [] } : null;

    const people = [booking.rider, booking.driver, ...others.map((o) => (o.rider as unknown as { _id: Types.ObjectId })._id)];
    const [charges, payouts] = await Promise.all([
      GatewayCharge.find({ user: { $in: people }, phone: { $exists: true, $ne: '' } }).select('user phone channel').sort({ createdAt: -1 }).limit(200).lean(),
      WithdrawalRequest.find({ user: { $in: people } }).select('user payNumber channel').sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    const moneyNumbers: Record<string, Array<{ phone: string; channel: string }>> = {};
    for (const c of [...charges.map((c) => ({ user: c.user, phone: c.phone!, channel: c.channel })), ...payouts.map((w) => ({ user: w.user, phone: w.payNumber, channel: w.channel }))]) {
      const list = (moneyNumbers[String(c.user)] ??= []);
      if (!list.some((x) => x.phone === c.phone)) list.push({ phone: c.phone, channel: c.channel });
    }

    // Every phone's trail from the start of the ride (or two hours before the SOS)
    const { rideTrails } = await import('./TripTrailService');
    const from = ride?.startedAt ?? new Date(record.createdAt.getTime() - 2 * 3_600_000);
    const trails = await rideTrails(record.ride, from);

    return { vehicle, coPassengers: others, moneyNumbers, messages, calls, trails };
  }

  /** A call, a message or an action, written to the incident's timeline (UC-A03 step 5). */
  async addLog(id: string, adminId: string, text: unknown) {
    const note = typeof text === 'string' ? text.trim() : '';
    if (!note) throw new AppError('The note is empty', 422, 'VALIDATION_ERROR');
    const admin = await User.findById(adminId).select('name').lean();
    const record = await EmergencyRecord.findByIdAndUpdate(
      id,
      { $push: { timeline: { event: 'Admin note', timestamp: new Date(), details: `${admin?.name ?? 'Admin'}: ${note.slice(0, 1000)}` } } },
      { new: true },
    );
    if (!record) throw new NotFoundError('Emergency record');
    await audit(adminId, 'sos.note', 'sos', id, note.slice(0, 200));
    return record;
  }

  async acknowledge(id: string, adminId: string) {
    const record = await this.safety.acknowledgeSOS(id, adminId);
    await audit(adminId, 'sos.acknowledge', 'sos', id);
    return record;
  }

  async resolve(id: string, adminId: string, notes: unknown, isFalseAlarm: unknown) {
    const text = typeof notes === 'string' ? notes.trim() : '';
    if (text.length < 5) throw new AppError('Record how the incident was resolved', 422, 'VALIDATION_ERROR');
    const record = await this.safety.resolveSOS(id, adminId, text, isFalseAlarm === true);
    await audit(adminId, isFalseAlarm === true ? 'sos.false_alarm' : 'sos.resolve', 'sos', id, text);
    return record;
  }

  async notifyPolice(id: string, adminId: string, notes: unknown) {
    const text = typeof notes === 'string' ? notes.trim() : undefined;
    const record = await this.safety.notifyPolice(id, adminId, text);
    await audit(adminId, 'sos.police', 'sos', id, text);
    return record;
  }
}
