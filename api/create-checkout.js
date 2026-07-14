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

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  // ── Resolve the authenticated buyer EARLY (before per-item minimum checks) so
  //    we can apply the first-order-vs-repeat-customer minimum rule below. Guests
  //    and failures fall through to buyerCompanyId = null (treated as a FIRST order
  //    → the higher 10-unit minimum is enforced). The order-row creation later
  //    reuses these same values. ────────────────────────────────────────────────
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

  // ── Repeat-customer check (server-authoritative) ──────────────────────────────
  //    A company is a "confirmed repeat customer" once it has ≥1 prior order in a
  //    PAID/CONFIRMED state. das_orders status vocabulary (see api/admin-orders.js):
  //      payment_pending, pending, in_review, shipping_quote_required,
  //      confirmed, in_production, shipped, delivered, completed, cancelled, issue.
  //    We fail SAFE toward the higher minimum: only an explicit allow-list of
  //    states that mean "this order was actually paid for / is being fulfilled"
  //    counts. Drafts (payment_pending), cancelled, and ambiguous pre-payment
  //    states (pending / in_review / shipping_quote_required / issue) do NOT count.
  const PAID_ORDER_STATUSES = ['confirmed', 'in_production', 'shipped', 'delivered', 'completed'];
  async function companyHasPriorOrder(companyId) {
    if (!companyId) return false;
    try {
      const svc = getServiceClient();
      const { data, error } = await svc.from('das_orders')
        .select('id')
        .eq('company_id', companyId)
        .in('status', PAID_ORDER_STATUSES)
        .limit(1);
      if (error) {
        console.error('[create-checkout] repeat-customer check failed:', error.message);
        return false;   // fail safe → treated as first order (higher minimum)
      }
      return Array.isArray(data) && data.length > 0;
    } catch (e) {
      console.error('[create-checkout] repeat-customer check error:', e && e.message);
      return false;     // fail safe → first order
    }
  }
  const isRepeatCustomer = await companyHasPriorOrder(buyerCompanyId);

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

  // Milestone-level labels for milestone-select kits (level doesn't affect price; it MUST
  // reach fulfillment). Validated server-side, then baked into the line-item name + metadata.
  const MS_LABELS = { '250k':'250,000', '500k':'500,000', '1m':'1 Million', '2m':'2 Million', '3m':'3 Million', '4m':'4 Million', '5m':'5 Million', '6m':'6 Million' };
  // Kit-configuration allowlist (milestone-select kits). Flat-priced — these only
  // change how the keepsake is finished, never the line price. Server-side allowlist
  // mirrors product.html kitConfigOptions; unknown keys are ignored (price-safe).
  const KIT_CONFIG = {
    'standard':         'Standard Kit',
    'custom-tag':       'Customized Driver Luggage Tag',
    'tag-medal-insert': 'Luggage Tag with Engraved Medal Insert',
    'one-pin':          'Single Premium Lapel Pin',
    'two-pins':         'Two Premium Lapel Pins',
  };

  const priced = [];
  for (const item of items) {
    const name = String(item && item.name ? item.name : '').trim().slice(0, 200);
    if (!name) return res.status(400).json({ error: 'Invalid item data (missing name).' });

    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty <= 0 || qty > MAX_QTY) {
      return res.status(400).json({ error: `Invalid quantity for "${name}".` });
    }

    // Block products flagged not-yet-available / out of stock (e.g. seasonal Holiday set).
    const known = Catalog.lookup(item.id);
    if (known && known.unavailable) {
      return res.status(400).json({ error: `"${name}" is not available for purchase right now.` });
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

    // ── First-order minimum vs repeat-customer per-hire minimum ──────────────
    //    Per-hire products (catalog `perHire:true`, e.g. das-007 Welcome Kit) may
    //    be ordered as few as PER_HIRE_REPEAT_MIN (1) by a CONFIRMED repeat
    //    customer — one kit per new hire. Everyone else (first-time buyers, guests,
    //    not-signed-in, no company, no prior paid order) keeps the catalog minimum
    //    (10). Non-per-hire products are never lowered. Fail-safe: if repeat status
    //    is unknown we already defaulted isRepeatCustomer=false → higher minimum.
    let effectiveMin = minQty;
    if (isRepeatCustomer && Catalog.isPerHire(item.id)) {
      effectiveMin = Math.min(minQty, Catalog.PER_HIRE_REPEAT_MIN || 1);
    }

    if (qty < effectiveMin) {
      return res.status(400).json({ error: `Minimum order for "${name}" is ${effectiveMin} units.` });
    }

    // ── Milestone-select kits (milestone-kit / safe-miles-kit) ──────────────
    //    The buyer chose a milestone LEVEL. It is flat-priced ($179) so it does not
    //    touch the price authority, but it MUST be carried to fulfillment. Validate the
    //    key, build a clean label, and append it to the line-item display name so it
    //    surfaces in Stripe, the order record, the confirmation email, admin, and the
    //    fulfillment view. Required for these products (can't ship an unspecified level).
    let displayName = name, milestoneKey = null, milestoneLabel = null;
    if (known && known.milestoneSelect) {
      const mk = String(item.milestone || '').toLowerCase().trim();
      if (!MS_LABELS[mk]) {
        return res.status(400).json({ error: `Please select a milestone level for "${name}".` });
      }
      milestoneKey   = mk;
      milestoneLabel = MS_LABELS[mk] + (known.safeMiles ? ' Safe Miles' : ' Miles');
      displayName    = `${name} — Selected Milestone: ${milestoneLabel}`;
    }

    // ── Kit configuration (milestone-select kits) ───────────────────────────
    //    Buyer chose how the keepsake pieces are finished. Flat-priced (no upcharge),
    //    so it never touches the price authority — but it MUST reach fulfillment.
    //    "Standard" is the default and adds nothing to the display name.
    let kitConfigKey = null, kitConfigLabel = null;
    if (known && known.milestoneSelect && item.kitConfig) {
      const ck = String(item.kitConfig).toLowerCase().trim();
      if (KIT_CONFIG[ck] && ck !== 'standard') {
        kitConfigKey   = ck;
        kitConfigLabel = KIT_CONFIG[ck];
        displayName   += ` · ${kitConfigLabel}`;
      }
    }

    priced.push({
      id:       item.id || '',
      name:     displayName,
      qty,
      unitPrice,
      minQty:   effectiveMin,   // the minimum that was actually enforced for this buyer
      image:    item.image    || null,
      category: item.category || '',
      milestoneKey,
      milestoneLabel,
      kitConfigKey,
      kitConfigLabel,
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
            ...(item.milestoneKey ? { milestone: item.milestoneKey, milestone_label: item.milestoneLabel } : {}),
            ...(item.kitConfigKey ? { kit_config: item.kitConfigKey, kit_config_label: item.kitConfigLabel } : {}),
          },
        },
        unit_amount: Math.round(item.unitPrice * 100),
      },
      quantity: item.qty,
    }));

    // Premium Guarantee upsell removed (2026-06-05) — no longer offered at checkout.

    // ── Custom-branded products (e.g. Welcome Driver Appreciation Kit, das-007) ──
    //    flagged `customization:true` in lib/catalog. When the cart contains one,
    //    expose an OPTIONAL "Customization notes" field at checkout so the buyer
    //    can volunteer logo/brand/messaging details up front. A DAS rep still
    //    follows up by email/phone after purchase regardless of what's entered.
    const hasCustomization = priced.some(it => {
      const k = Catalog.lookup(it.id);
      return k && k.customization;
    });

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
        name:        'Bundle Discount 15% off',   // Stripe coupon name max = 40 chars
      });
      discountsArg = [{ coupon: coupon.id }];
    }

    const siteUrl = (process.env.SITE_URL || 'https://driverappreciationsolutions.com').replace(/\/$/, '');

    // Authenticated buyer (buyerUserId / buyerCompanyId) was resolved up-front so
    // the order links to their company/portal. Guests (null) fall through to the
    // webhook's email-match path (backstop), so the storefront works without login.

    // ── FREE SHIPPING — site-wide (2026-06-05). All products ship free; $0 shipping line. ──
    const totalQty = priced.reduce((s, it) => s + it.qty, 0);
    const shippingCents = 0;
    const shippingLabel = 'Free shipping';

    const sessionConfig = {
      line_items,
      mode:                       'payment',
      // The checkout.session.completed webhook already records this order. Flag the
      // PaymentIntent so the payment_intent.succeeded handler skips it (no duplicate order row).
      payment_intent_data:        { metadata: { skip_pi_handler: 'true' } },
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
      custom_text: {
        submit: {
          message: hasCustomization
            ? 'Orders ship within 3–5 business days. A DAS representative will email or call you to finalize your branding — or email artwork to info@driverappreciationsolutions.com.'
            : (isRepeatCustomer
                ? 'Orders ship within 3–5 business days. Reorders of per-hire kits can be as few as 1 unit.'
                : 'Orders ship within 3–5 business days. First orders require a 10-unit minimum per product.'),
        },
      },
      metadata: {
        order_source:      'das-website-cart',
        item_count:        String(items.length),
        total_qty:         String(totalQty),
        shipping_charged:  String(shippingCents),
        bundle_applied:    bundleApplies ? '1' : '0',
      },
    };

    // Optional "Customization notes" field for custom-branded kits (das-007 etc.).
    // Stripe stores the entry on the session; the webhook/order can surface it to the rep.
    if (hasCustomization) {
      sessionConfig.custom_fields = [
        {
          key: 'customization_notes',
          // Stripe caps custom_fields label.custom at 50 chars — keep it short or the API 500s.
          label: { type: 'custom', custom: 'Customization notes (logo, colors, message)' },
          type: 'text',
          optional: true,
          text: { maximum_length: 255 },
        },
      ];
    }

    // Apply bundle discount coupon if eligible (15% off entire order).
    // NOTE: Stripe forbids combining `discounts` with `allow_promotion_codes`
    // in the same session — set only one. Auto bundle discount wins; otherwise
    // let the buyer enter a promo code.
    if (discountsArg) sessionConfig.discounts = discountsArg;
    else              sessionConfig.allow_promotion_codes = true;

    // ── Authenticated buyer → create the order row UP-FRONT (status
    //    payment_pending) so it appears in their portal immediately and the
    //    success page / webhook only needs to flip it to confirmed. Mirrors
    //    the proven recognition-order flow. Money figures match what Stripe
    //    will charge so the portal total is correct. ───────────────────────
    let createdOrderId = null;
    if (buyerCompanyId) {
      const goodsCents     = priced.reduce((s, it) => s + Math.round(it.unitPrice * 100) * it.qty, 0);
      const discountCents  = bundleApplies ? Math.round(goodsCents * 0.15) : 0;
      const subtotalCents  = goodsCents - discountCents;   // goods after discount, pre-shipping
      const totalCents     = subtotalCents + shippingCents;

      const orderItems = priced.map(it => ({ name: it.name, qty: it.qty, unit_price: it.unitPrice, sku: it.id || null }));

      const datePart    = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randPart    = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `DAS-${datePart}-${randPart}`;
      const noteParts   = [
        bundleApplies ? `Bundle discount 15% (−$${(discountCents / 100).toFixed(2)})` : null,
      ].filter(Boolean);

      const orderFields = {
        company_id:           buyerCompanyId,
        items:                orderItems,
        subtotal:             Math.round(subtotalCents) / 100,
        shipping_cost:        Math.round(shippingCents) / 100,
        total:                Math.round(totalCents) / 100,
        status:               'payment_pending',
        fulfillment_type:     'single_address',
        delivery_count:       1,
        submitted_by_user_id: buyerUserId,
        notes:                noteParts.join(' | ') || null,
      };

      try {
        const svc = getServiceClient();

        // Reuse the buyer's existing unpaid store-cart draft (if any) instead
        // of creating a new row on every checkout click. This keeps at most
        // ONE payment_pending order per buyer — abandoned checkouts update the
        // same draft rather than piling up. Recognition orders (recognition_track
        // set) are never touched here.
        const { data: draft } = await svc.from('das_orders')
          .select('id')
          .eq('company_id', buyerCompanyId)
          .eq('status', 'payment_pending')
          .is('recognition_track', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        let order, opErr;
        if (draft && draft.id) {
          ({ data: order, error: opErr } = await svc.from('das_orders')
            .update({ ...orderFields, updated_at: new Date().toISOString() })
            .eq('id', draft.id)
            .select('id').single());
        } else {
          ({ data: order, error: opErr } = await svc.from('das_orders')
            .insert({ ...orderFields, order_number: orderNumber })
            .select('id').single());
        }

        if (opErr) {
          console.error('[create-checkout] up-front order upsert failed:', opErr.message);
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
