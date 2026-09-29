import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
    topUpWalletSchema,
    withdrawalSchema,
    convertCoinsSchema,
    paginationSchema,
} from '../validators';

const router = Router();

// ─── Public ───────────────────────────────────────────────────────────────────

/** GET /api/v1/wallet/tiers — info about all reward tiers (no auth required) */
router.get('/tiers', WalletController.getTierInfo);

// ─── Authenticated ────────────────────────────────────────────────────────────

router.use(authenticate);

/** GET /api/v1/wallet — current balance, coins, tier */
router.get('/', WalletController.getWallet);

/** POST /wallet/topup — start a Paynow payment that tops up the wallet; follow it at /payments/charges/:reference */
router.post('/topup', validate(topUpWalletSchema), WalletController.createTopUpOrder);

/** Withdrawals to mobile money */
router.get('/withdrawals', WalletController.listWithdrawals);
router.post('/withdrawals', validate(withdrawalSchema), WalletController.requestWithdrawal);
router.post('/withdrawals/:id/cancel', WalletController.cancelWithdrawal);

/** GET /api/v1/wallet/transactions — paginated wallet movement history */
router.get('/transactions', validate(paginationSchema), WalletController.getTransactions);

/** GET /api/v1/wallet/coins/history — paginated coin ledger */
router.get('/coins/history', validate(paginationSchema), WalletController.getCoinHistory);

/** POST /api/v1/wallet/coins/convert — convert coins to wallet balance */
router.post('/coins/convert', validate(convertCoinsSchema), WalletController.convertCoins);

export default router;
