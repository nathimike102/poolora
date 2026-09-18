/**
 * Integration tests for SocketGateway
 * Runs a real Socket.io server and clients; persistence and auth are mocked.
 * Covers:
 * - Real-time location tracking (and who may subscribe to it)
 * - Live chat messaging
 * - SOS emergency handling
 * - Presence on disconnect
 * - Authorization
 */

import { AddressInfo } from 'net';
import { createServer, Server as HttpServer } from 'http';
import { Socket as ClientSocket, io } from 'socket.io-client';
import { Booking } from '../../models/Booking';
import { Message } from '../../models/Message';
import { SocketGateway } from '../../sockets/SocketGateway';
import { EventBridge } from '../../events';
import { BookingStatus } from '../../types';

const RIDER_ID = '64b7f0c2a1b2c3d4e5f60001';
const DRIVER_ID = '64b7f0c2a1b2c3d4e5f60002';
const ADMIN_ID = '64b7f0c2a1b2c3d4e5f60003';
const STRANGER_ID = '64b7f0c2a1b2c3d4e5f60004';
const BOOKING_ID = '64b7f0c2a1b2c3d4e5f6b001';
const EMERGENCY_ID = '64b7f0c2a1b2c3d4e5f6e001';

const USERS: Record<string, { _id: string; capabilities: string[] }> = {
  'rider-token': { _id: RIDER_ID, capabilities: ['rider'] },
  'driver-token': { _id: DRIVER_ID, capabilities: ['driver'] },
  'admin-token': { _id: ADMIN_ID, capabilities: ['rider', 'admin'] },
  'stranger-token': { _id: STRANGER_ID, capabilities: ['rider'] },
};

jest.mock('../../auth', () => ({
  UnifiedAuthService: jest.fn().mockImplementation(() => ({
    authenticate: jest.fn(async (token: string) => {
      const user = USERS[token];
      if (!user) throw new Error('Invalid token');
      return { user: { ...user, _id: { toString: () => user._id } }, sessionId: `session-${user._id}` };
    }),
  })),
}));
jest.mock('../../config/redis', () => ({
  getRedisClient: () => null,
  getRedisPub: () => null,
  getRedisSub: () => null,
}));
jest.mock('../../models/Booking');
jest.mock('../../models/Message');
jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

const mockTriggerSOS = jest.fn();
const mockUpdateSOSLocation = jest.fn();
jest.mock('../../services/SafetyService', () => ({
  SafetyService: jest.fn().mockImplementation(() => ({
    triggerSOS: mockTriggerSOS,
    updateSOSLocation: mockUpdateSOSLocation,
  })),
}));

