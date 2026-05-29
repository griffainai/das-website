/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Shared helpers for admin API serverless functions.

   - requireAdmin(req, res): verifies the Supabase access token from the
     Authorization: Bearer header (the portal uses Supabase Auth — same
     project as the database), then checks the verified email against the
     ADMIN_EMAILS allowlist. On failure it writes the response and returns
     null; on success returns { email }.

   - sb(pathAndQuery, opts): minimal Supabase REST (PostgREST) client using
     the service-role key. Admin endpoints legitimately operate across all
     companies' rows, so they bypass RLS via the service role — access is
     gated by requireAdmin() above, not by RLS.

   Ported from das-portal's Supabase-session `assertAdmin` + server client,
   adapted to the static site's Firebase-auth model.
   ============================================= */

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY     = process.env.SUPABASE_ANON_KEY;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Verify a Supabase access token by calling the Supabase Auth user endpoint.
 * The portal signs users in with @supabase/supabase-js, so the client holds a
 * standard Supabase access token (JWT). We validate it server-side via
 * GET /auth/v1/user. Returns the verified, lowercased email, or null if the
 * token is missing/invalid/expired.
 */
async function verifySupabaseToken(accessToken) {
  if (!accessToken || !SUPABASE_URL || !ANON_KEY) return null;
  try {
    const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method:  'GET',
      headers: {
        apikey:        ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!resp.ok) return null;
    const user = await resp.json();
    if (!user || !user.email) return null;
    return String(user.email).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Express-style admin guard. Writes a 401/403 and returns null on failure.
 * Returns { email } on success.
 */
async function requireAdmin(req, res) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const match = /^Bearer\s+(.+)$/i.exec(String(authHeader));
  const token = match ? match[1].trim() : null;

  const email = await verifySupabaseToken(token);
  if (!email) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (!adminEmails().includes(email)) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return { email };
}

/**
 * Minimal Supabase REST (PostgREST) helper using the service-role key.
 * `pathAndQuery` is everything after /rest/v1/ — e.g.
 *   sb('das_orders?status=eq.pending&select=id,total')
 *   sb('das_orders?id=eq.' + id, { method: 'PATCH', body: { status } })
 * Returns { ok, status, data }.
 */
async function sb(pathAndQuery, { method = 'GET', body, headers } = {}) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return { ok: false, status: 500, data: { error: 'Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' } };
  }
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey:          SERVICE_KEY,
      Authorization:   `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/json',
      Prefer:          'return=representation',
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: resp.ok, status: resp.status, data };
}

module.exports = { requireAdmin, verifySupabaseToken, adminEmails, sb };
