import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { Notification } from '../models/Notification';
import { sendSuccess, sendPaginated, paginate } from '../utils/helpers';
import { NotFoundError, AuthorizationError } from '../utils/AppError';
import { queryInt } from '../utils/request';

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
      const page = queryInt(req, 'page', 1);
      const limit = queryInt(req, 'limit', 20);

      const pageNum = Math.max(page || 1, 1);
      const limitNum = Math.max(limit || 20, 1);

      const [notifications, total] = await Promise.all([
        Notification.find({ user: user.userId })
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum),
        Notification.countDocuments({ user: user.userId }),
      ]);

      const result = paginate(notifications, total, pageNum, limitNum);
      sendPaginated(res, result, req.requestId);
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

      sendSuccess(res, { unreadCount }, 200, req.requestId);
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

      sendSuccess(res, { notification }, 200, req.requestId);
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
        req.requestId,
      );
    } catch (error) {
      next(error);
    }
  }
}
