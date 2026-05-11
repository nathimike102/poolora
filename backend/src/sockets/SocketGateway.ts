import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getRedisPub, getRedisSub, getRedisClient } from '../config/redis';
import { JWTPayload, LocationUpdate, DistanceMilestone } from '../types';
import { Message } from '../models/Message';
import { Booking } from '../models/Booking';
import { EmergencyRecord } from '../models/EmergencyRecord';
import { haversineDistanceKm } from '../utils/helpers';
import { AuthorizationError, ConflictError, NotFoundError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { EventBridge } from '../events';
import { BookingStatus, UserCapability } from '../types';

interface AuthenticatedSocket extends Socket {
  userId: string;
  sessionId: string;
}

interface DriverLocationInput {
  bookingId: string;
  location: {
    lng: number;
    lat: number;
  };
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp?: number;
}

interface DriverLocationResult {
  bookingId: string;
  driverId: string;
  riderId: string;
  location: {
    lng: number;
    lat: number;
  };
  speed: number;
  heading: number;
  accuracy: number;
  timestamp: number;
}

export class SocketGateway {
  private static instance: SocketGateway | null = null;
  private io!: Server;

  /**
   * Initialize Socket.io with Redis adapter for horizontal scaling.
   */
  initialize(httpServer: HttpServer): Server {
    SocketGateway.instance = this;
    this.io = new Server(httpServer, {
      cors: {
        origin: config.cors.origin,
        credentials: true,
      },
      pingTimeout: 30000,
      pingInterval: 10000,
      transports: ['websocket', 'polling'],
    });

    // Redis adapter for multi-instance pub/sub
    const pubClient = getRedisPub();
    const subClient = getRedisSub();
    if (pubClient && subClient) {
      try {
        this.io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.io Redis adapter connected');
      } catch {
        logger.warn('Socket.io running without Redis adapter (single-instance mode)');
      }
    } else {
      logger.warn('Socket.io running without Redis adapter (Redis not available)');
    }

    // JWT authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token =
          socket.handshake.auth.token ||
          socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication required'));
        }

        const payload = jwt.verify(token, config.jwt.accessSecret) as JWTPayload;

        // Verify session in Redis (skip if Redis unavailable)
        const redis = getRedisClient();
        if (redis) {
          const sessionExists = await redis.exists(`session:${payload.userId}:${payload.sessionId}`);
          if (!sessionExists) {
            return next(new Error('Session expired'));
          }
        }

        (socket as AuthenticatedSocket).userId = payload.userId;
        (socket as AuthenticatedSocket).sessionId = payload.sessionId;

        next();
      } catch {
        next(new Error('Invalid token'));
      }
    });

    this.io.on('connection', (socket) => {
      const authSocket = socket as AuthenticatedSocket;
      const userId = authSocket.userId;

      // Mark user online
      const redis = getRedisClient();
      if (redis) {
        redis.set(`online:user:${userId}`, '1', 'EX', 60 * 60);
      }

      logger.info('Socket connected', { userId, socketId: socket.id });

      // Join user's personal room
      socket.join(`user:${userId}`);

      // Notify only users in active bookings with this user (not global broadcast)
      this.notifyCounterparts(userId, 'user:online', { userId });
      this.registerLocationHandlers(authSocket);
      this.registerChatHandlers(authSocket);
      this.registerSOSHandlers(authSocket);

      socket.on('disconnect', async (reason) => {

        const redis = getRedisClient();

        if (redis) {
        await redis.del(`online:user:${userId}`);
      }

      // Notify only users in active bookings with this user (not global broadcast)
      this.notifyCounterparts(userId, 'user:offline', {
        userId,
        lastSeen: Date.now(),
      });

      logger.info('Socket disconnected', { userId, reason });

    });

      socket.on('error', (error) => {
        logger.error('Socket error', { userId, error: error.message });
      });
    });

    return this.io;
  }

  // ─── Location Tracking ─────────────────────────────────────────────────────

  private registerLocationHandlers(socket: AuthenticatedSocket): void {
    /**
     * Driver emits GPS coordinates every 5 seconds.
     * System calculates distance milestones and broadcasts to riders.
     */
    socket.on('driver:location:update', async (data: LocationUpdate) => {
      try {
        const [lng, lat] = data.location.coordinates;
        await this.handleDriverLocationUpdate(socket.userId, {
          bookingId: data.bookingId,
          location: { lng, lat },
          speed: data.speed,
          heading: data.heading,
          accuracy: data.accuracy,
          timestamp: data.timestamp,
        });
      } catch (error) {
        logger.error('Location update error', { error: (error as Error).message });
        socket.emit('tracking:error', { message: 'Failed to process location update' });
      }
    });

    /**
     * Join tracking room for a booking.
     */
    socket.on('tracking:join', (bookingId: string) => {
      socket.join(`tracking:${bookingId}`);
      logger.debug('Joined tracking room', { userId: socket.userId, bookingId });
    });

    socket.on('tracking:leave', (bookingId: string) => {
      socket.leave(`tracking:${bookingId}`);
    });
  }

  /**
   * Shared location processing used by both WebSocket events and REST API.
   * Persists latest coordinates in Redis and emits updates to rider listeners.
   */
  async handleDriverLocationUpdate(
    driverId: string,
    data: DriverLocationInput,
  ): Promise<DriverLocationResult> {
    const { bookingId, location, speed = 0, heading = 0, accuracy = 0 } = data;
    const timestamp = data.timestamp ?? Date.now();

    const booking = await Booking.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    if (booking.driver.toString() !== driverId) {
      throw new AuthorizationError('Only the assigned driver can send location updates');
    }

    const nonTrackableStatuses = [
      BookingStatus.CANCELLED,
      BookingStatus.REJECTED,
      BookingStatus.PAYMENT_FAILED,
    ];
    if (nonTrackableStatuses.includes(booking.status)) {
      throw new ConflictError('Cannot update location for an inactive booking');
    }

    const { lng, lat } = location;
    const redis = getRedisClient();
    if (redis) {
      await redis.geoadd(
        `tracking:${bookingId}`,
        lng,
        lat,
        `driver:${driverId}`,
      );

      await redis.setex(
        `location:${driverId}`,
        60,
        JSON.stringify({ lng, lat, speed, heading, accuracy, timestamp }),
      );

      await redis.setex(
        `booking:${bookingId}:driver:location`,
        60,
        JSON.stringify({ driverId, lng, lat, speed, heading, accuracy, timestamp }),
      );
    }

    const riderId = booking.rider.toString();
    const updatePayload: DriverLocationResult = {
      bookingId,
      driverId,
      riderId,
      location: { lng, lat },
      speed,
      heading,
      accuracy,
      timestamp,
    };

    this.io.to(`user:${riderId}`).emit('driver:location:updated', updatePayload);
    this.io.to(`tracking:${bookingId}`).emit('driver:location:updated', updatePayload);

    const pickupLat = booking.pickup.location.coordinates[1];
    const pickupLng = booking.pickup.location.coordinates[0];
    const distanceKm = haversineDistanceKm(lat, lng, pickupLat, pickupLng);

    const milestone = this.calculateMilestone(distanceKm, speed);
    if (milestone) {
      const milestonePayload = { bookingId, ...milestone };
      this.io.to(`user:${riderId}`).emit('driver:milestone', milestonePayload);
      this.io.to(`tracking:${bookingId}`).emit('driver:milestone', milestonePayload);
    }

    const routeDeviationKey = `route:deviation:${bookingId}`;
    if (distanceKm > 10 && redis) {
      const alreadyNotified = await redis.exists(routeDeviationKey);
      if (!alreadyNotified) {
        await redis.setex(routeDeviationKey, 300, '1');

        const deviationPayload = {
          bookingId,
          message: 'Driver may have deviated from the expected route',
          currentLocation: { lng, lat },
          timestamp,
        };
        this.io.to(`user:${riderId}`).emit('route:deviated', deviationPayload);
        this.io.to(`tracking:${bookingId}`).emit('route:deviated', deviationPayload);
      }
    }

    EventBridge.publish('location-events', {
      eventType: 'driver.location.updated',
      data: {
        bookingId,
        driverId,
        riderId,
        location: { lng, lat },
        speed,
        heading,
        accuracy,
        timestamp,
      },
    });

    return updatePayload;
  }

  static getInstance(): SocketGateway | null {
    return SocketGateway.instance;
  }

  /**
   * Calculate distance milestones for approach alerts.
   */
  private calculateMilestone(
    distanceKm: number,
    speed: number,
  ): DistanceMilestone | null {
    // Speed ~0 and within 500m → arrived
    if (distanceKm < 0.5 && speed < 5) {
      return {
        distanceKm,
        estimatedMins: 0,
        message: 'Driver has arrived',
      };
    }

    // < 1km
    if (distanceKm <= 1 && distanceKm > 0.5) {
      const eta = speed > 0 ? Math.round((distanceKm / (speed / 60)) * 10) / 10 : 5;
      return {
        distanceKm: Math.round(distanceKm * 10) / 10,
        estimatedMins: Math.min(eta, 5),
        message: `Driver is ${Math.round(distanceKm * 1000)}m away (~${Math.min(Math.round(eta), 5)} mins)`,
      };
    }

    // < 5km
    if (distanceKm <= 5 && distanceKm > 1) {
      const avgSpeedKmh = speed > 0 ? speed : 30;
      const eta = Math.round((distanceKm / avgSpeedKmh) * 60);
      return {
        distanceKm: Math.round(distanceKm * 10) / 10,
        estimatedMins: eta,
        message: `Driver is ${Math.round(distanceKm)}km away (~${eta} mins)`,
      };
    }

    return null;
  }

  // ─── Chat ──────────────────────────────────────────────────────────────────

  private registerChatHandlers(socket: AuthenticatedSocket): void {
    /**
     * Real-time chat messages via WebSocket.
     */
    socket.on('chat:message:send', async (data: {
      bookingId: string;
      content: string;
      contentType?: string;
    }) => {
      try {
        const { bookingId, content, contentType = 'text' } = data;

        const booking = await Booking.findById(bookingId);
        if (!booking) return;

        const isRider = booking.rider.toString() === socket.userId;
        const isDriver = booking.driver.toString() === socket.userId;
        if (!isRider && !isDriver) return;

        const receiverId = isRider
          ? booking.driver.toString()
          : booking.rider.toString();

        // Persist message
        const message = await Message.create({
          booking: bookingId,
          sender: socket.userId,
          receiver: receiverId,
          content,
          contentType,
        });

        // Deliver in real-time to receiver
        this.io.to(`user:${receiverId}`).emit('chat:message:receive', {
          messageId: message._id,
          bookingId,
          senderId: socket.userId,
          content,
          contentType,
          timestamp: message.createdAt,
        });

        // Acknowledge to sender
        socket.emit('chat:message:sent', {
          messageId: message._id,
          bookingId,
          timestamp: message.createdAt,
        });

        // TODO: FCM push notification for offline users
      } catch (error) {
        logger.error('Chat message error', { error: (error as Error).message });
        socket.emit('chat:error', { message: 'Failed to send message' });
      }
    });

    /**
     * Mark messages as read via socket.
     */
    socket.on('chat:messages:read', async (data: { bookingId: string }) => {
      try {
        await Message.updateMany(
          { booking: data.bookingId, receiver: socket.userId, isRead: false },
          { $set: { isRead: true, readAt: new Date() } },
        );

        // Notify sender that messages were read
        const booking = await Booking.findById(data.bookingId);
        if (booking) {
          const otherUserId =
            booking.rider.toString() === socket.userId
              ? booking.driver.toString()
              : booking.rider.toString();

          this.io.to(`user:${otherUserId}`).emit('chat:messages:read', {
            bookingId: data.bookingId,
            readBy: socket.userId,
          });
        }
      } catch (error) {
        logger.error('Chat read error', { error: (error as Error).message });
      }
    });
    // typing indicator
socket.on('chat:typing:start', async (data: { bookingId: string }) => {
  const booking = await Booking.findById(data.bookingId);
  if (!booking) return;

  const otherUserId =
    booking.rider.toString() === socket.userId
      ? booking.driver.toString()
      : booking.rider.toString();

  this.io.to(`user:${otherUserId}`).emit('chat:typing', {
    bookingId: data.bookingId,
    userId: socket.userId,
  });
});

socket.on('chat:typing:stop', async (data: { bookingId: string }) => {
  const booking = await Booking.findById(data.bookingId);
  if (!booking) return;

  const otherUserId =
    booking.rider.toString() === socket.userId
      ? booking.driver.toString()
      : booking.rider.toString();

  this.io.to(`user:${otherUserId}`).emit('chat:typing:stop', {
    bookingId: data.bookingId,
    userId: socket.userId,
  });
});
  }

  // ─── SOS ───────────────────────────────────────────────────────────────────

  private registerSOSHandlers(socket: AuthenticatedSocket): void {
    /**
     * High-frequency SOS location updates (every 5 seconds).
     */
    socket.on('sos:location:update', async (data: {
      emergencyId: string;
      location: { lng: number; lat: number };
    }) => {
      try {
        const { emergencyId, location } = data;

        const record = await EmergencyRecord.findById(emergencyId);
        if (!record || record.triggeredBy.toString() !== socket.userId) return;

        // Add to location history
        record.locationHistory.push({
          location: {
            type: 'Point',
            coordinates: [location.lng, location.lat],
          },
          timestamp: new Date(),
        });
        await record.save();

        // Broadcast to admin dashboard
        this.io.to('admin:sos').emit('sos:location:updated', {
          emergencyId,
          userId: socket.userId,
          location,
          timestamp: Date.now(),
        });

        // Publish to Kafka
        EventBridge.publish('safety-events', {
          eventType: 'sos.location.updated',
          data: { emergencyId, location, timestamp: Date.now() },
        });
      } catch (error) {
        logger.error('SOS location update error', { error: (error as Error).message });
      }
    });

    /**
     * Admin joins SOS monitoring room.
     * Only users with ADMIN capability can join.
     */
    socket.on('admin:sos:join', () => {
      // Verify the user has admin capability before allowing join
      // We need to look up capabilities from JWT payload
      // The JWT token was already validated in the auth middleware
      const token = socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');
      try {
        const payload = jwt.verify(token!, config.jwt.accessSecret) as JWTPayload;
        if (!payload.capabilities?.includes(UserCapability.ADMIN)) {
          socket.emit('error', { message: 'Admin access required' });
          logger.warn('Non-admin tried to join SOS monitoring', { userId: socket.userId });
          return;
        }
        socket.join('admin:sos');
        logger.info('Admin joined SOS monitoring', { userId: socket.userId });
      } catch {
        socket.emit('error', { message: 'Authentication failed' });
      }
    });
  }

  /**
   * Notify only users who are in an active booking with the given user.
   * Prevents broadcasting presence events to all connected clients.
   */
  private async notifyCounterparts(
    userId: string,
    event: string,
    payload: Record<string, any>,
  ): Promise<void> {
    try {
      // Find active bookings where this user is either rider or driver
      const activeBookings = await Booking.find({
        $or: [{ rider: userId }, { driver: userId }],
        status: { $in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
      }).select('rider driver').lean();

      // Collect unique counterpart user IDs
      const counterpartIds = new Set<string>();
      for (const booking of activeBookings) {
        const riderId = booking.rider.toString();
        const driverId = booking.driver.toString();
        if (riderId !== userId) counterpartIds.add(riderId);
        if (driverId !== userId) counterpartIds.add(driverId);
      }

      // Emit to each counterpart's personal room
      for (const id of counterpartIds) {
        this.io.to(`user:${id}`).emit(event, payload);
      }
    } catch (error) {
      logger.error('Failed to notify counterparts', { userId, event, error: (error as Error).message });
    }
  }

  /**
   * Get the Socket.io server instance.
   */
  getIO(): Server {
    return this.io;
  }
}
