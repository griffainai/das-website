/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Quote / Lead capture — Vercel Serverless Function
   POST /api/submit-quote
   ---------------------------------------------
   Ported from das-portal src/app/api/chat/submit-quote/route.ts.

   PATH A — authenticated portal user (Authorization: Bearer <token>):
            insert into `quotes`, linked to their company.
   PATH B — anonymous website visitor:
            insert into `website_leads` (service role, no FK) and fire a
            Resend email so the team can follow up immediately.

   Always returns 200 to the visitor — a lead is never lost to a UI error.
   Env: SUPABASE_*, RESEND_API_KEY (optional), DAS_NOTIFY_EMAIL (optional).
   ============================================= */

const { getServiceClient, getUserFromToken } = require('./_supabase');

const ALLOWED_ORIGINS = [
  'https://driverappreciationsolutions.com',
  'https://www.driverappreciationsolutions.com',
  'http://localhost:3000',
  'http://localhost:8888',
];

function setCors(req, res) {
  const origin  = req.headers.origin;
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin',  allowed);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function sendLeadNotification(lead) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return; // skip if not configured

  const to   = process.env.DAS_NOTIFY_EMAIL || 'leads@driverappreciationsolutions.com';
  const dealValue = lead.driver_count && lead.budget_per_driver
    ? `$${(lead.driver_count * lead.budget_per_driver).toLocaleString()}`
    : 'TBD';

  const body = {
    from:    'Scout <scout@driverappreciationsolutions.com>',
    to,
    subject: `🚛 New quote request — ${lead.contact_name || 'Anonymous'} (${lead.driver_count || '?'} drivers)`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#1A2E6E;padding:20px 24px;border-radius:12px 12px 0 0">
          <h2 style="color:#fff;margin:0;font-size:18px">New Quote Request from Website</h2>
          <p style="color:rgba(255,255,255,.6);margin:4px 0 0;font-size:13px">Submitted via Scout chat widget</p>
        </div>
        <div style="background:#fff;padding:24px;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 12px 12px">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:8px 0;color:#6B7280;width:140px">Contact</td><td style="padding:8px 0;font-weight:600;color:#111">${lead.contact_name || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6B7280">Email</td><td style="padding:8px 0"><a href="mailto:${lead.contact_email || ''}" style="color:#1A2E6E">${lead.contact_email || '—'}</a></td></tr>
            <tr><td style="padding:8px 0;color:#6B7280">Company</td><td style="padding:8px 0">${lead.company || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6B7280">Program type</td><td style="padding:8px 0">${lead.type || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6B7280">Driver count</td><td style="padding:8px 0">${lead.driver_count || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6B7280">Budget/driver</td><td style="padding:8px 0">${lead.budget_per_driver ? `$${lead.budget_per_driver}` : '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6B7280">Timeline</td><td style="padding:8px 0">${lead.timeline || '—'}</td></tr>
            ${lead.notes ? `<tr><td style="padding:8px 0;color:#6B7280;vertical-align:top">Notes</td><td style="padding:8px 0">${lead.notes}</td></tr>` : ''}
          </table>
          <div style="margin-top:20px;padding:12px 16px;background:#F0F4FF;border-radius:8px;font-size:13px;color:#374151">
            💡 <strong>Estimated deal value:</strong> ${dealValue}
          </div>
        </div>
      </div>
    `,
  };

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body:    JSON.stringify(body),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error(`[submit-quote] lead notification FAILED (HTTP ${resp.status}): ${errBody}`);
    }
  } catch (err) {
    console.error('[submit-quote] lead notification threw:', err && err.message);
  }
}

module.exports = async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const payload = req.body || {};

  // ── PATH A: Authenticated portal user ───────────────────────────────────
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (user) {
      const supabase = getServiceClient();
      const { data: profile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single();

      const notesStr = [
        payload.notes,
        payload.company       ? `Company: ${payload.company}`      : null,
        payload.contact_name  ? `Contact: ${payload.contact_name}` : null,
        payload.contact_email ? `Email: ${payload.contact_email}`  : null,
      ].filter(Boolean).join(' | ') || null;

      await supabase.from('quotes').insert({
        company_id:        (profile && profile.company_id) || null,
        user_id:           user.id,
        type:              payload.type,
        driver_count:      payload.driver_count,
        budget_per_driver: payload.budget_per_driver,
        timeline:          payload.timeline,
        notes:             notesStr,
        status:            'submitted',
      });

      return res.status(200).json({ ok: true, path: 'portal' });
    }
  } catch (err) {
    console.error('[submit-quote portal path]', err && err.message);
    // fall through to PATH B
  }

  // ── PATH B: Anonymous website visitor ───────────────────────────────────
  try {
    const service = getServiceClient();
    await service.from('website_leads').insert({
      contact_name:      payload.contact_name,
      contact_email:     payload.contact_email,
      company:           payload.company,
      type:              payload.type,
      driver_count:      payload.driver_count,
      budget_per_driver: payload.budget_per_driver,
      timeline:          payload.timeline,
      notes:             payload.notes,
      source:            'website_chat',
      status:            'new',
    });

    void sendLeadNotification(payload);
    return res.status(200).json({ ok: true, path: 'lead' });
  } catch (err) {
    console.error('[submit-quote anonymous path]', err && err.message);
    // Still return 200 — never show an error to the visitor.
    void sendLeadNotification(payload);
    return res.status(200).json({ ok: true });
  }
};
