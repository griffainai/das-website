/* Pricing-access (Planning Code) validator — E104.
   The unlock code is validated SERVER-SIDE so it never ships in the frontend.
   Source of truth (in order): Supabase site_config row {key:'pricing_code'} →
   env DAS_PRICING_CODE → built-in default. Changing the Supabase row (or env)
   updates the code with no deploy. Returns only { ok: true|false } — no detail. */
let getServiceClient;
try { ({ getServiceClient } = require('./_supabase')); } catch (e) { /* helper optional */ }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const code = String((req.body && req.body.code) || '').trim();
  if (!code) return res.status(400).json({ ok: false });

  // Resolve the configured code (Supabase → env → default).
  let configured = process.env.DAS_PRICING_CODE || 'PLANWITHDAS';
  if (getServiceClient) {
    try {
      const sb = getServiceClient();
      const { data } = await sb.from('site_config').select('value').eq('key', 'pricing_code').maybeSingle();
      if (data && data.value) configured = String(data.value).trim();
    } catch (e) { /* table/row absent → fall back to env/default */ }
  }

  const ok = code.toLowerCase() === String(configured).toLowerCase();
  return res.status(200).json({ ok });
};
