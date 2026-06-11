/**
 * Token-bucket rate limiter, keyed per org.
 *
 * Why token bucket over fixed window: bursts are normal (a RevOps manager
 * opening the Decay Radar fires ~10 requests at once). Token bucket absorbs
 * the burst, then throttles sustained abuse. A fixed window would reject
 * legitimate burst traffic at the window edge.
 *
 * Backed by an in-memory store with a Redis-compatible interface so tests
 * run without infra and production swaps in ioredis via the same contract.
 */
import { Request, Response, NextFunction } from "express";

export interface BucketStore {
  get(key: string): Promise<{ tokens: number; lastRefill: number } | null>;
  set(key: string, value: { tokens: number; lastRefill: number }): Promise<void>;
}

export class MemoryBucketStore implements BucketStore {
  private map = new Map<string, { tokens: number; lastRefill: number }>();
  async get(key: string) {
    return this.map.get(key) ?? null;
  }
  async set(key: string, value: { tokens: number; lastRefill: number }) {
    this.map.set(key, value);
  }
}

export interface RateLimitOptions {
  capacity: number;      // max tokens in the bucket (burst size)
  refillPerSec: number;  // tokens added per second (sustained rate)
  store?: BucketStore;
  keyFn?: (req: Request) => string;
  now?: () => number;    // injectable clock for deterministic tests
}

export function rateLimiter(opts: RateLimitOptions) {
  const store = opts.store ?? new MemoryBucketStore();
  const keyFn = opts.keyFn ?? ((req: Request) => (req as any).orgId ?? req.ip ?? "anon");
  const now = opts.now ?? (() => Date.now());

  return async function limit(req: Request, res: Response, next: NextFunction) {
    const key = `ratelimit:${keyFn(req)}`;
    const t = now();
    const bucket = (await store.get(key)) ?? { tokens: opts.capacity, lastRefill: t };

    // Refill based on elapsed time, capped at capacity
    const elapsedSec = Math.max(0, (t - bucket.lastRefill) / 1000);
    const tokens = Math.min(opts.capacity, bucket.tokens + elapsedSec * opts.refillPerSec);

    if (tokens < 1) {
      const retryAfterSec = Math.ceil((1 - tokens) / opts.refillPerSec);
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        error: "rate_limited",
        message: `Too many requests. Try again in ${retryAfterSec}s.`,
      });
    }

    await store.set(key, { tokens: tokens - 1, lastRefill: t });
    return next();
  };
}
