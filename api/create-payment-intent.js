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
    const amount = Math.round(
      items.reduce((sum, item) => sum + item.price * item.qty * 100, 0)
    );

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
