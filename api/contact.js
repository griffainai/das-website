/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Contact Form — Vercel Serverless Function
   POST /api/contact
   Sends email via Resend (resend.com — free tier: 3,000/mo)
   ============================================= */

module.exports = async (req, res) => {
  const allowedOrigin = process.env.SITE_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Company Purchasing Request (procurement pathway: quotes / PO / Net-30 / vendor setup) ──
  //    Handled here (not a new serverless function) to stay under the Vercel 12-function cap.
  if ((req.body || {}).formType === 'company-purchasing') {
    return handleCompanyPurchasing(req, res);
  }

  const { name, email, company, fleetSize, message, program } = req.body || {};

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const RESEND_API_KEY  = process.env.RESEND_API_KEY;
  const CONTACT_TO      = process.env.CONTACT_EMAIL || 'jaydenforshee@driverappreciationsolutions.com';
  const FROM_ADDRESS    = process.env.FROM_EMAIL    || 'noreply@driverappreciationsolutions.com';

  if (!RESEND_API_KEY) {
    // In production a missing key means the lead would be SILENTLY LOST — never
    // report success. Return an error so the form shows the failure (and the
    // visitor can email us directly) instead of a false "request received".
    const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    if (isProd) {
      console.error('[Contact] RESEND_API_KEY missing in production — lead NOT delivered:', { name, email, company });
      return res.status(500).json({ error: 'We could not send your message right now. Please email us directly at info@driverappreciationsolutions.com.' });
    }
    // Local dev only — log and succeed so the UI works without Resend configured.
    console.log('[Contact] RESEND_API_KEY not set (dev) — would send:', { name, email, company, fleetSize, program, message });
    return res.status(200).json({ ok: true, dev: true });
  }

  const html = `
    <div style="font-family:sans-serif;max-width:560px;color:#111">
      <h2 style="color:#0D1B45;margin:0 0 20px">New Contact Form Submission</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600;width:140px">Name</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5">${escHtml(name)}</td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600">Email</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5"><a href="mailto:${escHtml(email)}">${escHtml(email)}</a></td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600">Company</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5">${escHtml(company || '—')}</td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600">Fleet Size</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5">${escHtml(fleetSize || '—')}</td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600">Program</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5">${escHtml(program || '—')}</td></tr>
      </table>
      <h3 style="color:#0D1B45;margin:24px 0 8px">Message</h3>
      <div style="background:#F5F5F5;padding:16px;border-radius:8px;white-space:pre-wrap">${escHtml(message)}</div>
      <p style="margin-top:24px;font-size:12px;color:#888">Sent from driverappreciationsolutions.com contact form</p>
    </div>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `Driver Appreciation Solutions <${FROM_ADDRESS}>`,
        to:      [CONTACT_TO],
        reply_to: email,
        subject: `Fleet inquiry from ${name}${company ? ` — ${company}` : ''}`,
        html,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('[Resend Error]', resp.status, err);
      return res.status(500).json({ error: 'Failed to send message. Please try again or email us directly.' });
    }

    // E98: acknowledge the customer by email (best-effort — never fail the request if this errors).
    const ackHtml = `
      <div style="font-family:sans-serif;max-width:560px;color:#111;line-height:1.6">
        <p>Hi ${escHtml((name || '').split(' ')[0] || 'there')},</p>
        <p>Thank you for reaching out to Driver Appreciation Solutions. We've received your message${program ? ` regarding <strong>${escHtml(program)}</strong>` : ''} and a member of our fleet team will follow up shortly.</p>
        <p>If your request is time-sensitive, you can also reach us directly at <a href="mailto:info@driverappreciationsolutions.com">info@driverappreciationsolutions.com</a>.</p>
        <p>We look forward to helping you recognize your professional drivers.</p>
        <p style="color:#0D1B45;font-weight:600;margin-top:20px">Driver Appreciation Solutions</p>
      </div>`;
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Driver Appreciation Solutions <${FROM_ADDRESS}>`,
          to: [email],
          subject: 'We received your message — Driver Appreciation Solutions',
          html: ackHtml,
        }),
      });
    } catch (e) { console.error('[Contact] auto-responder failed:', e && e.message); }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[Contact] Network error:', err.message);
    return res.status(500).json({ error: 'Network error. Please try again.' });
  }
};

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── COMPANY PURCHASING REQUEST ──────────────────────────────────────────────
   Corporate/procurement pathway. Routes the lead to the 3 sales recipients and
   sends the buyer an auto-responder. Captures product/cart context for the team. */
