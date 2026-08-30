/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Contact Form — Vercel Serverless Function
   POST /api/contact
   Sends email via Resend (resend.com — free tier: 3,000/mo)
   ============================================= */

const { brandShell, btn } = require('../lib/email-brand');
module.exports = async (req, res) => {
  const allowedOrigin = process.env.SITE_URL || 'https://www.driverappreciationsolutions.com';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Electronic surveys (driver feedback · recognition assessment · 2027 guide) ──
  //    Handled here (not a new serverless function) to stay under the Vercel 12-function cap.
  //    Its own ceiling, deliberately far higher than the contact form's: a room of ten
  //    decision makers filling this out in a meeting shares ONE NAT IP, and the contact
  //    limit (4/min) would silently block eight of them.
  if ((req.body || {}).formType === 'survey') {
    const { rateLimit: rlSurvey } = require('./_rate');
    const srl = rlSurvey(req, 'survey', { burst: 12, perHour: 80 });
    if (!srl.allowed) {
      res.setHeader('Retry-After', String(srl.retryAfter));
      return res.status(429).json({ error: 'Too many submissions from this network — please wait a moment and try again.' });
    }
    const { handleSurvey } = require('./_survey');
    return handleSurvey(req, res);
  }

  // Rate ceiling — this endpoint sends up to 2 Resend emails per call.
  const { rateLimit } = require('./_rate');
  const rl = rateLimit(req, 'contact', { burst: 4, perHour: 12 });
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.retryAfter));
    return res.status(429).json({ error: 'Too many requests — please wait a moment and try again, or call 302.681.0995.' });
  }

  // ── Company Purchasing Request (procurement pathway: quotes / PO / Net-30 / vendor setup) ──
  //    Handled here (not a new serverless function) to stay under the Vercel 12-function cap.
  if ((req.body || {}).formType === 'company-purchasing') {
    return handleCompanyPurchasing(req, res);
  }

  const { name, email, company, fleetSize, message, program, followUp } = req.body || {};
  // Raw select VALUES must never reach customer copy ("regarding general").
  const PROGRAM_LABELS = {
    'appreciation': 'Driver Appreciation Kits',
    'safety': 'a Safety Recognition Program',
    'onboarding': 'New Driver Onboarding',
    'milestone': 'Service Milestone Awards',
    'holiday': 'a Holiday & Seasonal Program',
    'enterprise': 'an Enterprise / Volume Quote',
    'order-support': 'Order Support',
    'general': 'your fleet',
  };
  const programLabel = PROGRAM_LABELS[program] || null;
  // Follow-up preference from the contact form's selector (book / pricing / email).
  const FOLLOW_UP_TAGS = {
    book: ' · WANTS TO BOOK A CALL',
    pricing: ' · WANTS CUSTOM PRICING',
    email: '',
  };
  const followUpTag = FOLLOW_UP_TAGS[followUp] || '';
  const followUpLabel =
    followUp === 'book' ? 'Book a strategy call (calendar path)'
    : followUp === 'pricing' ? 'Send custom pricing'
    : followUp === 'email' ? 'Written reply' : null;

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
        <tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600">Program</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5">${escHtml(programLabel || program || '—')}</td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600">Requested Follow-up</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5;font-weight:700;color:#0D1B45">${escHtml(followUpLabel || '—')}</td></tr>
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
        subject: `Fleet inquiry from ${name}${company ? ` — ${company}` : ''}${followUpTag}`,
        html,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('[Resend Error]', resp.status, err);
      return res.status(500).json({ error: 'Failed to send message. Please try again or email us directly.' });
    }

    // Customer acknowledgment — DAS-branded, follow-up-aware, written to sell
    // the next step (best-effort — never fail the request if this errors).
    const firstName = escHtml((name || '').split(' ')[0] || 'there');
    const about = programLabel ? ` about <strong>${escHtml(programLabel)}</strong>` : '';
    const coName = company ? escHtml(company) + '’s' : 'your';
    let ackSubject, ackLede, ackNext;
    if (followUp === 'book') {
      ackSubject = 'Your strategy call — what happens before it';
      ackLede = `${firstName} — your call is on the board. Before we get on it, a fleet specialist builds ${coName} numbers${about}: real per-driver pricing, not a brochure.`;
      ackNext = `If you grabbed a time on the calendar, you’re set — the invite is in your inbox. If you didn’t, just reply with two times that work and we’ll lock one in.`;
    } else if (followUp === 'pricing') {
      ackSubject = 'Your custom pricing is being built';
      ackLede = `${firstName} — got it. A fleet specialist is building ${coName} pricing${about} now: your driver count, real unit costs, and what the program looks like on day one.`;
      ackNext = `It lands in your inbox within one business day. When it does, the numbers make one thing obvious: replacing a driver costs $8,000–$15,000 — recognizing one costs a fraction of that.`;
    } else {
      ackSubject = 'Got it — a real answer is coming';
      ackLede = `${firstName} — your message${about} is with the fleet team. A specialist replies in writing within one business day — a real answer from a person, not an autoresponder.`;
      ackNext = `Meanwhile, if it’s time-sensitive, skip the queue: call us and you’ll get a human.`;
    }
    const ackHtml = brandShell({
      preheader: 'A fleet specialist replies within one business day.',
      eyebrow: 'Message received',
      title: ackSubject.replace(/&/g, '&amp;').replace(/</g, '&lt;'),
      sub: '',
      photo: 'https://www.driverappreciationsolutions.com/images/email/contact-hero.jpg',
      bodyRows: `
        <p style="margin:0 0 14px;font-size:16px;color:#0B1020;line-height:1.7">Hi ${firstName ? String(firstName).replace(/[<>&]/g,'') : 'there'},</p>
        <p style="margin:0 0 14px;font-size:15px;color:#1F2937;line-height:1.75">${ackLede}</p>
        <p style="margin:0 0 22px;font-size:15px;color:#1F2937;line-height:1.75">${ackNext}</p>
        <div style="text-align:center;margin-bottom:10px">${btn('tel:3026810995', 'Call the fleet team — 302.681.0995')}</div>
        <p style="margin:0;text-align:center;font-size:12px;color:#3D4763">Mon&ndash;Fri, 9am&ndash;5pm CT. A person answers.</p>
      `,
      footNote: 'The average fleet loses more to turnover in a month than a year of recognition costs &mdash; that math is exactly what we&rsquo;ll show you.',
    });
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Driver Appreciation Solutions <${FROM_ADDRESS}>`,
          to: [email],
          reply_to: 'info@driverappreciationsolutions.com',
          subject: ackSubject,
          html: ackHtml,
        }),
      });
    } catch (e) { console.error('[Contact] auto-responder failed:', e && e.message); }

    // SMS opt-in → trigger the DAS concierge's instant speed-to-lead first touch.
    // Same contract as the company-purchasing path. Best-effort: a failure here
    // must never fail the form submission the visitor just made.
    const b = req.body || {};
    if (b.smsConsent && b.phone && process.env.LEAD_INGEST_SECRET) {
      try {
        await fetch((process.env.SMS_SERVICE_URL || 'https://sms-service-griffainai.vercel.app') + '/api/lead-ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: b.phone,
            firstName: b.firstName || (name || '').split(' ')[0],
            company,
            email: email || null,
            fleetSize,
            interest: program || null,
            consentText: b.smsConsentText || 'Agree that Driver Appreciation Solutions may text me in response to my inquiry — quotes, order and proof updates, and answers to my questions. Not marketing; messages are sent in reply to my request. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.',
            secret: process.env.LEAD_INGEST_SECRET,
          }),
        });
      } catch (e) { console.error('[Contact] SMS lead-ingest forward failed:', e && e.message); }
    }

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

  // Follow-up preference from the form's selector (book / call / email).
  const cpFollowUpTag =
    b.followUp === 'book' ? ' · WANTS TO BOOK A CALL'
    : b.followUp === 'call' ? ' · WANTS A CALLBACK' : '';
  const cpFollowUpLabel =
    b.followUp === 'book' ? 'Walk me through it live (calendar path)'
    : b.followUp === 'call' ? 'Have us call you'
    : b.followUp === 'email' ? 'Email me everything' : null;

  // Normalize the rest of the payload.
  const fields = {
    'Requested Follow-up': cpFollowUpLabel,
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
        subject: `DAS Company Purchasing Request – ${company}${cpFollowUpTag}`,
        html,
      }),
    });
    if (!teamResp.ok) {
      const err = await teamResp.json().catch(() => ({}));
      console.error('[CompanyPurchasing][Resend Error]', teamResp.status, err);
      return res.status(500).json({ error: 'Failed to submit your request. Please try again or email info@driverappreciationsolutions.com.' });
    }

    // 2) Auto-responder to the buyer (best-effort — never fail the request if this errors).
    const autoHtml = brandShell({
      preheader: 'Your purchasing request is in — a specialist is on it.',
      eyebrow: 'Corporate purchasing',
      title: 'Your request<br>is in',
      sub: 'Quote, purchase order, vendor setup, or Net-30 &mdash; a fleet specialist is preparing a real answer.',
      photo: 'https://www.driverappreciationsolutions.com/images/email/contact-hero.jpg',
      bodyRows: `
        <p style="margin:0 0 14px;font-size:16px;color:#0B1020;line-height:1.7">Hi ${firstName ? String(firstName).replace(/[<>&]/g,'') : 'there'},</p>
        <p style="margin:0 0 14px;font-size:15px;color:#1F2937;line-height:1.75">We received <b>${company ? String(company).replace(/[<>&]/g,'') : 'your company'}</b>&rsquo;s purchasing request. A fleet specialist will reply within one business day with pricing for your exact driver count &mdash; and can set up purchase orders, vendor onboarding, or Net-30 terms as needed.</p>
        <p style="margin:0 0 22px;font-size:15px;color:#1F2937;line-height:1.75">Time-sensitive? Skip the queue:</p>
        <div style="text-align:center;margin-bottom:10px">${btn('tel:3026810995', 'Call the fleet team — 302.681.0995')}</div>
        <p style="margin:0;text-align:center;font-size:12px;color:#3D4763">Mon&ndash;Fri, 9am&ndash;5pm CT.</p>
      `,
      footNote: 'Replacing one driver runs $8,000&ndash;$15,000. Your quote will show the recognition math for your exact driver count.',
    });
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Driver Appreciation Solutions <${FROM_ADDRESS}>`,
          to: [workEmail],
          subject: `${company}’s purchasing request is in — next steps`,
          html: autoHtml,
        }),
      });
    } catch (e) { console.error('[CompanyPurchasing] auto-responder failed:', e && e.message); }

    // 3) SMS opt-in → trigger the DAS concierge's instant speed-to-lead first touch.
    //    Best-effort: never fail the form submission if this errors.
    if (b.smsConsent && b.phone && process.env.LEAD_INGEST_SECRET) {
      try {
        // Forward the FULL quote context so the concierge's first-touch (and the whole
        // conversation) is specific to what they requested — product, quantity, drivers,
        // procurement needs — not a generic "how many drivers?" opener.
        const product = b.productInterest || ctx.productName || null;
        const drivers = b.numDrivers || b.fleetSize || null;
        await fetch((process.env.SMS_SERVICE_URL || 'https://sms-service-griffainai.vercel.app') + '/api/lead-ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: b.phone,
            firstName: b.firstName,
            company: b.company,
            email: workEmail || null,
            fleetSize: drivers,
            interest: product,
            quote: {
              product,
              category: ctx.productCategory || null,
              quantity: b.estQuantity || null,
              drivers,
              needs: Array.isArray(b.needs) ? b.needs : [],
              targetDate: b.targetDeliveryDate || null,
              notes: b.notes || null,
            },
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
