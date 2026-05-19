/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Stripe Checkout — Vercel Serverless Function
   POST /api/create-checkout
   ============================================= */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  const allowedOrigin = process.env.SITE_URL || '*';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { items } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  // Validate each item
  for (const item of items) {
    if (!item.name || typeof item.price !== 'number' || item.price <= 0 || !Number.isInteger(item.qty) || item.qty < 1) {
      return res.status(400).json({ error: `Invalid item: ${item.name || 'unknown'}` });
    }
    const minQty = item.minQty || 10;
    if (item.qty < minQty) {
      return res.status(400).json({ error: `Minimum order for ${item.name} is ${minQty} units` });
    }
  }

  try {
    const line_items = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: `Category: ${item.category || 'Driver Appreciation'} · Min. order: ${item.minQty || 10} units`,
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

    const siteUrl = process.env.SITE_URL || 'https://driverappreciationsolutions.com';

    const session = await stripe.checkout.sessions.create({
      // automatic_payment_methods lets Stripe surface Apple Pay, Google Pay,
      // Link, and cards based on what the buyer's browser/device supports —
      // no explicit list needed, and no domain verification required for wallets.
      automatic_payment_methods: { enabled: true },
      line_items,
      mode: 'payment',
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${siteUrl}/cart.html`,
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA'],
      },
      automatic_tax: { enabled: false },
      allow_promotion_codes: true,
      custom_text: {
        submit: {
          message: 'All orders ship within 3–5 business days. Minimum 10 units per product.',
        },
      },
      metadata: {
        order_source: 'driver-appreciation-solutions-web',
        item_count:   String(items.length),
      },
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('[Stripe Error]', err.message);
    return res.status(500).json({ error: 'Checkout session creation failed. Please try again.' });
  }
};
