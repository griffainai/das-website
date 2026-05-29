/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Shipping rule engine (UMD — browser + Node).

   Two fulfillment modes:
     - single_address: all kits ship to one company address. Quantity-tiered flat rates.
     - multi_address:  each recipient gets their own delivery ($20/each, CSV bulk upload).

   A "quote required" result means the admin can still submit the order, but the final
   shipping number is pending DAS review. This guards DAS against undercharging on bulk
   or bulky orders before live carrier APIs are wired in (FedEx/UPS/USPS/Shippo/etc.).

   Rates are launch defaults sitting roughly at break-even for ~$15/kit ship cost.
   Once a carrier API is wired (see lib/carriers.js), the carrier-aware path replaces
   the flat estimate; the quote-required thresholds stay as guardrails.

   Ported from das-portal/src/lib/shipping.ts.
   ============================================= */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('./carriers.js'));
  } else {
    root.DASShipping = factory(root.DASCarriers);
  }
}(typeof self !== 'undefined' ? self : this, function (Carriers) {

  Carriers = Carriers || {};

  // ─── Tunable launch rules ───────────────────────────────────────────────────
  var SHIPPING_RULES = {
    // Multi-address (CSV) fulfillment: charged per recipient regardless of contents.
    multiAddressPerRecipient: 20,

    // Single-address flat-rate tiers (self-serve up to 499).
    //   1–10    flat $25    11–24   flat $75    25–49   flat $150
    //   50–99   flat $275   100–249 flat $525   250–499 flat $950
    //   500+    quote required (true LTL / freight territory)
    singleAddressTiers: [
      { minQty: 1,   maxQty: 10,  flatRate: 25  },
      { minQty: 11,  maxQty: 24,  flatRate: 75  },
      { minQty: 25,  maxQty: 49,  flatRate: 150 },
      { minQty: 50,  maxQty: 99,  flatRate: 275 },
      { minQty: 100, maxQty: 249, flatRate: 525 },
      { minQty: 250, maxQty: 499, flatRate: 950 },
    ],

    // Single-address quote thresholds (inclusive lower bound). 500+ → manual review.
    quoteThresholds: { standard: 500, large: 500, manual: 500 },
  };

  // ─── Public API ─────────────────────────────────────────────────────────────
  function calculateShipping(input) {
    if (input.fulfillmentType === 'multi_address') return calculateMultiAddress(input);
    return calculateSingleAddress(input);
  }

  function totalItemQty(items) {
    return (items || []).reduce(function (sum, i) { return sum + (Number(i.qty) || 0); }, 0);
  }

  function hasManualQuoteFlag(items) {
    return (items || []).some(function (i) {
      return i.product && i.product.requires_manual_shipping_quote === true;
    });
  }

  // ─── Multi-address ────────────────────────────────────────────────────────────
  function calculateMultiAddress(input) {
    var recipients = Math.max(1, input.deliveryCount);
    var cost = SHIPPING_RULES.multiAddressPerRecipient * recipients;

    if (hasManualQuoteFlag(input.items)) {
      return {
        kind: 'quote_required',
        estimatedCost: cost,
        breakdown: 'Multi-address — ' + recipients + ' deliveries × $' +
          SHIPPING_RULES.multiAddressPerRecipient + '. Premium/bulky item requires DAS review.',
        requiresQuote: true,
        reason: 'product_flagged',
        adminMessage: 'One or more items in this order require DAS to confirm shipping & handling before fulfillment.',
      };
    }

    return {
      kind: 'calculated',
      cost: cost,
      breakdown: recipients + ' ' + (recipients === 1 ? 'delivery' : 'deliveries') + ' × $' +
        SHIPPING_RULES.multiAddressPerRecipient + ' (multi-address fulfillment)',
      requiresQuote: false,
    };
  }

  // ─── Single-address ───────────────────────────────────────────────────────────
  function calculateSingleAddress(input) {
    var qty = totalItemQty(input.items);

    if (hasManualQuoteFlag(input.items)) {
      return {
        kind: 'quote_required',
        estimatedCost: estimateSingleAddressFlat(qty),
        breakdown: 'Order contains a premium/bulky item that requires DAS shipping review.',
        requiresQuote: true,
        reason: 'product_flagged',
        adminMessage: 'One or more items in this order require DAS to confirm shipping & handling before fulfillment.',
      };
    }

    if (qty >= SHIPPING_RULES.quoteThresholds.manual) {
      return {
        kind: 'quote_required',
        estimatedCost: null,
        breakdown: 'Large bulk order (' + qty + ' items). Manual DAS review required before final payment or fulfillment.',
        requiresQuote: true,
        reason: 'manual_review_100',
        adminMessage: 'Your order exceeds standard shipping thresholds. DAS will review and contact you with final shipping & handling.',
      };
    }

    var flat = estimateSingleAddressFlat(qty);
    if (flat === null) {
      return { kind: 'calculated', cost: 0, breakdown: 'No items.', requiresQuote: false };
    }

    var tier = findTier(qty);
    return {
      kind: 'calculated',
      cost: flat,
      breakdown: tier
        ? qty + ' ' + (qty === 1 ? 'item' : 'items') + ' (' + tier.minQty + '–' + tier.maxQty + ' tier) — $' + flat + ' flat'
        : qty + ' ' + (qty === 1 ? 'item' : 'items') + ' — $' + flat + ' flat',
      requiresQuote: false,
    };
  }

  function findTier(qty) {
    for (var i = 0; i < SHIPPING_RULES.singleAddressTiers.length; i++) {
      var t = SHIPPING_RULES.singleAddressTiers[i];
      if (qty >= t.minQty && qty <= t.maxQty) return t;
    }
    return null;
  }

  function estimateSingleAddressFlat(qty) {
    if (qty <= 0) return null;
    var tier = findTier(qty);
    return tier ? tier.flatRate : null;
  }

  // ─── Live carrier rates (placeholder until carriers are configured) ───────────
  var HANDLING_MARKUP_PCT = 0.12;
  var MIN_HANDLING_USD = 2.50;
  var DEFAULT_KIT_WEIGHT_OZ = 48;
  var DEFAULT_KIT_LENGTH_IN = 12;
  var DEFAULT_KIT_WIDTH_IN = 10;
  var DEFAULT_KIT_HEIGHT_IN = 6;

  function getShipFromAddress() {
    var env = (typeof process !== 'undefined' && process.env) ? process.env : {};
    var street_1 = env.SHIP_FROM_STREET_1;
    var city = env.SHIP_FROM_CITY;
    var state = env.SHIP_FROM_STATE;
    var zip = env.SHIP_FROM_ZIP;
    if (!street_1 || !city || !state || !zip) return null;
    return {
      name: env.SHIP_FROM_NAME || 'Driver Appreciation Solutions',
      street_1: street_1,
      street_2: env.SHIP_FROM_STREET_2 || null,
      city: city,
      state: state,
      zip: zip,
      country: env.SHIP_FROM_COUNTRY || 'US',
    };
  }

  function aggregatePackage(items) {
    var weight_oz = 0;
    var length_in = DEFAULT_KIT_LENGTH_IN;
    var width_in = DEFAULT_KIT_WIDTH_IN;
    var height_in = DEFAULT_KIT_HEIGHT_IN;
    for (var idx = 0; idx < items.length; idx++) {
      var i = items[idx];
      if (i.qty <= 0) continue;
      var p = i.product || {};
      var w = p.package_weight_oz != null ? p.package_weight_oz : DEFAULT_KIT_WEIGHT_OZ;
      weight_oz += Number(w) * i.qty;
      length_in = Math.max(length_in, Number(p.package_length_in != null ? p.package_length_in : DEFAULT_KIT_LENGTH_IN));
      width_in = Math.max(width_in, Number(p.package_width_in != null ? p.package_width_in : DEFAULT_KIT_WIDTH_IN));
      height_in = Math.max(height_in, Number(p.package_height_in != null ? p.package_height_in : DEFAULT_KIT_HEIGHT_IN));
    }
    if (weight_oz <= 0) return null;
    return { weight_oz: weight_oz, length_in: length_in, width_in: width_in, height_in: height_in };
  }

  function applyHandlingMarkup(rate) {
    var withMarkup = rate * (1 + HANDLING_MARKUP_PCT);
    var handling = withMarkup - rate;
    return rate + Math.max(handling, MIN_HANDLING_USD);
  }

  /**
   * Carrier-aware calculator. Falls through to the sync flat-rate engine when no
   * carrier is configured, multi-address, quote-required threshold, or manual flag.
   * Currently all carriers return "unavailable" (lib/carriers.js stubs), so this
   * always falls back to flat rates — wired for the future, safe today.
   */
  function calculateShippingWithCarrier(input, destination) {
    if (input.fulfillmentType === 'multi_address') return Promise.resolve(calculateShipping(input));
    if (hasManualQuoteFlag(input.items)) return Promise.resolve(calculateShipping(input));

    var qty = totalItemQty(input.items);
    if (qty >= SHIPPING_RULES.quoteThresholds.standard) return Promise.resolve(calculateShipping(input));

    var configured = (typeof Carriers.configuredCarriers === 'function') ? Carriers.configuredCarriers() : [];
    if (!configured || configured.length === 0) return Promise.resolve(calculateShipping(input));

    var origin = getShipFromAddress();
    if (!origin) return Promise.resolve(calculateShipping(input));

    var parcel = aggregatePackage(input.items);
    if (!parcel) return Promise.resolve(calculateShipping(input));

    return Promise.resolve(
      Carriers.getRecommendedRate({ from: origin, to: destination, packages: [parcel] })
    ).then(function (quote) {
      if (!quote) return calculateShipping(input);
      var cost = Math.round(applyHandlingMarkup(quote.amount) * 100) / 100;
      return {
        kind: 'calculated',
        cost: cost,
        breakdown: qty + ' ' + (qty === 1 ? 'item' : 'items') + ' via ' +
          String(quote.carrier).toUpperCase() + ' ' + quote.service + ' — $' +
          quote.amount.toFixed(2) + ' carrier rate + DAS handling',
        requiresQuote: false,
      };
    }).catch(function () {
      return calculateShipping(input);
    });
  }

  return {
    SHIPPING_RULES: SHIPPING_RULES,
    calculateShipping: calculateShipping,
    calculateShippingWithCarrier: calculateShippingWithCarrier,
    totalItemQty: totalItemQty,
    hasManualQuoteFlag: hasManualQuoteFlag,
    estimateSingleAddressFlat: estimateSingleAddressFlat,
    getShipFromAddress: getShipFromAddress,
  };
}));
