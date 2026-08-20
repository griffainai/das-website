/**
 * THE AI GUARD WALL — the one chokepoint every model call in this service goes through.
 *
 * PORTED from the TSC build 2026-08-14. Doctrine: griffain-agency-workspace
 * 06_operations/AI-ENDPOINT-GUARD-WALL.md · unit economics:
 * 02_services/10_speed-to-lead/AI-UNIT-ECONOMICS.md
 *
 * WHY THIS EXISTS
 * ~$12 of API credit burned in a day on a site with ~6 real visitors. The cause was not the
 * concierge and not traffic: `api/concierge-eval.js` was a test script living in `api/`, and
 * Vercel publishes every `api/*.js` as a public function. Its body ran at module scope — ten
 * live model calls with the full system prompt — then called `process.exit()`, crashing the
 * lambda into a 500, which is exactly what crawlers and retries hit again.
 *
 * The generalised lesson: **an unguarded model call behind a public URL is a denial-of-WALLET,
 * not a cost bug.** The vendor will happily bill an infinite loop.
 *
 * WHAT THIS ENFORCES
 *   1. KILL SWITCH   — AI_KILL_SWITCH=1 stops every call instantly, no deploy needed.
 *   2. SPEND CEILING — THREE BANDS, not one cutoff:
 *                        normal   ≤ allowance           → serve quietly
 *                        overage  allowance → hard cap  → serve operator paths + ALERT; public
 *                                                         traffic is refused here
 *                        hard cap > hard cap             → refuse everyone
 *                      Silencing a reply to a real homeowner to save two cents is the wrong
 *                      trade; a stranger looping a public endpoint is not. And because a worked
 *                      lead costs ~4.8c, real demand CANNOT reach these numbers — so the spend
 *                      ceiling is a DEFECT ALARM, not a quota. If it trips, something is broken.
 *                      Unit economics: 02_services/10_speed-to-lead/AI-UNIT-ECONOMICS.md
 *   3. RATE CEILING  — burst + hourly caps, so a loop is stopped before it reaches the vendor.
 *   4. METER         — prices every call from the usage block the API already returns, and
 *                      counts REFUSALS as well as successes. A ledger that records only
 *                      successes reports an outage and a quiet day identically.
 *
 * HONEST LIMIT: counters live in module memory, which on Vercel is PER LAMBDA INSTANCE. This is
 * a speed bump, not a wall. The wall is AI_KILL_SWITCH plus a vendor-side spend cap on the key.
 * Never treat this file as the reason a key is safe.
 */

// The INCLUDED allowance for a day. A worked lead is ~4.8¢, so $2/day is ~40x a busy real day —
// deliberately far above demand, because this is a defect alarm and not a quota.
const DAILY_BUDGET_USD = Number(process.env.AI_DAILY_BUDGET_USD || 2);
// Beyond this, nothing is served to anyone. Past here it is not a customer, it is a bug.
const HARD_CAP_USD = Number(process.env.AI_HARD_CAP_USD || 10);
// Whose spend this is. Every ledger line carries it so per-client actuals are recoverable.
const CLIENT = process.env.AI_CLIENT_SLUG || 'das-web';
const MAX_PER_MIN = Number(process.env.AI_MAX_PER_MIN || 10);
const MAX_PER_HOUR = Number(process.env.AI_MAX_PER_HOUR || 120);

/** USD per 1M tokens. Update when pricing changes; unknown models price at the MOST expensive. */
const PRICES = {
  'claude-opus-5': { in: 15, out: 75 },
  'claude-sonnet-5': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
};
const MOST_EXPENSIVE = Object.values(PRICES).reduce(
  (a, p) => ({ in: Math.max(a.in, p.in), out: Math.max(a.out, p.out) }), { in: 0, out: 0 });

let _day = null;
let _spend = 0;
let _hits = [];
let _allowed = 0;
let _refused = 0;

const today = () => new Date().toISOString().slice(0, 10);
function rollDay() {
  const d = today();
  if (_day !== d) { _day = d; _spend = 0; _hits = []; _allowed = 0; _refused = 0; }
}

/**
 * Price a call from the vendor's own usage block.
 * An unknown model id prices at the most expensive known rate — guessing cheap under-reports
 * exactly what the ledger exists to catch.
 */
