import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/AppError';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Joi-based input validation middleware factory.
 * Validates the specified parts of the request against the provided schemas.
 */
export function validate(schemas: Partial<Record<RequestPart, Joi.ObjectSchema>>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: Record<string, string[]> = {};

    for (const [part, schema] of Object.entries(schemas) as [RequestPart, Joi.ObjectSchema][]) {
      const { error, value } = schema.validate(req[part], {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false,
      });

      if (error) {
        errors[part] = error.details.map((d) => d.message);
      } else {
        // Replace request data safely (bypasses Express 5 getter-only properties like req.query)
        Object.defineProperty(req, part, {
          value,
          writable: true,
          enumerable: true,
          configurable: true,
        });
      }
    }

    if (Object.keys(errors).length > 0) {
      next(new ValidationError('Validation failed', errors));
      return;
    }

    next();
  };
}
