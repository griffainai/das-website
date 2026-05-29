/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Recognition tier → kit price mapping (UMD — browser + Node).

   The catalog already has three kit tiers driven by a price multiplier on each
   product's base price (see product.html):
       standard   ×1.00
       premium    ×1.45
       enterprise ×1.95

   The recognition engine recommends a recognition tier (tier_1..tier_4). This
   module lines those up with a catalog kit tier so a recommended recognition
   tier produces a concrete unit price from any product's base price:

       tier_1 (Essential)     → standard
       tier_2 (Professional)  → premium
       tier_3 (Elite)         → enterprise
       tier_4 (Legacy)        → enterprise

   This is the single editable default. The admin still picks the actual kit and
   can override the kit tier at order time. Adjust TIER_TO_KIT / KIT_MULTIPLIERS
   here and every caller follows.
   ============================================= */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DASRecognitionPricing = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  // Catalog kit-tier price multipliers (must match product.html tier-btn data-mult).
  var KIT_MULTIPLIERS = {
    standard:   1.00,
    premium:    1.45,
    enterprise: 1.95,
  };

  // Recognition tier → catalog kit tier. Single editable default.
  var TIER_TO_KIT = {
    tier_1: 'standard',
    tier_2: 'premium',
    tier_3: 'enterprise',
    tier_4: 'enterprise',
  };

  function kitTierForRecognitionTier(recognitionTier) {
    return TIER_TO_KIT[recognitionTier] || 'standard';
  }

  function multiplierForKitTier(kitTier) {
    var m = KIT_MULTIPLIERS[kitTier];
    return (typeof m === 'number') ? m : 1.00;
  }

  /**
   * Unit price for a product at a recommended recognition tier.
   * @param {string} recognitionTier  tier_1..tier_4
   * @param {number} basePrice        product's standard (×1.0) price in USD
   * @returns {number} unit price in USD, rounded to cents
   */
  function priceForRecognitionTier(recognitionTier, basePrice) {
    var kit = kitTierForRecognitionTier(recognitionTier);
    return priceForKitTier(kit, basePrice);
  }

  /**
   * Unit price for a product at an explicit catalog kit tier (admin override).
   * @param {string} kitTier   standard | premium | enterprise
   * @param {number} basePrice product's standard (×1.0) price in USD
   * @returns {number} unit price in USD, rounded to cents
   */
  function priceForKitTier(kitTier, basePrice) {
    var price = Number(basePrice) * multiplierForKitTier(kitTier);
    return Math.round(price * 100) / 100;
  }

  return {
    KIT_MULTIPLIERS: KIT_MULTIPLIERS,
    TIER_TO_KIT: TIER_TO_KIT,
    kitTierForRecognitionTier: kitTierForRecognitionTier,
    multiplierForKitTier: multiplierForKitTier,
    priceForRecognitionTier: priceForRecognitionTier,
    priceForKitTier: priceForKitTier,
  };
}));
