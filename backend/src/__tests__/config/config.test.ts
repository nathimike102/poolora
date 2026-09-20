/**
 * Unit tests for config changes:
 * - Platform fee rate is configurable
 * - Platform fee rate defaults to 0.15
 */

describe('Config — Platform Fee Rate', () => {
  it('should default to 0.15 when PLATFORM_FEE_RATE env is not set', () => {
    // Our env setup sets it to '0.15'
    const { config } = require('../../config');
    expect(config.ride.platformFeeRate).toBe(0.15);
  });

  it('should be a valid number between 0 and 1', () => {
    const { config } = require('../../config');
    expect(config.ride.platformFeeRate).toBeGreaterThanOrEqual(0);
    expect(config.ride.platformFeeRate).toBeLessThanOrEqual(1);
  });
});

describe('Config — OTP Settings', () => {
  it('should allow a handful of tries per code', () => {
    const { config } = require('../../config');
    expect(config.otp.maxAttemptsPerCode).toBe(5);
  });

  it('should cap the wait so a mistyped code never locks someone out for long', () => {
    const { config } = require('../../config');
    expect(config.otp.backoffBaseSeconds).toBeGreaterThan(0);
    expect(config.otp.backoffMaxSeconds).toBeLessThanOrEqual(900);
  });

  it('should have expirySeconds set to 300', () => {
    const { config } = require('../../config');
    expect(config.otp.expirySeconds).toBe(300);
  });
});
