require('dotenv').config();

// Optional override for environments whose resolver can't answer SRV lookups
// (e.g. mongodb+srv on some home networks). Leave unset in Kubernetes so
// cluster DNS keeps resolving internal service names.
if (process.env.DNS_SERVERS) {
  require('dns').setServers(process.env.DNS_SERVERS.split(',').map((s: string) => s.trim()));
}

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
    // This service returns JSON, so it never needs to load scripts, styles or
    // frames. The dev-only tester UI below relaxes this for its own routes.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    // Strict Transport Security: 1 year, subdomains, eligible for preload
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// Force HTTPS in production. TLS terminates at the ingress, so only redirect
// requests the proxy reports as plain HTTP; in-cluster calls (probes,
// Prometheus) reach the pod directly without that header.
if (config.isProduction) {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'http') return next();
    return res.redirect(308, `https://${req.hostname}${req.originalUrl}`);
  });
}

// 4. Body Parser
// Raw body for Razorpay webhook signature verification
app.use(['/payments/webhook', '/api/v1/payments/webhook'], express.raw({ type: 'application/json' }), (req, _res, next) => {
  if (!req.body || (Buffer.isBuffer(req.body) && req.body.length === 0)) {
    req.body = {};
    return next();
  }
  req.rawBody = req.body;
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

// API tester frontend (served by backend for quick behavior checks).
// Development only: it lists every route and is not protected by auth.
if (!config.isProduction) {
  const testerDir = path.join(process.cwd(), 'frontend-tester');
  const testerCsp = helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
    },
  });
  app.use('/tester', testerCsp, express.static(testerDir));
  app.get('/tester', testerCsp, (_req: Request, res: Response) => {
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
}

// 5. Request Logger
app.use(requestLoggerMiddleware);

// 6. Global Rate Limiter (Redis-backed)
app.use(globalRateLimit);

// 7. Service root. The public website lives on Vercel; this is the API.
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    data: { service: 'poolora-api', health: '/health' },
  });
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
    requestId: _req.requestId || '',
  });
});

// 11. Global Error Handler (last middleware)
app.use(globalErrorHandler);

export default app;
