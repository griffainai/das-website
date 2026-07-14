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
    'das-003': { name: 'Premium Onboarding Pack',     basePrice: 59.99, minQty: 10 },
    'das-004': { name: 'Holiday Gift Set',            basePrice: 1.00,  minQty: 10 }, // TEMP: $1 live-payment test. REVERT: basePrice→54.99 + re-add `unavailable: true` (seasonal, Sept 21).
    // Volume-priced product: no tier multipliers — the unit price comes from
    // quantity breaks (corporate volume pricing). minQty 1 (sold individually at retail).
    // Flat $99 (E90 pricing update 2026-06-24 — was volume-tiered 64.95–79.95).
    'das-006': { name: 'Professional Driver Essentials Kit', basePrice: 99.00, minQty: 1, shippingIncluded: true },
    // Welcome Driver Appreciation Kit — custom-branded per-hire onboarding kit. Single price.
    // `customization:true` → checkout adds a "Customization notes" field + the rep coordinates artwork after purchase.
    // `perHire:true` → REPEAT customers (company with ≥1 prior paid order) may order as few as 1
    //   (one kit per new hire). FIRST-TIME buyers / guests still owe the 10-unit minimum.
    //   The number below (`minQty`) is the FIRST-ORDER minimum; the per-hire floor for repeats is 1.
    //   Server-authoritative: api/create-checkout.js reads `perHire` + the buyer's order history.
    'das-007': { name: 'Welcome Driver Appreciation Kit', basePrice: 229.00, minQty: 10, perHire: true, customization: true },
    // Driver Road Warrior Backpack™ — premium custom-logo backpack. Single price, min 1 (orderable
    // individually). `customization:true` → checkout adds a "Customization notes" field; the rep
    // coordinates the company logo after purchase.
    'das-008': { name: 'Driver Road Warrior Backpack', basePrice: 149.00, minQty: 10, customization: true },
    // Professional Driver Self-Care Kit™ (formerly Professional Travel Kit) — wellness/self-care bag + essentials. Single price, min 1.
    'das-009': { name: 'Professional Driver Self-Care Kit™', basePrice: 149.00, minQty: 1, customization: true },
    'das-010': { name: 'Professional Driver Road Warrior Duffel™', basePrice: 159.00, minQty: 10, customization: true },
    // E90 2026-06-24: Seat Back Organizer + Safe Driver Award are now PURCHASABLE.
    'das-011': { name: 'Professional Driver Seat Back Organizer™', basePrice: 149.00, minQty: 10, customization: true },
    // ── PREMIUM APPRECIATION KITS™ (D3, 2026-06-29) — recognition experiences, custom-branded.
    //    All >$110 so the pricing gate shows "Let's Plan Your Program"; prices live here for the
    //    quote/unlock path. customization:true → checkout adds the artwork-notes field.
    'road-ready-kit':         { name: 'The Road Ready™ Kit',         basePrice: 299.00, minQty: 1, customization: true },
    'safety-first-kit':       { name: 'The Safety First™ Kit',       basePrice: 299.00, minQty: 1, customization: true },
    'pride-in-your-ride-kit': { name: 'The Pride in Your Ride™ Kit', basePrice: 249.00, minQty: 1, customization: true },
    'long-haul-hydration-kit':{ name: 'The Long Haul Hydration™ Kit',basePrice: 199.00, minQty: 1, customization: true },
    'professional-driver-kit':{ name: 'The Professional Driver™ Kit',basePrice: 299.00, minQty: 1, customization: true },
    'command-center-kit':     { name: 'The Command Center™ Kit',     basePrice: 499.00, minQty: 1, customization: true },
    'working-hands-kit':      { name: 'The Working Hands™ Kit',      basePrice: 249.00, minQty: 1, customization: true },
    'highway-guardian-kit':   { name: 'The Highway Guardian™ Kit',   basePrice: 299.00, minQty: 1, customization: true },
    'dot-ready-kit':          { name: 'The DOT Ready™ Kit',          basePrice: 299.00, minQty: 1, customization: true },
    'clear-vision-kit':       { name: 'The Clear Vision™ Kit',       basePrice: 249.00, minQty: 1, customization: true },
    'recharge-kit':           { name: 'The Recharge™ Kit',           basePrice: 299.00, minQty: 1, customization: true },
    'safe-driver-award': { name: 'Safe Driver Award Program', basePrice: 549.00, minQty: 1 },
    'retirement-legacy-collection': { name: 'Professional Driver Retirement Legacy Collection™', basePrice: 649.00, minQty: 1 },
    // ── SAFE SERVICE MILES ACCESSORIES — everyday wearable/carry recognition items that
    //    complement the Safe Service Miles medals. Flat per-unit price, fleet bulk min 10.
    'ssm-lapel-pin':   { name: 'Safe Service Miles Lapel Pin', basePrice: 14.99, minQty: 10 },
    'ssm-luggage-tag': { name: 'Safe Service Miles Luggage Tag', basePrice: 79.99, minQty: 10, milestoneSelect: true, safeMiles: true },
    // ── MILESTONE RECOGNITION KITS — flat $179, buyer selects a milestone LEVEL (250k…6M).
    //    `milestoneSelect:true` → create-checkout validates item.milestone, appends a clean
    //    "Selected Milestone: …" label to the line-item name (so it shows in Stripe, the order
    //    record, emails, admin, and fulfillment) and stashes it in metadata. The level does NOT
    //    change price ($179 regardless). Two real products back an apparent 16+ -variant catalog;
    //    the "Featured 1 Million Mile" shop card routes here with 1M pre-selected (no 3rd product).
    'milestone-kit':  { name: 'Professional Driver Milestone Recognition Kit', basePrice: 499.00, minQty: 1, milestoneSelect: true },
    'safe-miles-kit': { name: 'Safe Miles Recognition Kit', basePrice: 549.00, minQty: 1, milestoneSelect: true, safeMiles: true },
  };

  // ── MILE PACKS — 23-kit recognition line. Single fixed price per kit by tier,
  //    min 10. Folded into BASE_PRODUCTS so checkout validates their prices.
  //    KEEP NAMES/PRICES in sync with js/mile-packs.js (front-end display data).
  var MILE_PACK_TIER_PRICE = { Essential: 49.99, Premium: 69.99, Signature: 89.99 };
  var MILE_PACKS_DEF = [
    ['mp-01','Road Warrior Fuel Pack','Premium'],      ['mp-02','Hydration & Hustle Kit','Premium'],
    ['mp-03','The Rookie Welcome Kit','Premium'],      ['mp-04','The Cab Comfort Kit','Signature'],
    ['mp-05','The Long Haul Snack Pack','Essential'],  ['mp-06','The Safety Star Pack','Signature'],
    ['mp-07','Midnight Munch Pack','Premium'],         ['mp-08','Freightliner Breakroom Bundle','Essential'],
    ['mp-09','Safe Miles Appreciation Pack','Premium'],['mp-10','Retirement Road Tribute','Signature'],
    ['mp-11','Iron Rig Recharge Box','Premium'],       ['mp-12','Reset Road Kit','Premium'],
    ['mp-13','Dispatch Desk Drop','Essential'],        ['mp-14','Night Dispatch Pack','Premium'],
    ['mp-15','Trainer Appreciation Kit','Signature'],  ['mp-16','Homestretch Kit','Premium'],
    ['mp-17','Family Appreciation Bundle','Premium'],  ['mp-18','Open Road Hydration & Fuel Kit','Premium'],
    ['mp-19','Executive Fleet Recognition Box','Signature'], ['mp-20','1 Million Miles Tribute','Signature'],
    ['mp-21','Road Shield Wellness Kit','Premium'],    ['mp-22','Cab Recovery Pack','Premium'],
    ['mp-23','Driver Health Essentials','Premium'],
  ];
  MILE_PACKS_DEF.forEach(function (m) {
    // MILE PACKS include free shipping → shippingIncluded:true (checkout charges $0 shipping).
    BASE_PRODUCTS[m[0]] = { name: m[1], basePrice: MILE_PACK_TIER_PRICE[m[2]], minQty: 10, tier: m[2], shippingIncluded: true };
  });

  // ── SERVICE MILESTONE AWARDS — medals (1M-6M) + early-career physical awards (250K/500K),
  //    across career + safe tracks. Single fixed price per item, min 1. Safe = higher prices.
  //    KEEP IN SYNC with js/milestones.js.
  // E90 2026-06-24 pricing (MUST match js/milestones.js): all medals (1M–6M, both tracks) flat $249;
  // Safe 250K/500K awards $649/$749; career 250K/500K awards unchanged.
  var MS_PRICE = {
    c: { '250k':29.99, '500k':39.99, '1m':249, '2m':249, '3m':249, '4m':249, '5m':249, '6m':249 },
    s: { '250k':649,   '500k':749,   '1m':249, '2m':249, '3m':249, '4m':249, '5m':249, '6m':249 },
  };
  var MS_WORD  = { '250k':'250,000', '500k':'500,000', '1m':'1 Million', '2m':'2 Million', '3m':'3 Million', '4m':'4 Million', '5m':'5 Million', '6m':'6 Million' };
  [['c','Service Miles'], ['s','Safe Service Miles']].forEach(function (t) {
    ['250k','500k','1m','2m','3m','4m','5m','6m'].forEach(function (mk) {
      var medal = (mk !== '250k' && mk !== '500k');
      BASE_PRODUCTS['msm-' + t[0] + '-' + mk] = {
        name: MS_WORD[mk] + ' ' + t[1] + (medal ? ' Medal' : ''),
        basePrice: MS_PRICE[t[0]][mk], minQty: 1, milestone: true,
      };
    });
  });

  // ── EXECUTIVE DRIVER RECOGNITION COLLECTION — purchasable upgrade on each SAFE milestone.
  //    Price = safe base + executive upgrade. Server-validated as msm-s-<mk>-exec (distinct id).
  //    KEEP IN SYNC with js/milestones.js EXEC map.
  //    500k is a special case: it offers a CHOICE of THREE gifts. Water Bottle (+$59) and
  //    Lunch Bag (+$179) are purchasable (msm-s-500k-exec-bottle / -lunchbag). The Food Jar
  //    option is "Pricing Coming Soon" → intentionally NOT registered, so the server rejects
  //    any attempt to purchase it. All other milestones map 1:1.
  // E90: exec total = safe base + upgrade → 250K $799, 1M $929, 2M $949, 3M–6M $999.
  var MS_EXEC_UPGRADE = { '250k':150, '1m':680, '2m':700, '3m':750, '4m':750, '5m':750, '6m':750 };
  ['250k','1m','2m','3m','4m','5m','6m'].forEach(function (mk) {
    BASE_PRODUCTS['msm-s-' + mk + '-exec'] = {
      name: MS_WORD[mk] + ' Safe Service Miles — Executive Collection',
      basePrice: Math.round((MS_PRICE.s[mk] + MS_EXEC_UPGRADE[mk]) * 100) / 100,
      minQty: 1, milestone: true,
    };
  });
  // 500k Safe Miles — Executive Collection: choose Water Bottle (+$59) or Lunch Bag (+$179).
  // (Food Jar option is Coming Soon — not purchasable — so it is deliberately omitted here.)
  [['bottle', 150, 'Premium YETI 32 oz Water Bottle'], ['lunchbag', 150, 'YETI Lunch Bag']].forEach(function (o) {
    BASE_PRODUCTS['msm-s-500k-exec-' + o[0]] = {
      name: MS_WORD['500k'] + ' Safe Service Miles — Executive Collection · ' + o[2],
      basePrice: Math.round((MS_PRICE.s['500k'] + o[1]) * 100) / 100,
      minQty: 1, milestone: true,
    };
  });

  function round2(n) { return Math.round(Number(n) * 100) / 100; }

  // Volume (quantity-break) pricing: return the unit price for a given quantity.
  // Quantities below the first tier fall back to the first (retail) tier price.
  function volumeUnitPrice(known, qty) {
    var tiers = known && known.volumeTiers;
    if (!tiers || !tiers.length) return null;
    qty = Number(qty) || 0;
    for (var i = 0; i < tiers.length; i++) {
      var t = tiers[i];
      if (qty >= t.min && (t.max == null || qty <= t.max)) return t.price;
    }
    return tiers[0].price;
  }

  // Strip an optional -standard/-premium/-enterprise tier suffix to get the base id.
  function baseId(id) {
    return String(id == null ? '' : id).replace(/-(standard|premium|enterprise)$/, '');
  }

  function lookup(id) {
    return BASE_PRODUCTS[baseId(id)] || null;
  }

  // Per-hire eligibility: products a confirmed REPEAT customer may order as few as 1 of
  // (one kit per new hire). Returns true only when the catalog product is flagged
  // `perHire:true`. First-time buyers / guests always get the product's normal minQty.
  // Keep this catalog-driven (never hardcode ids in the checkout endpoint).
  function isPerHire(id) {
    var k = lookup(id);
    return !!(k && k.perHire);
  }

  // The repeat-customer per-hire floor for a per-hire product (currently always 1).
  // Non-per-hire products are not affected by repeat status.
  var PER_HIRE_REPEAT_MIN = 1;

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

    // Volume-priced product: the server is authoritative — compute the unit price
    // from the requested quantity's tier and ignore whatever the client sent.
    if (known.volumeTiers) {
      var vunit = volumeUnitPrice(known, item.qty);
      return { status: 'verified', unitPrice: vunit, minQty: known.minQty || 1, name: known.name };
    }

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
    isPerHire: isPerHire,
    PER_HIRE_REPEAT_MIN: PER_HIRE_REPEAT_MIN,
    allowedPrices: allowedPrices,
    volumeUnitPrice: volumeUnitPrice,
    resolve: resolve,
  };
}));
