/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Subscription checkout — Vercel Serverless Function
   POST /api/billing-checkout   { tier: 'starter'|'professional'|'enterprise' }
   ---------------------------------------------
   Ported from das-portal src/app/api/stripe/create-checkout/route.ts.
   Auth: Authorization: Bearer <supabase access token>.
   Creates (or reuses) a Stripe customer for the portal user's account,
   then opens a subscription Checkout session for the requested tier.
   Env: STRIPE_SECRET_KEY, STRIPE_PRICE_{STARTER|PROFESSIONAL|ENTERPRISE},
        SUPABASE_*, SITE_URL.
   ============================================= */

const { getServiceClient, getUserFromToken } = require('./_supabase');

const PRICE_IDS = {
  starter:      process.env.STRIPE_PRICE_STARTER      || '',
  professional: process.env.STRIPE_PRICE_PROFESSIONAL || '',
  enterprise:   process.env.STRIPE_PRICE_ENTERPRISE   || '',
};

module.exports = async (req, res) => {
  const allowedOrigin = process.env.SITE_URL || '*';
  res.setHeader('Access-Control-Allow-Origin',  allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_REPLACE')) {
    return res.status(500).json({ error: 'Payment system not configured — contact support.' });
  }

  // Authenticate the portal user
  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  const { tier } = req.body || {};
  const priceId  = PRICE_IDS[tier];
  if (!priceId) return res.status(400).json({ error: `No price configured for tier: ${tier}` });

  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });
  const supabase = getServiceClient();

  try {
    // Fetch or create the Stripe customer
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
};
