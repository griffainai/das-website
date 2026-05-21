/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Stripe Checkout — Vercel Serverless Function
   POST /api/create-checkout
   ============================================= */

module.exports = async (req, res) => {
  const allowedOrigin = process.env.SITE_URL || '*';
  res.setHeader('Access-Control-Allow-Origin',  allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  // Guard: key must be present
  if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_REPLACE')) {
    console.error('[create-checkout] STRIPE_SECRET_KEY is not configured');
    return res.status(500).json({ error: 'Payment system not configured — contact support.' });
  }

  // Initialise Stripe inside the handler so the env var is read at request time
  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' });

  const { items } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  // Validate each item
  for (const item of items) {
    if (!item.name || typeof item.price !== 'number' || item.price <= 0) {
      return res.status(400).json({ error: `Invalid item data for: ${item.name || 'unknown'}` });
    }
    const minQty = item.minQty || 10;
    if ((item.qty || 0) < minQty) {
      return res.status(400).json({ error: `Minimum order for "${item.name}" is ${minQty} units` });
    }
    // Stripe minimum charge is $0.50 USD
    if (item.price < 0.50) {
      return res.status(400).json({ error: `Unit price for "${item.name}" must be at least $0.50` });
    }
  }

  try {
    const line_items = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: `Fleet recognition · min. ${item.minQty || 10} units`,
          images: item.image ? [item.image] : [],
          metadata: {
            product_id: item.id       || '',
            category:   item.category || '',
          },
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.qty,
    }));

    const siteUrl = (process.env.SITE_URL || 'https://driverappreciationsolutions.com').replace(/\/$/, '');

    const session = await stripe.checkout.sessions.create({
      line_items,
      mode:                       'payment',
      success_url:                `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:                 `${siteUrl}/cart.html`,
      billing_address_collection: 'required',
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      allow_promotion_codes:       true,
      custom_text: {
        submit: {
          message: 'Orders ship within 3–5 business days. Minimum 10 units per product.',
        },
      },
      metadata: {
        order_source: 'das-website-cart',
        item_count:   String(items.length),
      },
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[Stripe create-checkout error]', err.message, err.type);
    return res.status(500).json({
      error: err.message || 'Failed to create checkout session. Please try again.',
    });
  }
};
