require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import { requestIdMiddleware } from './middlewares/requestId.middleware';
import { requestLoggerMiddleware } from './middlewares/logger.middleware';
import { globalRateLimit } from './middlewares/rateLimit.middleware';
import { globalErrorHandler } from './middlewares/error.middleware';
import routes from './routes';
import { testerPresets } from './tester/presets';

const app = express();

// ─── Middleware Execution Chain (strict order) ───────────────────────────────

// 0. Trust the first proxy hop (nginx / cloud LB) so req.ip and rate-limit
//    keys are the real client IP, not the proxy address.
if (config.isProduction) {
  app.set('trust proxy', 1);
}

// 1. Request ID
app.use(requestIdMiddleware);

// 2. CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin header (React Native / mobile)
      if (!origin) return callback(null, true);

      // In development, allow localhost and 127.0.0.1 from any port
      // so local tools (e.g. live-server) can call the API.
      const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
      if (!config.isProduction && isLocalDevOrigin) {
        return callback(null, true);
      }

      if (config.cors.origin.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    maxAge: 86400, // cache preflight for 24 h
  }),
);

// 3. Security Headers (Helmet)
app.use(
  helmet({
    // CSP is intentionally disabled here — configure it at the reverse-proxy
    // or CDN layer where you have full control over the policy directives.
    contentSecurityPolicy: false,
    // Strict Transport Security: 30 days, applies to subdomains
    hsts: {
      maxAge: 2592000,
      includeSubDomains: true,
    },
  }),
);

// 4. Body Parser
// Raw body for Razorpay webhook signature verification
app.use(['/payments/webhook', '/api/v1/payments/webhook'], express.raw({ type: 'application/json' }), (req, _res, next) => {
  if (!req.body || (Buffer.isBuffer(req.body) && req.body.length === 0)) {
    req.body = {};
    return next();
  }
  (req as any).rawBody = req.body;
  try {
    req.body = JSON.parse(req.body.toString());
  } catch {
    req.body = {};
  }
  next();
});
// Tighter body limits — 1 MB is ample for API payloads; prevents abuse
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(compression());

// API tester frontend (served by backend for quick behavior checks)
const testerDir = path.join(process.cwd(), 'frontend-tester');
app.use('/tester', express.static(testerDir));
app.get('/tester', (_req: Request, res: Response) => {
  res.sendFile(path.join(testerDir, 'index.html'));
});
app.get('/tester/metadata', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    data: {
      presets: testerPresets,
      version: '1',
      generatedAt: new Date().toISOString(),
    },
  });
});

// 5. Request Logger
app.use(requestLoggerMiddleware);

// 6. Global Rate Limiter (Redis-backed)
app.use(globalRateLimit);

// 7. Static landing page at base URL
app.get('/', (_req: Request, res: Response) => {
  res.status(200).type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>One Piece Backend</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; color: #111827; }
      h1 { margin-bottom: 0.25rem; }
      p { margin-top: 0; color: #374151; }
      ul { padding-left: 1.25rem; }
      code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>One Piece Backend</h1>
    <p>This is the backend service for One Piece. Use the routes below.</p>
    <h2>Available Route Groups</h2>
    <ul>
      <li><code>/tester</code> (API behavior test UI)</li>
      <li><code>/health</code></li>
      <li><code>/auth</code></li>
      <li><code>/rides</code></li>
      <li><code>/bookings</code></li>
      <li><code>/payments</code></li>
      <li><code>/chat</code></li>
      <li><code>/safety</code></li>
      <li><code>/ratings</code></li>
      <li><code>/wallet</code></li>
    </ul>
  </body>
</html>`);
});

// 8-11. Routes (Auth, Authorization, Validation, Controller handled per-route)
app.use('/', routes);

// 12. Temporary backward compatibility for old /api/v1 clients
app.use('/api/v1', (req, res, next) => {
  // Webhook senders may not follow redirects reliably; keep it functional.
  if (req.path === '/payments/webhook') {
    return next();
  }

  const targetPath = req.originalUrl.replace(/^\/api\/v1/, '') || '/';
  res.setHeader('X-API-Deprecation', 'Use routes without /api/v1 prefix');
  return res.redirect(307, targetPath);
});

app.use('/api/v1', routes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    code: 404,
    error: {
      id: 'NOT_FOUND',
      message: 'The requested resource was not found',
    },
    timestamp: new Date().toISOString(),
    requestId: (_req as any).requestId || '',
  });
});

// 11. Global Error Handler (last middleware)
app.use(globalErrorHandler);

export default app;
