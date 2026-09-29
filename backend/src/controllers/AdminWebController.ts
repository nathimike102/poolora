/**
 * AdminWebController.ts
 *
 * HTTP handlers for the web admin (admin-web/): dashboard, driver
 * applications, users, disputes, SOS, reports, settings and the audit log.
 * All routes sit behind authenticate + requireAdmin in admin.routes.ts.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthenticatedRequest } from '../types';
import { sendSuccess } from '../utils/helpers';
import { queryInt, queryString } from '../utils/request';
import { AdminOverviewService } from '../services/AdminOverviewService';
import { AdminUserService } from '../services/AdminUserService';
import { AdminSosService } from '../services/AdminSosService';
import { DisputeService } from '../services/DisputeService';
import { ReportService, REPORT_TYPES, ReportType, parseReportParams } from '../services/ReportService';
import { ReportScheduleService } from '../services/ReportScheduleService';
import { CONTENT_TYPES, EXPORT_FORMATS, ExportFormat, reportFilename, toPdf, toXlsx } from '../services/ReportExport';
import { SettingsService } from '../services/SettingsService';
import { AccountMergeService } from '../services/AccountMergeService';
import { AppealService } from '../services/AppealService';
import { ParcelEvidenceService } from '../services/ParcelEvidenceService';
import { AlertRuleService } from '../services/AlertRuleService';
import { CallService } from '../services/CallService';
import { DocumentCheckService } from '../services/DocumentCheckService';
import { RatingService } from '../services/RatingService';
import { SupportService } from '../services/SupportService';
import { WithdrawalService } from '../services/WithdrawalService';
import { AppError } from '../utils/AppError';

const overview = new AdminOverviewService();
const users = new AdminUserService();
const sos = new AdminSosService();
const disputes = new DisputeService();
const reports = new ReportService();
const schedules = new ReportScheduleService();
const merges = new AccountMergeService();
const appeals = new AppealService();
const parcelEvidence = new ParcelEvidenceService();
const alerts = new AlertRuleService();
const calls = new CallService();
const documentChecks = new DocumentCheckService();
const ratings = new RatingService();
const support = new SupportService();
const withdrawals = new WithdrawalService();

type Handler = (req: Request, adminId: string) => Promise<unknown>;

/** Runs a handler and sends its result, or passes the error on. */
function handle(fn: Handler): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await fn(req, (req as AuthenticatedRequest).user.userId);
      sendSuccess(res, data, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  };
}

const page = (req: Request) => Math.max(1, queryInt(req, 'page', 1));
const limit = (req: Request, max = 100) => Math.min(max, Math.max(1, queryInt(req, 'limit', 25)));
const id = (req: Request, name = 'id') => String(req.params[name]);

