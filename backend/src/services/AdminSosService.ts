/**
 * AdminSosService.ts
 *
 * The web admin's view of SOS incidents (UC-A03): every incident, not only
 * active ones, with the rider, driver and ride in one place, and a
 * communications log kept on the incident's timeline.
 */

import { EmergencyRecord } from '../models/EmergencyRecord';
import { Booking } from '../models/Booking';
import { User } from '../models/User';
import { SOSStatus } from '../types';
import { AppError, NotFoundError } from '../utils/AppError';
import { audit } from './AuditService';
import { SafetyService } from './SafetyService';

const PERSON = 'name phone email gender profilePhotoUrl emergencyContacts stats warnings isSuspended isBlocked';

export class AdminSosService {
  private safety = new SafetyService();

  async list(params: { status?: string; page: number; limit: number }) {
    const filter: Record<string, unknown> = {};
    if (params.status === 'open') filter.status = { $in: [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED] };
    else if (params.status) filter.status = params.status;
    const [incidents, total] = await Promise.all([
      EmergencyRecord.find(filter)
        .select('status riskLevel monitoringState triggerLocation missedCheckIns createdAt resolvedAt policeNotifiedAt triggeredBy booking')
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
    return { record, booking, rider, driver, triggeredByRole };
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
