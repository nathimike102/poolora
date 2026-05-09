import { Router } from 'express';
import { ChatController } from '../controllers/ChatController';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { sendMessageSchema } from '../validators';

const router = Router();

router.use(authenticate);

// Unread count — MUST be before /:bookingId
router.get('/unread-count', ChatController.getUnreadCount);

// Messages
router.post('/messages', validate(sendMessageSchema), ChatController.sendMessage);
router.get('/:bookingId/messages', ChatController.getMessages);
router.post('/:bookingId/read', ChatController.markAsRead);

export default router;
