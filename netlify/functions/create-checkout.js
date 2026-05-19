/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Stripe Checkout — Netlify Serverless Function
   POST /.netlify/functions/create-checkout
   ============================================= */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const ALLOWED_ORIGIN = process.env.SITE_URL || '*';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let items;
  try {
    ({ items } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Cart is empty' }) };
  }

  // Validate each item
  for (const item of items) {
    if (!item.name || typeof item.price !== 'number' || item.price <= 0 || !Number.isInteger(item.qty) || item.qty < 1) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: `Invalid item: ${item.name || 'unknown'}` }) };
    }
    // Enforce minimum quantity
    const minQty = item.minQty || 10;
    if (item.qty < minQty) {
      return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: `Minimum order for ${item.name} is ${minQty} units` }) };
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
            product_id: item.id   || '',
            category:   item.category || '',
          },
        },
        unit_amount: Math.round(item.price * 100), // Stripe uses cents
      },
      quantity: item.qty,
    }));

    const siteUrl = process.env.SITE_URL || 'https://driverappreciationsolutions.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'payment',
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${siteUrl}/cart.html`,
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA'],
      },
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

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error('[Stripe Error]', err.message);
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Checkout session creation failed. Please try again.' }),
    };
  }
};
