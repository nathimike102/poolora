import { Router } from 'express';
import { AdminController, getKycDocuments } from '../controllers/AdminController';
import { AdminWebController as W } from '../controllers/AdminWebController';
import { validate } from '../middlewares/validation.middleware';
import { kycReviewParamsSchema, moderateReviewSchema } from '../validators';
import { authenticate } from '../middlewares/auth.middleware';
import { requireAdmin } from '../middlewares/capability.middleware';

const router = Router();

/**
 * All admin routes require authentication and admin capability
 */
router.use(authenticate, requireAdmin());

/**
 * GET /api/v1/admin/metrics
 * Get system metrics
 */
router.get('/metrics', AdminController.getMetrics);

/**
 * GET /api/v1/admin/rides
 * Get all rides
 */
router.get('/rides', AdminController.getRides);

/**
 * GET /api/v1/admin/users
 * Get all users
 */
router.get('/users', AdminController.getUsers);

/**
 * GET /api/v1/admin/payments
 * Get payments
 */
router.get('/payments', AdminController.getPayments);

/**
 * GET /api/v1/admin/demand-heatmap
 * Get demand clusters
 */
router.get('/demand-heatmap', AdminController.getDemandHeatmap);

/**
 * GET /admin/kyc/:userId/documents
 * Temporary links to review a driver's KYC documents
 */
router.get('/kyc/:userId/documents', validate(kycReviewParamsSchema), getKycDocuments);

// ─── Web admin (admin-web/) ─────────────────────────────────────────────────
router.get('/overview', W.overview);

router.get('/applications', W.applications);
router.post('/applications/:userId/request-changes', W.requestKycChanges);
router.post('/applications/:userId/recheck', W.recheckApplication);

router.get('/accounts', W.searchUsers);
router.get('/accounts/:id', W.userDetail);
router.post('/accounts/:id/suspend', W.suspend);
router.post('/accounts/:id/reinstate', W.reinstate);
router.post('/accounts/:id/block', W.requestBlock);
router.post('/accounts/:id/block/approve', W.approveBlock);
router.post('/accounts/:id/block/reject', W.rejectBlock);
router.post('/accounts/:id/unblock', W.unblock);
router.post('/accounts/:id/notes', W.addNote);
router.get('/accounts/:id/duplicates', W.duplicates);
router.post('/accounts/:id/merge', W.requestMerge);
router.get('/merges', W.listMerges);
router.post('/merges/:id/approve', W.approveMerge);
router.post('/merges/:id/reject', W.rejectMerge);
router.get('/accounts/:id/calls', W.userCalls);
router.get('/calls/:id/recording', W.callRecording);
router.get('/alert-rules', W.alertRules);
router.post('/alert-rules', W.createAlertRule);
router.patch('/alert-rules/:id', W.updateAlertRule);
router.delete('/alert-rules/:id', W.deleteAlertRule);
router.post('/alert-rules/:id/test', W.testAlertRule);
router.get('/parcel-claims', W.parcelClaims);
router.post('/parcel-claims/:id/decide', W.decideParcelClaim);
router.get('/parcels/:id/photos/:photoId', W.parcelPhoto);
router.get('/appeals', W.listAppeals);
router.post('/appeals/:id/decide', W.decideAppeal);

router.get('/support', W.supportQueue);
router.get('/support/:id', W.supportTicket);
router.post('/support/:id/reply', W.supportReply);
router.post('/support/:id/close', W.supportClose);

router.get('/reviews', W.reviews);
router.post('/reviews/:id/moderate', validate(moderateReviewSchema), W.moderateReview);

router.get('/fraud', W.fraudQueue);
router.post('/fraud/:id/review', W.reviewFraud);

router.get('/disputes', W.listDisputes);
router.get('/disputes/:id', W.disputeDetail);
router.post('/disputes/:id/assign', W.assignDispute);
router.post('/disputes/:id/resolve', W.resolveDispute);

router.get('/sos', W.listSos);
router.get('/sos/:id', W.sosDetail);
router.post('/sos/:id/log', W.sosLog);
router.post('/sos/:id/acknowledge', W.sosAcknowledge);
router.post('/sos/:id/resolve', W.sosResolve);
router.post('/sos/:id/police', W.sosPolice);

router.get('/report-schedules', W.reportSchedules);
router.post('/report-schedules', W.createReportSchedule);
router.patch('/report-schedules/:id', W.updateReportSchedule);
router.delete('/report-schedules/:id', W.deleteReportSchedule);
router.post('/report-schedules/:id/send', W.sendReportSchedule);
router.get('/reports/:type', W.report);

router.get('/settings', W.settings);
router.put('/settings', W.updateSettings);
router.get('/settings/history', W.settingsHistory);
router.get('/settings/pending', W.settingsPending);
router.post('/settings/pending/:id/approve', W.approveSettings);
router.post('/settings/pending/:id/reject', W.rejectSettings);
router.post('/settings/revert/:auditId', W.revertSettings);

router.get('/audit', W.auditLog);

export default router;