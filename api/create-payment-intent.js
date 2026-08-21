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
        // DB price authority for non-catalog items — same rule as create-checkout:
        // client price accepted only inside the legit 10–15% discount window.
        const cp  = Math.round(Number(item.price) * 100) / 100;
        const sku = String(item.sku || item.id || '').trim();
        let dbProd = null;
        let lookupFailed = false;
        if (sku) {
          try {
            const { getServiceClient } = require('./_supabase');
            const svc = getServiceClient();
            const { data, error } = await svc.from('das_products').select('price, min_qty').eq('sku', sku).limit(1).maybeSingle();
            if (error) { lookupFailed = true; console.error('[create-payment-intent] das_products lookup error:', error.message); }
            else dbProd = data;
          } catch (e) { lookupFailed = true; console.error('[create-payment-intent] das_products lookup threw:', e && e.message); }
        }
        if (dbProd && isFinite(Number(dbProd.price)) && Number(dbProd.price) > 0) {
          const dbPrice = Number(dbProd.price);
          if (!isFinite(cp) || cp < dbPrice * 0.80 - 0.01 || cp > dbPrice * 1.005 + 0.01) {
            return res.status(400).json({ error: 'Item pricing is out of date — please refresh the page and try again.' });
          }
          unitPrice = cp;
          minQty    = Number(dbProd.min_qty) > 0 ? Number(dbProd.min_qty) : (Number(item.minQty) > 0 ? Number(item.minQty) : 1);
        } else if (lookupFailed) {
          if (!isFinite(cp) || cp < 0.50) {
            return res.status(400).json({ error: `Unit price for "${label}" must be at least $0.50.` });
          }
          console.warn('[create-payment-intent] db unavailable — legacy floor pricing for', sku || label);
          unitPrice = cp;
          minQty    = Number(item.minQty) > 0 ? Number(item.minQty) : 1;
        } else {
          return res.status(400).json({ error: `"${label}" is not available for purchase right now.` });
        }
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
    console.error('[create-payment-intent]', err && err.message);
    res.status(500).json({ error: 'Payment could not be started. Please try again or contact info@driverappreciationsolutions.com.' });
  }
};
