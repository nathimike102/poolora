import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authenticate } from '../middlewares/auth.middleware';
import { requireActiveAccount } from '../middlewares/accountStatus.middleware';
import { validate } from '../middlewares/validation.middleware';
import { TripService } from '../services/TripService';
import { TRIP_INTERESTS, TRIP_TYPES } from '../models/Trip';
import { sendSuccess } from '../utils/helpers';
import type { AuthenticatedRequest } from '../types';

/** Group trips (Phase 4, UC-T01 to UC-T05) */
const router = Router();
const trips = new TripService();

/**
 * GET /trips/:id/calendar.ics?token=… — a member's calendar feed (UC-T04).
 * No login: calendar apps fetch it with the signed token from /calendar-link.
 */
router.get('/:id/calendar.ics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ics = await trips.calendarIcs(String(req.params.id), String(req.query.token ?? ''));
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="siham-trip.ics"');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).send(ics);
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);

const userId = (req: Request) => (req as AuthenticatedRequest).user.userId;
const objectId = Joi.string().hex().length(24);
const tripParam = { params: Joi.object({ id: objectId.required() }) };

/** Wraps a handler: runs it and sends its result with the given status */
const run = (fn: (req: Request) => Promise<unknown>, status = 200) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await fn(req), status, req.requestId);
  } catch (error) {
    next(error);
  }
};

const plan = {
  title: Joi.string().trim().min(3).max(100),
  description: Joi.string().trim().max(2000).allow(''),
  tripType: Joi.string().valid(...TRIP_TYPES),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')),
  destinations: Joi.array().items(Joi.object({ name: Joi.string().trim().min(2).max(120).required(), lat: Joi.number().min(-90).max(90), lng: Joi.number().min(-180).max(180) })).min(1).max(10),
  budgetPerPerson: Joi.number().min(0).max(10_000_000),
  interests: Joi.array().items(Joi.string().valid(...TRIP_INTERESTS)).unique().max(TRIP_INTERESTS.length),
  itinerary: Joi.array().items(Joi.object({ day: Joi.number().integer().min(1).max(90).required(), title: Joi.string().trim().min(1).max(120).required(), notes: Joi.string().trim().max(1000).allow('') })).max(90),
  maxGroupSize: Joi.number().integer().min(2).max(8),
  visibility: Joi.string().valid('public', 'private'),
};

router.post(
  '/',
  requireActiveAccount,
  validate({
    body: Joi.object({
      ...plan,
      title: plan.title.required(),
      tripType: plan.tripType.required(),
      startDate: plan.startDate.required(),
      endDate: plan.endDate.required(),
      destinations: plan.destinations.required(),
      maxGroupSize: plan.maxGroupSize.required(),
    }),
  }),
  run((req) => trips.create(userId(req), req.body).then((trip) => ({ trip })), 201),
);

router.get(
  '/search',
  validate({
    query: Joi.object({
      destination: Joi.string().trim().max(120).allow(''),
      from: Joi.date().iso(),
      to: Joi.date().iso(),
      interests: Joi.alternatives(Joi.array().items(Joi.string()), Joi.string()),
      maxBudget: Joi.number().min(0),
    }),
  }),
  run(async (req) => {
    const q = req.query as Record<string, unknown>;
    const interests = typeof q.interests === 'string' ? q.interests.split(',').filter(Boolean) : (q.interests as string[] | undefined);
    return { trips: await trips.search(userId(req), { ...q, interests } as never) };
  }),
);

router.get(
  '/invite/:code',
  validate({ params: Joi.object({ code: Joi.string().trim().alphanum().min(6).max(20).required() }) }),
  run(async (req) => ({ trip: await trips.byInviteCode(String(req.params.code), userId(req)) })),
);

router.get('/mine', run(async (req) => ({ trips: await trips.mine(userId(req)) })));

router.get(
  '/:id',
  validate({ ...tripParam, query: Joi.object({ code: Joi.string().max(20) }) }),
  run(async (req) => ({ trip: await trips.get(String(req.params.id), userId(req), req.query.code as string | undefined) })),
);

router.patch(
  '/:id',
  validate({ ...tripParam, body: Joi.object({ ...plan, status: Joi.string().valid('planning', 'ongoing', 'completed', 'cancelled') }).min(1) }),
  run(async (req) => ({ trip: await trips.update(String(req.params.id), userId(req), req.body) })),
);

