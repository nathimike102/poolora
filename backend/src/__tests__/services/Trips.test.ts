/**
 * Group trips (UC-T01 to UC-T05): plan limits, joining, private trips,
 * compatibility search, split expenses, settling up and activity votes.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(undefined),
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { User } from '../../models/User';
import { TripService, settlementPlan } from '../../services/TripService';
import { Trip } from '../../models/Trip';

jest.setTimeout(60_000);

const DAY = 86_400_000;
let mongo: MongoMemoryServer;
const service = new TripService();
const [alice, bob, carol, dan] = [0, 1, 2, 3].map(() => new Types.ObjectId().toString());

const plan = (overrides: Record<string, unknown> = {}) => ({
  title: 'Goa long weekend',
  tripType: 'weekend' as const,
  startDate: new Date(Date.now() + 10 * DAY).toISOString(),
  endDate: new Date(Date.now() + 12 * DAY).toISOString(),
  destinations: [{ name: 'Goa' }],
  budgetPerPerson: 8000,
  interests: ['beach', 'food'],
  maxGroupSize: 3,
  ...overrides,
});

/** A trip Alice organises with Bob and Carol on it */
async function groupTrip() {
  const trip = await service.create(alice, plan());
  const id = trip._id.toString();
  for (const who of [bob, carol]) {
    await service.requestJoin(id, who, 'Count me in');
    const view = await service.get(id, alice);
    const request = (view.joinRequests as Array<{ _id: unknown; user: { _id: unknown } }>).find((r) => String(r.user._id) === who)!;
    await service.respond(id, alice, String(request._id), true);
  }
  return id;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  await User.collection.insertMany([alice, bob, carol, dan].map((id, i) => ({
    _id: new Types.ObjectId(id), name: ['Alice', 'Bob', 'Carol', 'Dan'][i], phone: `+91900000000${i}`, capabilities: ['rider'], kyc: { status: 'none' }, stats: {},
  })));
});

it('settles the UC-T03 example: Bob and Carol each owe Alice ₹1,000', () => {
  const balances = new Map([[alice, 200_000], [bob, -100_000], [carol, -100_000]]);
  expect(settlementPlan(balances)).toEqual([
    { from: bob, to: alice, amount: 1000 },
    { from: carol, to: alice, amount: 1000 },
  ]);
});

it('keeps group size and trip length within the rules', async () => {
  await expect(service.create(alice, plan({ maxGroupSize: 9 }))).rejects.toThrow('2 to 8 people');
  await expect(service.create(alice, plan({ endDate: new Date(Date.now() + 110 * DAY).toISOString() }))).rejects.toThrow('1 to 90 days');
});

it('joins by request, and refuses when the trip is full', async () => {
  const id = await groupTrip();
  await expect(service.requestJoin(id, dan)).rejects.toMatchObject({ errorId: 'TRIP_FULL' });
  const view = await service.get(id, bob);
  expect(view).toMatchObject({ isMember: true, isOrganizer: false });
  expect((view.members as unknown[]).length).toBe(3);
});

it('hides private trips unless you have the invite code', async () => {
  const trip = await service.create(alice, plan({ visibility: 'private' }));
  const id = trip._id.toString();
  await expect(service.get(id, dan)).rejects.toThrow('not found');
  expect(await service.search(dan, {})).toHaveLength(0);
  await expect(service.get(id, dan, trip.inviteCode)).resolves.toMatchObject({ isMember: false });
  await expect(service.byInviteCode(trip.inviteCode.toLowerCase(), dan)).resolves.toMatchObject({ title: 'Goa long weekend' });
  await expect(service.requestJoin(id, dan, undefined, trip.inviteCode)).resolves.toEqual({ status: 'pending' });
});

it('ranks trips by shared interests, dates and budget', async () => {
  await service.create(alice, plan({ title: 'Goa beaches', interests: ['beach', 'food'] }));
  await service.create(bob, plan({ title: 'Goa churches', interests: ['culture'], budgetPerPerson: 30000 }));
  const found = await service.search(carol, { destination: 'goa', interests: ['beach'], maxBudget: 10000 });
  expect(found.map((t) => t.title)).toEqual(['Goa beaches', 'Goa churches']);
  expect(found[0].compatibility).toBe(100);
});

