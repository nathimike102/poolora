export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorId: string;

  constructor(message: string, statusCode: number, errorId?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errorId = errorId || this.deriveErrorId(statusCode);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  private deriveErrorId(code: number): string {
    switch (code) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      case 422: return 'VALIDATION_ERROR';
      case 429: return 'RATE_LIMITED';
      case 503: return 'SERVICE_UNAVAILABLE';
      default: return 'INTERNAL_ERROR';
    }
  }
}

export class ValidationError extends AppError {
  public readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR');
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMITED');
  }
}