export const AdminWebController = {
  overview: handle(() => overview.overview()),

  // ── Driver applications (UC-A01) ─────────────────────────────────────────
  applications: handle(async (req) => ({ applications: await users.applications(queryString(req, 'status')) })),
  /** Runs the automatic checks again, and the vendor's background check when connected */
  recheckApplication: handle(async (req) => {
    const checks = await documentChecks.run(id(req, 'userId'));
    const { config } = await import('../config');
    if (config.kycVerify.url) await documentChecks.sendToVendor(id(req, 'userId'));
    return { checks, backgroundCheck: Boolean(config.kycVerify.url) };
  }),
  requestKycChanges: handle((req, admin) =>
    users.requestKycChanges(id(req, 'userId'), admin, req.body?.documents, req.body?.note)),

  // ── Users (UC-A05) ────────────────────────────────────────────────────────
  searchUsers: handle((req) =>
    users.search({
      q: queryString(req, 'q'),
      role: queryString(req, 'role'),
      status: queryString(req, 'status'),
      kycStatus: queryString(req, 'kycStatus'),
      page: page(req),
      limit: limit(req),
    })),
  userDetail: handle((req) => users.detail(id(req))),
  suspend: handle((req, admin) => {
    const days = req.body?.days === null || req.body?.days === undefined ? null : Number(req.body.days);
    return users.suspend(id(req), admin, days, req.body?.reason);
  }),
  reinstate: handle((req, admin) => users.reinstate(id(req), admin, req.body?.reason)),
  requestBlock: handle((req, admin) => users.requestBlock(id(req), admin, req.body?.reason)),
  approveBlock: handle((req, admin) => users.approveBlock(id(req), admin)),
  rejectBlock: handle((req, admin) => users.rejectBlock(id(req), admin, req.body?.reason)),
  unblock: handle((req, admin) => users.unblock(id(req), admin, req.body?.reason)),
  addNote: handle((req, admin) => users.addNote(id(req), admin, req.body?.text)),

  // ── Support tickets (UC-X02) ──────────────────────────────────────────────
  supportQueue: handle((req) => {
    const status = queryString(req, 'status');
    return support.queue(status === 'answered' || status === 'closed' ? status : 'open', queryString(req, 'category') || undefined);
  }),
  supportTicket: handle((req) => support.adminGet(id(req))),
  supportReply: handle((req, admin) => support.adminReply(id(req), admin, String(req.body?.text ?? ''), req.body?.close === true)),
  supportClose: handle((req, admin) => support.close(id(req), admin)),

  // ── Review moderation (UC-R06) ────────────────────────────────────────────
  reviews: handle((req) => {
    const status = queryString(req, 'status');
    return ratings.moderationQueue(status === 'reported' || status === 'done' ? status : 'pending');
  }),
  moderateReview: handle((req, admin) => ratings.moderate(id(req), admin, req.body.decision, req.body.note)),

  // ── Fraud flags (UC-AI02) ─────────────────────────────────────────────────
  fraudQueue: handle((req) => users.fraudQueue(queryString(req, 'view') === 'reviewed' ? 'reviewed' : 'open')),
  reviewFraud: handle((req, admin) => users.reviewFraud(id(req), admin, req.body?.decision, req.body?.note)),
  auditLog: handle((req) =>
    users.auditLog({
      actor: queryString(req, 'actor'),
      action: queryString(req, 'action'),
      targetId: queryString(req, 'targetId'),
      page: page(req),
      limit: limit(req),
    })),

  // ── Disputes (UC-A04) ─────────────────────────────────────────────────────
  listDisputes: handle((req) =>
    disputes.list({ status: queryString(req, 'status'), category: queryString(req, 'category'), page: page(req), limit: limit(req) })),
  disputeDetail: handle((req) => disputes.detail(id(req))),
  assignDispute: handle((req, admin) => disputes.assign(id(req), admin)),
  resolveDispute: handle((req, admin) => disputes.resolve(id(req), admin, req.body ?? {})),

  // ── SOS (UC-A03) ──────────────────────────────────────────────────────────
  listSos: handle((req) => sos.list({ status: queryString(req, 'status'), page: page(req), limit: limit(req) })),
  sosDetail: handle((req) => sos.detail(id(req))),
  sosLog: handle((req, admin) => sos.addLog(id(req), admin, req.body?.text)),
  sosAcknowledge: handle((req, admin) => sos.acknowledge(id(req), admin)),
  sosResolve: handle((req, admin) => sos.resolve(id(req), admin, req.body?.notes, req.body?.isFalseAlarm)),
  sosPolice: handle((req, admin) => sos.notifyPolice(id(req), admin, req.body?.notes)),

  // ── Duplicate accounts and appeals (UC-A05) ─────────────────────────────
  duplicates: handle((req) => merges.duplicates(id(req))),
  listMerges: handle((req) => merges.list(queryString(req, 'status'))),
  requestMerge: handle((req, admin) => merges.request(id(req), String(req.body?.targetId ?? ''), admin, req.body?.reason)),
  approveMerge: handle((req, admin) => merges.approve(id(req), admin)),
  rejectMerge: handle((req, admin) => merges.reject(id(req), admin, req.body?.reason)),
  listAppeals: handle((req) => appeals.list(queryString(req, 'status') ?? 'open')),
  decideAppeal: handle((req, admin) => appeals.decide(id(req), admin, req.body?.decision, req.body?.note)),

  // ── Masked calls (UC-D06, UC-A03) ───────────────────────────────────────
  userCalls: handle((req) => calls.forUser(id(req))),
  callRecording: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const audio = await calls.recording(id(req));
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(200).send(audio);
    } catch (error) {
      next(error);
    }
  },

  // ── Alert rules (UC-A02, UC-A06) ────────────────────────────────────────
  alertRules: handle(() => alerts.list()),
  createAlertRule: handle((req, admin) => alerts.create(req.body ?? {}, admin)),
  updateAlertRule: handle((req, admin) => alerts.update(id(req), req.body ?? {}, admin)),
  deleteAlertRule: handle((req, admin) => alerts.remove(id(req), admin)),
  testAlertRule: handle((req, admin) => alerts.test(id(req), admin)),

  // ── Parcel claims (UC-P05) ─────────────────────────────────────────────
  withdrawals: handle(async (req) => ({ withdrawals: await withdrawals.adminList(queryString(req, 'status') ?? 'pending') })),
  withdrawalPaid: handle((req, admin) => withdrawals.markPaid(id(req), admin, req.body?.payoutReference)),
  withdrawalReject: handle((req, admin) => withdrawals.reject(id(req), admin, req.body?.note)),
  parcelClaims: handle((req) => parcelEvidence.adminList(queryString(req, 'status') ?? 'open')),
  decideParcelClaim: handle((req, admin) => parcelEvidence.decide(id(req), admin, req.body ?? {})),
  parcelPhoto: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const file = await parcelEvidence.photoFile(id(req), id(req, 'photoId'), { userId: user.userId, capabilities: user.capabilities });
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.status(200).send(file.body);
    } catch (error) {
      next(error);
    }
  },

  // ── Reports (UC-A06) ──────────────────────────────────────────────────────
  report: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = id(req, 'type') as ReportType;
      if (!REPORT_TYPES.includes(type)) throw new AppError('Unknown report', 404, 'NOT_FOUND');
      const report = await reports.build(type, parseReportParams(req.query as Record<string, unknown>));
      const format = queryString(req, 'format') as ExportFormat | undefined;
      if (format && EXPORT_FORMATS.includes(format)) {
        const body = format === 'xlsx' ? await toXlsx(report) : format === 'pdf' ? await toPdf(report) : reports.toCsv(report);
        res.setHeader('Content-Type', CONTENT_TYPES[format]);
        res.setHeader('Content-Disposition', `attachment; filename="${reportFilename(report, format)}"`);
        res.status(200).send(body);
        return;
      }
      sendSuccess(res, report, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  },
  reportSchedules: handle(() => schedules.list()),
  createReportSchedule: handle((req, admin) => schedules.create(req.body ?? {}, admin)),
  updateReportSchedule: handle((req, admin) => schedules.update(id(req), req.body ?? {}, admin)),
  deleteReportSchedule: handle((req, admin) => schedules.remove(id(req), admin)),
  sendReportSchedule: handle((req, admin) => schedules.sendNow(id(req), admin)),

  // ── Settings (UC-A07) ─────────────────────────────────────────────────────
  settings: handle(async () => ({ settings: SettingsService.list() })),
  updateSettings: handle(async (req, admin) => ({
    settings: await SettingsService.update(req.body?.changes ?? {}, admin, req.body?.reason),
    pending: await SettingsService.pending(),
  })),
  settingsHistory: handle(async () => ({ history: await SettingsService.history() })),
  settingsPending: handle(async () => ({ pending: await SettingsService.pending() })),
  approveSettings: handle(async (req, admin) => ({
    settings: await SettingsService.approve(id(req), admin, req.body?.note),
  })),
  rejectSettings: handle((req, admin) => SettingsService.reject(id(req), admin, req.body?.note)),
  revertSettings: handle(async (req, admin) => ({
    settings: await SettingsService.revert(id(req, 'auditId'), admin, req.body?.reason),
  })),
};

/** Raising and viewing disputes from the app (any signed-in user). */
export const DisputeController = {
  create: handle((req, userId) => disputes.create(userId, req.body ?? {})),
  mine: handle(async (_req, userId) => ({ disputes: await disputes.mine(userId) })),
};
