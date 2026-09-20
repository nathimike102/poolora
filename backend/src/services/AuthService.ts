import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { config } from '../config';
import { getRedisClient, requireRedis } from '../config/redis';
import { User, IUser } from '../models/User';
import { OtpChallenge } from '../models/OtpChallenge';
import { kycPrefix } from './UploadService';
import { JWTPayload, UserCapability, KYCStatus, IVehicle } from '../types';
import {
  AppError,
  AuthenticationError,
  NotFoundError,
  ConflictError,
} from '../utils/AppError';
import { generateOTP } from '../utils/helpers';
import { logger } from '../utils/logger';
import { EventBridge } from '../events';

export class AuthService {
  private isTwilioConfigured(): boolean {
    if (!config.twilio.enabled) {
      return false;
    }

    const sid = config.twilio.accountSid;
    const token = config.twilio.authToken;
    const from = config.twilio.phoneNumber;

    return Boolean(
      sid &&
      token &&
      from &&
      !sid.includes('XXXXXXXXXXXXXXXX') &&
      token !== 'CHANGE_ME' &&
      !from.includes('XXXXXXXXXX'),
    );
  }

  private async sendOtpViaTwilio(phone: string, otp: string): Promise<void> {
    const sid = config.twilio.accountSid;
    const token = config.twilio.authToken;
    const from = config.twilio.phoneNumber;

    const body = new URLSearchParams({
      To: phone,
      From: from,
      Body: `Your OTP is ${otp}. It expires in ${Math.floor(config.otp.expirySeconds / 60)} minutes.`,
    });

    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      body.toString(),
      {
        auth: { username: sid, password: token },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
      },
    );
  }

  /**
   * How long to wait before the next code may be tried, after `failures`
   * wrong ones. Doubles each time, capped, so brute force becomes impractical
   * while a real person who mistyped is only held up for a few seconds.
   */
  private backoffSeconds(failures: number): number {
    if (failures <= 0) return 0;
    const delay = config.otp.backoffBaseSeconds * 2 ** (failures - 1);
    return Math.min(delay, config.otp.backoffMaxSeconds);
  }

  /**
   * Send OTP to phone number. Stores OTP in Redis with TTL.
   * A new code clears the per-code attempt count but not the recent-failure
   * count, so requesting another code cannot be used to escape the delay.
   */
  async sendOtp(phone: string): Promise<{ message: string }> {
    const redis = getRedisClient();

    if (!redis) {
      // Redis unavailable — persist OTP challenge in MongoDB.
      const now = new Date();
      const existingChallenge = await OtpChallenge.findOne({ phone });

      const otp = generateOTP();
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const expiresAt = new Date(Date.now() + (config.otp.expirySeconds * 1000));

      await OtpChallenge.findOneAndUpdate(
        { phone },
        {
          $set: {
            otpHash,
            expiresAt,
            attempts: 0,
            failures: existingChallenge?.failures ?? 0,
            retryAfter: existingChallenge?.retryAfter ?? null,
          },
        },
        { upsert: true, new: true },
      );

      if (this.isTwilioConfigured()) {
        try {
          await this.sendOtpViaTwilio(phone, otp);
        } catch (error: unknown) {
          const twilioError = axios.isAxiosError(error)
            ? error.response?.data || error.message
            : error instanceof Error
              ? error.message
              : String(error);
          logger.error('Twilio OTP send failed (redis unavailable branch)', {
            phone,
            error: twilioError,
          });
          throw new AppError('Failed to send OTP SMS', 502, 'OTP_PROVIDER_ERROR');
        }
      } else {
        logger.debug(`[DEV - REDIS DOWN] OTP for ${phone}: ${otp}`);
      }
      return { message: 'OTP sent successfully' };
    }

    // Generate and store OTP (hashed for security)
    const otp = generateOTP();
    const otpKey = `otp:${phone}`;
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    await redis.setex(otpKey, config.otp.expirySeconds, otpHash);
    // A fresh code gets a fresh set of tries; the failure count stands.
    await redis.del(`otp:attempts:${phone}`);

    if (this.isTwilioConfigured()) {
      try {
        await this.sendOtpViaTwilio(phone, otp);
      } catch (error: unknown) {
        const twilioError = axios.isAxiosError(error)
          ? error.response?.data || error.message
          : error instanceof Error
            ? error.message
            : String(error);
        // Keep OTP and let user retry within TTL, but report provider failure.
        logger.error('Twilio OTP send failed', {
          phone,
          error: twilioError,
        });
        throw new AppError('Failed to send OTP SMS', 502, 'OTP_PROVIDER_ERROR');
      }
    } else {
      logger.debug(`[DEV] OTP for ${phone}: ${otp}`);
    }

    return { message: 'OTP sent successfully' };
  }

  /**
   * Verify OTP and either register or login the user.
   * Returns access + refresh tokens.
   */
  async verifyOtp(
    phone: string,
    otp: string,
    name?: string,
    email?: string,
    dateOfBirth?: string,
  ): Promise<{
    user: IUser;
    accessToken: string;
    refreshToken: string;
    isNewUser: boolean;
  }> {
    const redis = getRedisClient();

    if (redis) {
      // Still waiting out an earlier wrong code?
      const retryKey = `otp:retry:${phone}`;
      const retryTtl = await redis.ttl(retryKey);
      if (retryTtl > 0) {
        throw new AppError(
          `Too many wrong codes. Try again in ${retryTtl} seconds.`,
          429,
          'OTP_RETRY_LATER',
        );
      }

      // Retrieve stored OTP hash
      const otpKey = `otp:${phone}`;
      const storedHash = await redis.get(otpKey);

      if (!storedHash) {
        throw new AuthenticationError('OTP expired or not requested');
      }

      const attemptsKey = `otp:attempts:${phone}`;
      const failuresKey = `otp:failures:${phone}`;

      // Compare hashes using timing-safe equality
      const providedHash = crypto.createHash('sha256').update(otp).digest('hex');
      const otpMatch =
        storedHash.length === providedHash.length &&
        crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(providedHash));

      if (!otpMatch) {
        const attempts = await redis.incr(attemptsKey);
        await redis.expire(attemptsKey, config.otp.expirySeconds);

        const failures = await redis.incr(failuresKey);
        await redis.expire(failuresKey, config.otp.failureWindowSeconds);

        const wait = this.backoffSeconds(failures);
        if (wait > 0) await redis.setex(retryKey, wait, '1');

        if (attempts >= config.otp.maxAttemptsPerCode) {
          // Throw the code away, but leave the account usable: the next step
          // is to request a new code, not to wait out a suspension.
          await redis.del(otpKey, attemptsKey);
          throw new AppError(
            `Too many wrong codes. Request a new one in ${wait} seconds.`,
            429,
            'OTP_RETRY_LATER',
          );
        }

        throw new AuthenticationError(
          `Invalid OTP. ${config.otp.maxAttemptsPerCode - attempts} attempts remaining before a new code is needed.`,
        );
      }

      // OTP valid — clean up, including the failure history.
      await redis.del(otpKey, attemptsKey, failuresKey, retryKey);
    } else {
      // Redis unavailable — verify with MongoDB OTP fallback store.
      const challenge = await OtpChallenge.findOne({ phone });
      if (!challenge) {
        throw new AuthenticationError('OTP expired or not requested');
      }

      const now = new Date();
      if (challenge.retryAfter && challenge.retryAfter.getTime() > now.getTime()) {
        const waitSeconds = Math.ceil((challenge.retryAfter.getTime() - now.getTime()) / 1000);
        throw new AppError(
          `Too many wrong codes. Try again in ${waitSeconds} seconds.`,
          429,
          'OTP_RETRY_LATER',
        );
      }

      if (challenge.expiresAt.getTime() <= now.getTime()) {
        await OtpChallenge.deleteOne({ phone });
        throw new AuthenticationError('OTP expired or not requested');
      }

      const providedHash = crypto.createHash('sha256').update(otp).digest('hex');
      const storedHash = challenge.otpHash;

      const otpMatch =
        storedHash.length === providedHash.length &&
        crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(providedHash));

      if (!otpMatch) {
        const nextAttempts = (challenge.attempts ?? 0) + 1;
        const nextFailures = (challenge.failures ?? 0) + 1;
        const wait = this.backoffSeconds(nextFailures);
        const retryAfter = new Date(now.getTime() + wait * 1000);
        const outOfTries = nextAttempts >= config.otp.maxAttemptsPerCode;

        await OtpChallenge.findOneAndUpdate(
          { phone },
          {
            $set: {
              attempts: nextAttempts,
              failures: nextFailures,
              retryAfter,
              // The document has to outlive the wait, so the failure count and
              // the wait itself cannot be shed by simply asking for a new code.
              expiresAt: new Date(
                Math.max(
                  challenge.expiresAt.getTime(),
                  now.getTime() + config.otp.failureWindowSeconds * 1000,
                ),
              ),
              // Out of tries: drop the code itself, never the account.
              ...(outOfTries ? { otpHash: '' } : {}),
            },
          },
        );

        if (outOfTries) {
          throw new AppError(
            `Too many wrong codes. Request a new one in ${wait} seconds.`,
            429,
            'OTP_RETRY_LATER',
          );
        }

        throw new AuthenticationError(
          `Invalid OTP. ${config.otp.maxAttemptsPerCode - nextAttempts} attempts remaining before a new code is needed.`,
        );
      }

      await OtpChallenge.deleteOne({ phone });
    }

    // Find or create user
    let user = await User.findOne({ phone });
    let isNewUser = false;

    if (!user) {
      if (!name) {
        throw new AppError('Name is required for registration', 400);
      }

      // New user — enters as Rider by default (no role param accepted)
      user = await User.create({
        phone,
        name,
        email,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        capabilities: [UserCapability.RIDER],
      });

      isNewUser = true;

      EventBridge.publish('user-events', {
        eventType: 'user.registered',
        data: { userId: user._id, phone },
      });
    }

    // Generate session tokens
    const sessionId = uuidv4();
    const { accessToken, refreshToken } = this.generateTokens(user, sessionId);

    // Store session + refresh token in Redis when available.
    if (redis) {
      await this.createSession(user._id.toString(), sessionId);
      await this.storeRefreshToken(user._id.toString(), sessionId, refreshToken);
    } else {
      logger.warn('Redis unavailable during OTP verify: issuing JWTs without Redis-backed session persistence');
    }

    EventBridge.publish('user-events', {
      eventType: 'user.logged_in',
      data: { userId: user._id, sessionId },
    });

    return { user, accessToken, refreshToken, isNewUser };
  }

  /**
   * Submit KYC documents to upgrade to Driver capability.
   */
  async submitKyc(
    userId: string,
    data: {
      licenseNumber: string;
      drivingLicenseUrl: string;
      vehicle: IVehicle;
    },
  ): Promise<IUser> {
    // Documents must be files this user uploaded, not arbitrary links
    const prefix = kycPrefix(userId);
    const docs = [data.drivingLicenseUrl, data.vehicle.registrationDocUrl, data.vehicle.insuranceDocUrl, ...data.vehicle.photos];
    if (docs.some((doc) => !doc.startsWith(prefix))) {
      throw new AppError('Documents must be uploaded through the app', 400, 'INVALID_DOCUMENT');
    }

    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');

    if (user.kyc.status === KYCStatus.PENDING) {
      throw new ConflictError('KYC already submitted and pending review');
    }

    if (user.kyc.status === KYCStatus.APPROVED) {
      throw new ConflictError('KYC already approved');
    }

    user.kyc = {
      status: KYCStatus.PENDING,
      licenseNumber: data.licenseNumber,
      drivingLicenseUrl: data.drivingLicenseUrl,
      submittedAt: new Date(),
    };

    user.vehicles.push(data.vehicle);

    await user.save();

    EventBridge.publish('user-events', {
      eventType: 'kyc.submitted',
      data: { userId },
    });

    return user;
  }

  /**
   * Admin approves KYC — grants Driver capability.
   */
  async approveKyc(userId: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');

    if (user.kyc.status !== KYCStatus.PENDING) {
      throw new AppError('No pending KYC to approve', 400);
    }

    user.kyc.status = KYCStatus.APPROVED;
    user.kyc.reviewedAt = new Date();

    if (!user.capabilities.includes(UserCapability.DRIVER)) {
      user.capabilities.push(UserCapability.DRIVER);
    }

    await user.save();

    // Invalidate existing sessions so user gets updated JWT payload on next login
    await this.invalidateAllSessions(userId);

    EventBridge.publish('user-events', {
      eventType: 'kyc.approved',
      data: { userId },
    });

    return user;
  }

  /**
   * Admin rejects KYC. The driver may correct the documents and resubmit.
   */
  async rejectKyc(userId: string, reason: string): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) throw new NotFoundError('User');

    if (user.kyc.status !== KYCStatus.PENDING) {
      throw new AppError('No pending KYC to reject', 400);
    }

    user.kyc.status = KYCStatus.REJECTED;
    user.kyc.reviewedAt = new Date();
    user.kyc.rejectionReason = reason;
    await user.save();

    EventBridge.publish('user-events', {
      eventType: 'kyc.rejected',
      data: { userId, reason },
    });

    return user;
  }

  /**
   * Refresh access token using a valid refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    let payload: JWTPayload;

    try {
      payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as JWTPayload;
    } catch {
      throw new AuthenticationError('Invalid refresh token');
    }

    const redis = requireRedis();
    const refreshKey = `refresh:${payload.userId}:${payload.sessionId}`;
    const storedToken = await redis.get(refreshKey);

    if (!storedToken || storedToken !== refreshToken) {
      // Potential token reuse — invalidate all sessions for safety
      await this.invalidateAllSessions(payload.userId);
      throw new AuthenticationError('Refresh token reuse detected. All sessions invalidated.');
    }

    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Rotate refresh token
    const newSessionId = payload.sessionId;
    const tokens = this.generateTokens(user, newSessionId);

    // Update Redis
    await redis.del(refreshKey);
    await this.storeRefreshToken(payload.userId, newSessionId, tokens.refreshToken);
    await redis.zadd(`sessions:${payload.userId}`, Date.now(), newSessionId);

    return tokens;
  }

  /**
   * Logout — destroy session.
   */
  async logout(userId: string, sessionId: string): Promise<void> {
    const redis = requireRedis();
    await redis.del(
      `session:${userId}:${sessionId}`,
      `refresh:${userId}:${sessionId}`,
    );
  }

  /**
   * Create a full JWT session for an already-authenticated user.
   * Called by the firebase-login endpoint after Firebase token verification
   * so the client also receives platform JWT tokens for the rest of the API.
   */
  async createSessionForUser(
    user: IUser,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = uuidv4();
    const { accessToken, refreshToken } = this.generateTokens(user, sessionId);

    await this.createSession(user._id.toString(), sessionId);
    await this.storeRefreshToken(user._id.toString(), sessionId, refreshToken);

    EventBridge.publish('user-events', {
      eventType: 'user.logged_in',
      data: { userId: user._id, sessionId, provider: 'firebase' },
    });

    return { accessToken, refreshToken };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private generateTokens(
    user: IUser,
    sessionId: string,
  ): { accessToken: string; refreshToken: string } {
    const jwtPayload: JWTPayload = {
      userId: user._id.toString(),
      phone: user.phone,
      capabilities: user.capabilities,
      driverVerified: user.kyc.status === KYCStatus.APPROVED,
      sessionId,
    };

    const accessOptions: SignOptions = {
      expiresIn: config.jwt.accessExpiry as SignOptions['expiresIn'],
    };
    const refreshOptions: SignOptions = {
      expiresIn: config.jwt.refreshExpiry as SignOptions['expiresIn'],
    };

    const accessToken = jwt.sign(jwtPayload, config.jwt.accessSecret as jwt.Secret, accessOptions);

    const refreshToken = jwt.sign(jwtPayload, config.jwt.refreshSecret as jwt.Secret, refreshOptions);

    return { accessToken, refreshToken };
  }

  private async createSession(userId: string, sessionId: string): Promise<void> {
    const redis = requireRedis();
    const sessionKey = `session:${userId}:${sessionId}`;
    const sessionsSetKey = `sessions:${userId}`;

    // Store session
    await redis.setex(sessionKey, 7 * 24 * 3600, '1'); // 7 days

    // Track session in a sorted set (by creation time)
    await redis.zadd(sessionsSetKey, Date.now(), sessionId);

    // Enforce max concurrent sessions
    const sessionCount = await redis.zcard(sessionsSetKey);
    if (sessionCount > config.session.maxConcurrent) {
      // Remove oldest sessions
      const excess = sessionCount - config.session.maxConcurrent;
      const oldSessions = await redis.zrange(sessionsSetKey, 0, excess - 1);

      for (const oldId of oldSessions) {
        await redis.del(`session:${userId}:${oldId}`, `refresh:${userId}:${oldId}`);
      }
      await redis.zremrangebyrank(sessionsSetKey, 0, excess - 1);
    }
  }

  private async storeRefreshToken(
    userId: string,
    sessionId: string,
    refreshToken: string,
  ): Promise<void> {
    const redis = requireRedis();
    await redis.setex(`refresh:${userId}:${sessionId}`, 7 * 24 * 3600, refreshToken);
  }

  private async invalidateAllSessions(userId: string): Promise<void> {
    const redis = requireRedis();
    const sessionsSetKey = `sessions:${userId}`;
    const sessionIds = await redis.zrange(sessionsSetKey, 0, -1);

    const pipeline = redis.pipeline();
    for (const sid of sessionIds) {
      pipeline.del(`session:${userId}:${sid}`);
      pipeline.del(`refresh:${userId}:${sid}`);
    }
    pipeline.del(sessionsSetKey);
    await pipeline.exec();
  }
}
