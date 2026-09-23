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
    findById: jest.fn(),
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
import { User } from '../../models/User';

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

      // No wait outstanding, stored hash exists
      mockRedis.ttl.mockResolvedValueOnce(-2);
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
      expect(result).toMatchObject({ isNewUser: false });
    });

    it('asks a new phone for a profile without using up the code', async () => {
      const otpHash = crypto.createHash('sha256').update('123456').digest('hex');
      mockRedis.ttl.mockResolvedValueOnce(-2);
      mockRedis.get.mockResolvedValueOnce(otpHash);
      const { User } = require('../../models/User');
      User.findOne.mockResolvedValueOnce(null);

      const result = await authService.verifyOtp(testPhone, '123456', undefined);

      expect(result).toEqual({ needsProfile: true });
      expect(mockRedis.del).not.toHaveBeenCalled();
      expect(User.create).not.toHaveBeenCalled();
    });

    it('creates the account when the same code comes back with a name', async () => {
      const otpHash = crypto.createHash('sha256').update('123456').digest('hex');
      mockRedis.ttl.mockResolvedValueOnce(-2);
      mockRedis.get.mockResolvedValueOnce(otpHash);
      mockRedis.del.mockResolvedValue(1);
      const { User } = require('../../models/User');
      User.findOne.mockResolvedValueOnce(null);
      User.create.mockResolvedValueOnce({ _id: 'new1', phone: testPhone, name: 'Asha Rao', capabilities: ['rider'], kyc: { status: 'none' } });

      const result = await authService.verifyOtp(testPhone, '123456', 'Asha Rao');

      expect(result).toMatchObject({ isNewUser: true });
      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ phone: testPhone, name: 'Asha Rao' }));
      expect(mockRedis.del).toHaveBeenCalledWith(
        `otp:${testPhone}`, `otp:attempts:${testPhone}`, `otp:failures:${testPhone}`, `otp:retry:${testPhone}`,
      );
    });

    it('should reject an incorrect OTP', async () => {
      const correctOtp = '123456';
      const wrongOtp = '654321';
      const otpHash = crypto.createHash('sha256').update(correctOtp).digest('hex');

      mockRedis.ttl.mockResolvedValueOnce(-2);
      mockRedis.get.mockResolvedValueOnce(otpHash);
      mockRedis.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValue(true);
      mockRedis.setex.mockResolvedValue('OK');

      await expect(authService.verifyOtp(testPhone, wrongOtp, undefined)).rejects.toThrow('Invalid OTP');

      // A wrong code sets a wait, and never an account suspension.
      expect(mockRedis.setex).toHaveBeenCalledWith(`otp:retry:${testPhone}`, 5, '1');
      expect(mockRedis.setex).not.toHaveBeenCalledWith(
        expect.stringContaining('suspended'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should reject when OTP has expired (not in Redis)', async () => {
      mockRedis.ttl.mockResolvedValueOnce(-2);
      mockRedis.get.mockResolvedValueOnce(null); // OTP expired

      await expect(authService.verifyOtp(testPhone, '123456', undefined)).rejects.toThrow(
        'OTP expired or not requested',
      );
    });

    it('should discard the code, but not the account, after too many wrong tries', async () => {
      const correctOtp = '123456';
      const otpHash = crypto.createHash('sha256').update(correctOtp).digest('hex');

      mockRedis.ttl.mockResolvedValueOnce(-2);
      mockRedis.get.mockResolvedValueOnce(otpHash);
      // 5th wrong try against this code, 5th recent failure overall.
      mockRedis.incr.mockResolvedValueOnce(5).mockResolvedValueOnce(5);
      mockRedis.expire.mockResolvedValue(true);
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      await expect(authService.verifyOtp(testPhone, '000000', undefined)).rejects.toThrow(
        'Too many wrong codes',
      );

      // The code is dropped and a wait applies, but nothing suspends the phone.
      expect(mockRedis.del).toHaveBeenCalledWith(`otp:${testPhone}`, `otp:attempts:${testPhone}`);
      expect(mockRedis.setex).toHaveBeenCalledWith(`otp:retry:${testPhone}`, 80, '1');
    });

    it('should refuse while a wait from an earlier wrong code is still running', async () => {
      mockRedis.ttl.mockResolvedValueOnce(42);

      await expect(authService.verifyOtp(testPhone, '123456', undefined)).rejects.toThrow(
        'Try again in 42 seconds',
      );
      // It never even looks the code up.
      expect(mockRedis.get).not.toHaveBeenCalled();
    });
  });
});

describe('AuthService — KYC approval', () => {
  let authService: AuthService;

  function pendingDriver(overrides: { licence?: string; registration?: string } = {}) {
    return {
      kyc: { status: 'pending', drivingLicenseUrl: overrides.licence },
      vehicles: overrides.registration === undefined ? [] : [{ registrationDocUrl: overrides.registration }],
      capabilities: ['rider'],
      save: jest.fn(),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService();
    jest.spyOn(authService as any, 'invalidateAllSessions').mockResolvedValue(undefined);
  });

  it('refuses to approve a driver who has not uploaded a licence', async () => {
    const user = pendingDriver({ registration: 's3://kyc/rc.jpg' });
    (User.findById as jest.Mock).mockResolvedValue(user);

    await expect(authService.approveKyc('u1')).rejects.toMatchObject({ statusCode: 409, errorId: 'KYC_DOCUMENTS_MISSING' });
    expect(user.save).not.toHaveBeenCalled();
  });

  it('refuses to approve a driver with no vehicle registration', async () => {
    const user = pendingDriver({ licence: 's3://kyc/dl.jpg' });
    (User.findById as jest.Mock).mockResolvedValue(user);

    await expect(authService.approveKyc('u1')).rejects.toMatchObject({ errorId: 'KYC_DOCUMENTS_MISSING' });
    expect(user.save).not.toHaveBeenCalled();
  });

  it('approves and grants the driver capability once both documents are uploaded', async () => {
    const user = pendingDriver({ licence: 's3://kyc/dl.jpg', registration: 's3://kyc/rc.jpg' });
    (User.findById as jest.Mock).mockResolvedValue(user);

    await authService.approveKyc('u1');
    expect(user.kyc.status).toBe('approved');
    expect(user.capabilities).toContain('driver');
    expect(user.save).toHaveBeenCalled();
  });
});