it('splits expenses, suggests the fewest payments and records them', async () => {
  const id = await groupTrip();
  await service.addExpense(id, alice, { description: 'Hotel', amount: 3000 });
  await service.addExpense(id, bob, { description: 'Dinner', amount: 100, splitAmong: [bob, carol] });

  let report = await service.settlement(id, carol);
  expect(report.total).toBe(3100);
  expect(report.members.find((m) => m.userId === carol)).toMatchObject({ share: 1050, balance: -1050 });
  // Alice is owed 2,000; Bob owes 950 and Carol 1,050, so two payments settle it
  expect(report.transfers.map(({ from, to, amount }) => ({ from, to, amount }))).toEqual([
    { from: carol, to: alice, amount: 1050 },
    { from: bob, to: alice, amount: 950 },
  ]);

  await expect(service.setPayNumber(id, alice, '12345')).rejects.toThrow('Zimbabwe mobile number');
  await service.setPayNumber(id, alice, '0771 234 567');
  report = await service.settlement(id, carol);
  expect(report.transfers.find((t) => t.to === alice)).toMatchObject({ payNumber: '+263771234567', ecocashLink: 'tel:*151*1*1*0771234567*1050%23' });

  await expect(service.markSettled(id, dan, { from: carol, to: alice, amount: 1000 })).rejects.toThrow('not found');
  report = await service.markSettled(id, carol, { from: carol, to: alice, amount: 1000 });
  expect(report.members.find((m) => m.userId === carol)?.balance).toBe(-50);
  await expect(service.leave(id, carol)).rejects.toThrow('Settle up');
});

it('confirms an activity on a majority yes and adds its cost to the expenses', async () => {
  const id = await groupTrip();
  const activity = await service.proposeActivity(id, alice, { title: 'Dudhsagar trek', cost: 1500 });
  expect(activity.status).toBe('proposed'); // 1 of 3
  const decided = await service.vote(id, bob, activity._id.toString(), 'yes');
  expect(decided.status).toBe('confirmed');
  const expenses = await service.expenses(id, carol);
  expect(expenses).toEqual([expect.objectContaining({ description: 'Dudhsagar trek', amount: 1500 })]);
  await expect(service.vote(id, carol, activity._id.toString(), 'no')).rejects.toThrow('closed');

  const skipped = await service.proposeActivity(id, bob, { title: 'Casino night' });
  await service.vote(id, alice, skipped._id.toString(), 'no');
  expect((await service.vote(id, carol, skipped._id.toString(), 'no')).status).toBe('rejected');
});

describe('organizer ratings (UC-T02)', () => {
  it('lets each member rate the organizer once, after the trip', async () => {
    const id = await groupTrip();
    await expect(service.rateOrganizer(id, bob, 5)).rejects.toThrow('after the trip');

    await Trip.updateOne({ _id: id }, { startDate: new Date(Date.now() - 5 * DAY), endDate: new Date(Date.now() - 3 * DAY) });
    await expect(service.rateOrganizer(id, alice, 5)).rejects.toThrow('cannot rate yourself');
    await service.rateOrganizer(id, bob, 5, 'Great planning');
    await service.rateOrganizer(id, carol, 4);
    await expect(service.rateOrganizer(id, bob, 1)).rejects.toThrow('already rated');

    const organizer = await User.findById(alice).lean();
    expect(organizer?.stats).toMatchObject({ avgRatingAsOrganizer: 4.92, totalRatingsAsOrganizer: 2, ratingSumAsOrganizer: 9 });
    const view = await service.get(id, bob);
    expect(view).toMatchObject({ canRateOrganizer: false, myOrganizerRating: { score: 5, comment: 'Great planning' } });
    expect(view.organizerRatings).toBeUndefined(); // other members' comments stay private
  });

  it('closes rating 30 days after the trip, and for cancelled trips', async () => {
    const id = await groupTrip();
    await Trip.updateOne({ _id: id }, { startDate: new Date(Date.now() - 40 * DAY), endDate: new Date(Date.now() - 35 * DAY) });
    await expect(service.rateOrganizer(id, bob, 5)).rejects.toThrow('for 30 days');
    await Trip.updateOne({ _id: id }, { endDate: new Date(Date.now() - 2 * DAY), status: 'cancelled' });
    await expect(service.rateOrganizer(id, bob, 5)).rejects.toThrow('cancelled');
  });
});

describe('shared calendar (UC-T04)', () => {
  it('serves confirmed activities to members through a signed link', async () => {
    const id = await groupTrip();
    const when = new Date(Date.now() + 11 * DAY);
    const kayak = await service.proposeActivity(id, bob, { title: 'Kayaking, north beach; sunrise', date: when.toISOString(), durationMins: 90, cost: 1200 });
    await service.vote(id, carol, kayak._id.toString(), 'yes');
    await service.proposeActivity(id, carol, { title: 'Casino night', date: when.toISOString() }); // still being voted on

    const { url, webcalUrl } = await service.calendarLink(id, bob);
    expect(webcalUrl.startsWith('webcal:')).toBe(true);
    const token = new URL(url).searchParams.get('token')!;
    const ics = await service.calendarIcs(id, token);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Goa long weekend');
    expect(ics).toContain('SUMMARY:Kayaking\\, north beach\\; sunrise');
    expect(ics).not.toContain('Casino night');
    expect(ics.split('\r\n').every((line) => Buffer.byteLength(line) <= 75)).toBe(true);

    await expect(service.calendarIcs(id, `${bob}.forged-signature-forged-signatu`)).rejects.toThrow();
    await Trip.updateOne({ _id: id }, { $pull: { members: { user: new Types.ObjectId(bob) } } });
    await expect(service.calendarIcs(id, token)).rejects.toThrow(); // leaving the group ends access
  });
});