router.post(
  '/:id/join',
  requireActiveAccount,
  validate({ ...tripParam, body: Joi.object({ message: Joi.string().trim().max(500).allow(''), code: Joi.string().max(20) }) }),
  run((req) => trips.requestJoin(String(req.params.id), userId(req), req.body.message, req.body.code)),
);

router.post(
  '/:id/requests/:requestId',
  validate({ params: Joi.object({ id: objectId.required(), requestId: objectId.required() }), body: Joi.object({ accept: Joi.boolean().required() }) }),
  run(async (req) => ({ trip: await trips.respond(String(req.params.id), userId(req), String(req.params.requestId), req.body.accept) })),
);

router.post('/:id/leave', validate(tripParam), run((req) => trips.leave(String(req.params.id), userId(req))));

router.put(
  '/:id/pay-number',
  validate({ ...tripParam, body: Joi.object({ payNumber: Joi.string().trim().max(20).allow('').required() }) }),
  run((req) => trips.setPayNumber(String(req.params.id), userId(req), req.body.payNumber)),
);

// ── Expenses and settling up ────────────────────────────────────────────────

router.get('/:id/expenses', validate(tripParam), run(async (req) => ({ expenses: await trips.expenses(String(req.params.id), userId(req)) })));

router.post(
  '/:id/expenses',
  validate({
    ...tripParam,
    body: Joi.object({
      description: Joi.string().trim().min(2).max(200).required(),
      amount: Joi.number().min(0.01).max(10_000_000).required(),
      paidBy: objectId,
      splitAmong: Joi.array().items(objectId).min(1).max(8),
    }),
  }),
  run(async (req) => ({ expense: await trips.addExpense(String(req.params.id), userId(req), req.body) }), 201),
);

router.delete(
  '/:id/expenses/:expenseId',
  validate({ params: Joi.object({ id: objectId.required(), expenseId: objectId.required() }) }),
  run((req) => trips.deleteExpense(String(req.params.id), userId(req), String(req.params.expenseId))),
);

router.get('/:id/settlement', validate(tripParam), run((req) => trips.settlement(String(req.params.id), userId(req))));

router.post(
  '/:id/settlements',
  validate({ ...tripParam, body: Joi.object({ from: objectId.required(), to: objectId.required(), amount: Joi.number().min(0.01).required() }) }),
  run((req) => trips.markSettled(String(req.params.id), userId(req), req.body)),
);

router.post('/:id/settlement/notify', validate(tripParam), run((req) => trips.notifyObligations(String(req.params.id), userId(req))));

// ── Activities ──────────────────────────────────────────────────────────────

router.post(
  '/:id/activities',
  validate({
    ...tripParam,
    body: Joi.object({
      title: Joi.string().trim().min(2).max(120).required(),
      date: Joi.date().iso(),
      cost: Joi.number().min(0).max(10_000_000),
      durationMins: Joi.number().integer().min(0).max(24 * 60 * 7),
      notes: Joi.string().trim().max(1000).allow(''),
    }),
  }),
  run(async (req) => ({ activity: await trips.proposeActivity(String(req.params.id), userId(req), req.body) }), 201),
);

router.post(
  '/:id/activities/:activityId/vote',
  validate({ params: Joi.object({ id: objectId.required(), activityId: objectId.required() }), body: Joi.object({ vote: Joi.string().valid('yes', 'no', 'maybe').required() }) }),
  run(async (req) => ({ activity: await trips.vote(String(req.params.id), userId(req), String(req.params.activityId), req.body.vote) })),
);

// ── Organizer rating and calendar ───────────────────────────────────────────

router.post(
  '/:id/rate-organizer',
  validate({
    ...tripParam,
    body: Joi.object({ score: Joi.number().integer().min(1).max(5).required(), comment: Joi.string().trim().max(500).allow('') }),
  }),
  run((req) => trips.rateOrganizer(String(req.params.id), userId(req), req.body.score, req.body.comment)),
);

router.get('/:id/calendar-link', validate(tripParam), run((req) => trips.calendarLink(String(req.params.id), userId(req))));

export default router;
