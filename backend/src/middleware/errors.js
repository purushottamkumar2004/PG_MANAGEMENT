// Every error leaves the API as { error: { code, message } }.
import { AppError } from '../lib/errors.js';

export function notFoundRoute(_req, _res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Route not found'));
}

// Express needs the 4-argument signature to treat this as an error handler.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  // Body parser errors (bad JSON, too large, wrong charset) are client input problems.
  if (err?.type && typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } });
  }
  // Log only message and stack: never request bodies, tokens or DB row details.
  if (process.env.NODE_ENV !== 'test') console.error('Unhandled error:', err?.stack ?? err?.message ?? err);
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
}
