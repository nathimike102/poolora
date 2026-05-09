import { Router } from 'express';
import { WalletController } from '../controllers/WalletController';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validation.middleware';
import {
    topUpWalletSchema,
    confirmTopUpSchema,
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

/** POST /api/v1/wallet/topup — create Razorpay order for wallet top-up */
router.post('/topup', validate(topUpWalletSchema), WalletController.createTopUpOrder);

/** POST /api/v1/wallet/topup/confirm — confirm payment and credit wallet */
router.post('/topup/confirm', validate(confirmTopUpSchema), WalletController.confirmTopUp);

/** GET /api/v1/wallet/transactions — paginated INR movement history */
router.get('/transactions', validate(paginationSchema), WalletController.getTransactions);

/** GET /api/v1/wallet/coins/history — paginated coin ledger */
router.get('/coins/history', validate(paginationSchema), WalletController.getCoinHistory);

/** POST /api/v1/wallet/coins/convert — convert coins to INR balance */
router.post('/coins/convert', validate(convertCoinsSchema), WalletController.convertCoins);

export default router;
