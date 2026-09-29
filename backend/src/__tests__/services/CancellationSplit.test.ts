/**
 * How a cancelled fare splits between the rider's refund, the platform fee
 * and the driver, with the platform fee refundable (the default) or kept.
 */
import { cancellationSplit } from '../../services/BookingService';
import { config } from '../../config';

const ride = config.ride as unknown as { keepPlatformFeeOnCancel: boolean; platformFeeRate: number };

afterEach(() => {
  ride.keepPlatformFeeOnCancel = false;
});

describe('cancellationSplit', () => {
  it('refunds the fee with the fare by default', () => {
    expect(cancellationSplit(200, 1, true)).toEqual({ refund: 200, retained: 0, platformFee: 0, driverEarnings: 0 });
    // 50%: the platform takes its rate of what is kept
    expect(cancellationSplit(200, 0.5, true)).toEqual({ refund: 100, retained: 100, platformFee: 15, driverEarnings: 85 });
  });

  it('keeps the fee on the whole fare when the fee is non-refundable', () => {
    ride.keepPlatformFeeOnCancel = true;
    expect(cancellationSplit(200, 1, true)).toEqual({ refund: 170, retained: 30, platformFee: 30, driverEarnings: 0 });
    expect(cancellationSplit(200, 0.5, true)).toEqual({ refund: 100, retained: 100, platformFee: 30, driverEarnings: 70 });
    expect(cancellationSplit(200, 0, true)).toEqual({ refund: 0, retained: 200, platformFee: 30, driverEarnings: 170 });
  });

  it('always refunds in full outside the policy (driver cancels, request not accepted)', () => {
    ride.keepPlatformFeeOnCancel = true;
    expect(cancellationSplit(200, 1, false)).toEqual({ refund: 200, retained: 0, platformFee: 0, driverEarnings: 0 });
  });
});
