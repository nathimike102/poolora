import { mlClient } from '../utils/mlClient';
import { User } from '../models/User';
import { Payment } from '../models/Payment';
import { Booking } from '../models/Booking';
import { logger } from '../utils/logger';
import { FraudLevel, KYCStatus } from '../types';

/** Suspensions the fraud check places start with this, so a review can lift exactly those */
export const FRAUD_SUSPENSION_PREFIX = 'Automatic fraud check';

interface FraudCheckResult {
  userId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  flags: string[];
  shouldBlock: boolean;
  recommendedAction: string;
}

export class FraudDetectionService {

  /**
   * Analyze a payment failure for potential fraud.
   * Runs a series of rule-based checks and calls the ML service for deep analysis.
   */
  async analyzePaymentFailure(userId: string, paymentData: Record<string, unknown>): Promise<FraudCheckResult> {
    try {
      logger.info('Starting fraud analysis for payment failure', { userId, orderId: paymentData.orderId });

      // 1. Gather historical data for analysis
      const [user, userPayments, userBookings] = await Promise.all([
        User.findById(userId),
        Payment.find({ rider: userId }).sort({ createdAt: -1 }).limit(50),
        Booking.find({ rider: userId }).sort({ createdAt: -1 }).limit(100),
      ]);

      if (!user) {
        throw new Error(`User ${userId} not found for fraud analysis`);
      }

      // 2. Local rule-based checks (First line of defense)
      const cancellations30d = userBookings.filter(
        b => b.status === 'cancelled' && 
        b.createdAt > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length;

      const avgPayment = userPayments.length > 0 
        ? userPayments.reduce((sum, p) => sum + p.amount, 0) / userPayments.length 
        : 0;

      const bookingsLastHour = userBookings.filter(
        b => b.createdAt > new Date(Date.now() - 60 * 60 * 1000)
      ).length;

      // 3. Call ML Service for statistical anomaly detection
      let mlResult;
      try {
        const response = await mlClient.post('/api/fraud-check', {
          user_id: userId,
          cancellation_count_7d: userBookings.filter(b => b.status === 'cancelled' && b.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
          cancellation_count_30d: cancellations30d,
          total_bookings: userBookings.length,
          avg_payment_amount: avgPayment,
          current_payment_amount: paymentData.amount || 0,
          unique_ips_7d: 1, // We should track IPs in a real system
          bookings_last_hour: bookingsLastHour,
          account_age_days: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
          is_verified: !!user.phone && user.kyc.status === KYCStatus.APPROVED,
          location_change_km: 0, // Should be calculated from tracking history
        }, { timeout: 2000 });
        
        mlResult = response.data;
      } catch (error) {
        logger.error('ML Service fraud-check call failed — falling back to local rules', { error: (error as Error).message });
        // Basic fallback logic
        mlResult = this.runLocalHeuristics(
          cancellations30d,
          bookingsLastHour,
          avgPayment,
          typeof paymentData.amount === 'number' ? paymentData.amount : 0,
        );
      }

      // 4. Act on the results
      const level = mlResult.risk_level ?? mlResult.riskLevel;
      const flags: string[] = Array.isArray(mlResult.flags) ? mlResult.flags : [];
      if (mlResult.should_block || mlResult.shouldBlock || level === 'critical') {
        await this.suspendForReview(userId, flags);
      } else if (level === 'high') {
        await this.flagUser(userId, flags);
      }

      return {
        userId,
        riskScore: mlResult.risk_score || mlResult.riskScore,
        riskLevel: mlResult.risk_level || mlResult.riskLevel,
        flags: mlResult.flags,
        shouldBlock: mlResult.should_block || mlResult.shouldBlock,
        recommendedAction: mlResult.recommended_action || mlResult.recommendedAction,
      };
    } catch (error) {
      logger.error('Fraud analysis pipeline failed', { userId, error: (error as Error).message });
      throw error;
    }
  }

  private runLocalHeuristics(cancellations: number, velocity: number, avgPay: number, currentPay: number) {
    const flags = [];
    let score = 0;

    if (cancellations > 10) {
      score += 30;
      flags.push('High cancellation count');
    }
    if (velocity > 5) {
      score += 40;
      flags.push('High booking velocity');
    }
    if (avgPay > 0 && currentPay > avgPay * 5) {
      score += 30;
      flags.push('Significant payment deviation');
    }

    return {
      riskScore: score,
      riskLevel: score > 70 ? 'critical' : score > 40 ? 'high' : 'low',
      flags,
      shouldBlock: score > 70,
      recommendedAction: score > 70 ? 'block' : 'allow',
    };
  }

  /**
   * High risk (UC-AI02 step 4): suspend until an admin reviews it, and alert
   * the admins. A permanent block needs two admins (UC-A05 3b), so the check
   * never blocks by itself.
   */
  private async suspendForReview(userId: string, flags: string[]) {
    logger.warn('Suspending user for fraud review', { userId, flags });
    const reason = `${FRAUD_SUSPENSION_PREFIX}: ${flags.join(', ') || 'unusual payment activity'}`;
    // An admin's own suspension or block is left as it is
    const user = await User.findOneAndUpdate(
      { _id: userId, isBlocked: { $ne: true }, isSuspended: { $ne: true } },
      { $set: { fraudLevel: FraudLevel.BLOCKED, fraudFlags: flags, fraudFlaggedAt: new Date(), isSuspended: true, suspensionReason: reason }, $unset: { suspendedUntil: 1 } },
    );
    if (!user) {
      await User.updateOne({ _id: userId }, { $set: { fraudLevel: FraudLevel.BLOCKED, fraudFlags: flags, fraudFlaggedAt: new Date() } });
    } else {
      const { NotificationService } = await import('./NotificationService');
      const message = 'We paused your account while our team checks some unusual payment activity. This usually takes a few hours. Contact support if you think this is a mistake.';
      await new NotificationService().createNotification(userId, 'Account paused for a check', message, 'system').catch(() => undefined);
    }
    await this.alertAdmins(userId, 'suspended', flags);
  }

  private async flagUser(userId: string, flags: string[]) {
    logger.info('Flagging user for manual review', { userId, flags });
    await User.findByIdAndUpdate(userId, {
      $set: { fraudLevel: FraudLevel.FLAGGED, fraudFlags: flags, fraudFlaggedAt: new Date() },
    });
    await this.alertAdmins(userId, 'flagged', flags);
  }

  /** Admins on the web dashboard see it at once (UC-AI02: alert admin immediately) */
  private async alertAdmins(userId: string, action: 'flagged' | 'suspended', flags: string[]) {
    try {
      const { SocketGateway } = await import('../sockets/SocketGateway');
      SocketGateway.getInstance()?.getIO()?.to('admin:sos').emit('fraud:flagged', { userId, action, flags, at: new Date().toISOString() });
    } catch (error) {
      logger.debug('Could not alert admins about a fraud flag', { error: (error as Error).message });
    }
  }
}
