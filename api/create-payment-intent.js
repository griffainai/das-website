const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Stripe not configured — set STRIPE_SECRET_KEY in Vercel environment variables' });
  }

  const { items } = req.body || {};
  if (!items || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'No items provided' });
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // Server-side price authority — never trust the client-sent price.
    // Known catalog products are priced by lib/catalog (volume products are
    // priced from the requested quantity's tier); unknown items are sanity-checked.
    const Catalog = require('../lib/catalog');
    let amount = 0;
    for (const item of items) {
      const qty = Number(item && item.qty);
      const label = (item && item.name) ? String(item.name) : 'item';
      if (!Number.isInteger(qty) || qty <= 0 || qty > 100000) {
        return res.status(400).json({ error: `Invalid quantity for "${label}".` });
      }
      const known = Catalog.lookup(item.id);
      if (known && known.unavailable) {
        return res.status(400).json({ error: `"${label}" is not available for purchase right now.` });
      }
      let unitPrice, minQty;
      const verdict = Catalog.resolve(item);
      if (verdict.status === 'verified') {
        unitPrice = verdict.unitPrice;
        minQty    = verdict.minQty || 1;
      } else if (verdict.status === 'rejected') {
        return res.status(400).json({ error: 'Item pricing is out of date — please refresh the page and try again.' });
      } else {
        const cp = Number(item.price);
        if (!isFinite(cp) || cp < 0.50) {
          return res.status(400).json({ error: `Unit price for "${label}" must be at least $0.50.` });
        }
        unitPrice = Math.round(cp * 100) / 100;
        minQty    = Number(item.minQty) > 0 ? Number(item.minQty) : 1;
      }
      if (qty < minQty) {
        return res.status(400).json({ error: `Minimum order for "${label}" is ${minQty} units.` });
      }
      amount += Math.round(unitPrice * 100) * qty;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        order_items: JSON.stringify(items.map(i => ({ id: i.id, name: i.name, qty: i.qty }))),
        source: 'express-checkout',
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
