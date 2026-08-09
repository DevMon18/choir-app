/**
 * Standardized Application Error System & Result Types
 */

export class ApplicationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code = 'INTERNAL_ERROR', statusCode = 500) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class UnauthorizedError extends ApplicationError {
  constructor(message = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApplicationError {
  constructor(message = 'Insufficient permissions') {
    super(message, 'FORBIDDEN', 403);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends ApplicationError {
  constructor(message = 'Invalid input data') {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends ApplicationError {
  constructor(message = 'Rate limit exceeded. Please slow down.') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
    this.name = 'RateLimitError';
  }
}

export class NotFoundError extends ApplicationError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Helper to catch and format errors into structured ActionResult responses
 */
export function handleServerError(err: unknown): ActionResult<never> {
  if (err instanceof ApplicationError) {
    return {
      success: false,
      error: err.message,
      code: err.code,
    };
  }

  if (err instanceof Error) {
    return {
      success: false,
      error: err.message,
      code: 'SERVER_ERROR',
    };
  }

  return {
    success: false,
    error: 'An unexpected server error occurred.',
    code: 'UNKNOWN_ERROR',
  };
}
