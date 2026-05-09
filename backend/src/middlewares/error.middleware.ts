import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/AppError';
import { ApiResponse } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Global error handler — last middleware in the chain.
 * Maps known AppError instances to standardized API responses.
 * Swallows stack traces in production.
 */
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as any).requestId || '';

  // Mongoose validation error
  if (err.name === 'ValidationError' && !(err instanceof AppError)) {
    const mongooseErr = err as any;
    const details = Object.values(mongooseErr.errors || {}).map(
      (e: any) => e.message,
    );
    const response: ApiResponse = {
      status: 'error',
      code: 422,
      error: {
        id: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };
    res.status(422).json(response);
    return;
  }

  // Mongoose duplicate key error
  if ((err as any).code === 11000) {
    const keyPattern = (err as any).keyPattern || {};
    const field = Object.keys(keyPattern)[0] || 'field';
    const response: ApiResponse = {
      status: 'error',
      code: 409,
      error: {
        id: 'CONFLICT',
        message: `Duplicate value for ${field}`,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };
    res.status(409).json(response);
    return;
  }

  // Mongoose cast error (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    const response: ApiResponse = {
      status: 'error',
      code: 422,
      error: {
        id: 'VALIDATION_ERROR',
        message: 'Invalid ID format',
      },
      timestamp: new Date().toISOString(),
      requestId,
    };
    res.status(422).json(response);
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    const response: ApiResponse = {
      status: 'error',
      code: 401,
      error: {
        id: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      },
      timestamp: new Date().toISOString(),
      requestId,
    };
    res.status(401).json(response);
    return;
  }

  // Known operational errors
  if (err instanceof AppError) {
    const response: ApiResponse = {
      status: 'error',
      code: err.statusCode,
      error: {
        id: err.errorId,
        message: err.message,
        details: err instanceof ValidationError ? err.details : undefined,
      },
      timestamp: new Date().toISOString(),
      requestId,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Unknown / programming errors
  logger.error('Unhandled error', {
    requestId,
    error: err.message,
    stack: err.stack,
    name: err.name,
  });

  const response: ApiResponse = {
    status: 'error',
    code: 500,
    error: {
      id: 'INTERNAL_ERROR',
      message: config.isProduction
        ? 'An unexpected error occurred'
        : err.message,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };

  res.status(500).json(response);
}