function priceCall(model, usage = {}) {
  const p = PRICES[model] || MOST_EXPENSIVE;
  // Cached reads bill at ~10% of base input and cache WRITES at ~125%. Pricing them all at full
  // input rate would over-report by ~2x on a cached call and make the ledger useless for exactly
  // the decision it exists to inform — whether caching is working.
  const fresh = Number(usage.input_tokens || 0);
  const cacheRead = Number(usage.cache_read_input_tokens || 0);
  const cacheWrite = Number(usage.cache_creation_input_tokens || 0);
  const outTok = Number(usage.output_tokens || 0);
  return (fresh / 1e6) * p.in
    + (cacheRead / 1e6) * p.in * 0.10
    + (cacheWrite / 1e6) * p.in * 1.25
    + (outTok / 1e6) * p.out;
}

/**
 * May this call proceed?
 * @param {{feature:string, trust:'public'|'internal'}} ctx
 * @returns {{ok:true}|{ok:false, reason:string}}
 */
function guardDecision({ feature = 'unknown', trust = 'public' } = {}) {
  rollDay();
  const deny = (reason) => {
    _refused++;
    console.error('AI_REFUSED', JSON.stringify({ day: _day, client: CLIENT, feature, trust, reason, spend: round(_spend) }));
    return { ok: false, reason };
  };

  if (process.env.AI_KILL_SWITCH === '1') return deny('kill_switch');

  const now = Date.now();
  _hits = _hits.filter((t) => now - t <= 3600_000);
  const lastMin = _hits.filter((t) => now - t <= 60_000).length;
  if (lastMin >= MAX_PER_MIN || _hits.length >= MAX_PER_HOUR) return deny('rate_limit');

  // ---- THREE BANDS, not one cutoff ----------------------------------------
  // A blunt cap that cuts off a client who legitimately needs more is a bad cap: it drops real
  // leads to save pennies. That objection is right in general and does NOT apply here, because
  // real demand cannot reach these numbers. A worked lead costs ~4.8¢ and a busy month is ~$5,
  // so a $2/day cap sits ~40x above the highest plausible real day.
  //
  // So the spend ceiling is a DEFECT ALARM, not a quota. If it trips, something is broken — a
  // loop, a retry storm, a stray endpoint, two bots talking to each other. See
  // 02_services/10_speed-to-lead/AI-UNIT-ECONOMICS.md.
  //
  //   normal    ≤ allowance          serve quietly
  //   overage   allowance → hard cap serve, but ALERT — never drop a real lead over pennies
  //   hard stop > hard cap           refuse; public surfaces stop first and hardest
  if (_spend >= HARD_CAP_USD) return deny('hard_cap');

  if (_spend >= DAILY_BUDGET_USD) {
    // Public/untrusted traffic has no claim on the overage band at all.
    if (trust === 'public') return deny('daily_budget');
    // Operator paths keep serving: the customer on the other end is worth orders of magnitude
    // more than the overage. This is an upsell/incident signal, not a reason to go silent.
    console.error('AI_OVERAGE', JSON.stringify({
      feature, spend: round(_spend), allowance: DAILY_BUDGET_USD, hard_cap: HARD_CAP_USD,
      note: 'serving anyway — investigate as a defect before raising the cap',
    }));
  }

  _hits.push(now);
  _allowed++;
  return { ok: true };
}

/** Record what a call actually cost. Call this on EVERY response that carried a usage block. */
function meter({ feature = 'unknown', model = 'unknown', usage = {} } = {}) {
  rollDay();
  const cost = priceCall(model, usage);
  _spend += cost;
  // Structured and greppable: this is the ledger when there is no database.
  console.log('AI_SPEND', JSON.stringify({
    day: _day, client: CLIENT, feature, model,
    in: Number(usage.input_tokens || 0), out: Number(usage.output_tokens || 0),
    cache_read: Number(usage.cache_read_input_tokens || 0),
    cache_write: Number(usage.cache_creation_input_tokens || 0),
    usd: round(cost), day_usd: round(_spend),
  }));
  return cost;
}

