/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Portal API Router — Vercel Serverless Function
   ---------------------------------------------
   ONE physical function that fans out to four logical endpoints, kept under
   the Hobby plan's 12-function-per-deployment cap. Public URLs are preserved
   by `rewrites` in vercel.json:

     /api/submit-quote      → /api/portal?action=submit-quote
     /api/billing-checkout  → /api/portal?action=billing-checkout
     /api/billing-portal    → /api/portal?action=billing-portal
     /api/stripe-webhook    → /api/portal?action=stripe-webhook

   Body parsing is disabled (config below) because the Stripe webhook needs the
   RAW request bytes for signature verification. We read the stream ourselves
   and JSON.parse it for the non-webhook actions.

   Env: ANTHROPIC excluded (chat.js stays standalone — it streams).
        SUPABASE_*, STRIPE_*, RESEND_API_KEY, DAS_NOTIFY_EMAIL, SITE_URL.
   ============================================= */

const { getServiceClient, getUserFromToken } = require('./_supabase');

// Shared pure-logic libs (UMD → CommonJS). No Supabase/Stripe coupling.
const Shipping    = require('../lib/shipping');
const Pricing     = require('../lib/recognition-pricing');

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

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* =============================================================
   ACTION: submit-quote   (PATH A authed → quotes; PATH B → website_leads + email)
   ============================================================= */
async function sendLeadNotification(lead) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;

  const to = process.env.DAS_NOTIFY_EMAIL || 'leads@driverappreciationsolutions.com';
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

/* -------------------------------------------------------------------
   Generic admin notification (Resend). Recipient resolution order:
     DAS_NOTIFY_EMAIL  →  ADMIN_EMAILS (all)  →  griffainai@gmail.com
   Fire-and-forget; never blocks or throws into the request path.
   ------------------------------------------------------------------- */
function adminNotifyRecipients() {
  const direct = (process.env.DAS_NOTIFY_EMAIL || '').split(',').map(s => s.trim()).filter(Boolean);
  if (direct.length) return direct;
  const admins = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (admins.length) return admins;
  return ['griffainai@gmail.com'];
}

async function sendAdminEmail({ subject, html, from }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn('[notify] RESEND_API_KEY missing — skipping:', subject); return; }
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from:    from || 'DAS Portal <notifications@driverappreciationsolutions.com>',
        to:      adminNotifyRecipients(),
        subject,
        html,
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error(`[notify] FAILED (HTTP ${resp.status}): ${errBody}`);
    }
  } catch (err) {
    console.error('[notify] threw:', err && err.message);
  }
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch
  ));
}

/* =============================================================
   ACTION: submit-ticket   (authed → support_tickets + admin email)
   Inserts server-side (service role) so the notification always fires
   with trusted data, then emails the DAS team. Returns the created row.
   ============================================================= */
