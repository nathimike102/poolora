import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { recordRequest } from '../utils/requestStats';
import { redactUrl } from '../utils/redactUrl';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const requestId = req.requestId || '-';

  res.on('finish', () => {
    const duration = Date.now() - start;
    recordRequest(duration, res.statusCode);
    const logData = {
      requestId,
      method: req.method,
      url: redactUrl(req.originalUrl),
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')?.substring(0, 100),
    };

    if (res.statusCode >= 500) {
      logger.error('Request completed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed', logData);
    } else {
      logger.info('Request completed', logData);
    }
  });

  next();
}
