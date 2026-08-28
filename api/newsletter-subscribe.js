/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Newsletter Subscribe — Vercel Serverless Function
   POST /api/newsletter-subscribe

   1. Validates email
   2. Inserts into Supabase newsletter_subscribers
      (ON CONFLICT DO NOTHING — safe to re-subscribe)
   3. Sends a welcome email to the subscriber via Resend
   ============================================= */

module.exports = async (req, res) => {
  const allowedOrigin = process.env.SITE_URL || 'https://www.driverappreciationsolutions.com';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  const { rateLimit } = require('./_rate');
  const rl = rateLimit(req, 'newsletter', { burst: 3, perHour: 10 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests.' });
  }

  const { email } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const RESEND_KEY   = process.env.RESEND_API_KEY;
  const FROM         = process.env.FROM_EMAIL || 'noreply@driverappreciationsolutions.com';
  const SB_URL       = process.env.SUPABASE_URL;
  const SB_SVC_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // ── 1. Store in Supabase ──────────────────────────────────
  let alreadySubscribed = false;
  if (SB_URL && SB_SVC_KEY) {
    try {
      const sbRes = await fetch(`${SB_URL}/rest/v1/newsletter_subscribers`, {
        method: 'POST',
        headers: {
          'apikey':        SB_SVC_KEY,
          'Authorization': `Bearer ${SB_SVC_KEY}`,
          'Content-Type':  'application/json',
          'Prefer':        'return=minimal,resolution=ignore-duplicates',
        },
        body: JSON.stringify({ email, source: 'ideas_page' }),
      });
      // 200 = inserted, 201 = inserted, 204 = ignored duplicate
      if (sbRes.status === 204) alreadySubscribed = true;
    } catch (e) {
      // Non-fatal — still send welcome email
      console.error('[Newsletter] Supabase insert error:', e.message);
    }
  }

  // ── 2. Skip welcome email if already subscribed ───────────
  if (alreadySubscribed) {
    return res.status(200).json({ ok: true, message: "You're already on the list." });
  }

  // ── 3. Send welcome email via Resend ─────────────────────
  if (!RESEND_KEY) {
    console.log('[Newsletter] RESEND_API_KEY not set — would welcome:', email);
    return res.status(200).json({ ok: true, dev: true });
  }

  const { brandShell, btn, grayBox } = require('../lib/email-brand');
  const html = brandShell({
    preheader: "Your WELCOME10 code is inside — 10% off your first kit order.",
    eyebrow: 'Fleet Recognition Insights',
    title: "You're on<br>the list",
    sub: 'Practical guides on driver retention, safety ROI, and recognition program design &mdash; for fleet operators who mean it.',
    photo: 'https://www.driverappreciationsolutions.com/images/email/welcome-hero.jpg',
    bodyRows: `
      <div style="background:#F1F5FB;border:1px solid #DCE5F2;padding:20px 24px;text-align:center;margin-bottom:26px">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#9A7B2E;margin-bottom:6px">Your welcome code</div>
        <div style="font-size:28px;font-weight:800;letter-spacing:0.08em;color:#0C1840;margin-bottom:6px">WELCOME10</div>
        <div style="font-size:12px;color:#67718A;line-height:1.5">10% off your first kit order &mdash; enter it in your cart at checkout.</div>
      </div>
      <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0C1840;margin-bottom:14px">What you'll receive</div>
      <div style="font-size:13px;color:#3D4763;line-height:1.7;margin-bottom:8px"><b style="color:#0C1840">Retention playbooks</b> &mdash; what recognition actually does to turnover, with the math.</div>
      <div style="font-size:13px;color:#3D4763;line-height:1.7;margin-bottom:8px"><b style="color:#0C1840">Seasonal deadlines</b> &mdash; Driver Appreciation Week order windows, before they close.</div>
      <div style="font-size:13px;color:#3D4763;line-height:1.7;margin-bottom:24px"><b style="color:#0C1840">Program design</b> &mdash; milestones, safety recognition, and onboarding done right.</div>
      <div style="text-align:center;margin-bottom:8px">${btn('https://www.driverappreciationsolutions.com/ideas.html', 'Read the Guides')}</div>
    `,
    footNote: 'You are receiving this because you signed up at driverappreciationsolutions.com. Reply to unsubscribe.',
  });

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    `Driver Appreciation Solutions <${FROM}>`,
        to:      [email],
        subject: "You're subscribed — Fleet Recognition Insights",
        html,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('[Newsletter] Resend error:', resp.status, err);
      // Still return 200 — subscriber is stored, email is a bonus
    }
  } catch (e) {
    console.error('[Newsletter] Resend network error:', e.message);
  }

  return res.status(200).json({ ok: true });
};
