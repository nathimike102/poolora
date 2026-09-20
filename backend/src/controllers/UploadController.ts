import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';
import { presignKycUpload, KycDocumentPurpose } from '../services/UploadService';

export class UploadController {
  /**
   * POST /uploads/kyc
   * Presigned upload for a KYC document owned by the signed-in user.
   */
  static async presignKyc(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = (req as AuthenticatedRequest).user;
      const { purpose, contentType } = req.body as { purpose: KycDocumentPurpose; contentType: string };
      const upload = await presignKycUpload(userId, purpose, contentType);
      sendSuccess(res, upload, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  }
}