async function handleSubmitTicket(req, res, payload) {
  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  const subject  = String(payload.subject  || '').trim();
  const message  = String(payload.message  || '').trim();
  const priority = ['low', 'normal', 'high', 'urgent'].includes(payload.priority) ? payload.priority : 'normal';
  if (!subject) return res.status(400).json({ error: 'Subject is required' });

  const supabase = getServiceClient();
  const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).maybeSingle();
  const companyId = (profile && profile.company_id) || null;

  let companyName = '';
  if (companyId) {
    const { data: co } = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle();
    companyName = (co && co.name) || '';
  }

  const { data, error } = await supabase.from('support_tickets').insert({
    company_id: companyId,
    user_id:    user.id,
    subject,
    message,
    category:   payload.category || 'general',
    priority,
    status:     'open',
  }).select().single();

  if (error) {
    console.error('[submit-ticket]', error.message);
    return res.status(500).json({ error: 'Could not submit ticket' });
  }

  const prClr = { urgent: '#B91C1C', high: '#C2410C', normal: '#1A2E6E', low: '#6B7280' }[priority] || '#1A2E6E';
  void sendAdminEmail({
    subject: `🎫 Support ticket — ${subject} [${priority.toUpperCase()}]`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:${prClr};padding:18px 22px;border-radius:12px 12px 0 0">
          <h2 style="color:#fff;margin:0;font-size:17px">New Support Ticket</h2>
          <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:12px">Priority: ${esc(priority)}</p>
        </div>
        <div style="background:#fff;padding:22px;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 12px 12px">
          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:14px">
            <tr><td style="padding:6px 0;color:#6B7280;width:120px">Company</td><td style="padding:6px 0;font-weight:600;color:#111">${esc(companyName || '—')}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7280">From</td><td style="padding:6px 0">${esc(user.email || '—')}</td></tr>
            <tr><td style="padding:6px 0;color:#6B7280">Subject</td><td style="padding:6px 0;font-weight:600;color:#111">${esc(subject)}</td></tr>
          </table>
          ${message ? `<div style="background:#F9FAFB;border-radius:8px;padding:12px 16px;font-size:13px;color:#374151;white-space:pre-wrap">${esc(message)}</div>` : ''}
        </div>
      </div>`,
  });

  return res.status(200).json({ ok: true, ticket: data });
}

async function handleSubmitQuote(req, res, payload) {
  // ── PATH A: Authenticated portal user ──────────────────────────────
  try {
    const user = await getUserFromToken(req.headers.authorization);
    if (user) {
      const supabase = getServiceClient();
      const { data: profile } = await supabase
        .from('users').select('company_id').eq('id', user.id).single();

      const notesStr = [
        payload.notes,
        payload.company       ? `Company: ${payload.company}`      : null,
        payload.contact_name  ? `Contact: ${payload.contact_name}` : null,
        payload.contact_email ? `Email: ${payload.contact_email}`  : null,
      ].filter(Boolean).join(' | ') || null;

      const { data: quoteRow } = await supabase.from('quotes').insert({
        company_id:        (profile && profile.company_id) || null,
        user_id:           user.id,
        type:              payload.type,
        driver_count:      payload.driver_count,
        budget_per_driver: payload.budget_per_driver,
        timeline:          payload.timeline,
        notes:             notesStr,
        status:            'submitted',
      }).select().single();

      let coName = '';
      if (profile && profile.company_id) {
        const { data: co } = await supabase.from('companies').select('name').eq('id', profile.company_id).maybeSingle();
        coName = (co && co.name) || '';
      }
      void sendAdminEmail({
        subject: `📋 Quote request — ${esc(coName || user.email || 'Portal user')}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <div style="background:#1A2E6E;padding:18px 22px;border-radius:12px 12px 0 0">
              <h2 style="color:#fff;margin:0;font-size:17px">New Quote Request</h2>
              <p style="color:rgba(255,255,255,.7);margin:4px 0 0;font-size:12px">From the customer portal</p>
            </div>
            <div style="background:#fff;padding:22px;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 12px 12px">
              <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:14px">
                <tr><td style="padding:6px 0;color:#6B7280;width:140px">Company</td><td style="padding:6px 0;font-weight:600;color:#111">${esc(coName || '—')}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">From</td><td style="padding:6px 0">${esc(user.email || '—')}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Type</td><td style="padding:6px 0">${esc(payload.type || '—')}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Driver count</td><td style="padding:6px 0">${esc(payload.driver_count || '—')}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Budget / driver</td><td style="padding:6px 0">${esc(payload.budget_per_driver || '—')}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Timeline</td><td style="padding:6px 0">${esc(payload.timeline || '—')}</td></tr>
              </table>
              ${notesStr ? `<div style="background:#F9FAFB;border-radius:8px;padding:12px 16px;font-size:13px;color:#374151;white-space:pre-wrap">${esc(notesStr)}</div>` : ''}
            </div>
          </div>`,
      });

      return res.status(200).json({ ok: true, path: 'portal', quote: quoteRow });
    }
  } catch (err) {
    console.error('[submit-quote portal path]', err && err.message);
  }

  // ── PATH B: Anonymous website visitor ──────────────────────────────
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
    void sendLeadNotification(payload);
    return res.status(200).json({ ok: true });
  }
}

/* =============================================================
   ACTION: billing-checkout   (subscription Checkout session)
   ============================================================= */
const PRICE_IDS = {
  starter:      process.env.STRIPE_PRICE_STARTER      || '',
  professional: process.env.STRIPE_PRICE_PROFESSIONAL || '',
  enterprise:   process.env.STRIPE_PRICE_ENTERPRISE   || '',
};

async function handleBillingCheckout(req, res, payload) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_REPLACE')) {
    return res.status(500).json({ error: 'Payment system not configured — contact support.' });
  }

  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  const tier    = payload.tier;
  const priceId = PRICE_IDS[tier];
  if (!priceId) return res.status(400).json({ error: `No price configured for tier: ${tier}` });

  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
  const supabase = getServiceClient();

  try {
    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id, company_id, companies(name)')
      .eq('id', user.id)
      .single();

    let customerId = profile && profile.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  (profile && profile.companies && profile.companies.name) || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const siteUrl = (process.env.SITE_URL || 'https://driverappreciationsolutions.com').replace(/\/$/, '');
    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      payment_method_types: ['card'],
      line_items:           [{ price: priceId, quantity: 1 }],
      mode:                 'subscription',
      success_url:          `${siteUrl}/account.html?subscribed=1`,
      cancel_url:           `${siteUrl}/account.html?tab=billing`,
      metadata:             { supabase_user_id: user.id, tier },
      subscription_data:    { metadata: { supabase_user_id: user.id, tier } },
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[billing-checkout]', err && err.message);
    return res.status(500).json({ error: err.message || 'Failed to create checkout session.' });
  }
}

/* =============================================================
   ACTION: billing-portal   (Stripe customer-portal URL)
   ============================================================= */
async function handleBillingPortal(req, res) {
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_REPLACE')) {
    return res.status(500).json({ error: 'Payment system not configured — contact support.' });
  }

  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from('users').select('stripe_customer_id').eq('id', user.id).single();

  const customerId = profile && profile.stripe_customer_id;
  if (!customerId) return res.status(400).json({ error: 'No Stripe customer on file' });

  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
  const siteUrl = (process.env.SITE_URL || 'https://driverappreciationsolutions.com').replace(/\/$/, '');

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${siteUrl}/account.html?tab=billing`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('[billing-portal]', err && err.message);
    return res.status(500).json({ error: err.message || 'Failed to open billing portal.' });
  }
}

