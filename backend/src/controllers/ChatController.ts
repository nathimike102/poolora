import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../services/ChatService';
import { AuthenticatedRequest } from '../types';
import { sendSuccess, sendPaginated } from '../utils/helpers';

const chatService = new ChatService();

export class ChatController {
  /**
   * POST /api/v1/chat/messages
   * Send a message in a booking chat.
   */
  static async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const message = await chatService.sendMessage(user.userId, req.body);
      sendSuccess(res, { message }, 201, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/chat/:bookingId/messages
   * Get chat history for a booking.
   */
  static async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { page = '1', limit = '50' } = req.query as any;
      const result = await chatService.getMessages(
        user.userId,
        String(req.params.bookingId),
        parseInt(page),
        parseInt(limit),
      );
      sendPaginated(res, result, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/chat/:bookingId/read
   * Mark all messages as read.
   */
  static async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const count = await chatService.markAsRead(user.userId, String(req.params.bookingId));
      sendSuccess(res, { markedRead: count }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/chat/unread-count
   * Get total unread message count.
   */
  static async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const count = await chatService.getUnreadCount(user.userId);
      sendSuccess(res, { unreadCount: count }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }
}
