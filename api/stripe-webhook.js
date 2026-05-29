/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Stripe Webhook — Vercel Serverless Function
   POST /api/stripe-webhook
   ---------------------------------------------
   Ported from das-portal src/app/api/stripe/webhook/route.ts.
   Syncs Stripe events → Supabase: subscription state + shop orders.
   The Inngest post-purchase flow is omitted (no Inngest in this stack);
   a comment marks where a follow-up nurture hook would go.

   IMPORTANT: Stripe signature verification needs the RAW request body, so we
   read the stream ourselves and never touch req.body (which would parse it).
   Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_*.
   ============================================= */

const { getServiceClient } = require('./_supabase');

// Tell Vercel not to pre-parse the body — we need the raw bytes.
module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

  const signature = req.headers['stripe-signature'] || '';
  const secret    = process.env.STRIPE_WEBHOOK_SECRET || '';

  let event;
  try {
    const rawBody = await readRawBody(req);
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

        // ── Portal shop order payment (order created up-front) ────────────
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

          // (post-purchase nurture hook would fire here)
          break;
        }

        // ── Store checkout (one-time payment) → record an order ───────────
        if (session.mode === 'payment') {
          const { data: existingForSession } = await supabase
            .from('das_orders').select('id').eq('stripe_session_id', session.id).maybeSingle();
          if (existingForSession) break; // idempotency

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

        // ── Subscription checkout → upsert subscription record ────────────
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
        if (existing) break; // already recorded via checkout.session.completed

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
};