/* =============================================================
   ACTION: stripe-webhook   (RAW body → signature verify → sync Supabase)
   ============================================================= */
async function handleStripeWebhook(req, res, rawBody) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

  const signature = req.headers['stripe-signature'] || '';
  const secret    = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error('[stripe-webhook] signature error', err && err.message);
    return res.status(400).json({ error: (err && err.message) || 'Invalid signature' });
  }

  const supabase = getServiceClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        // ── Portal shop order payment (order created up-front) ──────────
        if (session.metadata && session.metadata.orderId) {
          const addr = session.shipping_details && session.shipping_details.address;
          const shippingAddress = addr
            ? [addr.line1, addr.line2, addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')
            : null;

          const { data: existing } = await supabase
            .from('das_orders').select('notes').eq('id', session.metadata.orderId).single();

          const existingNotes = (existing && existing.notes) || '';
          const addressNote   = shippingAddress ? `Ship to: ${shippingAddress}` : null;
          const newNotes      = [existingNotes, addressNote].filter(Boolean).join(' | ') || null;

          await supabase.from('das_orders')
            .update({ status: 'confirmed', notes: newNotes })
            .eq('id', session.metadata.orderId);
          break;
        }

        // ── Store checkout (one-time payment) → record an order ─────────
        if (session.mode === 'payment') {
          const { data: existingForSession } = await supabase
            .from('das_orders').select('id').eq('stripe_session_id', session.id).maybeSingle();
          if (existingForSession) break;

          const email        = (session.customer_details && session.customer_details.email) || '';
          const customerName = (session.customer_details && session.customer_details.name)  || '';

          let companyId = null;
          if (email) {
            const { data: userRow } = await supabase
              .from('users').select('company_id').eq('email', email).maybeSingle();
            companyId = (userRow && userRow.company_id) || null;
          }

          const lineItemsPage = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
          const items = lineItemsPage.data.map((li) => ({
            name:       li.description || '',
            qty:        li.quantity    || 1,
            unit_price: ((li.amount_total || 0) / (li.quantity || 1)) / 100,
          }));

          const total   = (session.amount_total || 0) / 100;
          const payload = {
            order_number:      `DAS-${Date.now().toString(36).toUpperCase()}`,
            stripe_session_id: session.id,
            items,
            subtotal:          total,
            total,
            status:            'confirmed',
            notes:             customerName ? `Customer: ${customerName} <${email}>` : email,
          };
          if (companyId) payload.company_id = companyId;

          const { error } = await supabase.from('das_orders').insert(payload);
          if (error) console.error('[stripe-webhook] insert das_order failed:', error.message);
          break;
        }

        // ── Subscription checkout → upsert subscription record ──────────
        if (session.mode !== 'subscription') break;

        const userId         = session.metadata && session.metadata.supabase_user_id;
        const tier           = session.metadata && session.metadata.tier;
        const subscriptionId = session.subscription;
        if (!userId || !tier) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        const { data: profile } = await supabase
          .from('users').select('company_id').eq('id', userId).single();
        const companyId = profile && profile.company_id;
        if (!companyId) break;

        await supabase.from('subscriptions').upsert({
          company_id:             companyId,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id:     session.customer,
          tier,
          status:                 sub.status,
          current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end:     new Date(sub.current_period_end   * 1000).toISOString(),
          updated_at:             new Date().toISOString(),
        }, { onConflict: 'company_id' });

        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub    = event.data.object;
        const userId = sub.metadata && sub.metadata.supabase_user_id;
        const tier   = sub.metadata && sub.metadata.tier;
        if (!userId) break;

        const { data: profile } = await supabase
          .from('users').select('company_id').eq('id', userId).single();
        const companyId = profile && profile.company_id;
        if (!companyId) break;

        await supabase.from('subscriptions').update({
          status:               sub.status,
          tier:                 tier || undefined,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end:   new Date(sub.current_period_end   * 1000).toISOString(),
          updated_at:           new Date().toISOString(),
        }).eq('company_id', companyId);

        break;
      }

      case 'invoice.payment_failed': {
        const invoice    = event.data.object;
        const customerId = invoice.customer;
        const { error } = await supabase.from('subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId);
        if (error) console.error('[stripe-webhook] mark past_due failed:', error.message);
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        const metadata = pi.metadata || {};
        if (metadata.skip_pi_handler === 'true') break;

        const { data: existing } = await supabase
          .from('das_orders').select('id').eq('stripe_session_id', pi.id).maybeSingle();
        if (existing) break;

        const email = pi.receipt_email || '';
        let companyId = null;
        if (email) {
          const { data: userRow } = await supabase
            .from('users').select('company_id').eq('email', email).maybeSingle();
          companyId = (userRow && userRow.company_id) || null;
        }

        const total   = (pi.amount_received || 0) / 100;
        const payload  = {
          order_number:      `DAS-${Date.now().toString(36).toUpperCase()}`,
          stripe_session_id: pi.id,
          items:             [],
          subtotal:          total,
          total,
          status:            'confirmed',
          notes:             email ? `Direct charge: ${email}` : 'Direct charge (no email)',
        };
        if (companyId) payload.company_id = companyId;

        const { error } = await supabase.from('das_orders').insert(payload);
        if (error) console.error('[stripe-webhook] insert from payment_intent failed:', error.message);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error('[stripe-webhook] handler error', event && event.type, err && err.message);
    // Return 200 so Stripe doesn't hammer retries for non-signature errors we've logged.
  }

  return res.status(200).json({ received: true });
}

