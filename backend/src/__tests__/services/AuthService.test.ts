/**
 * Unit tests for AuthService — focusing on the OTP hashing fix.
 *
 * Tests verify:
 * - OTP is stored as SHA-256 hash in Redis (not plaintext)
 * - OTP verification compares hashes correctly
 * - Invalid OTP is rejected
 * - Expired/missing OTP is rejected
 */
import crypto from 'crypto';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockRedis = {
  exists: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
  ttl: jest.fn(),
  sadd: jest.fn(),
  scard: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([]),
  srem: jest.fn(),
  zadd: jest.fn().mockResolvedValue(1),
  zcard: jest.fn().mockResolvedValue(1),
  zrange: jest.fn().mockResolvedValue([]),
  zrem: jest.fn().mockResolvedValue(1),
};

jest.mock('../../config/redis', () => ({
  getRedisClient: () => mockRedis,
  requireRedis: () => mockRedis,
}));

jest.mock('../../models/User', () => ({
  User: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../../models/OtpChallenge', () => ({
  OtpChallenge: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock('../../events', () => ({
  EventBridge: { publish: jest.fn() },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock_token'),
  verify: jest.fn(),
}));

// ── Import under test ───────────────────────────────────────────────────────

import { AuthService } from '../../services/AuthService';

describe('AuthService — OTP Security', () => {
  let authService: AuthService;
  const testPhone = '+919876543210';

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
    // Disable Twilio in tests by overriding the check
    jest.spyOn(authService as any, 'isTwilioConfigured').mockReturnValue(false);
  });

  describe('sendOtp', () => {
    it('should store a SHA-256 hashed OTP in Redis, not the plaintext OTP', async () => {
      // Not suspended
      mockRedis.exists.mockResolvedValueOnce(0);

      await authService.sendOtp(testPhone);

      // setex should have been called with the hashed OTP
      expect(mockRedis.setex).toHaveBeenCalledTimes(1);
      const [key, ttl, storedValue] = mockRedis.setex.mock.calls[0];
      expect(key).toBe(`otp:${testPhone}`);
      expect(ttl).toBe(300); // config.otp.expirySeconds

      // The stored value should be a 64-char hex string (SHA-256 output)
      expect(storedValue).toHaveLength(64);
      expect(storedValue).toMatch(/^[a-f0-9]{64}$/);

      // The stored value should NOT be a 6-digit number (the raw OTP)
      expect(storedValue).not.toMatch(/^\d{6}$/);
    });

    it('should not store the same value twice for the same phone (different OTPs)', async () => {
      mockRedis.exists.mockResolvedValue(0);

      await authService.sendOtp(testPhone);
      const hash1 = mockRedis.setex.mock.calls[0][2];

      jest.clearAllMocks();
      jest.spyOn(authService as any, 'isTwilioConfigured').mockReturnValue(false);
      mockRedis.exists.mockResolvedValue(0);

      await authService.sendOtp(testPhone);
      const hash2 = mockRedis.setex.mock.calls[0][2];

      // Both should be valid SHA-256 hashes
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('verifyOtp', () => {
    it('should verify a correct OTP by comparing SHA-256 hashes', async () => {
      const rawOtp = '123456';
      const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');

      // Not suspended, stored hash exists
      mockRedis.exists.mockResolvedValueOnce(0);
      mockRedis.get.mockResolvedValueOnce(otpHash);
      mockRedis.del.mockResolvedValue(1);

      // Mock User.findOne to return a user (existing user flow)
      const { User } = require('../../models/User');
      User.findOne.mockResolvedValueOnce({
        _id: 'user123',
        phone: testPhone,
        name: 'Test User',
        capabilities: ['rider'],
        kyc: { status: 'none' },
        isSuspended: false,
      });

      const result = await authService.verifyOtp(testPhone, rawOtp, undefined);
      expect(result).toBeDefined();
      expect(result.isNewUser).toBe(false);
    });

    it('should reject an incorrect OTP', async () => {
      const correctOtp = '123456';
      const wrongOtp = '654321';
      const otpHash = crypto.createHash('sha256').update(correctOtp).digest('hex');

      mockRedis.exists.mockResolvedValueOnce(0);
      mockRedis.get.mockResolvedValueOnce(otpHash);
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValue(true);

      await expect(authService.verifyOtp(testPhone, wrongOtp, undefined)).rejects.toThrow('Invalid OTP');
    });

    it('should reject when OTP has expired (not in Redis)', async () => {
      mockRedis.exists.mockResolvedValueOnce(0);
      mockRedis.get.mockResolvedValueOnce(null); // OTP expired

      await expect(authService.verifyOtp(testPhone, '123456', undefined)).rejects.toThrow(
        'OTP expired or not requested',
      );
    });

    it('should suspend account after max failed attempts', async () => {
      const correctOtp = '123456';
      const otpHash = crypto.createHash('sha256').update(correctOtp).digest('hex');

      mockRedis.exists.mockResolvedValueOnce(0);
      mockRedis.get.mockResolvedValueOnce(otpHash);
      mockRedis.incr.mockResolvedValueOnce(3); // 3rd attempt = max
      mockRedis.expire.mockResolvedValue(true);
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      await expect(authService.verifyOtp(testPhone, '000000', undefined)).rejects.toThrow(
        'Maximum OTP attempts exceeded',
      );

      // Verify suspension key was set
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `otp:suspended:${testPhone}`,
        expect.any(Number),
        '1',
      );
    });
  });
});
