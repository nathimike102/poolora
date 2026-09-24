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
import { SettingsService } from '../services/SettingsService';
import { AppError } from '../utils/AppError';

const overview = new AdminOverviewService();
const users = new AdminUserService();
const sos = new AdminSosService();
const disputes = new DisputeService();
const reports = new ReportService();

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

  // ── Reports (UC-A06) ──────────────────────────────────────────────────────
  report: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = id(req, 'type') as ReportType;
      if (!REPORT_TYPES.includes(type)) throw new AppError('Unknown report', 404, 'NOT_FOUND');
      const report = await reports.build(type, parseReportParams(req.query as Record<string, unknown>));
      if (queryString(req, 'format') === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="poolora-${type}-${report.from.slice(0, 10)}-to-${report.to.slice(0, 10)}.csv"`);
        res.status(200).send(reports.toCsv(report));
        return;
      }
      sendSuccess(res, report, 200, req.requestId);
    } catch (error) {
      next(error);
    }
  },

  // ── Settings (UC-A07) ─────────────────────────────────────────────────────
  settings: handle(async () => ({ settings: SettingsService.list() })),
  updateSettings: handle(async (req, admin) => ({
    settings: await SettingsService.update(req.body?.changes ?? {}, admin, req.body?.reason),
  })),
  settingsHistory: handle(async () => ({ history: await SettingsService.history() })),
  revertSettings: handle(async (req, admin) => ({
    settings: await SettingsService.revert(id(req, 'auditId'), admin, req.body?.reason),
  })),
};

/** Raising and viewing disputes from the app (any signed-in user). */
export const DisputeController = {
  create: handle((req, userId) => disputes.create(userId, req.body ?? {})),
  mine: handle(async (_req, userId) => ({ disputes: await disputes.mine(userId) })),
};