/* =============================================================
   RECOGNITION: company resolution helper (service client)
   Mirrors the old lib/admin-auth resolveCompany using supabase-js.
   ============================================================= */
async function createPortalCompany(supabase, user) {
  const domain = String(user.email || '').split('@')[1] || '';
  const name   = domain ? `${domain} (via website)` : `${user.email || 'Customer'} account`;
  const { data, error } = await supabase
    .from('companies')
    .insert({ name, billing_email: user.email || null, owner_id: user.id })
    .select('id').single();
  if (error) { console.error('[recognition] createCompany', error.message); return null; }
  return data && data.id;
}

async function resolvePortalCompany(supabase, user) {
  if (!user || !user.id) return null;
  const { data: rows } = await supabase
    .from('users').select('id, company_id').eq('id', user.id).limit(1);

  if (Array.isArray(rows) && rows.length) {
    if (rows[0].company_id) return rows[0].company_id;
    const cid = await createPortalCompany(supabase, user);
    if (cid) await supabase.from('users').update({ company_id: cid }).eq('id', user.id);
    return cid;
  }
  // No users row (pure website signup) → provision company + link.
  const cid = await createPortalCompany(supabase, user);
  if (cid) {
    await supabase.from('users')
      .upsert({ id: user.id, email: user.email, company_id: cid, role: 'owner' }, { onConflict: 'id' });
  }
  return cid;
}

