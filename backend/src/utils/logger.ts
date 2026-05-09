import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';
const { combine, timestamp, printf, colorize, errors } = winston.format;

// ── Human-readable format for development ─────────────────────────────────────
const devTextFormat = printf(({ level, message, timestamp, requestId, ...meta }) => {
  const reqId = requestId ? ` [${requestId}]` : '';
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level}${reqId}: ${message}${metaStr}`;
});

const devConsoleFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  colorize(),
  devTextFormat,
);

const devFileFormat = combine(
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  devTextFormat,
);

// ── Structured JSON format for production (ELK / CloudWatch / Loki) ───────────
const prodFormat = combine(
  errors({ stack: true }),
  timestamp(),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction ? prodFormat : devFileFormat,
  defaultMeta: { service: 'mobility-backend' },
  transports: [
    new winston.transports.Console({
      format: isProduction ? prodFormat : devConsoleFormat,
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 10,
    }),
  ],
});
