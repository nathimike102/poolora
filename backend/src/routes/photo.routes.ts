import { Router, type Request, type Response, type NextFunction } from 'express';
import { ProfilePhotoService } from '../services/ProfilePhotoService';

const router = Router();

// Public: riders and drivers see each other's pictures, and the random key
// in the link is what keeps one from being looked up by user id.
router.get('/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const photo = await ProfilePhotoService.get(String(req.params.key));
    // A changed picture gets a new key, so a link never needs revalidating
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.type(photo.contentType).send(photo.data);
  } catch (error) {
    next(error);
  }
});

export default router;
