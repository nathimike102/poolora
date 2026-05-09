import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { Notification } from '../models/Notification';
import { sendSuccess, sendPaginated, paginate } from '../utils/helpers';
import { NotFoundError, AuthorizationError } from '../utils/AppError';

export class NotificationController {
  /**
   * GET /api/v1/notifications
   * Get notifications for logged-in user.
   */
  static async getNotifications(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { page = '1', limit = '20' } = req.query as any;

      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.max(parseInt(limit, 10) || 20, 1);

      const [notifications, total] = await Promise.all([
        Notification.find({ user: user.userId })
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum),
        Notification.countDocuments({ user: user.userId }),
      ]);

      const result = paginate(notifications, total, pageNum, limitNum);
      sendPaginated(res, result, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/notifications/unread-count
   * Get unread notification count.
   */
  static async getUnreadCount(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;

      const unreadCount = await Notification.countDocuments({
        user: user.userId,
        isRead: false,
      });

      sendSuccess(res, { unreadCount }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   * Mark one notification as read.
   */
  static async markAsRead(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const notificationId = String(req.params.id);

      const notification = await Notification.findById(notificationId);
      if (!notification) {
        throw new NotFoundError('Notification');
      }

      if (notification.user.toString() !== user.userId) {
        throw new AuthorizationError('You are not allowed to access this notification');
      }

      notification.isRead = true;
      await notification.save();

      sendSuccess(res, { notification }, 200, (req as any).requestId);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/read-all
   * Mark all notifications as read for logged-in user.
   */
  static async markAllAsRead(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;

      const result = await Notification.updateMany(
        { user: user.userId, isRead: false },
        { $set: { isRead: true } },
      );

      sendSuccess(
        res,
        { markedCount: result.modifiedCount },
        200,
        (req as any).requestId,
      );
    } catch (error) {
      next(error);
    }
  }
}