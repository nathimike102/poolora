import { Message, IMessage } from '../models/Message';
import { Booking } from '../models/Booking';
import { BookingStatus } from '../types';
import { AppError, NotFoundError, AuthorizationError } from '../utils/AppError';
import { paginate } from '../utils/helpers';
import { EventBridge } from '../events';
import Filter from 'bad-words';
import { NotificationService } from './NotificationService';

const profanityFilter = new Filter();

export class ChatService {
  /**
   * Send a message. Only allowed between driver and rider of a CONFIRMED booking.
   */
  private notificationService = new NotificationService();
  async sendMessage(
    senderId: string,
    data: {
      bookingId: string;
      content: string;
      contentType: 'text' | 'image' | 'location';
      clientMsgId?: string;
    },
  ): Promise<IMessage> {
    // 1. Idempotency check
    if (data.clientMsgId) {
      const existing = await Message.findOne({ clientMsgId: data.clientMsgId });
      if (existing) return existing;
    }

    const booking = await Booking.findById(data.bookingId);
    if (!booking) throw new NotFoundError('Booking');

    if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.COMPLETED) {
      throw new AppError('Chat is only available for confirmed bookings', 400);
    }

    // Verify sender is part of the booking
    const isRider = booking.rider.toString() === senderId;
    const isDriver = booking.driver.toString() === senderId;
    if (!isRider && !isDriver) {
      throw new AuthorizationError('You are not part of this booking');
    }

    const receiverId = isRider
      ? booking.driver.toString()
      : booking.rider.toString();

    // Profanity filter for text messages
    let sanitizedContent = data.content;
    if (data.contentType === 'text') {
      sanitizedContent = profanityFilter.clean(data.content);
    }

    const message = await Message.create({
      booking: data.bookingId,
      sender: senderId,
      receiver: receiverId,
      content: sanitizedContent,
      contentType: data.contentType,
      clientMsgId: data.clientMsgId,
    });
    await this.notificationService.createNotification(
    receiverId,
    "New Message",
    sanitizedContent,
    "chat",
  {
    bookingId: data.bookingId,
    messageId: message._id.toString(),
  }
);

    // The socket gateway handles real-time delivery
    // Push notification for offline user is handled via FCM
    EventBridge.publish('user-events', {
      eventType: 'chat.message.sent',
      data: {
        messageId: message._id,
        bookingId: data.bookingId,
        senderId,
        receiverId,
        contentType: data.contentType,
      },
    });

    return message;
  }

  /**
   * Get chat history for a booking.
   */
  async getMessages(
    userId: string,
    bookingId: string,
    page: number,
    limit: number,
  ) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    const isParticipant =
      booking.rider.toString() === userId ||
      booking.driver.toString() === userId;
    if (!isParticipant) {
      throw new AuthorizationError('You are not part of this booking');
    }

    const [messages, total] = await Promise.all([
      Message.find({ booking: bookingId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Message.countDocuments({ booking: bookingId }),
    ]);

    return paginate(messages.reverse(), total, page, limit);
  }

  /**
   * Mark messages as read.
   */
  async markAsRead(userId: string, bookingId: string): Promise<number> {
    const result = await Message.updateMany(
      {
        booking: bookingId,
        receiver: userId,
        isRead: false,
      },
      {
        $set: { isRead: true, readAt: new Date() },
      },
    );

    return result.modifiedCount;
  }

  /**
   * Get unread message count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return Message.countDocuments({
      receiver: userId,
      isRead: false,
    });
  }
}
