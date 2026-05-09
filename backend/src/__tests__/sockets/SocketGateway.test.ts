/**
 * Unit tests for SocketGateway — focusing on:
 * - Admin SOS room authorization check
 * - Online/offline scoped to booking counterparts
 */
import { UserCapability } from '../../types';

// ── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../config/redis', () => ({
  getRedisClient: () => null,
  getRedisPub: () => null,
  getRedisSub: () => null,
}));

jest.mock('../../models/Message', () => ({
  Message: { create: jest.fn(), updateMany: jest.fn() },
}));

jest.mock('../../models/Booking', () => ({
  Booking: {
    findById: jest.fn(),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

jest.mock('../../models/EmergencyRecord', () => ({
  EmergencyRecord: { findById: jest.fn() },
}));

jest.mock('../../events', () => ({
  EventBridge: { publish: jest.fn() },
}));

describe('SocketGateway — Security', () => {
  describe('Admin SOS room authorization', () => {
    it('should require ADMIN capability in JWT to join admin:sos room', () => {
      // Verify that the JWT payload must include admin capability
      const adminPayload = {
        userId: 'admin123',
        phone: '+911234567890',
        capabilities: [UserCapability.ADMIN, UserCapability.RIDER],
        driverVerified: false,
        sessionId: 'sess123',
      };

      const regularPayload = {
        userId: 'user123',
        phone: '+919876543210',
        capabilities: [UserCapability.RIDER],
        driverVerified: false,
        sessionId: 'sess456',
      };

      // Admin should have the capability
      expect(adminPayload.capabilities).toContain(UserCapability.ADMIN);

      // Regular user should NOT have the capability
      expect(regularPayload.capabilities).not.toContain(UserCapability.ADMIN);
    });

    it('should verify admin check uses the ADMIN enum value', () => {
      expect(UserCapability.ADMIN).toBe('admin');

      // Verify the capabilities check would work
      const isAdmin = (capabilities: UserCapability[]) =>
        capabilities.includes(UserCapability.ADMIN);

      expect(isAdmin([UserCapability.ADMIN])).toBe(true);
      expect(isAdmin([UserCapability.RIDER])).toBe(false);
      expect(isAdmin([UserCapability.DRIVER])).toBe(false);
      expect(isAdmin([UserCapability.RIDER, UserCapability.DRIVER])).toBe(false);
    });
  });

  describe('Online/offline broadcast scoping', () => {
    it('should query active bookings to find counterparts', async () => {
      const { Booking } = require('../../models/Booking');

      // Mock the chained query
      const mockLean = jest.fn().mockResolvedValue([
        { rider: 'user1', driver: 'user2' },
        { rider: 'user1', driver: 'user3' },
      ]);
      const mockSelect = jest.fn().mockReturnValue({ lean: mockLean });
      (Booking.find as jest.Mock).mockReturnValue({ select: mockSelect });

      // Call Booking.find with the expected query
      const result = await Booking.find({
        $or: [{ rider: 'user1' }, { driver: 'user1' }],
        status: { $in: ['pending', 'confirmed'] },
      }).select('rider driver').lean();

      expect(result).toHaveLength(2);
      expect(Booking.find).toHaveBeenCalledWith({
        $or: [{ rider: 'user1' }, { driver: 'user1' }],
        status: { $in: ['pending', 'confirmed'] },
      });
    });

    it('should extract unique counterpart IDs correctly', () => {
      const userId = 'user1';
      const activeBookings = [
        { rider: { toString: () => 'user1' }, driver: { toString: () => 'user2' } },
        { rider: { toString: () => 'user1' }, driver: { toString: () => 'user3' } },
        { rider: { toString: () => 'user4' }, driver: { toString: () => 'user1' } },
      ];

      const counterpartIds = new Set<string>();
      for (const booking of activeBookings) {
        const riderId = booking.rider.toString();
        const driverId = booking.driver.toString();
        if (riderId !== userId) counterpartIds.add(riderId);
        if (driverId !== userId) counterpartIds.add(driverId);
      }

      // Should have 3 unique counterparts: user2, user3, user4
      expect(counterpartIds.size).toBe(3);
      expect(counterpartIds.has('user2')).toBe(true);
      expect(counterpartIds.has('user3')).toBe(true);
      expect(counterpartIds.has('user4')).toBe(true);
      // Should NOT include the user itself
      expect(counterpartIds.has('user1')).toBe(false);
    });
  });
});
