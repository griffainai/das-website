/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Stripe Checkout — Vercel Serverless Function
   POST /api/create-checkout
   ============================================= */

const { getServiceClient, getUserFromToken } = require('./_supabase');

module.exports = async (req, res) => {
  const allowedOrigin = process.env.SITE_URL || '*';
  res.setHeader('Access-Control-Allow-Origin',  allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

  // Quantity-tiered shipping engine (replaces the old hardcoded $12.95/$24.95).
  const Shipping = require('../lib/shipping');
  // Server-side price authority for the static storefront catalog (anti price-tampering).
  const Catalog  = require('../lib/catalog');

  const body = req.body || {};
  const { items } = body;
  // Optional upsell metadata from the client (cart.html computes these)
  const bundleDiscount    = Math.max(0, Number(body.bundleDiscount   || 0));
  const guaranteeFee      = Math.max(0, Number(body.guaranteeFee     || 0));
  const premiumGuarantee  = Boolean(body.premiumGuarantee);

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  // ── Validate + PRICE each item server-side ───────────────────────────────────
  // Known storefront products are priced from lib/catalog: the browser-sent price is
  // verified against the real tier prices and replaced with the trusted value, never
  // taken on faith. Unknown items (e.g. Frequently-Bought-Together bundle items sourced
  // from Supabase) are sanity-checked and passed through.
  const MAX_ITEMS = 100;       // a real cart never has this many distinct lines
  const MAX_QTY    = 100000;   // per-line sanity ceiling
  if (items.length > MAX_ITEMS) {
    return res.status(400).json({ error: 'Too many items in cart.' });
  }

  const priced = [];
  for (const item of items) {
    const name = String(item && item.name ? item.name : '').trim().slice(0, 200);
    if (!name) return res.status(400).json({ error: 'Invalid item data (missing name).' });

    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QTY) {
      return res.status(400).json({ error: `Invalid quantity for "${name}".` });
    }

    // Resolve the authoritative unit price.
    let unitPrice, minQty;
    const verdict = Catalog.resolve(item);
    if (verdict.status === 'verified') {
      unitPrice = verdict.unitPrice;                 // server-trusted tier price
      minQty    = verdict.minQty || 10;
    } else if (verdict.status === 'rejected') {
      // Known product, but the price matches no real tier → tampering. Reject.
      console.error('[create-checkout] price mismatch', { id: item.id, sent: item.price, allowed: verdict.allowed });
      return res.status(400).json({ error: 'Item pricing is out of date — please refresh the page and try again.' });
    } else {
      // Unknown product (FBT / Supabase-sourced): sanity-check the client price.
      const cp = Number(item.price);
      if (!isFinite(cp) || cp < 0.50) {
        return res.status(400).json({ error: `Unit price for "${name}" must be at least $0.50.` });
      }
      unitPrice = Math.round(cp * 100) / 100;
      minQty    = Number(item.minQty) > 0 ? Number(item.minQty) : 10;
    }

    if (qty < minQty) {
      return res.status(400).json({ error: `Minimum order for "${name}" is ${minQty} units.` });
    }

    priced.push({
      id:       item.id || '',
      name,
      qty,
      unitPrice,
      minQty,
      image:    item.image    || null,
      category: item.category || '',
    });
  }

  try {
    const line_items = priced.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: `Fleet recognition · min. ${item.minQty} units`,
          images: item.image ? [item.image] : [],
          metadata: {
            product_id: item.id,
            category:   item.category,
          },
        },
        unit_amount: Math.round(item.unitPrice * 100),
      },
      quantity: item.qty,
    }));

    // ── Premium guarantee — added as a Stripe line item so the buyer sees it
    //    on the receipt and Stripe records it as a sold add-on. Server recomputes
    //    fee from subtotal × 10% rather than trusting the client number, so
    //    clients can't underpay by tampering with the request body.
    if (premiumGuarantee) {
      const subtotalCents = priced.reduce((s, it) => s + Math.round(it.unitPrice * 100) * it.qty, 0);
      const serverGuaranteeCents = Math.round(subtotalCents * 0.10);
      if (serverGuaranteeCents >= 50) {
        line_items.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Premium Guarantee — 1-yr quality lock + overnight replacement',
              description: '10% of order subtotal · optional add-on',
            },
            unit_amount: serverGuaranteeCents,
          },
          quantity: 1,
        });
      }
    }

    // ── Bundle discount — applied via Stripe Coupon (created on the fly).
    //    Re-computed server-side: only valid when subtotal >= $575.
    //    15% off the entire order.
    const bundleEligibleSubtotal = priced.reduce((s, it) => s + it.unitPrice * it.qty, 0);
    const bundleApplies = bundleEligibleSubtotal >= 575;
    let discountsArg = undefined;
    if (bundleApplies) {
      const coupon = await stripe.coupons.create({
        percent_off: 15,
        duration:    'once',
        name:        'Bundle Discount — 15% off (Aug 7 promotion)',
      });
      discountsArg = [{ coupon: coupon.id }];
    }

    const siteUrl = (process.env.SITE_URL || 'https://driverappreciationsolutions.com').replace(/\/$/, '');

    // ── Resolve the authenticated buyer (if any) so the order is linked to
    //    their company and shows up in their portal. Guests fall through to
    //    the webhook's email-match path (backstop), so the public storefront
    //    keeps working without a login. ──────────────────────────────────────
    let buyerUserId = null;
    let buyerCompanyId = null;
    try {
      const user = await getUserFromToken(req.headers.authorization || req.headers.Authorization);
      if (user) {
        buyerUserId = user.id;
        const svc = getServiceClient();
        const { data: profile } = await svc.from('users').select('company_id').eq('id', user.id).maybeSingle();
        buyerCompanyId = (profile && profile.company_id) || null;
      }
    } catch (e) {
      console.warn('[create-checkout] buyer resolve skipped:', e && e.message);
    }

    // ── Quantity-tiered shipping (single company address) ──
    // Kits cost ~$15 each to ship; the old flat $12.95 undercharged every multi-unit
    // order. Compute a flat rate from total quantity using the shared rule engine.
    const totalQty = priced.reduce((s, it) => s + it.qty, 0);
    const shipResult = Shipping.calculateShipping({
      fulfillmentType: 'single_address',
      deliveryCount:   1,
      items:           priced.map(it => ({ qty: it.qty, product: null })),
    });
    // For calculable tiers use the engine cost; for 500+ (quote-required) charge the
    // top self-serve tier as a conservative floor and flag for DAS follow-up.
    let shippingCents;
    let shippingLabel;
    if (shipResult.requiresQuote) {
      shippingCents = Math.round((Shipping.estimateSingleAddressFlat(499) || 950) * 100);
      shippingLabel = `Flat-rate shipping (${totalQty} units — final freight confirmed by DAS)`;
    } else {
      shippingCents = Math.round(shipResult.cost * 100);
      shippingLabel = `Flat-rate shipping (${totalQty} units)`;
    }
    if (!(shippingCents > 0)) shippingCents = 2500; // safety floor

    const sessionConfig = {
      line_items,
      mode:                       'payment',
      success_url:                `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:                 `${siteUrl}/cart.html`,
      billing_address_collection:  'required',
      shipping_address_collection: { allowed_countries: ['US', 'CA'] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: shippingCents, currency: 'usd' },
            display_name: shippingLabel,
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 3 },
              maximum: { unit: 'business_day', value: 7 },
            },
          },
        },
      ],
      allow_promotion_codes:       true,
      custom_text: {
        submit: {
          message: 'Orders ship within 3–5 business days. Minimum 10 units per product.',
        },
      },
      metadata: {
        order_source:      'das-website-cart',
        item_count:        String(items.length),
        total_qty:         String(totalQty),
        shipping_charged:  String(shippingCents),
        shipping_quote:    shipResult.requiresQuote ? '1' : '0',
        bundle_applied:    bundleApplies ? '1' : '0',
        premium_guarantee: premiumGuarantee ? '1' : '0',
      },
    };

    // Apply bundle discount coupon if eligible (15% off entire order)
    if (discountsArg) sessionConfig.discounts = discountsArg;

    // ── Authenticated buyer → create the order row UP-FRONT (status
    //    payment_pending) so it appears in their portal immediately and the
    //    success page / webhook only needs to flip it to confirmed. Mirrors
    //    the proven recognition-order flow. Money figures match what Stripe
    //    will charge so the portal total is correct. ───────────────────────
    let createdOrderId = null;
    if (buyerCompanyId) {
      const goodsCents     = priced.reduce((s, it) => s + Math.round(it.unitPrice * 100) * it.qty, 0);
      const guaranteeCents = (premiumGuarantee && Math.round(goodsCents * 0.10) >= 50) ? Math.round(goodsCents * 0.10) : 0;
      const preDiscount    = goodsCents + guaranteeCents;
      const discountCents  = bundleApplies ? Math.round(preDiscount * 0.15) : 0;
      const subtotalCents  = preDiscount - discountCents;   // goods after discount, pre-shipping
      const totalCents     = subtotalCents + shippingCents;

      const orderItems = priced.map(it => ({ name: it.name, qty: it.qty, unit_price: it.unitPrice, sku: it.id || null }));
      if (guaranteeCents > 0) orderItems.push({ name: 'Premium Guarantee (1-yr quality lock + overnight replacement)', qty: 1, unit_price: Math.round(guaranteeCents) / 100, sku: 'GUARANTEE' });

      const datePart    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randPart    = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `DAS-${datePart}-${randPart}`;
      const noteParts   = [
        bundleApplies    ? `Bundle discount 15% (−$${(discountCents / 100).toFixed(2)})` : null,
        premiumGuarantee ? 'Premium guarantee added' : null,
        shipResult.requiresQuote ? 'Freight confirmed by DAS after order' : null,
      ].filter(Boolean);

      try {
        const svc = getServiceClient();
        const { data: order, error: insErr } = await svc.from('das_orders').insert({
          company_id:           buyerCompanyId,
          order_number:         orderNumber,
          items:                orderItems,
          subtotal:             Math.round(subtotalCents) / 100,
          shipping_cost:        Math.round(shippingCents) / 100,
          total:                Math.round(totalCents) / 100,
          status:               'payment_pending',
          fulfillment_type:     'single_address',
          delivery_count:       1,
          submitted_by_user_id: buyerUserId,
          notes:                noteParts.join(' | ') || null,
        }).select('id').single();
        if (insErr) {
          console.error('[create-checkout] up-front order insert failed:', insErr.message);
        } else if (order) {
          createdOrderId = order.id;
          sessionConfig.metadata.orderId    = order.id;
          sessionConfig.metadata.company_id = buyerCompanyId;
          sessionConfig.success_url         = `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`;
        }
      } catch (e) {
        console.error('[create-checkout] order creation skipped:', e && e.message);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // Link the Stripe session back to the order so confirm-order / webhook can find it.
    if (createdOrderId) {
      try {
        await getServiceClient().from('das_orders')
          .update({ stripe_session_id: session.id })
          .eq('id', createdOrderId);
      } catch (e) {
        console.error('[create-checkout] session link failed:', e && e.message);
      }
    }

    return res.status(200).json({ url: session.url, orderId: createdOrderId });

  } catch (err) {
    console.error('[Stripe create-checkout error]', err.message, err.type);
    return res.status(500).json({
      error: 'Failed to create checkout session. Please try again.',
    });
  }
};
