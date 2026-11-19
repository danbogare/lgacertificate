import { Request, RequestHandler } from "express";

interface IRateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

interface IRateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory limiter for a single Node process. Use a shared store (for example Redis)
// when deploying multiple instances so each instance enforces the same quota.
export function createRateLimiter({
  windowMs,
  max,
  message = "Too many requests. Please try again later.",
}: IRateLimitOptions): RequestHandler {
  const entries = new Map<string, IRateLimitEntry>();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key);
    }
  }, Math.min(windowMs, 60_000));
  cleanup.unref();

  return (req, res, next) => {
    const key = getClientKey(req);
    const now = Date.now();
    let entry = entries.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      entries.set(key, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", remaining);
    res.setHeader("RateLimit-Reset", Math.max(1, Math.ceil((entry.resetAt - now) / 1000)));

    if (entry.count > max) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((entry.resetAt - now) / 1000)));
      res.status(429).json({ success: false, message });
      return;
    }

    next();
  };
}

function getClientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}
