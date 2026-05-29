/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Carrier-rate aggregator (UMD — browser + Node).

   PLACEHOLDER. Today every adapter returns `{ kind: 'unavailable' }`, so DAS uses
   the flat-rate rule engine in lib/shipping.js. This file is the clean seam for
   wiring live carrier APIs later (FedEx / UPS / USPS / Shippo / ShipStation / EasyPost).

   When a carrier is wired:
     1. Its adapter starts returning `{ kind: 'ok', quotes: [...] }`.
     2. `getRecommendedRate()` picks the cheapest available quote.
     3. shipping.js calculateShippingWithCarrier() automatically prefers it.

   Each adapter is configured by env credentials (isConfigured). With none present,
   configuredCarriers() returns [] and the flat-rate floor stays in force.

   Ported from das-portal/src/lib/shipping/carriers/.
   ============================================= */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DASCarriers = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  var env = (typeof process !== 'undefined' && process.env) ? process.env : {};

  // Each adapter: { name, isConfigured(), getRates(req) -> Promise<RateResponse> }.
  // Stub adapters report not_implemented and never claim to be configured until
  // their credentials AND a real HTTP call are added.
  function stubAdapter(name, configEnvKeys) {
    return {
      name: name,
      isConfigured: function () {
        // True only when ALL required credential env vars are present.
        for (var i = 0; i < configEnvKeys.length; i++) {
          if (!env[configEnvKeys[i]]) return false;
        }
        // Even with creds, the HTTP call isn't implemented yet — stay unavailable.
        return false;
      },
      getRates: function () {
        return Promise.resolve({ kind: 'unavailable', reason: 'not_implemented' });
      },
    };
  }

  var fedex       = stubAdapter('fedex',       ['FEDEX_API_KEY', 'FEDEX_API_SECRET', 'FEDEX_ACCOUNT_NUMBER']);
  var ups         = stubAdapter('ups',         ['UPS_CLIENT_ID', 'UPS_CLIENT_SECRET', 'UPS_ACCOUNT_NUMBER']);
  var usps        = stubAdapter('usps',        ['USPS_CLIENT_ID', 'USPS_CLIENT_SECRET']);
  var shippo      = stubAdapter('shippo',      ['SHIPPO_API_TOKEN']);
  var shipstation = stubAdapter('shipstation', ['SHIPSTATION_API_KEY', 'SHIPSTATION_API_SECRET']);
  var easypost    = stubAdapter('easypost',    ['EASYPOST_API_KEY']);

  var CARRIERS = [fedex, ups, usps, shippo, shipstation, easypost];

  function configuredCarriers() {
    return CARRIERS.filter(function (c) { return c.isConfigured(); });
  }

  function getRecommendedRate(req) {
    var adapters = configuredCarriers();
    if (adapters.length === 0) return Promise.resolve(null);

    return Promise.all(adapters.map(function (a) {
      return a.getRates(req).then(
        function (v) { return v; },
        function () { return { kind: 'error', message: 'adapter threw' }; }
      );
    })).then(function (results) {
      var allQuotes = [];
      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        if (r && r.kind === 'ok' && r.quotes) allQuotes = allQuotes.concat(r.quotes);
      }
      if (allQuotes.length === 0) return null;
      return allQuotes.reduce(function (cheapest, q) {
        return q.amount < cheapest.amount ? q : cheapest;
      }, allQuotes[0]);
    });
  }

  return {
    CARRIERS: CARRIERS,
    configuredCarriers: configuredCarriers,
    getRecommendedRate: getRecommendedRate,
  };
}));
