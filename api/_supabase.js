/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Shared Supabase helpers for serverless functions
   ---------------------------------------------
   Two clients:
   • service client  — full access, bypasses RLS. NEVER expose to the browser.
                        Used for lead capture + webhook syncs.
   • anon + token     — validates a portal user's access token so we can
                        attribute writes to their account under RLS.

   Env vars required:
     SUPABASE_URL                — public project URL
     SUPABASE_SERVICE_ROLE_KEY   — secret service-role key (server only)
     SUPABASE_ANON_KEY           — public anon key (for token validation)
   ============================================= */

const { createClient } = require('@supabase/supabase-js');

let _service = null;

/** Service-role client (bypasses RLS). Throws if not configured. */
function getServiceClient() {
  if (_service) return _service;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase service client not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  }

  _service = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _service;
}

/**
 * Resolve the authenticated portal user from a bearer token.
 * Returns the Supabase user object, or null if absent/invalid.
 * The browser sends `Authorization: Bearer <access_token>` from its
 * Supabase JS session — see js/auth.js getSupabase().
 */
async function getUserFromToken(authHeader) {
  const url  = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon || !authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const client = createClient(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error) return null;
    return data.user || null;
  } catch {
    return null;
  }
}

module.exports = { getServiceClient, getUserFromToken };
