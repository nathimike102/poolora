/**
 * TripService.ts
 *
 * Group trips (Phase 4, UC-T01 to UC-T05): plan a trip, find trips that suit
 * you, ask to join, split expenses, vote on activities, and settle up.
 * Money is worked out in whole cents so shares always add up to the total.
 */

import { addRatingPipeline } from '../utils/ratingScore';
import crypto from 'crypto';
import { Types } from 'mongoose';
import { Trip, ITrip, TRIP_LIMITS, TripVote } from '../models/Trip';
import { TripExpense } from '../models/TripExpense';
import { User } from '../models/User';
import { config } from '../config';
import { AppError, AuthorizationError, ConflictError, NotFoundError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { localTime, money, REGION, toE164, toLocalClock } from '../config/region';
import { phrase, type Phrase } from '../i18n';

const DAY_MS = 86_400_000;
/** Members can rate the organizer for this long after the trip ends */
const RATING_WINDOW_DAYS = 30;
const toCents = (dollars: number) => Math.round(dollars * 100);
const toDollars = (cents: number) => Math.round(cents) / 100;
const idOf = (v: unknown) => String((v as { _id?: unknown })?._id ?? v);

export interface TripInput {
  title: string;
  description?: string;
  tripType: ITrip['tripType'];
  startDate: string | Date;
  endDate: string | Date;
  destinations: Array<{ name: string; lat?: number; lng?: number }>;
  budgetPerPerson?: number;
  interests?: string[];
  itinerary?: Array<{ day: number; title: string; notes?: string }>;
  maxGroupSize: number;
  visibility?: 'public' | 'private';
}

export interface Transfer { from: string; to: string; amount: number }

/** A trip as sent to the app, with fields added per viewer */
export type TripView = Record<string, unknown>;

/**
 * The fewest payments that settle everyone's balance: the one who owes most
 * pays the one owed most, and so on. `balances` are in cents, positive when
 * the member is owed money.
 */
export function settlementPlan(balances: Map<string, number>): Transfer[] {
  const owed = [...balances].filter(([, b]) => b > 0).map(([id, b]) => ({ id, left: b })).sort((a, b) => b.left - a.left);
  const owing = [...balances].filter(([, b]) => b < 0).map(([id, b]) => ({ id, left: -b })).sort((a, b) => b.left - a.left);
  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < owing.length && j < owed.length) {
    const pay = Math.min(owing[i].left, owed[j].left);
    if (pay > 0) transfers.push({ from: owing[i].id, to: owed[j].id, amount: toDollars(pay) });
    owing[i].left -= pay;
    owed[j].left -= pay;
    if (owing[i].left === 0) i++;
    if (owed[j].left === 0) j++;
  }
  return transfers;
}

/** Equal shares in cents; the odd cents go to the first people in the list */
function shares(amountCents: number, people: string[]): Map<string, number> {
  const base = Math.floor(amountCents / people.length);
  let extra = amountCents - base * people.length;
  const out = new Map<string, number>();
  for (const p of people) {
    out.set(p, base + (extra > 0 ? 1 : 0));
    if (extra > 0) extra--;
  }
  return out;
}

function checkPlan(input: Pick<TripInput, 'startDate' | 'endDate' | 'maxGroupSize'>) {
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  if (days < TRIP_LIMITS.minDays || days > TRIP_LIMITS.maxDays) {
    throw new AppError(`A trip lasts from ${TRIP_LIMITS.minDays} to ${TRIP_LIMITS.maxDays} days`, 422, 'VALIDATION_ERROR');
  }
  if (input.maxGroupSize < TRIP_LIMITS.minGroup || input.maxGroupSize > TRIP_LIMITS.maxGroup) {
    throw new AppError(`A group has ${TRIP_LIMITS.minGroup} to ${TRIP_LIMITS.maxGroup} people`, 422, 'VALIDATION_ERROR');
  }
  return days;
}