async function handleCompanyPurchasing(req, res) {
  const b = req.body || {};
  const firstName = String(b.firstName || '').trim();
  const lastName  = String(b.lastName || '').trim();
  const company   = String(b.company || '').trim();
  const workEmail = String(b.workEmail || '').trim();

  if (!firstName || !lastName || !company || !workEmail) {
    return res.status(400).json({ error: 'First name, last name, company, and work email are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
    return res.status(400).json({ error: 'Please enter a valid work email address.' });
  }

  // Lead recipients for company-purchasing requests (per spec). Overridable via env.
  const RECIPIENTS = (process.env.COMPANY_PURCHASING_TO ||
    'ssshafeek@driverappreciationsolutions.com,info@driverappreciationsolutions.com,shaqisvictory@gmail.com,afaust@offdutynotdrivingrewards.com')
    .split(',').map(s => s.trim()).filter(Boolean);
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_ADDRESS   = process.env.FROM_EMAIL || 'noreply@driverappreciationsolutions.com';

  // Normalize the rest of the payload.
  const fields = {
    'Name': `${firstName} ${lastName}`,
    'Title': b.title, 'Company': company,
    'Work Email': workEmail, 'Phone': b.phone,
    'Product / Program of Interest': b.productInterest,
    'Estimated Quantity': b.estQuantity,
    'Target Delivery Date': b.targetDeliveryDate,
    'Number of Drivers': b.numDrivers,
    'Billing Contact': b.billingContact,
    'Billing Contact Email': b.billingContactEmail,
    'Shipping State': b.shippingState,
    // SMS opt-in (10DLC consent proof — captured at submission time).
    'SMS Consent': b.smsConsent
      ? 'YES — opted in ' + new Date().toISOString() + (b.smsConsentText ? ' · "' + String(b.smsConsentText).slice(0, 300) + '"' : '')
      : 'No (not opted in)',
  };
  const needs = Array.isArray(b.needs) ? b.needs : [];
  const ctx = b.context || {};
  const cart = Array.isArray(ctx.cart) ? ctx.cart : [];
  const stamp = new Date().toISOString();

  const row = (k, v) => `<tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600;width:200px">${escHtml(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5">${escHtml(v || '—')}</td></tr>`;
  const cartRows = cart.length
    ? cart.map(i => `<tr><td style="padding:6px 12px;border-bottom:1px solid #EEE">${escHtml(i.name)}${i.milestoneLabel ? ' — ' + escHtml(i.milestoneLabel) : ''}</td><td style="padding:6px 12px;border-bottom:1px solid #EEE;text-align:right">${escHtml(String(i.qty || ''))} × $${escHtml(String(i.price || ''))}</td></tr>`).join('')
    : '<tr><td style="padding:6px 12px;color:#888">No cart items</td><td></td></tr>';

  const html = `
    <div style="font-family:sans-serif;max-width:620px;color:#111">
      <h2 style="color:#0D1B45;margin:0 0 6px">Company Purchasing Request</h2>
      <p style="margin:0 0 18px;color:#555">${escHtml(company)} · ${escHtml(stamp)}</p>
      <table style="width:100%;border-collapse:collapse">${Object.keys(fields).map(k => row(k, fields[k])).join('')}</table>
      <h3 style="color:#0D1B45;margin:22px 0 6px">Purchasing Need</h3>
      <div style="background:#F5F5F5;padding:12px 16px;border-radius:8px">${needs.length ? needs.map(escHtml).join(' · ') : '—'}</div>
      ${b.notes ? `<h3 style="color:#0D1B45;margin:22px 0 6px">Additional Notes</h3><div style="background:#F5F5F5;padding:12px 16px;border-radius:8px;white-space:pre-wrap">${escHtml(b.notes)}</div>` : ''}
      <h3 style="color:#0D1B45;margin:22px 0 6px">Referring Product</h3>
      <table style="width:100%;border-collapse:collapse">
        ${row('Product', ctx.productName)}${row('SKU', ctx.productSku)}${row('Category', ctx.productCategory)}${row('Product URL', ctx.productUrl)}
      </table>
      <h3 style="color:#0D1B45;margin:22px 0 6px">Cart at Request${ctx.cartTotal ? ` (est. $${escHtml(String(ctx.cartTotal))})` : ''}</h3>
      <table style="width:100%;border-collapse:collapse">${cartRows}</table>
      <p style="margin-top:22px;font-size:12px;color:#888">Source: ${escHtml(ctx.sourcePage || '—')} · driverappreciationsolutions.com company-purchasing form</p>
    </div>`;

  if (!RESEND_API_KEY) {
    const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    if (isProd) {
      console.error('[CompanyPurchasing] RESEND_API_KEY missing — lead NOT delivered:', { company, workEmail });
      return res.status(500).json({ error: 'We could not submit your request right now. Please email info@driverappreciationsolutions.com.' });
    }
    console.log('[CompanyPurchasing] (dev) would send:', { company, workEmail, needs, ctx });
    return res.status(200).json({ ok: true, dev: true });
  }

  try {
    // 1) Notify the sales team (all recipients).
    const teamResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Driver Appreciation Solutions <${FROM_ADDRESS}>`,
        to: RECIPIENTS,
        reply_to: workEmail,
        subject: `DAS Company Purchasing Request – ${company}`,
        html,
      }),
    });
    if (!teamResp.ok) {
      const err = await teamResp.json().catch(() => ({}));
      console.error('[CompanyPurchasing][Resend Error]', teamResp.status, err);
      return res.status(500).json({ error: 'Failed to submit your request. Please try again or email info@driverappreciationsolutions.com.' });
    }

    // 2) Auto-responder to the buyer (best-effort — never fail the request if this errors).
    const autoHtml = `
      <div style="font-family:sans-serif;max-width:560px;color:#111;line-height:1.6">
        <p>Thank you for your interest in Driver Appreciation Solutions.</p>
        <p>Your company purchasing request has been received and a member of our team will follow up shortly regarding your quote, purchase order, vendor onboarding, invoice billing, or Net 30 request.</p>
        <p>We look forward to helping you recognize your professional drivers.</p>
        <p style="color:#0D1B45;font-weight:600;margin-top:20px">Driver Appreciation Solutions</p>
      </div>`;
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Driver Appreciation Solutions <${FROM_ADDRESS}>`,
          to: [workEmail],
          subject: 'Thank You for Contacting Driver Appreciation Solutions',
          html: autoHtml,
        }),
      });
    } catch (e) { console.error('[CompanyPurchasing] auto-responder failed:', e && e.message); }

    // 3) SMS opt-in → trigger the DAS concierge's instant speed-to-lead first touch.
    //    Best-effort: never fail the form submission if this errors.
    if (b.smsConsent && b.phone && process.env.LEAD_INGEST_SECRET) {
      try {
        await fetch((process.env.SMS_SERVICE_URL || 'https://sms-service-griffainai.vercel.app') + '/api/lead-ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: b.phone,
            firstName: b.firstName,
            company: b.company,
            fleetSize: b.fleetSize,
            consentText: b.smsConsentText || 'Opted in to recurring SMS from Driver Appreciation Solutions about recognition programs, quotes, and updates. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.',
            secret: process.env.LEAD_INGEST_SECRET,
          }),
        });
      } catch (e) { console.error('[CompanyPurchasing] SMS lead-ingest forward failed:', e && e.message); }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[CompanyPurchasing] Network error:', err.message);
    return res.status(500).json({ error: 'Network error. Please try again.' });
  }
}