/* =============================================================
   ACTION: recognition-catalog   (active products for the wizard)
   Service-role read so it works regardless of das_products RLS.
   ============================================================= */
async function handleRecognitionCatalog(req, res) {
  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  const supabase = getServiceClient();
  let { data, error } = await supabase.from('das_products').select('*').eq('active', true).order('name');
  if (error) { // tolerate a schema without an `active` flag
    ({ data, error } = await supabase.from('das_products').select('*').order('name'));
  }
  if (error) { console.error('[recognition-catalog]', error.message); return res.status(500).json({ error: 'Catalog load failed' }); }

  const products = (Array.isArray(data) ? data : []).map(p => ({
    id:    p.id,
    name:  p.name,
    sku:   p.sku,
    price: Number(p.price) || 0,
    category: p.category || '',
    requires_manual_shipping_quote: p.requires_manual_shipping_quote === true,
    ships_individually:             p.ships_individually === true,
    package_weight_oz:              p.package_weight_oz,
  }));
  return res.status(200).json({ products });
}

/* =============================================================
   ACTION: recognition-order   (price + create order + Stripe / quote)
   Pay-now: order inserted payment_pending, Stripe metadata.orderId +
   stripe_session_id set so the stripe-webhook records/advances it (no
   duplicate insert). Quote-required orders are stored for manual review.
   ============================================================= */
const REQUIRED_RECIPIENT_FIELDS = ['first_name', 'last_name', 'address_1', 'city', 'state', 'zip'];

function cleanRecipient(r) {
  return {
    first_name: String(r.first_name || '').trim(),
    last_name:  String(r.last_name  || '').trim(),
    address_1:  String(r.address_1  || '').trim(),
    address_2:  r.address_2 ? String(r.address_2).trim() : null,
    city:       String(r.city  || '').trim(),
    state:      String(r.state || '').trim(),
    zip:        String(r.zip   || '').trim(),
    phone:      r.phone ? String(r.phone).trim() : null,
    email:      r.email ? String(r.email).trim() : null,
    shirt_size: r.shirt_size ? String(r.shirt_size).trim() : null,
    message:    r.message ? String(r.message).trim() : null,
    ref_no:     r.ref_no ? String(r.ref_no).trim() : null,
  };
}