/** Whether members may rate the organizer now: the trip is over, not cancelled, and ended within the window */
function ratingOpen(trip: Pick<ITrip, 'status' | 'endDate'>): boolean {
  if (trip.status === 'cancelled') return false;
  const end = new Date(trip.endDate).getTime() + DAY_MS; // endDate is the last day of the trip
  const now = Date.now();
  return (trip.status === 'completed' || now >= end) && now <= end + RATING_WINDOW_DAYS * DAY_MS;
}

/** `<userId>.<signature>`: identifies the member without a login, for calendar apps */
function calendarToken(tripId: string, userId: string): string {
  const sig = crypto.createHmac('sha256', config.jwt.accessSecret).update(`trip-calendar:${tripId}:${userId}`).digest('base64url').slice(0, 32);
  return `${userId}.${sig}`;
}

/** 20260924 for an all-day date, in Zimbabwe time */
const icsDate = (d: Date) => toLocalClock(d).toISOString().slice(0, 10).replace(/-/g, '');
/** 20260924T083000Z */
const icsTime = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/**
 * A tel: link that dials EcoCash "send money" (*151*1*1*number*amount#) to an
 * Econet number. Other networks' wallets have their own codes, so they get none.
 */
export function ecocashLink(e164: string | undefined, amount: number): string | undefined {
  const national = e164?.startsWith(REGION.dialCode) ? `0${e164.slice(REGION.dialCode.length)}` : undefined;
  if (!national || !/^07[78]/.test(national)) return undefined;
  const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `tel:*151*1*1*${national}*${value}%23`;
}

/** Lines longer than 75 octets are folded, as RFC 5545 requires */
function fold(line: string): string {
  const out: string[] = [];
  let rest = Buffer.from(line, 'utf8');
  while (rest.length > 75) {
    let cut = out.length ? 74 : 75;
    while (cut > 0 && (rest[cut] & 0xc0) === 0x80) cut--; // do not split a UTF-8 character
    out.push(rest.subarray(0, cut).toString('utf8'));
    rest = rest.subarray(cut);
  }
  out.push(rest.toString('utf8'));
  return out.join('\r\n ');
}

