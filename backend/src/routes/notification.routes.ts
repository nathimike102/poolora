import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { paginationSchema } from '../validators';

const router = Router();

router.use(authenticate);

// Must be before /:id
router.get('/unread-count', NotificationController.getUnreadCount);
router.patch('/read-all', NotificationController.markAllAsRead);

router.get('/', validate(paginationSchema), NotificationController.getNotifications);
router.patch('/:id/read', NotificationController.markAsRead);

export default router;