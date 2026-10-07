/**
 * Company programmes (UC-C01, UC-C02) against a real MongoDB: admins set a
 * company up with its own email domains, and staff join by confirming a
 * work email from a link that expires after a day.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockSent: Array<{ to: string; text: string }> = [];
jest.mock('../../services/Mailer', () => ({
  ...jest.requireActual('../../services/Mailer'),
  mailEnabled: () => true,
  sendMail: jest.fn(async (mail: { to: string; text: string }) => {
    mockSent.push(mail);
    return true;
  }),
}));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { Organisation } from '../../models/Organisation';
import { User } from '../../models/User';
import { AdminAuditLog } from '../../models/AdminAuditLog';
import { OrganisationService, WORK_LINK_TTL_MS } from '../../services/OrganisationService';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const service = new OrganisationService();
const adminId = new Types.ObjectId();
const tendai = new Types.ObjectId();
const rudo = new Types.ObjectId();

const linkToken = () => /\/track\/work\/([A-Za-z0-9_-]{32})/.exec(mockSent.at(-1)!.text)![1];
const company = (overrides: Record<string, unknown> = {}) =>
  service.create({ name: 'Econet', domains: ['econet.co.zw'], billingContact: { name: 'Accounts', email: 'accounts@econet.co.zw' }, ...overrides }, adminId.toString());

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([Organisation.init(), User.init()]);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  mockSent.length = 0;
  await Promise.all([Organisation.deleteMany({}), User.deleteMany({}), AdminAuditLog.deleteMany({})]);
  await User.collection.insertMany([
    { _id: tendai, name: 'Tendai Moyo', phone: '+263771000001', capabilities: ['rider'], stats: {} },
    { _id: rudo, name: 'Rudo Dube', phone: '+263771000002', capabilities: ['rider'], stats: {} },
  ]);
});

describe('setting a company up (UC-C01)', () => {
  it('creates it with its domains and records who did', async () => {
    const { organisation } = await company({ domains: ['@Econet.co.zw', 'econet.co.zw', 'cassava.co.zw'] });
    expect(organisation.domains).toEqual(['econet.co.zw', 'cassava.co.zw']);
    expect(await AdminAuditLog.countDocuments({ action: 'organisation.create' })).toBe(1);
  });

  it('refuses public email services and domains another company has', async () => {
    await expect(company({ domains: ['gmail.com'] })).rejects.toMatchObject({ errorId: 'PUBLIC_DOMAIN' });
    await company();
    await expect(service.create({ name: 'Other', domains: ['econet.co.zw'], billingContact: { name: 'Accounts', email: 'a@other.co.zw' } }, adminId.toString()))
      .rejects.toThrow('econet.co.zw already belongs to Econet');
  });

  it('needs a name and a billing contact', async () => {
    await expect(company({ name: '' })).rejects.toMatchObject({ statusCode: 422 });
    await expect(company({ billingContact: { name: 'Accounts', email: 'not an email' } })).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('joining with a work email (UC-C02)', () => {
  it('sends a link, and the person is a member once they confirm it', async () => {
    const { organisation } = await company();
    const sent = await service.requestJoin(tendai.toString(), 'Tendai.Moyo@econet.co.zw');
    expect(sent).toEqual({ sentTo: 'tendai.moyo@econet.co.zw', company: 'Econet' });
    expect(mockSent[0].to).toBe('tendai.moyo@econet.co.zw');

    const token = linkToken();
    // Opening the page does not join; only Confirm does
    expect(await service.peek(token)).toEqual({ firstName: 'Tendai', company: 'Econet', email: 'tendai.moyo@econet.co.zw' });
    expect((await service.status(tendai.toString())).work).toBeNull();

    expect(await service.confirm(token)).toEqual({ firstName: 'Tendai', company: 'Econet' });
    const status = await service.status(tendai.toString());
    expect(status.work).toMatchObject({ organisation: { _id: organisation._id, name: 'Econet', active: true }, email: 'tendai.moyo@econet.co.zw' });
    expect(status.pending).toBeNull();
    // A link works once
    expect(await service.confirm(token)).toBeNull();
    expect((await service.get(organisation._id)).members).toHaveLength(1);
  });

  it('tells people whose company is not on Siham', async () => {
    await company();
    await expect(service.requestJoin(tendai.toString(), 'me@delta.co.zw')).rejects.toMatchObject({ errorId: 'NO_COMPANY_PROGRAMME' });
    await expect(service.requestJoin(tendai.toString(), 'not-an-email')).rejects.toMatchObject({ statusCode: 422 });
  });

  it('lets a work email belong to one account only', async () => {
    await company();
    await service.requestJoin(tendai.toString(), 'shared@econet.co.zw');
    await service.confirm(linkToken());
    await expect(service.requestJoin(rudo.toString(), 'shared@econet.co.zw')).rejects.toThrow('linked to another Siham account');
  });

  it('sends at most one link every ten minutes', async () => {
    await company();
    await service.requestJoin(tendai.toString(), 'tendai@econet.co.zw');
    await expect(service.requestJoin(tendai.toString(), 'tendai@econet.co.zw')).rejects.toMatchObject({ errorId: 'WORK_LINK_RATE_LIMITED' });
  });

  it('does not accept a link after a day', async () => {
    await company();
    await service.requestJoin(tendai.toString(), 'tendai@econet.co.zw');
    const token = linkToken();
    await User.updateOne({ _id: tendai }, { $set: { 'workPending.sentAt': new Date(Date.now() - WORK_LINK_TTL_MS - 1000) } });
    expect(await service.peek(token)).toBeNull();
    expect(await service.confirm(token)).toBeNull();
  });

  it('does not accept a link once the company is suspended or the domain removed', async () => {
    const { organisation } = await company({ domains: ['econet.co.zw', 'cassava.co.zw'] });
    await service.requestJoin(tendai.toString(), 'tendai@cassava.co.zw');
    const token = linkToken();
    await service.update(organisation._id, { domains: ['econet.co.zw'] }, adminId.toString());
    expect(await service.confirm(token)).toBeNull();

    await service.update(organisation._id, { status: 'suspended' }, adminId.toString());
    await expect(service.requestJoin(rudo.toString(), 'rudo@econet.co.zw')).rejects.toMatchObject({ errorId: 'NO_COMPANY_PROGRAMME' });
  });

  it('lets a member leave, and an admin remove someone who left the company', async () => {
    const { organisation } = await company();
    for (const [id, email] of [[tendai, 'tendai@econet.co.zw'], [rudo, 'rudo@econet.co.zw']] as const) {
      await service.requestJoin(id.toString(), email);
      await service.confirm(linkToken());
    }
    await service.leave(tendai.toString());
    expect((await service.status(tendai.toString())).work).toBeNull();

    await service.removeMember(organisation._id, rudo.toString(), adminId.toString(), 'Left Econet');
    expect((await service.get(organisation._id)).members).toHaveLength(0);
    expect((await service.list()).organisations[0].members).toBe(0);
    await expect(service.removeMember(organisation._id, rudo.toString(), adminId.toString())).rejects.toMatchObject({ statusCode: 404 });
  });
});