const booking = {
  _id: BOOKING_ID,
  rider: RIDER_ID,
  driver: DRIVER_ID,
  status: BookingStatus.CONFIRMED,
  pickup: { location: { type: 'Point', coordinates: [77.1, 28.7] } },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

let url = '';
const openSockets: ClientSocket[] = [];

function connect(token?: string): Promise<ClientSocket> {
  const socket = io(url, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  openSockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function waitFor<T>(socket: ClientSocket, event: string, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for "${event}"`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

function expectNoEvent(socket: ClientSocket, event: string, windowMs = 300): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = () => reject(new Error(`Unexpected "${event}"`));
    socket.once(event, handler);
    setTimeout(() => {
      socket.off(event, handler);
      resolve();
    }, windowMs);
  });
}

const tick = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Suite ────────────────────────────────────────────────────────────────────

describe('SocketGateway Integration Tests', () => {
  let httpServer: HttpServer;

  beforeAll((done) => {
    SocketGateway.resetInstanceForTests();
    httpServer = createServer();
    SocketGateway.getInstance(httpServer);
    httpServer.listen(0, () => {
      url = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
      done();
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (Booking.findById as jest.Mock).mockImplementation(async (id: string) =>
      String(id) === BOOKING_ID ? booking : null,
    );
    (Booking.find as jest.Mock).mockReturnValue({
      select: () => ({ lean: async () => [booking] }),
    });
  });

  afterEach(() => {
    while (openSockets.length) openSockets.pop()!.disconnect();
  });

  afterAll((done) => {
    SocketGateway.resetInstanceForTests();
    httpServer.close(() => done());
  });

  describe('Real-time Location Tracking', () => {
    it('should broadcast driver location to a rider tracking the booking', async () => {
      const rider = await connect('rider-token');
      const driver = await connect('driver-token');
      rider.emit('tracking:join', BOOKING_ID);
      await tick();

      const received = waitFor<{ location: unknown; driverId: string; bookingId: string }>(
        rider,
        'driver:location:updated',
      );
      driver.emit('driver:location:update', {
        bookingId: BOOKING_ID,
        location: { type: 'Point', coordinates: [77.1025, 28.7041] },
        speed: 45,
        heading: 120,
        accuracy: 10,
        timestamp: Date.now(),
      });

      const data = await received;
      expect(data.location).toEqual({ lng: 77.1025, lat: 28.7041 });
      expect(data.driverId).toBe(DRIVER_ID);
      expect(data.bookingId).toBe(BOOKING_ID);
    });

    it('should emit a distance milestone and publish the location event', async () => {
      const rider = await connect('rider-token');
      const driver = await connect('driver-token');

      const milestone = waitFor<{ message: string }>(rider, 'driver:milestone');
      driver.emit('driver:location:update', {
        bookingId: BOOKING_ID,
        location: { type: 'Point', coordinates: [77.11, 28.71] },
        speed: 30,
        timestamp: Date.now(),
      });

      expect((await milestone).message).toMatch(/^Driver is /);
      expect(EventBridge.publish).toHaveBeenCalledWith(
        'location-events',
        expect.objectContaining({ eventType: 'driver.location.updated' }),
      );
    });

    it('should not let a non-participant subscribe to live tracking', async () => {
      const stranger = await connect('stranger-token');
      const driver = await connect('driver-token');

      const refused = waitFor<{ message: string }>(stranger, 'tracking:error');
      stranger.emit('tracking:join', BOOKING_ID);
      expect((await refused).message).toBe('Not authorized to track this booking');

      const silence = expectNoEvent(stranger, 'driver:location:updated');
      driver.emit('driver:location:update', {
        bookingId: BOOKING_ID,
        location: { type: 'Point', coordinates: [77.1, 28.7] },
        timestamp: Date.now(),
      });
      await silence;
    });
  });

  describe('Live Chat Messaging', () => {
    it('should send and receive messages in real-time', async () => {
      (Message.create as jest.Mock).mockResolvedValue({ _id: 'msg1', createdAt: new Date() });
      const rider = await connect('rider-token');
      const driver = await connect('driver-token');

      const received = waitFor<{ content: string; senderId: string }>(driver, 'chat:message:receive');
      rider.emit('chat:message:send', { bookingId: BOOKING_ID, content: 'Where are you located?' });

      const data = await received;
      expect(data.content).toBe('Where are you located?');
      expect(data.senderId).toBe(RIDER_ID);
    });

    it('should mark messages as read for a participant only', async () => {
      const rider = await connect('rider-token');
      const stranger = await connect('stranger-token');

      stranger.emit('chat:messages:read', { bookingId: BOOKING_ID });
      await tick();
      expect(Message.updateMany).not.toHaveBeenCalled();

      rider.emit('chat:messages:read', { bookingId: BOOKING_ID });
      await tick();
      expect(Message.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ booking: BOOKING_ID, receiver: RIDER_ID }),
        { $set: expect.objectContaining({ isRead: true }) },
      );
    });
  });

  describe('SOS Emergency Handling', () => {
    it('should broadcast an SOS alert to admins monitoring SOS', async () => {
      mockTriggerSOS.mockResolvedValue({ _id: EMERGENCY_ID, liveTrackingUrl: 'https://example.com/t' });
      const admin = await connect('admin-token');
      admin.emit('admin:sos:join');
      await tick();

      const rider = await connect('rider-token');
      const alert = waitFor<{ emergencyId: string }>(admin, 'sos:alert');
      rider.emit('sos:trigger', { bookingId: BOOKING_ID, location: { lng: 77.1, lat: 28.7 } });

      expect((await alert).emergencyId).toBe(EMERGENCY_ID);
      expect(mockTriggerSOS).toHaveBeenCalledWith(RIDER_ID, expect.objectContaining({ bookingId: BOOKING_ID }));
    });

    it('should relay SOS location updates through the ownership-checked service', async () => {
      mockUpdateSOSLocation.mockResolvedValue(undefined);
      const admin = await connect('admin-token');
      admin.emit('admin:sos:join');
      await tick();

      const rider = await connect('rider-token');
      const update = waitFor<{ location: unknown }>(admin, 'sos:location:updated');
      rider.emit('sos:location:update', { emergencyId: EMERGENCY_ID, location: { lng: 77.105, lat: 28.705 } });

      expect((await update).location).toEqual({ lng: 77.105, lat: 28.705 });
      expect(mockUpdateSOSLocation).toHaveBeenCalledWith(EMERGENCY_ID, RIDER_ID, { lng: 77.105, lat: 28.705 });
    });

    it('should not broadcast SOS location when the service rejects the sender', async () => {
      mockUpdateSOSLocation.mockRejectedValue(new Error('You do not have access to update this SOS record'));
      const admin = await connect('admin-token');
      admin.emit('admin:sos:join');
      await tick();

      const stranger = await connect('stranger-token');
      const silence = expectNoEvent(admin, 'sos:location:updated');
      stranger.emit('sos:location:update', { emergencyId: EMERGENCY_ID, location: { lng: 1, lat: 1 } });
      await silence;
    });
  });

  describe('Presence', () => {
    it('should notify the booking counterpart when a user disconnects', async () => {
      const rider = await connect('rider-token');
      const driver = await connect('driver-token');

      const offline = waitFor<{ userId: string }>(rider, 'user:offline');
      driver.disconnect();

      expect((await offline).userId).toBe(DRIVER_ID);
    });
  });

  describe('Authorization and Security', () => {
    it('should reject unauthenticated connections', async () => {
      await expect(connect()).rejects.toThrow('Authentication required');
    });

    it('should reject invalid tokens', async () => {
      await expect(connect('forged-token')).rejects.toThrow('Invalid token');
    });

    it('should prevent riders from joining admin-only rooms', async () => {
      const rider = await connect('rider-token');
      const refused = waitFor<{ message: string }>(rider, 'error');
      rider.emit('admin:sos:join');
      expect((await refused).message).toContain('Admin access required');
    });
  });
});
