/**
 * SafetyAlerts.ts
 *
 * Who hears about an SOS, and how.
 *
 * - The safety team (every admin) gets a push and an SMS the moment an SOS is
 *   raised, and again while nobody has taken it (UC-A03: respond within 5
 *   minutes). Paging does not depend on anyone having the dashboard open or
 *   having set up an alert rule.
 * - The person who raised it hears when the team takes it and when it closes,
 *   by push and on their open SOS screen.
 * - Emergency contacts get texts; those who use Siham also get a push.
 *
 * Nothing here throws: a failed channel is logged and the others still go.
 */

import { User } from '../models/User';
import { UserCapability } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';
import { NotificationService } from './NotificationService';
import type { Phrase } from '../i18n';

const notifications = new NotificationService();

/** A phone number texts can go to (users who signed in with Google have a placeholder) */
const textable = (phone?: string): phone is string => Boolean(phone && phone.startsWith('+'));

/** Whether texts can actually be sent (Twilio enabled and set up) */
export function smsAvailable(): boolean {
  return notifications.smsAvailable();
}

/**
 * Pages every admin about an incident: push always, SMS unless `sms` is false.
 * Returns how many admins were reached by each.
 */
export async function pageSafetyTeam(
  emergencyId: string,
  headline: string,
  options: { sms?: boolean } = {},
): Promise<{ push: number; sms: number }> {
  const sent = { push: 0, sms: 0 };
  try {
    const admins = await User.find({
      capabilities: UserCapability.ADMIN,
      isBlocked: { $ne: true },
      closedAt: { $exists: false },
    }).select('phone').lean();
    // An empty id: a safety alert that is not an SOS (a car tracker alarm)
    const link = config.admin.webUrl ? ` ${config.admin.webUrl}${emergencyId ? `/sos/${emergencyId}` : '/sos'}` : '';
    const data: Record<string, string> = emergencyId ? { type: 'sos', emergencyId } : { type: 'safety_alert' };

    await Promise.all(admins.map(async (admin) => {
      await notifications.sendPushNotification(String(admin._id), 'SOS', headline, data);
      sent.push++;
      if (options.sms !== false && textable(admin.phone) && smsAvailable()) {
        try {
          await notifications.sendSMS(admin.phone, `Siham SOS: ${headline}.${link}`.slice(0, 320));
          sent.sms++;
        } catch {
          // Logged by sendSMS
        }
      }
    }));
  } catch (error) {
    logger.error('Could not page the safety team', { emergencyId, error: (error as Error).message });
  }
  return sent;
}

/** A push to every admin, for safety matters that are not an emergency in progress (a safety report on a rating). */
export async function pushAdmins(title: string, body: string, data: Record<string, string>): Promise<void> {
  try {
    const admins = await User.find({ capabilities: UserCapability.ADMIN, isBlocked: { $ne: true }, closedAt: { $exists: false } }).select('_id').lean();
    await Promise.all(admins.map((a) => notifications.sendPushNotification(String(a._id), title, body, data)));
  } catch (error) {
    logger.error('Could not push to admins', { error: (error as Error).message });
  }
}

/** Texts each number; returns the numbers the provider accepted. */
export async function textPeople(phones: string[], message: string): Promise<string[]> {
  if (!smsAvailable()) return [];
  const results = await Promise.allSettled(phones.filter(textable).map(async (phone) => {
    await notifications.sendSMS(phone, message);
    return phone;
  }));
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}

/** Pushes to the contacts who have Siham accounts, found by phone number. */
export async function pushToPhones(phones: string[], title: string | Phrase, body: string | Phrase, data: Record<string, string>): Promise<void> {
  try {
    const users = await User.find({ phone: { $in: phones.filter(textable) }, closedAt: { $exists: false } }).select('_id').lean();
    await Promise.all(users.map((u) => notifications.sendPushNotification(String(u._id), title, body, data)));
  } catch (error) {
    logger.warn('Could not push to emergency contacts', { error: (error as Error).message });
  }
}

/**
 * Tells the person who raised the SOS that something changed: a push (so it
 * reaches them outside the app) and a socket event their SOS screen listens for.
 */
export async function tellUser(
  userId: string,
  event: { emergencyId: string; change: string; title?: string | Phrase; body?: string | Phrase },
): Promise<void> {
  try {
    const { SocketGateway } = await import('../sockets/SocketGateway');
    SocketGateway.getInstance()?.getIO()?.to(`user:${userId}`).emit('sos:updated', { emergencyId: event.emergencyId, change: event.change });
  } catch (error) {
    logger.debug('Could not reach the user over the socket', { error: (error as Error).message });
  }
  if (event.title && event.body) {
    await notifications.sendPushNotification(userId, event.title, event.body, { type: 'sos', emergencyId: event.emergencyId });
  }
}
