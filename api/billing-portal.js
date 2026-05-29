/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Stripe Billing Portal — Vercel Serverless Function
   POST /api/billing-portal
   ---------------------------------------------
   Ported from das-portal src/app/api/stripe/portal/route.ts.
   Auth: Authorization: Bearer <supabase access token>.
   Returns a Stripe customer-portal URL the client redirects to, so the
   customer can manage / cancel their subscription and view invoices.
   Env: STRIPE_SECRET_KEY, SUPABASE_*, SITE_URL.
   ============================================= */

const { getServiceClient, getUserFromToken } = require('./_supabase');

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

  const user = await getUserFromToken(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'Unauthenticated' });

  const supabase = getServiceClient();
  const { data: profile } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

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
};
