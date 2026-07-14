/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Fleet Calculator Submit — Vercel Serverless Function
   POST /api/calculator-submit

   Purpose (two jobs):
     1. AUTHORITATIVE MATH. Recomputes the calculator result server-side with the
        SAME engine the browser uses (lib/fleet-calculators.js). The client is
        never trusted for the numbers — the front end can show an instant local
        estimate, but the stored/returned figure is the server's. One engine,
        both sides → the "match equation" is guaranteed identical everywhere.
     2. FIRST-PARTY DATA (the moat). Persists anonymized fleet inputs + computed
        outputs to feed the "DAS Driver Recognition Index." Optional email is
        captured as a lead. Degrades gracefully when Supabase/Resend env is unset.

   Expected Supabase table (owned by the portal schema; this fn only inserts):
     create table calculator_submissions (
       id           bigint generated always as identity primary key,
       calculator   text not null,          -- 'turnover' | 'recognition' | 'safety'
       inputs       jsonb not null,
       result       jsonb not null,
       fleet_size   numeric,                -- denormalized for fast Index aggregation
       email        text,                   -- nullable; present only if user opted in
       source       text,
       user_agent   text,
       referer      text,
       created_at   timestamptz default now()
     );
   ============================================= */

const Calc = require('../lib/fleet-calculators.js');

// Whitelist of numeric input fields per calculator — anything else is dropped,
// so we never persist arbitrary client payloads.
const ALLOWED_INPUTS = {
  turnover:    ['fleetSize', 'turnoverPct', 'replacementCostPerDriver'],
  recognition: ['fleetSize', 'turnoverPct', 'replacementCostPerDriver', 'recognitionSpendPerDriver', 'turnoverReductionPct'],
  safety:      ['fleetSize', 'crashesPerYear', 'avgMilesPerTruck', 'crashRatePerMillionMiles', 'avgCrashCost', 'incidentReductionPct', 'recognitionSpendPerDriver'],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeInputs(type, raw) {
  const allowed = ALLOWED_INPUTS[type];
  const out = {};
  raw = raw || {};
  for (const key of allowed) {
    if (raw[key] === undefined || raw[key] === null || raw[key] === '') continue;
    const n = Number(raw[key]);
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

module.exports = async (req, res) => {
  const allowedOrigin = process.env.SITE_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const calculator = String(body.calculator || '').trim();

  if (!ALLOWED_INPUTS[calculator]) {
    return res.status(400).json({ error: 'Unknown calculator. Expected: turnover, recognition, or safety.' });
  }

  const inputs = sanitizeInputs(calculator, body.inputs);

  // ── 1. Authoritative recompute ────────────────────────────
  let result;
  try {
    result = Calc.calculate(calculator, inputs);
  } catch (e) {
    console.error('[Calculator] compute error:', e.message);
    return res.status(400).json({ error: 'Could not compute result.' });
  }

  // Optional email (lead opt-in). Ignore silently if malformed rather than reject
  // the whole submission — the number still matters to the user.
  let email = null;
  if (body.email && typeof body.email === 'string') {
    const e = body.email.trim().toLowerCase();
    if (e.length <= 254 && EMAIL_RE.test(e)) email = e;
  }

  // ── 2. Persist for the DAS Recognition Index (non-fatal) ──
  const SB_URL     = process.env.SUPABASE_URL;
  const SB_SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (SB_URL && SB_SVC_KEY) {
    const record = {
      calculator,
      inputs,
      result,
      fleet_size: inputs.fleetSize != null ? inputs.fleetSize : null,
      email,
      source: 'calculator_' + calculator,
      user_agent: (req.headers['user-agent'] || '').slice(0, 512),
      referer: (req.headers['referer'] || req.headers['referrer'] || '').slice(0, 512),
    };
    try {
      await fetch(`${SB_URL}/rest/v1/calculator_submissions`, {
        method: 'POST',
        headers: {
          'apikey':        SB_SVC_KEY,
          'Authorization': `Bearer ${SB_SVC_KEY}`,
          'Content-Type':  'application/json',
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify(record),
      });
    } catch (e) {
      console.error('[Calculator] Supabase insert error:', e.message);
    }

    // Also register the email on the newsletter list (dedup-safe), mirroring
    // the newsletter endpoint's insert so leads land in one place.
    if (email) {
      try {
        await fetch(`${SB_URL}/rest/v1/newsletter_subscribers`, {
          method: 'POST',
          headers: {
            'apikey':        SB_SVC_KEY,
            'Authorization': `Bearer ${SB_SVC_KEY}`,
            'Content-Type':  'application/json',
            'Prefer':        'return=minimal,resolution=ignore-duplicates',
          },
          body: JSON.stringify({ email, source: 'calculator_' + calculator }),
        });
      } catch (e) {
        console.error('[Calculator] newsletter insert error:', e.message);
      }
    }
  } else {
    console.log('[Calculator] Supabase not configured — computed', calculator, 'result in dev mode.');
  }

  // ── 3. Return the authoritative result to the client ──────
  return res.status(200).json({ ok: true, calculator, inputs, result });
};
