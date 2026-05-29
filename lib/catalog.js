/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Public storefront catalog — server-side price authority (UMD).

   The public store (shop.html, product.html, index.html) is static, hardcoded
   HTML. This module is the SERVER-SIDE MIRROR of those product base prices so the
   checkout endpoint can verify the price the browser sends instead of trusting it.
   (A tampered request could otherwise set any unit price ≥ $0.50.)

   ── KEEP IN SYNC with shop.html / product.html ──
   `basePrice` is the standard (×1.0) tier. The three kit tiers are derived by the
   shared multipliers in lib/recognition-pricing.js (standard 1.0 / premium 1.45 /
   enterprise 1.95) — the SAME numbers product.html uses (TIER_MULTS / data-mult).

   Cart item id forms this resolves:
     - "das-001"            → shop / index card (standard price)
     - "das-001-premium"    → product.html PDP (base × tier multiplier)
     - <uuid> (+ sku)       → Frequently-Bought-Together / Supabase items (unknown here)

   resolve(item) returns one of:
     { status: 'verified', unitPrice }  → known product, price matches a real tier; use unitPrice
     { status: 'rejected', reason }     → known product, price does NOT match any tier (tampered)
     { status: 'unknown' }              → not a static catalog product; caller sanity-checks + passes through
   ============================================= */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./recognition-pricing.js'));
  } else {
    root.DASCatalog = factory(root.DASRecognitionPricing);
  }
}(typeof self !== 'undefined' ? self : this, function (Pricing) {

  // Tier multipliers — single source of truth shared with the recognition engine.
  var MULTIPLIERS = (Pricing && Pricing.KIT_MULTIPLIERS) || { standard: 1.0, premium: 1.45, enterprise: 1.95 };

  // Standard (×1.0) base prices. MUST match shop.html / product.html.
  var BASE_PRODUCTS = {
    'das-001': { name: 'Driver Appreciation Kit',     basePrice: 49.99, minQty: 10 },
    'das-002': { name: 'Safety Recognition Kit',      basePrice: 44.99, minQty: 10 },
    'das-003': { name: 'Premium Onboarding Pack',     basePrice: 59.99, minQty: 10 },
    'das-004': { name: 'Holiday Gift Set',            basePrice: 54.99, minQty: 10 },
    'das-005': { name: 'Service Milestone Award Box', basePrice: 79.99, minQty: 10 },
  };

  function round2(n) { return Math.round(Number(n) * 100) / 100; }

  // Strip an optional -standard/-premium/-enterprise tier suffix to get the base id.
  function baseId(id) {
    return String(id == null ? '' : id).replace(/-(standard|premium|enterprise)$/, '');
  }

  function lookup(id) {
    return BASE_PRODUCTS[baseId(id)] || null;
  }

  // The set of legitimate unit prices for a base price, one per tier, rounded to cents.
  function allowedPrices(basePrice) {
    var out = [];
    for (var k in MULTIPLIERS) {
      if (Object.prototype.hasOwnProperty.call(MULTIPLIERS, k)) out.push(round2(basePrice * MULTIPLIERS[k]));
    }
    return out;
  }

  function resolve(item) {
    item = item || {};
    var known = lookup(item.id);
    if (!known) return { status: 'unknown' };

    var clientPrice = Number(item.price);
    var allowed = allowedPrices(known.basePrice);
    for (var i = 0; i < allowed.length; i++) {
      // Tolerance ~1 cent absorbs floating-point / rounding differences.
      if (Math.abs(allowed[i] - clientPrice) < 0.011) {
        return { status: 'verified', unitPrice: allowed[i], minQty: known.minQty, name: known.name };
      }
    }
    return { status: 'rejected', reason: 'price_mismatch', allowed: allowed, minQty: known.minQty };
  }

  return {
    BASE_PRODUCTS: BASE_PRODUCTS,
    MULTIPLIERS: MULTIPLIERS,
    lookup: lookup,
    allowedPrices: allowedPrices,
    resolve: resolve,
  };
}));
