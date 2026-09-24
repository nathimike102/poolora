/**
 * SupportService.ts
 *
 * Support requests (UC-X02). A user opens a ticket in a category, and the
 * Poolora team replies in the same thread. Safety and payment tickets are
 * urgent and answered first; a safety ticket also alerts the admins at once.
 */

import { Types } from 'mongoose';
import { SupportTicket, SupportCategory, URGENT_CATEGORIES, ISupportTicket } from '../models/SupportTicket';
import { Booking } from '../models/Booking';
import { AppError, AuthorizationError, NotFoundError } from '../utils/AppError';
import { audit } from './AuditService';
import { emailUser } from './Mailer';
import { logger } from '../utils/logger';

/** Open tickets a user may have at once, so a loop cannot flood the queue */
const MAX_OPEN_TICKETS = 5;

export class SupportService {
  async create(userId: string, data: { category: SupportCategory; subject: string; message: string; bookingId?: string; appInfo?: string }) {
    const open = await SupportTicket.countDocuments({ user: userId, status: { $ne: 'closed' } });
    if (open >= MAX_OPEN_TICKETS) {
      throw new AppError(`You have ${open} open requests. We'll answer those first; add to one of them instead.`, 409, 'TOO_MANY_TICKETS');
    }
    if (data.bookingId) {
      const booking = await Booking.findById(data.bookingId).select('rider driver');
      if (!booking || (booking.rider.toString() !== userId && booking.driver.toString() !== userId)) {
        throw new AuthorizationError('That trip is not one of yours');
      }
    }
    const ticket = await SupportTicket.create({
      user: userId,
      category: data.category,
      subject: data.subject.trim(),
      booking: data.bookingId,
      priority: URGENT_CATEGORIES.includes(data.category) ? 'urgent' : 'normal',
      appInfo: data.appInfo,
      messages: [{ from: 'user', author: userId, text: data.message.trim(), at: new Date() }],
    });
    if (data.category === 'safety') await this.alertAdmins(ticket);
    return ticket;
  }

  async mine(userId: string) {
    return SupportTicket.find({ user: userId }).select('-messages.author -appInfo -assignedTo').sort({ updatedAt: -1 }).limit(50).lean();
  }

  async get(userId: string, ticketId: string) {
    const ticket = await SupportTicket.findOne({ _id: ticketId, user: userId }).select('-messages.author -appInfo -assignedTo').lean();
    if (!ticket) throw new NotFoundError('Support request');
    return ticket;
  }

  /** The user adds to their ticket; a closed one opens again */
  async reply(userId: string, ticketId: string, text: string) {
    const ticket = await SupportTicket.findOneAndUpdate(
      { _id: ticketId, user: userId },
      { $push: { messages: { from: 'user', author: userId, text: text.trim(), at: new Date() } }, $set: { status: 'open' }, $unset: { closedAt: 1 } },
      { new: true },
    ).select('-messages.author -appInfo -assignedTo');
    if (!ticket) throw new NotFoundError('Support request');
    return ticket;
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  /** Waiting tickets, urgent first, then oldest first */
  async queue(status: 'open' | 'answered' | 'closed' = 'open', category?: string) {
    const filter: Record<string, unknown> = { status };
    if (category) filter.category = category;
    const tickets = await SupportTicket.find(filter)
      .populate('user', 'name phone email')
      .populate('assignedTo', 'name')
      // 'urgent' comes after 'normal', so descending puts urgent first
      .sort(status === 'open' ? { priority: -1, createdAt: 1 } : { updatedAt: -1 })
      .limit(200)
      .lean();
    return { tickets };
  }

  async adminGet(ticketId: string) {
    const ticket = await SupportTicket.findById(ticketId)
      .populate('user', 'name phone email capabilities createdAt')
      .populate('messages.author', 'name')
      .populate('assignedTo', 'name')
      .populate('booking', 'status pickup.address dropoff.address createdAt')
      .lean();
    if (!ticket) throw new NotFoundError('Support request');
    return { ticket };
  }

  /** A reply from the team; the user is notified and can answer back */
  async adminReply(ticketId: string, adminId: string, text: string, close = false) {
    const body = text?.trim();
    if (!body) throw new AppError('Write a reply', 422, 'VALIDATION_ERROR');
    const ticket = await SupportTicket.findByIdAndUpdate(
      ticketId,
      {
        $push: { messages: { from: 'support', author: adminId, text: body, at: new Date() } },
        $set: { status: close ? 'closed' : 'answered', assignedTo: new Types.ObjectId(adminId), ...(close ? { closedAt: new Date() } : {}) },
      },
      { new: true },
    );
    if (!ticket) throw new NotFoundError('Support request');
    await audit(adminId, close ? 'support.reply_close' : 'support.reply', 'support', ticketId, undefined, { category: ticket.category });
    await this.tell(ticket, `Reply to "${ticket.subject}"`, body);
    return { ticket };
  }

  async close(ticketId: string, adminId: string) {
    const ticket = await SupportTicket.findByIdAndUpdate(ticketId, { $set: { status: 'closed', closedAt: new Date() } }, { new: true });
    if (!ticket) throw new NotFoundError('Support request');
    await audit(adminId, 'support.close', 'support', ticketId);
    return { ticket };
  }

  private async tell(ticket: ISupportTicket, title: string, message: string) {
    const { NotificationService } = await import('./NotificationService');
    const n = new NotificationService();
    const userId = ticket.user.toString();
    await Promise.allSettled([
      n.createNotification(userId, title, message.slice(0, 300), 'system', { ticketId: ticket._id.toString() }),
      n.sendPushNotification(userId, title, message.slice(0, 120), { type: 'support', ticketId: ticket._id.toString() }),
      emailUser(userId, title, message),
    ]);
  }

  private async alertAdmins(ticket: ISupportTicket) {
    try {
      const { SocketGateway } = await import('../sockets/SocketGateway');
      SocketGateway.getInstance()?.getIO()?.to('admin:sos').emit('support:safety', {
        ticketId: ticket._id.toString(),
        userId: ticket.user.toString(),
        subject: ticket.subject,
        at: new Date().toISOString(),
      });
    } catch (error) {
      logger.debug('Could not alert admins about a safety ticket', { error: (error as Error).message });
    }
  }
}
