/**
 * Structured Application Logger
 * Formats server-side operational logs with timestamps, context metadata, and sanitized payload values.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  userId?: string;
  operation?: string;
  durationMs?: number;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'api_key',
]);

const sanitizePayload = (obj: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitized[key] = sanitizePayload(val as Record<string, unknown>);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
};

const formatMessage = (level: LogLevel, message: string, context?: LogContext) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? sanitizePayload(context) : {}),
  };
  return JSON.stringify(payload);
};

export const logger = {
  info: (message: string, context?: LogContext) => {
    console.log(formatMessage('info', message, context));
  },
  warn: (message: string, context?: LogContext) => {
    console.warn(formatMessage('warn', message, context));
  },
  error: (message: string, context?: LogContext) => {
    console.error(formatMessage('error', message, context));
  },
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', message, context));
    }
  },
};
