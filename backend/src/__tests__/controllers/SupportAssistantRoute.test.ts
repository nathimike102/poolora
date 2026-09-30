/**
 * The support assistant's routes: the app asks whether it is on, then sends
 * the conversation and gets the reply.
 */
import express from 'express';
import request from 'supertest';

jest.mock('../../middlewares/auth.middleware', () => ({
  authenticate: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { userId: '64b000000000000000000001' };
    next();
  },
}));
const mockReply = jest.fn();
let mockEnabled = true;
jest.mock('../../services/SupportBotService', () => ({
  supportBotEnabled: () => mockEnabled,
  SupportBotService: jest.fn().mockImplementation(() => ({ reply: mockReply })),
}));
jest.mock('../../services/SupportService', () => ({ SupportService: jest.fn() }));

import supportRoutes from '../../routes/support.routes';

const app = express();
app.use(express.json());
app.use('/support', supportRoutes);

describe('/support/assistant', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnabled = true;
  });

  it('says whether the assistant is on', async () => {
    expect((await request(app).get('/support/assistant')).body.data).toEqual({ enabled: true });
    mockEnabled = false;
    expect((await request(app).get('/support/assistant')).body.data).toEqual({ enabled: false });
  });

  it('passes the conversation to the assistant and returns its reply', async () => {
    mockReply.mockResolvedValue({ reply: 'Half, until 2 hours before.', ticketId: undefined });
    const messages = [{ role: 'user', text: 'How much do I get back if I cancel?' }];

    const res = await request(app).post('/support/assistant').send({ messages });

    expect(res.status).toBe(200);
    expect(res.body.data.reply).toBe('Half, until 2 hours before.');
    expect(mockReply).toHaveBeenCalledWith('64b000000000000000000001', messages);
  });

  it('refuses an empty or malformed conversation', async () => {
    expect((await request(app).post('/support/assistant').send({ messages: [] })).status).toBe(422);
    expect((await request(app).post('/support/assistant').send({ messages: [{ role: 'system', text: 'x' }] })).status).toBe(422);
    expect(mockReply).not.toHaveBeenCalled();
  });
});
