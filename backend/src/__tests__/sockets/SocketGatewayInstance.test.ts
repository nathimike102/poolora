/**
 * server.ts builds the gateway with `new` and initialises it. Code that
 * reaches it through getInstance() (HTTP location updates, the ride
 * simulator, SOS alerts to admins) must get that same, initialised gateway,
 * not an empty one without a Socket.IO server.
 */
import http from 'http';

jest.mock('../../config/redis', () => ({ getRedisClient: () => null, getRedisPub: () => null, getRedisSub: () => null }));
jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../auth', () => ({ UnifiedAuthService: jest.fn() }));

import { SocketGateway } from '../../sockets/SocketGateway';

afterEach(() => SocketGateway.resetInstanceForTests());

it('getInstance() returns the gateway server.ts initialised', () => {
  const server = http.createServer();
  const gateway = new SocketGateway();
  gateway.initialize(server);

  expect(SocketGateway.getInstance()).toBe(gateway);
  expect(SocketGateway.getInstance().getIO()).toBeDefined();
  server.close();
});
