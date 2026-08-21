/* =============================================
   In-memory per-IP rate ceiling for email-sending / row-inserting endpoints.
   Underscore-prefixed → helper, NOT a Vercel function (12-function cap).

   Per-lambda-instance memory, so this is a SPEED BUMP, not a guarantee —
   the same doctrine as the AI guard wall's rate gate: stop the loop before
   it reaches Resend/Supabase, don't pretend to be a distributed limiter.
   ============================================= */

const buckets = new Map(); // key -> [timestamps]
const MAX_KEYS = 5000;     // bound memory on long-lived instances

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (Array.isArray(fwd) ? fwd[0] : String(fwd || '')).split(',')[0].trim()
    || req.socket?.remoteAddress || 'unknown';
}

/**
 * rateLimit(req, route, { burst, perHour }) → { allowed, retryAfter }
 * burst: max requests per minute. perHour: max per hour.
 */
function rateLimit(req, route, { burst = 5, perHour = 20 } = {}) {
  const now = Date.now();
  const key = route + ':' + clientIp(req);
  if (buckets.size > MAX_KEYS) buckets.clear();
  const hits = (buckets.get(key) || []).filter((t) => now - t < 3600_000);
  const lastMinute = hits.filter((t) => now - t < 60_000).length;
  if (lastMinute >= burst || hits.length >= perHour) {
    return { allowed: false, retryAfter: lastMinute >= burst ? 60 : 3600 };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { allowed: true };
}

module.exports = { rateLimit, clientIp };
