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
  const allowedOrigin = process.env.SITE_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

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

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F1F4F7;font-family:'Plus Jakarta Sans',Inter,Arial,sans-serif">
  <div style="max-width:560px;margin:40px auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10)">

    <!-- Header -->
    <div style="background:#0C1840;padding:44px 44px 36px;text-align:center">
      <div style="display:inline-block;background:rgba(255,255,255,0.10);border:1px solid rgba(255,255,255,0.15);border-radius:100px;padding:5px 16px;font-size:11px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:20px">Driver Appreciation Solutions</div>
      <h1 style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.22;margin:0 0 14px">You're in. Welcome to<br>Fleet Recognition Insights.</h1>
      <p style="font-size:15px;color:rgba(255,255,255,0.65);line-height:1.65;margin:0;max-width:400px;display:inline-block">Practical guides on driver retention, safety ROI, and recognition program design — for fleet operators who mean it.</p>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;padding:40px 44px">

      <h2 style="font-size:17px;font-weight:700;color:#0C1840;margin:0 0 20px;letter-spacing:-0.01em">Here's what you'll receive:</h2>

      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:32px">
        <tr>
          <td style="vertical-align:top;padding-bottom:18px">
            <div style="display:flex;gap:12px">
              <div style="width:22px;height:22px;min-width:22px;background:#0C1840;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;text-align:center;line-height:22px">1</div>
              <div>
                <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:4px">Retention research that moves budgets.</div>
                <div style="font-size:14px;color:#555;line-height:1.6">The data fleet operators need to justify recognition spend internally — cited, sourced, and applicable.</div>
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top;padding-bottom:18px">
            <div style="display:flex;gap:12px">
              <div style="width:22px;height:22px;min-width:22px;background:#0C1840;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;text-align:center;line-height:22px">2</div>
              <div>
                <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:4px">Safety culture and accident reduction.</div>
                <div style="font-size:14px;color:#555;line-height:1.6">How recognition programs connect to measurable safety outcomes — with ATRI and FMCSA data backing it up.</div>
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="vertical-align:top">
            <div style="display:flex;gap:12px">
              <div style="width:22px;height:22px;min-width:22px;background:#0C1840;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;text-align:center;line-height:22px">3</div>
              <div>
                <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:4px">Program frameworks you can actually use.</div>
                <div style="font-size:14px;color:#555;line-height:1.6">Templates, calendars, and implementation guides for fleet operators building recognition from scratch or improving what they have.</div>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- CTA box -->
      <div style="background:#F5F7FF;border:1px solid #DDE3F8;border-radius:10px;padding:24px;margin-bottom:32px">
        <div style="font-size:13px;font-weight:700;color:#0C1840;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.06em">Start reading now</div>
        <p style="font-size:14px;color:#444;line-height:1.6;margin:0 0 18px">Browse the full insights library — guides on DAW planning, turnover cost analysis, safety ROI, and year-round recognition calendars.</p>
        <a href="https://driverappreciationsolutions.com/ideas.html" style="display:inline-block;background:#0C1840;color:#ffffff;font-size:14px;font-weight:700;letter-spacing:-0.01em;padding:12px 24px;border-radius:8px;text-decoration:none">Read the Guides →</a>
      </div>

      <div style="border-top:1px solid #EAEAEA;padding-top:20px">
        <p style="font-size:12px;color:#AAA;line-height:1.7;margin:0">You're receiving this because you subscribed at <a href="https://driverappreciationsolutions.com" style="color:#AAA">driverappreciationsolutions.com</a>. We send 1–2 emails per month. Unsubscribe anytime by replying "unsubscribe."</p>
      </div>

    </div>
  </div>
</body>
</html>`;

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
