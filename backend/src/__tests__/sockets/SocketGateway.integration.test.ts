/**
 * Integration tests for SocketGateway
 * Tests real-time flows:
 * - Real-time location tracking
 * - Live chat messaging
 * - SOS emergency handling
 * - Booking state synchronization
 */

import { Server as HttpServer } from 'http';
import { Socket as ClientSocket, io } from 'socket.io-client';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { Booking } from '../../models/Booking';
import { EmergencyRecord } from '../../models/EmergencyRecord';
import { Message } from '../../models/Message';
import { SocketGateway } from '../../sockets/SocketGateway';
import { EventBridge } from '../../events';
import { BookingStatus } from '../../types';

describe('SocketGateway Integration Tests', () => {
  let httpServer: HttpServer;
  let socketGateway: SocketGateway;
  let clientSocket: ClientSocket;
  let riderSocket: ClientSocket;
  let driverSocket: ClientSocket;

  const TEST_PORT = 3001;
  const TEST_URL = `http://localhost:${TEST_PORT}`;

  const DRIVER_JWT =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJkcml2ZXIxMjMiLCJwaG9uZSI6IisxMjM0NTY3ODkwIiwiY2FwYWJpbGl0aWVzIjpbImRyaXZlciJdLCJkcml2ZXJWZXJpZmllZCI6dHJ1ZSwic2Vzc2lvbklkIjoic2Vzc2lkMSJ9.sig';
  const RIDER_JWT =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJyaWRlcjEyMyIsInBob25lIjoiKzEyMzQ1Njc4OTEiLCJjYXBhYmlsaXRpZXMiOlsicmlkZXIiXSwiZHJpdmVyVmVyaWZpZWQiOmZhbHNlLCJzZXNzaW9uSWQiOiJzZXNzaWQyIn0.sig';

  beforeAll((done) => {
    httpServer = createServer();
    socketGateway = SocketGateway.getInstance(httpServer);

    httpServer.listen(TEST_PORT, () => {
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket) clientSocket.disconnect();
    if (riderSocket) riderSocket.disconnect();
    if (driverSocket) driverSocket.disconnect();

    httpServer.close(done);
  });

  describe('Real-time Location Tracking', () => {
    it('should broadcast driver location to rider in real-time', (done) => {
      const bookingId = 'booking123';
      const location = { lng: 77.1025, lat: 28.7041 };

      jest.spyOn(Booking, 'findById').mockResolvedValueOnce({
        _id: bookingId,
        driver: 'driver123',
        rider: 'rider123',
        status: BookingStatus.CONFIRMED,
      } as any);

      driverSocket = io(TEST_URL, {
        auth: { token: DRIVER_JWT },
      });

      riderSocket = io(TEST_URL, {
        auth: { token: RIDER_JWT },
      });

      riderSocket.on('connect', () => {
        riderSocket.emit('join-booking', { bookingId });

        riderSocket.on('driver-location', (data) => {
          expect(data.location).toEqual(location);
          expect(data.driverId).toBe('driver123');
          expect(data.bookingId).toBe(bookingId);
          done();
        });

        driverSocket.on('connect', () => {
          driverSocket.emit('update-location', {
            bookingId,
            location,
            speed: 45,
            heading: 120,
          });
        });
      });
    });

    it('should track multiple location updates and calculate distance milestones', (done) => {
      const bookingId = 'booking456';
      const locations = [
        { lng: 77.1, lat: 28.7 },
        { lng: 77.11, lat: 28.71 },
        { lng: 77.12, lat: 28.72 },
      ];

      jest.spyOn(EventBridge, 'emit');

      driverSocket = io(TEST_URL, {
        auth: { token: DRIVER_JWT },
      });

      driverSocket.on('connect', () => {
        let updateCount = 0;

        driverSocket.on('milestone-reached', (data) => {
          if (data.milestone === 'halfway') {
            expect(EventBridge.emit).toHaveBeenCalledWith(
              'location:milestone',
              expect.objectContaining({
                bookingId,
                milestone: 'halfway',
              })
            );
            done();
          }
        });

        // Send multiple location updates
        locations.forEach((loc) => {
          setTimeout(() => {
            driverSocket.emit('update-location', {
              bookingId,
              location: loc,
            });
          }, updateCount++ * 100);
        });
      });
    });
  });

  describe('Live Chat Messaging', () => {
    it('should send and receive messages in real-time', (done) => {
      const bookingId = 'booking789';
      const message = 'Where are you located?';

      riderSocket = io(TEST_URL, {
        auth: { token: RIDER_JWT },
      });

      driverSocket = io(TEST_URL, {
        auth: { token: DRIVER_JWT },
      });

      jest.spyOn(Message, 'create').mockResolvedValueOnce({
        _id: 'msg1',
        booking: bookingId,
        sender: 'rider123',
        text: message,
        createdAt: new Date(),
      } as any);

      riderSocket.on('connect', () => {
        riderSocket.emit('join-chat', { bookingId });

        driverSocket.on('connect', () => {
          driverSocket.emit('join-chat', { bookingId });

          driverSocket.on('receive-message', (data) => {
            expect(data.text).toBe(message);
            expect(data.sender).toBe('rider123');
            done();
          });

          riderSocket.emit('send-message', {
            bookingId,
            text: message,
          });
        });
      });
    });

    it('should mark messages as read', (done) => {
      const bookingId = 'booking101';

      jest.spyOn(Message, 'updateMany');

      riderSocket = io(TEST_URL, {
        auth: { token: RIDER_JWT },
      });

      riderSocket.on('connect', () => {
        riderSocket.emit('join-chat', { bookingId });

        riderSocket.emit('messages-read', { bookingId });

        setTimeout(() => {
          expect(Message.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
              booking: bookingId,
              receiver: 'rider123',
            }),
            { read: true }
          );
          done();
        }, 100);
      });
    });
  });

  describe('SOS Emergency Handling', () => {
    it('should broadcast SOS alert to admin and counterpart', (done) => {
      const emergencyId = 'emergency123';
      const bookingId = 'booking202';

      jest.spyOn(EmergencyRecord, 'findById').mockResolvedValueOnce({
        _id: emergencyId,
        booking: bookingId,
        status: 'triggered',
        location: { lng: 77.1, lat: 28.7 },
      } as any);

      jest.spyOn(Booking, 'findById').mockResolvedValueOnce({
        _id: bookingId,
        rider: 'rider123',
        driver: 'driver123',
      } as any);

      const adminSocket = io(TEST_URL, {
        auth: {
          token: 'admin_jwt_token',
        },
      });

      riderSocket = io(TEST_URL, {
        auth: { token: RIDER_JWT },
      });

      adminSocket.on('connect', () => {
        adminSocket.emit('join-room', { room: 'admin:sos' });

        riderSocket.on('connect', () => {
          riderSocket.emit('trigger-sos', {
            bookingId,
            location: { lng: 77.1, lat: 28.7 },
          });

          adminSocket.on('sos-alert', (data) => {
            expect(data.emergencyId).toBe(emergencyId);
            expect(data.status).toBe('triggered');
            adminSocket.disconnect();
            riderSocket.disconnect();
            done();
          });
        });
      });
    });

    it('should track SOS location updates', (done) => {
      const emergencyId = 'emergency456';
      const locations = [
        { lng: 77.1, lat: 28.7 },
        { lng: 77.105, lat: 28.705 },
      ];

      jest.spyOn(EmergencyRecord, 'findById').mockResolvedValue({
        _id: emergencyId,
        status: 'triggered',
      } as any);

      const adminSocket = io(TEST_URL, {
        auth: { token: 'admin_jwt_token' },
      });

      adminSocket.on('connect', () => {
        adminSocket.emit('join-room', { room: 'admin:sos' });

        let updateCount = 0;

        adminSocket.on('sos-location-update', (data) => {
          updateCount++;
          if (updateCount === locations.length) {
            expect(data.location).toEqual(locations[locations.length - 1]);
            adminSocket.disconnect();
            done();
          }
        });

        riderSocket = io(TEST_URL, {
          auth: { token: RIDER_JWT },
        });

        riderSocket.on('connect', () => {
          locations.forEach((loc, idx) => {
            setTimeout(() => {
              riderSocket.emit('update-sos-location', {
                emergencyId,
                location: loc,
              });
            }, idx * 100);
          });
        });
      });
    });
  });

  describe('Booking State Synchronization', () => {
    it('should sync booking status changes to all participants', (done) => {
      const bookingId = 'booking303';

      jest.spyOn(Booking, 'findById').mockResolvedValueOnce({
        _id: bookingId,
        rider: 'rider123',
        driver: 'driver123',
        status: BookingStatus.CONFIRMED,
      } as any);

      riderSocket = io(TEST_URL, {
        auth: { token: RIDER_JWT },
      });

      driverSocket = io(TEST_URL, {
        auth: { token: DRIVER_JWT },
      });

      let syncCount = 0;

      riderSocket.on('booking-status-changed', (data) => {
        expect(data.status).toBe(BookingStatus.IN_PROGRESS);
        syncCount++;
        if (syncCount === 2) done();
      });

      driverSocket.on('booking-status-changed', (data) => {
        expect(data.status).toBe(BookingStatus.IN_PROGRESS);
        syncCount++;
        if (syncCount === 2) done();
      });

      riderSocket.on('connect', () => {
        riderSocket.emit('join-booking', { bookingId });

        driverSocket.on('connect', () => {
          driverSocket.emit('join-booking', { bookingId });

          // Simulate status change from driver
          driverSocket.emit('start-ride', { bookingId });
        });
      });
    });

    it('should handle rider and driver disconnection gracefully', (done) => {
      const bookingId = 'booking404';

      riderSocket = io(TEST_URL, {
        auth: { token: RIDER_JWT },
      });

      driverSocket = io(TEST_URL, {
        auth: { token: DRIVER_JWT },
      });

      riderSocket.on('connect', () => {
        riderSocket.emit('join-booking', { bookingId });

        driverSocket.on('connect', () => {
          driverSocket.emit('join-booking', { bookingId });

          // Wait a moment then disconnect driver
          setTimeout(() => {
            riderSocket.on('driver-disconnected', () => {
              expect(EventBridge.emit).toHaveBeenCalledWith('booking:participant-offline', 
                expect.anything()
              );
              done();
            });

            driverSocket.disconnect();
          }, 100);
        });
      });
    });
  });

  describe('Authorization and Security', () => {
    it('should reject unauthenticated connections', (done) => {
      const unauthSocket = io(TEST_URL);

      unauthSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        unauthSocket.disconnect();
        done();
      });

      setTimeout(() => {
        unauthSocket.disconnect();
        done();
      }, 2000);
    });

    it('should prevent riders from joining driver-only rooms', (done) => {
      riderSocket = io(TEST_URL, {
        auth: { token: RIDER_JWT },
      });

      riderSocket.on('connect', () => {
        riderSocket.emit('join-room', { room: 'drivers:location' });

        riderSocket.on('error', (error) => {
          expect(error).toContain('Not authorized');
          riderSocket.disconnect();
          done();
        });
      });
    });
  });
});