async function handleRecognitionOrder(req, res, body) {
  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  const supabase = getServiceClient();
  const companyId = await resolvePortalCompany(supabase, user);
  if (!companyId) return res.status(400).json({ error: 'Could not resolve your company. Please contact support.' });

  const track           = String(body.track || '').trim();
  const milestone       = String(body.milestone || '').trim();
  const sku             = String(body.sku || '').trim();
  const recognitionTier = String(body.tier || '').trim();              // tier_1..tier_4
  const kitTierOverride = body.kitTier ? String(body.kitTier).trim() : null;
  const tierOverridden  = Boolean(body.tierOverridden) || !!kitTierOverride;
  const fulfillmentType = body.fulfillmentType === 'multi_address' ? 'multi_address' : 'single_address';
  const companyNote     = body.companyNote ? String(body.companyNote).trim() : null;
  const eligibility     = Boolean(body.eligibilityConfirmed);

  if (!track || !milestone || !recognitionTier || !sku) {
    return res.status(400).json({ error: 'Missing required fields (track, milestone, tier, product).' });
  }
  if (!eligibility) return res.status(400).json({ error: 'Eligibility must be confirmed before submitting.' });

  const rawRecipients = Array.isArray(body.recipients) ? body.recipients : [];
  if (rawRecipients.length === 0)    return res.status(400).json({ error: 'At least one recipient is required.' });
  if (rawRecipients.length > 5000)   return res.status(400).json({ error: 'Too many recipients in a single order.' });

  const recipients = rawRecipients.map(cleanRecipient);
  for (let i = 0; i < recipients.length; i++) {
    const missing = REQUIRED_RECIPIENT_FIELDS.filter(f => !recipients[i][f]);
    if (missing.length) return res.status(400).json({ error: `Recipient ${i + 1} is missing: ${missing.join(', ')}` });
  }

  // Authoritative product lookup (service role).
  const { data: prod, error: prodErr } = await supabase
    .from('das_products').select('*').eq('sku', sku).limit(1).maybeSingle();
  if (prodErr) { console.error('[recognition-order] product lookup', prodErr.message); return res.status(500).json({ error: 'Product lookup failed.' }); }
  if (!prod)   return res.status(400).json({ error: `Unknown product SKU: ${sku}` });

  // Pricing: recognition tier → kit tier → unit price.
  const kitTier   = kitTierOverride || Pricing.kitTierForRecognitionTier(recognitionTier);
  const basePrice = Number(prod.price) || 0;
  const unitPrice = Pricing.priceForKitTier(kitTier, basePrice);
  if (unitPrice < 0.50) return res.status(400).json({ error: 'Computed unit price is below the minimum chargeable amount.' });

  const qty           = recipients.length;
  const deliveryCount = fulfillmentType === 'multi_address' ? qty : 1;

  const shippingResult = Shipping.calculateShipping({
    fulfillmentType,
    deliveryCount,
    items: [{
      qty,
      product: {
        requires_manual_shipping_quote: prod.requires_manual_shipping_quote === true,
        ships_individually:             prod.ships_individually === true,
        package_weight_oz:              prod.package_weight_oz,
        package_length_in:              prod.package_length_in,
        package_width_in:               prod.package_width_in,
        package_height_in:              prod.package_height_in,
      },
    }],
  });

  const requiresQuote = shippingResult.requiresQuote;
  const subtotal      = Number((unitPrice * qty).toFixed(2));
  const shippingCost  = requiresQuote ? null : shippingResult.cost;
  const total         = requiresQuote ? null : Number((subtotal + shippingCost).toFixed(2));

  const datePart    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randPart    = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `DAS-RX-${datePart}-${randPart}`;
  const tierLabel   = recognitionTier.replace('tier_', 'Tier ');
  const itemLabel   = `${prod.name} — ${milestone} (${tierLabel}, ${kitTier})`;

  const notesParts = [
    `Track: ${track}`,
    `Milestone: ${milestone}`,
    `Tier: ${recognitionTier}${tierOverridden ? ' (override → ' + kitTier + ')' : ''}`,
    `Fulfillment: ${fulfillmentType}`,
    companyNote ? `Company note: ${companyNote}` : null,
    requiresQuote ? `Quote reason: ${shippingResult.reason}` : null,
  ].filter(Boolean);

  const orderRow = {
    company_id:               companyId,
    order_number:             orderNumber,
    items:                    [{ name: itemLabel, qty, unit_price: unitPrice, sku }],
    subtotal,
    shipping_cost:            shippingCost,
    total,
    status:                   requiresQuote ? 'shipping_quote_required' : 'payment_pending',
    notes:                    notesParts.join(' | '),
    fulfillment_type:         fulfillmentType,
    delivery_count:           deliveryCount,
    shipping_quote_required:  requiresQuote,
    shipping_quote_reason:    requiresQuote ? shippingResult.reason : null,
    recipients,
    recognition_track:        track,
    recognition_milestone:    milestone,
    recognition_tier:         recognitionTier,
    submitted_by_user_id:     user.id,
    eligibility_confirmed_at: new Date().toISOString(),
  };

  const { data: order, error: insErr } = await supabase
    .from('das_orders').insert(orderRow).select('*').single();
  if (insErr || !order) { console.error('[recognition-order] insert failed', insErr && insErr.message); return res.status(500).json({ error: 'Order creation failed.' }); }

  // Quote-required → submit for review, no charge.
  if (requiresQuote) {
    return res.status(200).json({
      mode:          'quote_required',
      orderId:       order.id,
      orderNumber:   order.order_number,
      status:        order.status,
      adminMessage:  shippingResult.adminMessage,
      estimatedCost: shippingResult.estimatedCost,
    });
  }

  // Calculable → pay now via Stripe Checkout.
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_REPLACE')) {
    console.error('[recognition-order] STRIPE_SECRET_KEY not configured');
    return res.status(500).json({ error: 'Payment system not configured — contact support.' });
  }

  try {
    const Stripe  = require('stripe');
    const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
    const siteUrl = (process.env.SITE_URL || 'https://driverappreciationsolutions.com').replace(/\/$/, '');

    const line_items = [{
      price_data: {
        currency: 'usd',
        product_data: {
          name:        itemLabel,
          description: `${fulfillmentType === 'multi_address' ? qty + ' recipients' : milestone} · recognition program`,
        },
        unit_amount: Math.round(unitPrice * 100),
      },
      quantity: qty,
    }];

    if (shippingCost > 0) {
      line_items.push({
        price_data: {
          currency: 'usd',
          product_data: { name: 'Shipping & handling', description: shippingResult.breakdown },
          unit_amount: Math.round(shippingCost * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode:                       'payment',
      success_url:                `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
      cancel_url:                 `${siteUrl}/account.html#recognition`,
      billing_address_collection: 'required',
      custom_text: { submit: { message: 'Recognition orders enter DAS review immediately after payment.' } },
      // orderId (camelCase) is what the stripe-webhook checkout.session.completed
      // handler keys on — it flips this order to confirmed and never double-inserts.
      metadata: {
        order_source: 'das-recognition-order',
        orderId:      order.id,
        order_number: order.order_number,
        company_id:   companyId,
        recipients:   String(qty),
      },
    });

    await supabase.from('das_orders')
      .update({ stripe_session_id: session.id, notes: notesParts.concat([`Stripe session: ${session.id}`]).join(' | ') })
      .eq('id', order.id);

    return res.status(200).json({ mode: 'checkout', orderId: order.id, orderNumber: order.order_number, url: session.url });
  } catch (err) {
    console.error('[recognition-order] Stripe error', err && err.message);
    return res.status(500).json({ error: (err && err.message) || 'Failed to start checkout. Please try again.' });
  }
}

/* =============================================================
   ROUTER
   ============================================================= */
module.exports = async (req, res) => {
  const action = (req.query && req.query.action) || '';

  // Stripe webhook is server-to-server: no CORS, needs raw body, no OPTIONS.
  if (action === 'stripe-webhook') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const rawBody = await readRawBody(req);
    return handleStripeWebhook(req, res, rawBody);
  }

  // Browser-facing actions: CORS + OPTIONS preflight.
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  // Body parsing is disabled globally (for the webhook), so parse here.
  let payload = {};
  try {
    const rawBody = await readRawBody(req);
    if (rawBody && rawBody.length) payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  switch (action) {
    case 'submit-quote':         return handleSubmitQuote(req, res, payload);
    case 'submit-ticket':        return handleSubmitTicket(req, res, payload);
    case 'billing-checkout':     return handleBillingCheckout(req, res, payload);
    case 'billing-portal':       return handleBillingPortal(req, res);
    case 'recognition-catalog':  return handleRecognitionCatalog(req, res);
    case 'recognition-order':    return handleRecognitionOrder(req, res, payload);
    default:
      return res.status(404).json({ error: `Unknown portal action: ${action || '(none)'}` });
  }
};

// Disable Vercel's body parser so the webhook gets raw bytes.
// (Set AFTER the export assignment so it isn't wiped.)
module.exports.config = { api: { bodyParser: false } };
