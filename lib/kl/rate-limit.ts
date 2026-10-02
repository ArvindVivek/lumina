// KL Web 1.0.3, from kitchenlabs-kit/web/kl-web/lib/rate-limit.ts. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
// Limits for API routes, so one visitor (or a bot) can't drain the shared OpenAI key.
//
// Two kinds:
// 1. createRateLimiter: in memory, per IP or per user, a fixed window. No setup at all.
//    LIMITS: memory lives in one server instance. On Vercel every function instance has its
//    own counter and a cold start resets it, so a determined caller can get more than `limit`.
//    It is a speed bump against bursts and loops, not a hard daily cap.
// 2. consumeDailyQuota: the real per-user daily cap, counted in the database by
//    <schema>.consume_ai_quota(kind) (migration 20260927120000_shared_ios_suite_foundation in
//    kitchenlabs-kit). Needs Supabase and a signed-in (or anonymous) session.
//
// Validate input before either one, so mistakes cost nothing.

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets (0 when ok). */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  reset(key: string): void;
  /** Keys currently tracked (for tests and debugging). */
  size(): number;
}

export function createRateLimiter({
  limit,
  windowMs,
  now = () => Date.now(),
  maxKeys = 5_000,
}: {
  limit: number;
  windowMs: number;
  /** Injected in tests so windows can pass without waiting. */
  now?: () => number;
  /** Caps memory: past this, expired keys are dropped, then the oldest. */
  maxKeys?: number;
}): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  function evict(t: number) {
    for (const [key, w] of windows) if (w.resetAt <= t) windows.delete(key);
    // Map keeps insertion order, so the first keys are the oldest windows.
    for (const key of windows.keys()) {
      if (windows.size < maxKeys) break;
      windows.delete(key);
    }
  }

  return {
    check(key) {
      const t = now();
      let w = windows.get(key);
      if (!w || w.resetAt <= t) {
        if (!w && windows.size >= maxKeys) evict(t);
        windows.delete(key);
        w = { count: 0, resetAt: t + windowMs };
        windows.set(key, w);
      }
      w.count += 1;
      const ok = w.count <= limit;
      return {
        ok,
        limit,
        remaining: Math.max(0, limit - w.count),
        retryAfterSeconds: ok ? 0 : Math.max(1, Math.ceil((w.resetAt - t) / 1000)),
      };
    },
    reset(key) {
      windows.delete(key);
    },
    size() {
      return windows.size;
    },
  };
}

/** The caller's IP as Vercel reports it (first x-forwarded-for entry), or "unknown". */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Key by user when signed in (fair across shared Wi-Fi), else by IP. */
export function rateLimitKey(req: Request, userId?: string | null): string {
  return userId ? `user:${userId}` : `ip:${clientIp(req)}`;
}

/** Plain-English wait time: "30 seconds", "1 minute", "5 minutes". */
export function waitText(seconds: number): string {
  if (seconds < 90) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

/** A 429 with Retry-After and a friendly message in `{ error: { code, message } }`. */
export function rateLimitedResponse(result: RateLimitResult, message?: string): Response {
  const text = message ?? `That's a lot of tries in a row. Please wait ${waitText(result.retryAfterSeconds)} and try again.`;
  return Response.json(
    { error: { code: "rate_limited", message: text } },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}

// ---------------------------------------------------------------------------------------------
// Supabase-backed daily quota

/** Any Supabase client acting as the caller (supabaseForRequest in lib/kl/supabase/server.ts). */
export interface QuotaClient {
  rpc(fn: "consume_ai_quota", args: { p_kind: string }): PromiseLike<{ data: unknown; error: unknown }>;
}

export type QuotaResult =
  | { ok: true; used: number; remaining: number }
  | { ok: false; reason: "limit" | "error"; message: string };

/**
 * Counts one use of `kind` for the caller today (UTC) and compares it with `dailyLimit`.
 * Attempts count, so a retry after a failure still costs one. Put a comment next to your
 * limit saying why that number (docs/standards/quality-bar.md).
 */
export async function consumeDailyQuota(
  db: QuotaClient,
  kind: string,
  dailyLimit: number,
  limitMessage = "You've reached today's limit. It resets at midnight UTC.",
): Promise<QuotaResult> {
  const { data, error } = await db.rpc("consume_ai_quota", { p_kind: kind });
  if (error) {
    console.error("[quota] consume_ai_quota failed", error);
    return { ok: false, reason: "error", message: "We couldn't check your usage. Please try again." };
  }
  const used = Number(data);
  if (!Number.isFinite(used)) {
    console.error("[quota] consume_ai_quota returned", data);
    return { ok: false, reason: "error", message: "We couldn't check your usage. Please try again." };
  }
  if (used > dailyLimit) return { ok: false, reason: "limit", message: limitMessage };
  return { ok: true, used, remaining: Math.max(0, dailyLimit - used) };
}

/** 429 for a spent quota, 503 when the count itself failed. */
export function quotaResponse(result: Extract<QuotaResult, { ok: false }>): Response {
  return Response.json(
    { error: { code: result.reason === "limit" ? "rate_limited" : "unavailable", message: result.message } },
    { status: result.reason === "limit" ? 429 : 503 },
  );
}
