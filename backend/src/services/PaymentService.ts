import { Payment } from '../models/Payment';
import type { FilterQuery } from 'mongoose';
import type { IPayment } from '../models/Payment';

/**
 * Payment history. Taking payments is ChargeService (Paynow); this reads
 * what was paid.
 */
export class PaymentService {
  /**
   * Get payment history for a user.
   */
  async getUserPayments(
    userId: string,
    role: 'rider' | 'driver',
    page: number,
    limit: number,
  ) {
    const filter: FilterQuery<IPayment> = { [role]: userId };

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('booking', 'ride seatsBooked')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Payment.countDocuments(filter),
    ]);

    return { payments, total, page, limit };
  }
}
