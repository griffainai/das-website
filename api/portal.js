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
    case 'submit-quote':     return handleSubmitQuote(req, res, payload);
    case 'billing-checkout': return handleBillingCheckout(req, res, payload);
    case 'billing-portal':   return handleBillingPortal(req, res);
    default:
      return res.status(404).json({ error: `Unknown portal action: ${action || '(none)'}` });
  }
};

// Disable Vercel's body parser so the webhook gets raw bytes.
// (Set AFTER the export assignment so it isn't wiped.)
module.exports.config = { api: { bodyParser: false } };