/** The trip and its confirmed activities as an iCalendar feed */
export function tripCalendar(trip: ITrip): string {
  const stamp = icsTime(new Date());
  const place = trip.destinations.map((d) => d.name).join(', ');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Poolora//Trips//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(trip.title)}`,
    `X-WR-TIMEZONE:${REGION.timeZone}`,
    'BEGIN:VEVENT',
    `UID:trip-${trip._id}@poolora.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(new Date(trip.startDate))}`,
    `DTEND;VALUE=DATE:${icsDate(new Date(new Date(trip.endDate).getTime() + DAY_MS))}`,
    `SUMMARY:${icsText(trip.title)}`,
    ...(place ? [`LOCATION:${icsText(place)}`] : []),
    ...(trip.status === 'cancelled' ? ['STATUS:CANCELLED'] : []),
    'END:VEVENT',
  ];
  for (const a of trip.activities ?? []) {
    if (a.status !== 'confirmed' || !a.date) continue;
    const start = new Date(a.date);
    const timed = Boolean(a.durationMins);
    lines.push(
      'BEGIN:VEVENT',
      `UID:activity-${a._id}@poolora.app`,
      `DTSTAMP:${stamp}`,
      timed ? `DTSTART:${icsTime(start)}` : `DTSTART;VALUE=DATE:${icsDate(start)}`,
      timed ? `DTEND:${icsTime(new Date(start.getTime() + a.durationMins! * 60_000))}` : `DTEND;VALUE=DATE:${icsDate(new Date(start.getTime() + DAY_MS))}`,
      `SUMMARY:${icsText(a.title)}`,
      ...(a.notes || a.cost ? [`DESCRIPTION:${icsText([a.notes, a.cost ? `Cost: ${money(a.cost)}` : ''].filter(Boolean).join('\n'))}`] : []),
      ...(place ? [`LOCATION:${icsText(place)}`] : []),
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export class TripService {
  // ── Plan (UC-T01) ─────────────────────────────────────────────────────────

  async create(userId: string, input: TripInput) {
    const days = checkPlan(input);
    if (new Date(input.startDate).getTime() < Date.now() - DAY_MS) throw new AppError('The trip must start today or later', 422, 'VALIDATION_ERROR');
    const itinerary = (input.itinerary ?? []).filter((d) => d.day >= 1 && d.day <= days && d.title?.trim());
    return Trip.create({
      ...input,
      itinerary,
      organizer: userId,
      inviteCode: crypto.randomBytes(5).toString('hex').toUpperCase(),
      members: [{ user: userId, role: 'organizer', joinedAt: new Date() }],
    });
  }

  async update(tripId: string, userId: string, changes: Partial<TripInput> & { status?: ITrip['status'] }) {
    const trip = await this.memberTrip(tripId, userId);
    if (trip.organizer.toString() !== userId) throw new AuthorizationError('Only the organizer can change the plan');
    const next = { startDate: changes.startDate ?? trip.startDate, endDate: changes.endDate ?? trip.endDate, maxGroupSize: changes.maxGroupSize ?? trip.maxGroupSize };
    checkPlan(next);
    if (next.maxGroupSize < trip.members.length) throw new ConflictError(`${trip.members.length} people have already joined`);
    Object.assign(trip, changes);
    await trip.save();
    return trip;
  }

  // ── Find (UC-T02) ─────────────────────────────────────────────────────────

  /**
   * Public trips still being planned, with room, ranked by how well they
   * fit: shared interests (50%), overlapping dates (30%) and budget (20%).
   */
  async search(userId: string, q: { destination?: string; from?: string; to?: string; interests?: string[]; maxBudget?: number }): Promise<TripView[]> {
    const filter: Record<string, unknown> = {
      visibility: 'public',
      status: 'planning',
      endDate: { $gte: new Date() },
      'members.user': { $ne: new Types.ObjectId(userId) },
      $expr: { $lt: [{ $size: '$members' }, '$maxGroupSize'] },
    };
    if (q.destination?.trim()) {
      const text = q.destination.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [{ 'destinations.name': { $regex: text, $options: 'i' } }, { title: { $regex: text, $options: 'i' } }];
    }
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;
    if (from) filter.endDate = { $gte: from };
    if (to) filter.startDate = { $lte: to };

    const trips = await Trip.find(filter)
      .select('-joinRequests -settlements -inviteCode -activities -organizerRatings')
      .populate('organizer', 'name profilePhotoUrl stats.avgRatingAsDriver stats.avgRatingAsRider stats.totalRatingsAsRider stats.avgRatingAsOrganizer stats.totalRatingsAsOrganizer')
      .populate('members.user', 'name profilePhotoUrl')
      .limit(100)
      .lean();

    const wanted = new Set(q.interests ?? []);
    const scored = trips.map((t) => {
      const shared = wanted.size ? t.interests.filter((i) => wanted.has(i)).length / wanted.size : 1;
      let dates = 1;
      if (from && to) {
        const overlap = Math.min(to.getTime(), t.endDate.getTime()) - Math.max(from.getTime(), t.startDate.getTime());
        const tripLength = t.endDate.getTime() - t.startDate.getTime() + DAY_MS;
        dates = Math.max(0, Math.min(1, (overlap + DAY_MS) / tripLength));
      }
      const budget = q.maxBudget && t.budgetPerPerson ? (t.budgetPerPerson <= q.maxBudget ? 1 : Math.max(0, 1 - (t.budgetPerPerson - q.maxBudget) / q.maxBudget)) : 1;
      const compatibility = Math.round(100 * (0.5 * shared + 0.3 * dates + 0.2 * budget));
      return { ...t, compatibility, spotsLeft: t.maxGroupSize - t.members.length };
    });
    return scored.sort((a, b) => b.compatibility - a.compatibility || a.startDate.getTime() - b.startDate.getTime()).slice(0, 50);
  }

  /** The caller's trips, newest start first */
  async mine(userId: string): Promise<TripView[]> {
    return Trip.find({ 'members.user': userId })
      .select('title tripType startDate endDate destinations status maxGroupSize members organizer joinRequests')
      .sort({ startDate: -1 })
      .limit(50)
      .lean()
      .then((trips) =>
        trips.map(({ joinRequests, ...t }) => ({
          ...t,
          pendingRequests: t.organizer.toString() === userId ? joinRequests.filter((r) => r.status === 'pending').length : 0,
        })),
      );
  }

  /**
   * A trip. Members see everything; others see the plan and who is going, if
   * the trip is public or they have the invite code.
   */
  async get(tripId: string, userId: string, inviteCode?: string): Promise<TripView> {
    const trip = await Trip.findById(tripId)
      .populate('organizer', 'name profilePhotoUrl stats.avgRatingAsOrganizer stats.totalRatingsAsOrganizer')
      .populate('members.user', 'name profilePhotoUrl')
      .populate('joinRequests.user', 'name profilePhotoUrl stats')
      .lean();
    if (!trip) throw new NotFoundError('Trip');
    const member = trip.members.some((m) => idOf(m.user) === userId);
    const invited = Boolean(inviteCode) && inviteCode === trip.inviteCode;
    if (!member && trip.visibility === 'private' && !invited) throw new NotFoundError('Trip');

    const isOrganizer = idOf(trip.organizer) === userId;
    const myRequest = trip.joinRequests.find((r) => idOf(r.user) === userId);
    const { organizerRatings = [], ...rest } = trip;
    const myRating = organizerRatings.find((r) => idOf(r.user) === userId);
    const base = {
      ...rest,
      myOrganizerRating: myRating ? { score: myRating.score, comment: myRating.comment } : undefined,
      canRateOrganizer: member && !isOrganizer && !myRating && ratingOpen(trip),
      joinRequests: isOrganizer ? trip.joinRequests.filter((r) => r.status === 'pending') : [],
      inviteCode: member ? trip.inviteCode : undefined,
      settlements: member ? trip.settlements : [],
      activities: member ? trip.activities : [],
      // Mobile money numbers are only for fellow members
      members: trip.members.map((m) => ({ ...m, payNumber: member ? m.payNumber : undefined })),
      isMember: member,
      isOrganizer,
      /** The viewer's own user id, so the app can tell which member is "you" */
      viewerId: userId,
      myRequestStatus: myRequest?.status,
    };
    return base;
  }

  /** Opens a trip from the invite code its organizer shared */
  async byInviteCode(code: string, userId: string): Promise<TripView> {
    const trip = await Trip.findOne({ inviteCode: code.trim().toUpperCase() }).select('_id inviteCode').lean();
    if (!trip) throw new NotFoundError('Trip');
    return this.get(trip._id.toString(), userId, trip.inviteCode);
  }

  // ── Join ──────────────────────────────────────────────────────────────────

  async requestJoin(tripId: string, userId: string, message?: string, inviteCode?: string) {
    const trip = await Trip.findById(tripId);
    if (!trip) throw new NotFoundError('Trip');
    if (trip.visibility === 'private' && inviteCode !== trip.inviteCode) throw new NotFoundError('Trip');
    if (trip.status !== 'planning') throw new ConflictError('This trip is no longer taking new members');
    if (trip.members.some((m) => m.user.toString() === userId)) throw new ConflictError('You are already on this trip');
    if (trip.members.length >= trip.maxGroupSize) throw new AppError('This trip is full', 409, 'TRIP_FULL');
    if (trip.joinRequests.some((r) => r.user.toString() === userId && r.status === 'pending')) throw new ConflictError('You have already asked to join');

    trip.joinRequests.push({ user: new Types.ObjectId(userId), message: message?.trim() || undefined, status: 'pending', at: new Date() } as never);
    await trip.save();
    const name = (await User.findById(userId).select('name').lean())?.name?.split(' ')[0] ?? 'Someone';
    await this.notify([trip.organizer.toString()], phrase('trip.joinRequestTitle'), phrase('trip.joinRequestBody', { name, trip: trip.title }), trip);
    return { status: 'pending' as const };
  }

  async respond(tripId: string, organizerId: string, requestId: string, accept: boolean): Promise<TripView> {
    const trip = await Trip.findById(tripId);
    if (!trip) throw new NotFoundError('Trip');
    if (trip.organizer.toString() !== organizerId) throw new AuthorizationError('Only the organizer can answer requests');
    const request = trip.joinRequests.find((r) => r._id.toString() === requestId);
    if (!request || request.status !== 'pending') throw new NotFoundError('Join request');
    if (accept && trip.members.length >= trip.maxGroupSize) throw new AppError('The trip is full', 409, 'TRIP_FULL');

    request.status = accept ? 'accepted' : 'declined';
    if (accept) trip.members.push({ user: request.user, role: 'member', joinedAt: new Date() } as never);
    await trip.save();
    await this.notify(
      [request.user.toString()],
      phrase(accept ? 'trip.acceptedTitle' : 'trip.declinedTitle'),
      phrase(accept ? 'trip.acceptedBody' : 'trip.declinedBody', { trip: trip.title }),
      trip,
    );
    return this.get(tripId, organizerId);
  }

  /** A member leaves; the organizer cannot leave their own trip */
  async leave(tripId: string, userId: string) {
    const trip = await this.memberTrip(tripId, userId);
    if (trip.organizer.toString() === userId) throw new ConflictError('The organizer cannot leave. Cancel the trip instead.');
    const { balances } = await this.balances(trip);
    if (Math.abs(balances.get(userId) ?? 0) >= 1) throw new ConflictError('Settle up with the group before leaving');
    trip.members = trip.members.filter((m) => m.user.toString() !== userId) as never;
    await trip.save();
    return { left: true };
  }

  /** A member's mobile money number (EcoCash, OneMoney), shown to the group for settling up */
  async setPayNumber(tripId: string, userId: string, payNumber: string) {
    const trip = await this.memberTrip(tripId, userId);
    const me = trip.members.find((m) => m.user.toString() === userId)!;
    const normalised = payNumber.trim() ? toE164(payNumber) : undefined;
    if (normalised === null) throw new AppError('Enter a Zimbabwe mobile number, like 0771 234 567', 422, 'VALIDATION_ERROR');
    me.payNumber = normalised;
    await trip.save();
    return { payNumber: me.payNumber };
  }

  // ── Expenses (UC-T03) ─────────────────────────────────────────────────────

  async expenses(tripId: string, userId: string) {
    await this.memberTrip(tripId, userId);
    return TripExpense.find({ trip: tripId }).populate('paidBy', 'name').sort({ spentAt: -1 }).lean();
  }

  async addExpense(tripId: string, userId: string, data: { description: string; amount: number; paidBy?: string; splitAmong?: string[] }, activityId?: Types.ObjectId) {
    const trip = await this.memberTrip(tripId, userId);
    const members = trip.members.map((m) => m.user.toString());
    const paidBy = data.paidBy ?? userId;
    const splitAmong = data.splitAmong?.length ? [...new Set(data.splitAmong)] : members;
    if (!members.includes(paidBy) || splitAmong.some((m) => !members.includes(m))) {
      throw new AppError('Only trip members can pay or share an expense', 422, 'VALIDATION_ERROR');
    }
    const expense = await TripExpense.create({
      trip: tripId,
      description: data.description.trim(),
      amount: toDollars(toCents(data.amount)),
      paidBy,
      splitAmong,
      createdBy: userId,
      activity: activityId,
    });
    const others = splitAmong.filter((m) => m !== userId);
    const share = toDollars(Math.ceil(toCents(data.amount) / splitAmong.length));
    await this.notify(others, phrase('trip.expenseTitle', { trip: trip.title }), phrase('trip.expenseBody', { description: data.description.trim(), amount: money(expense.amount), share: money(share) }), trip);
    return expense;
  }

  async deleteExpense(tripId: string, userId: string, expenseId: string) {
    const trip = await this.memberTrip(tripId, userId);
    const expense = await TripExpense.findOne({ _id: expenseId, trip: tripId });
    if (!expense) throw new NotFoundError('Expense');
    if (expense.createdBy.toString() !== userId && trip.organizer.toString() !== userId) {
      throw new AuthorizationError('Only whoever added it, or the organizer, can remove an expense');
    }
    await expense.deleteOne();
    return { removed: true };
  }

  // ── Settle up (UC-T05) ────────────────────────────────────────────────────

  /** Net balance per member in cents: what they paid, less their shares, adjusted for payments made */
  private async balances(trip: ITrip) {
    const expenses = await TripExpense.find({ trip: trip._id }).lean();
    const balances = new Map<string, number>(trip.members.map((m) => [m.user.toString(), 0]));
    const paid = new Map<string, number>();
    const owes = new Map<string, number>();
    let total = 0;
    for (const e of expenses) {
      const amount = toCents(e.amount);
      total += amount;
      const payer = e.paidBy.toString();
      paid.set(payer, (paid.get(payer) ?? 0) + amount);
      balances.set(payer, (balances.get(payer) ?? 0) + amount);
      for (const [person, share] of shares(amount, e.splitAmong.map(String))) {
        owes.set(person, (owes.get(person) ?? 0) + share);
        balances.set(person, (balances.get(person) ?? 0) - share);
      }
    }
    for (const s of trip.settlements) {
      const amount = toCents(s.amount);
      balances.set(s.from.toString(), (balances.get(s.from.toString()) ?? 0) + amount);
      balances.set(s.to.toString(), (balances.get(s.to.toString()) ?? 0) - amount);
    }
    return { balances, paid, owes, total };
  }

  /**
   * The settlement report: totals, each member's share and balance, and the
   * payments that settle everyone. When the payee added an EcoCash number,
   * the payment carries a link that dials EcoCash's send-money USSD code
   * with the number and amount filled in; the payer still confirms with
   * their PIN on the phone.
   */
  async settlement(tripId: string, userId: string) {
    const trip = await this.memberTrip(tripId, userId);
    await trip.populate('members.user', 'name');
    const { balances, paid, owes, total } = await this.balances(trip);
    const names = new Map(trip.members.map((m) => [idOf(m.user), (m.user as unknown as { name?: string }).name ?? 'Member']));
    const numbers = new Map(trip.members.map((m) => [idOf(m.user), m.payNumber]));
    const transfers = settlementPlan(balances).map((t) => ({
      ...t,
      fromName: names.get(t.from),
      toName: names.get(t.to),
      payNumber: numbers.get(t.to),
      ecocashLink: ecocashLink(numbers.get(t.to), t.amount),
    }));
    return {
      total: toDollars(total),
      perPerson: trip.members.length ? toDollars(total / trip.members.length) : 0,
      members: [...names].map(([id, name]) => ({
        userId: id,
        name,
        paid: toDollars(paid.get(id) ?? 0),
        share: toDollars(owes.get(id) ?? 0),
        balance: toDollars(balances.get(id) ?? 0),
      })),
      transfers,
      settled: trip.settlements,
    };
  }

  /** Records a payment between two members; either of them can mark it */
  async markSettled(tripId: string, userId: string, data: { from: string; to: string; amount: number }) {
    const trip = await this.memberTrip(tripId, userId);
    if (userId !== data.from && userId !== data.to) throw new AuthorizationError('Only the payer or the payee can mark a payment');
    const members = trip.members.map((m) => m.user.toString());
    if (!members.includes(data.from) || !members.includes(data.to) || data.from === data.to) {
      throw new AppError('Both people must be trip members', 422, 'VALIDATION_ERROR');
    }
    trip.settlements.push({ from: new Types.ObjectId(data.from), to: new Types.ObjectId(data.to), amount: toDollars(toCents(data.amount)), markedBy: new Types.ObjectId(userId), at: new Date() } as never);
    await trip.save();
    const other = userId === data.from ? data.to : data.from;
    await this.notify([other], phrase('trip.paymentTitle', { trip: trip.title }), phrase('trip.paymentBody', { amount: money(data.amount) }), trip);
    return this.settlement(tripId, userId);
  }

  /** Tells every member what they owe or are owed (UC-T05 step 6) */
  async notifyObligations(tripId: string, userId: string) {
    const report = await this.settlement(tripId, userId);
    const trip = await this.memberTrip(tripId, userId);
    for (const m of report.members) {
      const pays = report.transfers.filter((t) => t.from === m.userId).map((t) => phrase('trip.payTo', { amount: money(t.amount), name: t.toName }));
      const gets = report.transfers.filter((t) => t.to === m.userId).map((t) => phrase('trip.getFrom', { amount: money(t.amount), name: t.fromName }));
      if (!pays.length && !gets.length) continue;
      const body = pays.length ? phrase('trip.youOwe', { list: pays }) : phrase('trip.youGet', { list: gets });
      await this.notify([m.userId], phrase('trip.settleTitle', { trip: trip.title }), body, trip);
    }
    return { notified: report.members.length };
  }

  // ── Activities (UC-T04) ───────────────────────────────────────────────────

  async proposeActivity(tripId: string, userId: string, data: { title: string; date?: string; cost?: number; durationMins?: number; notes?: string }) {
    const trip = await this.memberTrip(tripId, userId);
    trip.activities.push({
      title: data.title.trim(),
      date: data.date ? new Date(data.date) : undefined,
      cost: data.cost,
      durationMins: data.durationMins,
      notes: data.notes?.trim() || undefined,
      proposedBy: new Types.ObjectId(userId),
      votes: [{ user: new Types.ObjectId(userId), vote: 'yes' }],
      status: 'proposed',
    } as never);
    await trip.save();
    const others = trip.members.map((m) => m.user.toString()).filter((m) => m !== userId);
    await this.notify(others, phrase('trip.voteTitle', { title: data.title.trim() }), phrase('trip.voteBody', { trip: trip.title }), trip);
    return this.decide(trip, trip.activities[trip.activities.length - 1]._id.toString(), userId);
  }

  /**
   * A member's vote. More than half the group voting yes confirms the
   * activity and adds its cost to the group's expenses, paid by whoever
   * proposed it; more than half voting no rejects it.
   */
  async vote(tripId: string, userId: string, activityId: string, vote: TripVote) {
    const trip = await this.memberTrip(tripId, userId);
    const activity = trip.activities.find((a) => a._id.toString() === activityId);
    if (!activity) throw new NotFoundError('Activity');
    if (activity.status !== 'proposed') throw new ConflictError('Voting on this activity has closed');
    const mine = activity.votes.find((v) => v.user.toString() === userId);
    if (mine) mine.vote = vote;
    else activity.votes.push({ user: new Types.ObjectId(userId), vote });
    await trip.save();
    return this.decide(trip, activityId, userId);
  }

  private async decide(trip: ITrip, activityId: string, userId: string) {
    const activity = trip.activities.find((a) => a._id.toString() === activityId)!;
    const majority = Math.floor(trip.members.length / 2) + 1;
    const yes = activity.votes.filter((v) => v.vote === 'yes').length;
    const no = activity.votes.filter((v) => v.vote === 'no').length;
    if (yes >= majority) {
      activity.status = 'confirmed';
      if (activity.cost && activity.cost > 0) {
        const expense = await this.addExpense(trip._id.toString(), userId, { description: activity.title, amount: activity.cost, paidBy: activity.proposedBy.toString() }, activity._id);
        activity.expense = expense._id;
      }
      await trip.save();
      await this.notify(trip.members.map((m) => m.user.toString()), phrase('trip.confirmedTitle', { title: activity.title }), activity.date ? phrase('trip.confirmedOn', { date: localTime(activity.date, { day: 'numeric', month: 'short' }) }) : phrase('trip.confirmedBody'), trip);
    } else if (no >= majority) {
      activity.status = 'rejected';
      await trip.save();
    }
    return activity;
  }

  // ── Organizer rating (UC-T02) ─────────────────────────────────────────────

  /**
   * A member rates the organizer once, after the trip and within 30 days.
   * The organizer's average shows on their trips in search; comments are
   * kept private.
   */
  async rateOrganizer(tripId: string, userId: string, score: number, comment?: string) {
    const trip = await this.memberTrip(tripId, userId);
    if (trip.organizer.toString() === userId) throw new AppError('You cannot rate yourself', 422, 'VALIDATION_ERROR');
    if (!ratingOpen(trip)) {
      throw new ConflictError(trip.status === 'cancelled' ? 'This trip was cancelled' : `You can rate the organizer after the trip, for ${RATING_WINDOW_DAYS} days`);
    }
    const saved = await Trip.findOneAndUpdate(
      { _id: trip._id, 'organizerRatings.user': { $ne: new Types.ObjectId(userId) } },
      { $push: { organizerRatings: { user: new Types.ObjectId(userId), score, comment: comment?.trim() || undefined, at: new Date() } } },
    );
    if (!saved) throw new ConflictError('You have already rated this organizer');
    // Score updated in one step on the server (utils/ratingScore)
    await User.updateOne({ _id: trip.organizer }, addRatingPipeline('Organizer', score));
    return { rated: true, score };
  }

  // ── Shared calendar (UC-T04) ──────────────────────────────────────────────

  /**
   * A private calendar link for a member: the trip and its confirmed
   * activities, as an .ics feed calendar apps can subscribe to, so changes
   * show up on their own. The link stops working if the member leaves.
   */
  async calendarLink(tripId: string, userId: string) {
    await this.memberTrip(tripId, userId);
    const url = `${config.app.baseUrl}/trips/${tripId}/calendar.ics?token=${calendarToken(tripId, userId)}`;
    return { url, webcalUrl: url.replace(/^https?:/, 'webcal:') };
  }

  async calendarIcs(tripId: string, token: string): Promise<string> {
    const [userId, sig] = String(token ?? '').split('.');
    if (!userId || !sig || !Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(tripId)) throw new NotFoundError('Calendar');
    const expected = calendarToken(tripId, userId).split('.')[1];
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new NotFoundError('Calendar');
    const trip = await Trip.findById(tripId).lean();
    if (!trip || !trip.members.some((m) => m.user.toString() === userId)) throw new NotFoundError('Calendar');
    return tripCalendar(trip as unknown as ITrip);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async memberTrip(tripId: string, userId: string) {
    const trip = await Trip.findById(tripId);
    if (!trip || !trip.members.some((m) => m.user.toString() === userId)) throw new NotFoundError('Trip');
    return trip;
  }

  private async notify(userIds: string[], title: string | Phrase, body: string | Phrase, trip: ITrip) {
    if (!userIds.length) return;
    try {
      const { NotificationService } = await import('./NotificationService');
      const n = new NotificationService();
      await Promise.allSettled(
        userIds.flatMap((id) => [
          n.createNotification(id, title, body, 'system', { tripId: trip._id.toString() }),
          n.sendPushNotification(id, title, body, { type: 'trip', tripId: trip._id.toString() }),
        ]),
      );
    } catch (error) {
      logger.debug('Trip notification failed', { error: (error as Error).message });
    }
  }
}
