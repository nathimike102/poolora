import { Router } from 'express';
import { RatingController } from '../controllers/RatingController';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import { createRatingSchema } from '../validators';

const router = Router();

router.use(authenticate);

router.post('/', validate(createRatingSchema), RatingController.createRating);
router.get('/user/:userId', RatingController.getUserRatings);

export default router;
