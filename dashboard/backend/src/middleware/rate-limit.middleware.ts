import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';

/**
 * Lightweight in-process sliding-window rate limiter.
 *
 * Why in-process and not `express-rate-limit` + Redis: this PR avoids
 * adding a new top-level dependency. For a single-instance backend behind
 * one nginx, an in-memory limiter is sufficient as a defence-in-depth
 * layer on top of nginx's own `limit_req`. If/when the backend scales
 * horizontally, swap this for a Redis-backed counter (the same Redis
 * instance the session store already talks to).
 *
 * Trade-offs to be aware of:
 *   - State is per process, so replicas don't share buckets.
 *   - State is lost on restart (limit briefly looser after deploys).
 *   - Memory usage is bounded only by the eviction sweep below.
 *
 * Always trust `req.ip` here, which means `app.set('trust proxy', …)`
 * MUST be configured correctly for the deployment topology, otherwise
 * the limiter will see every request as coming from the proxy.
 */

interface RateLimitOptions {
  /** Sliding-window length, in milliseconds. */
  windowMs: number;
  /** Max requests allowed per key per window. */
  max: number;
  /** Human-readable label used in the 429 response and logs. */
  label: string;
}

interface RateBucket {
  /** Request timestamps within the active window (ms since epoch). */
  hits: number[];
}

const buckets = new Map<string, RateBucket>();
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function sweep(now: number, windowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets.entries()) {
    const cutoff = now - windowMs;
    bucket.hits = bucket.hits.filter((ts) => ts > cutoff);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max, label } = options;

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    // Namespace by limiter label so the same IP can have separate
    // budgets for distinct middlewares.
    const key = `${label}:${ip}`;
    const now = Date.now();
    const cutoff = now - windowMs;

    const bucket = buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((ts) => ts > cutoff);

    if (bucket.hits.length >= max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.hits[0] + windowMs - now) / 1000)
      );

      res.setHeader('Retry-After', retryAfterSeconds.toString());
      logger.warn(
        `${label} rate limit hit for ${ip} (${bucket.hits.length}/${max} ` +
        `in ${windowMs}ms window)`
      );
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: retryAfterSeconds,
      });
      return;
    }

    bucket.hits.push(now);
    buckets.set(key, bucket);

    sweep(now, windowMs);
    next();
  };
}

/**
 * Test-only: clear all rate-limit state. Exposed so jest tests can run
 * without leaking buckets across cases.
 */
export function _resetRateLimitsForTesting() {
  buckets.clear();
  lastSweep = Date.now();
}
