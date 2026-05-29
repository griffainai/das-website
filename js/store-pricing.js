/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Storefront price sync — single source of truth.

   The price for each product lives in ONE place: lib/catalog.js (the same file the
   checkout endpoint uses as its price authority). On load, this script overwrites every
   product card's price FROM that catalog, so the displayed price and the
   data-product-price the cart reads always match what checkout will accept.

   The prices hardcoded in the HTML are only a no-flash fallback if this script doesn't
   run; they are never authoritative (api/create-checkout re-checks against lib/catalog).

   Requires /lib/catalog.js (window.DASCatalog) to be loaded BEFORE this file.
   ============================================= */
(function () {
  'use strict';

  function money(n) {
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function sync() {
    var C = window.DASCatalog;
    if (!C || typeof C.lookup !== 'function') return;   // catalog not loaded — keep HTML fallback

    var cards = document.querySelectorAll('[data-product-id]');
    var synced = 0;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var prod = C.lookup(card.getAttribute('data-product-id'));
      if (!prod || typeof prod.basePrice !== 'number') continue;   // unknown id — leave as-is

      // The value the cart reads on add-to-cart.
      card.setAttribute('data-product-price', prod.basePrice.toFixed(2));
      // The value the shopper sees.
      var amt = card.querySelector('.product-price-amount');
      if (amt) amt.textContent = money(prod.basePrice);
      synced++;
    }
    // Marker for QA / debugging: how many cards were priced from the catalog.
    document.documentElement.setAttribute('data-pricing-synced', String(synced));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
})();
