/**
 * EmergencyContactService.ts
 *
 * Emergency contacts (UC-R10): up to three, one of them primary, each with
 * a choice of whether they get the SOS text. A contact is verified by a text
 * with a link they open and confirm; one who never confirms stays usable,
 * marked unverified (7a).
 */

import crypto from 'crypto';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { config } from '../config';
import { IEmergencyContact } from '../types';
import { AppError, NotFoundError } from '../utils/AppError';
import { NotificationService } from './NotificationService';

export const MAX_EMERGENCY_CONTACTS = 3;
/** How long a verification link works */
const LINK_TTL_MS = 7 * 86_400_000;
/** At most one verification text per contact in this time */
const RESEND_AFTER_MS = 10 * 60_000;

type ContactInput = { name: string; phone: string; relation: string; email?: string; primary?: boolean; notifyOnSos?: boolean };

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** What the app sees: no token hash, and a simple verified flag */
function view(c: IEmergencyContact) {
  return {
    _id: c._id?.toString(),
    name: c.name,
    phone: c.phone,
    relation: c.relation,
    email: c.email,
    primary: Boolean(c.primary),
    notifyOnSos: c.notifyOnSos !== false,
    verified: Boolean(c.verifiedAt),
    verificationSentAt: c.verifySentAt,
  };
}

export class EmergencyContactService {
  async list(userId: string) {
    const user = await User.findById(userId).select('+emergencyContacts.verifyTokenHash').lean();
    if (!user) throw new NotFoundError('User');
    let contacts = user.emergencyContacts ?? [];
    // Contacts saved before they had ids get one, so the app can verify them
    if (contacts.some((c) => !c._id)) {
      contacts = contacts.map((c) => ({ ...c, _id: c._id ?? new Types.ObjectId() }));
      await User.updateOne({ _id: userId }, { $set: { emergencyContacts: contacts } });
    }
    return contacts.map(view);
  }

  /**
   * Replaces the list. A contact whose number is unchanged keeps its
   * verification; a new or changed number starts unverified. Exactly one
   * contact is primary: the one marked, or else the first.
   */
  async replace(userId: string, contacts: ContactInput[]) {
    if (contacts.length > MAX_EMERGENCY_CONTACTS) {
      throw new AppError(`You can have up to ${MAX_EMERGENCY_CONTACTS} emergency contacts`, 422, 'VALIDATION_ERROR');
    }
    const phones = contacts.map((c) => c.phone);
    if (new Set(phones).size !== phones.length) throw new AppError('Each contact needs a different phone number', 422, 'VALIDATION_ERROR');

    const user = await User.findById(userId).select('+emergencyContacts.verifyTokenHash').lean();
    if (!user) throw new NotFoundError('User');
    const before = new Map(user.emergencyContacts.map((c) => [c.phone, c]));
    const primaryIndex = Math.max(0, contacts.findIndex((c) => c.primary));

    const next: IEmergencyContact[] = contacts.map((c, i) => {
      const old = before.get(c.phone);
      return {
        _id: old?._id ?? new Types.ObjectId(),
        name: c.name,
        phone: c.phone,
        relation: c.relation,
        email: c.email || undefined,
        primary: i === primaryIndex,
        notifyOnSos: c.notifyOnSos !== false,
        verifiedAt: old?.verifiedAt,
        verifyTokenHash: old?.verifyTokenHash,
        verifySentAt: old?.verifySentAt,
      };
    });
    // Only this field changes, so the rest of the profile is not revalidated
    await User.updateOne({ _id: userId }, { $set: { emergencyContacts: next } });
    return next.map(view);
  }

  /** Texts the contact a link to confirm they agree to be called in an emergency */
  async sendVerification(userId: string, contactId: string): Promise<{ sentTo: string }> {
    const user = await User.findById(userId).select('name emergencyContacts');
    if (!user) throw new NotFoundError('User');
    const contact = user.emergencyContacts.find((c) => c._id?.toString() === contactId);
    if (!contact) throw new NotFoundError('Emergency contact');
    if (contact.verifiedAt) throw new AppError(`${contact.name} has already confirmed`, 409, 'ALREADY_VERIFIED');
    if (contact.verifySentAt && Date.now() - contact.verifySentAt.getTime() < RESEND_AFTER_MS) {
      throw new AppError('A text was sent a few minutes ago. Wait 10 minutes before sending another.', 429, 'VERIFY_RATE_LIMITED');
    }
    const sms = new NotificationService();
    if (!sms.smsAvailable()) {
      throw new AppError('Text messages are not available right now. The contact still gets SOS alerts by any other means we have.', 503, 'SMS_UNAVAILABLE');
    }

    const token = crypto.randomBytes(24).toString('base64url');
    const firstName = (user.name || 'A Poolora user').split(' ')[0];
    await sms.sendSMS(
      contact.phone,
      `${firstName} added you as an emergency contact on Poolora. If they raise an SOS on a ride, you'll get a text with their live location. Please confirm: ${config.app.baseUrl}/track/contact/${token}`,
    );
    await User.updateOne(
      { _id: userId, 'emergencyContacts._id': contact._id },
      { $set: { 'emergencyContacts.$.verifyTokenHash': hash(token), 'emergencyContacts.$.verifySentAt': new Date() } },
    );
    return { sentTo: contact.phone };
  }

  /** Who a verification link is for, without changing anything (GET is safe for link previews) */
  async peek(token: string): Promise<{ userFirstName: string; contactName: string; verified: boolean } | null> {
    const found = await this.findByToken(token);
    if (!found) return null;
    return { userFirstName: found.userFirstName, contactName: found.contact.name, verified: Boolean(found.contact.verifiedAt) };
  }

  /** The contact confirmed on the page */
  async confirm(token: string): Promise<{ userFirstName: string; contactName: string } | null> {
    const found = await this.findByToken(token);
    if (!found) return null;
    await User.updateOne(
      { _id: found.userId, 'emergencyContacts._id': found.contact._id },
      { $set: { 'emergencyContacts.$.verifiedAt': new Date() } },
    );
    const notifications = new NotificationService();
    const message = `${found.contact.name} confirmed they are your emergency contact.`;
    await notifications.createNotification(found.userId, 'Emergency contact confirmed', message, 'system').catch(() => undefined);
    await notifications.sendPushNotification(found.userId, 'Emergency contact confirmed', message, { type: 'emergency_contact' }).catch(() => undefined);
    return { userFirstName: found.userFirstName, contactName: found.contact.name };
  }

  private async findByToken(token: string) {
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
    const tokenHash = hash(token);
    const user = await User.findOne({
      emergencyContacts: { $elemMatch: { verifyTokenHash: tokenHash, verifySentAt: { $gt: new Date(Date.now() - LINK_TTL_MS) } } },
    }).select('+emergencyContacts.verifyTokenHash');
    const contact = user?.emergencyContacts.find((c) => c.verifyTokenHash === tokenHash);
    if (!user || !contact) return null;
    return { userId: user._id.toString(), userFirstName: (user.name || 'Someone').split(' ')[0], contact };
  }
}
