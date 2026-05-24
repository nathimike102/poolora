import axios from 'axios';
import { User } from '../models/User';
import { KYCStatus } from '../types';
import { AppError, NotFoundError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { config } from '../config';

export class KYCService {
  /**
   * Submit KYC documents for verification.
   * In production, this would call an external OCR/Verification API (e.g., HyperVerge or Digilocker).
   */
  async submitKYC(
    userId: string,
    data: {
      idType: 'aadhar' | 'pan' | 'license';
      idNumber: string;
      docUrl: string;
      faceUrl?: string;
    },
  ): Promise<any> {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');

    if (user.kyc.status === KYCStatus.APPROVED) {
      throw new AppError('KYC already verified', 400);
    }

    // Update user KYC state to PENDING
    user.kyc = {
      status: KYCStatus.PENDING,
      licenseNumber: data.idType === 'license' ? data.idNumber : user.kyc.licenseNumber,
      drivingLicenseUrl: data.idType === 'license' ? data.docUrl : user.kyc.drivingLicenseUrl,
      submittedAt: new Date(),
    };

    await user.save();

    // Trigger async background verification (mocked here)
    this.processVerification(userId, data).catch((err) => {
      logger.error('Background KYC verification failed', { userId, error: err.message });
    });

    return { status: KYCStatus.PENDING, message: 'KYC submitted successfully' };
  }

  /**
   * Mocked background verification logic.
   * Performs face match and document integrity checks.
   */
  private async processVerification(userId: string, data: any): Promise<void> {
    logger.info('Starting KYC verification process', { userId, idType: data.idType });

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Simple rule: if ID number contains 'FAKE', reject it
    if (data.idNumber.includes('FAKE')) {
      await User.findByIdAndUpdate(userId, {
        'kyc.status': KYCStatus.REJECTED,
        'kyc.rejectionReason': 'Invalid document or tampering detected',
        'kyc.reviewedAt': new Date(),
      });
      return;
    }

    // Success
    await User.findByIdAndUpdate(userId, {
      'kyc.status': KYCStatus.APPROVED,
      'kyc.reviewedAt': new Date(),
    });

    logger.info('KYC verification completed successfully', { userId });
  }
}