const round = (n) => Math.round(n * 1e6) / 1e6;
const spentToday = () => { rollDay(); return _spend; };
const counters = () => { rollDay(); return { allowed: _allowed, refused: _refused, spend: round(_spend) }; };

/**
 * The ONE way this site talks to Anthropic. Guards, calls, meters.
 * @returns {{ok:true, text:string, usage:object}|{ok:false, reason:string}}
 */
async function callModel(payload, { feature = 'unknown', trust = 'public', cache = true } = {}) {
  const gate = guardDecision({ feature, trust });
  if (!gate.ok) return gate;

  // ---- PROMPT CACHING: the single biggest cost lever, and it is free ---------
  // The system prompt is ~1,600 tokens and is re-sent on EVERY call — roughly 75% of the input
  // bill, paying full price to send the same bytes over and over. Marking it ephemeral makes
  // subsequent reads cost ~10% of base input: **−55% per call, with the model and the output
  // completely unchanged.**
  //
  // This is why "switch to a cheaper model" is the wrong first move: caching saves more than
  // downgrading does, and it costs nothing in quality. Cached sonnet lands near the price of
  // UNCACHED haiku. See 02_services/10_speed-to-lead/AI-UNIT-ECONOMICS.md §"Model choice".
  //
  // Only the SYSTEM block is cached — it is the constant. The thread varies every turn, so
  // caching it would pay the 1.25x write premium for a block that is never read again.
  if (cache && typeof payload.system === 'string' && payload.system.length > 2000) {
    payload = {
      ...payload,
      system: [{ type: 'text', text: payload.system, cache_control: { type: 'ephemeral' } }],
    };
  }

  const key = process.env.ANTHROPIC_API_KEY || process.env.CRM_ANTHROPIC_KEY;
  if (!key) { console.error('AI_NO_KEY', feature); return { ok: false, reason: 'no_key' }; }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('AI_UPSTREAM_FAILED', feature, res.status, (await res.text().catch(() => '')).slice(0, 300));
      return { ok: false, reason: 'upstream_' + res.status };
    }
    const json = await res.json();
    meter({ feature, model: payload.model, usage: json.usage || {} });
    const text = (json.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
    // `json` is returned too so tool-use callers (call recap) can read tool_use blocks without
    // needing their own fetch — the whole point is that there is exactly ONE way out to the vendor.
    return { ok: true, text, usage: json.usage || {}, json };
  } catch (err) {
    console.error('AI_CALL_ERROR', feature, String(err));
    return { ok: false, reason: 'error' };
  }
}


/**
 * SDK-shaped entry point. DAS calls Anthropic through `@anthropic-ai/sdk`, not raw fetch, so
 * this wraps `client.messages.create` with the identical gate/cache/meter as callModel().
 *
 * Returns the SDK response on success, or null when the guard refuses. Callers must treat null
 * as "no model available" and fall back — every DAS call site already has a fallback path,
 * which is why refusing is safe here.
 *
 * @param {object} client  an @anthropic-ai/sdk instance
 * @param {object} payload the messages.create payload
 * @param {{feature:string, trust:'public'|'internal', cache?:boolean}} ctx
 */
async function guardedCreate(client, payload, { feature = 'unknown', trust = 'public', cache = true } = {}) {
  const gate = guardDecision({ feature, trust });
  if (!gate.ok) return null;

  // Same caching rule as callModel: only the constant SYSTEM block, only when it is big enough
  // that the 1.25x write premium is worth paying once.
  if (cache && typeof payload.system === 'string' && payload.system.length > 2000) {
    payload = { ...payload, system: [{ type: 'text', text: payload.system, cache_control: { type: 'ephemeral' } }] };
  }
  try {
    const resp = await client.messages.create(payload);
    meter({ feature, model: payload.model, usage: resp && resp.usage ? resp.usage : {} });
    return resp;
  } catch (err) {
    console.error('AI_SDK_CALL_FAILED', feature, String(err && err.message || err));
    return null;
  }
}

module.exports = { callModel, guardedCreate, guardDecision, meter, priceCall, spentToday, counters };
// Test seams — never used in production paths.
module.exports._resetForTests = () => { _day = today(); _spend = 0; _hits = []; _allowed = 0; _refused = 0; };
module.exports._spendForTests = (usd) => { rollDay(); _spend = usd; };
