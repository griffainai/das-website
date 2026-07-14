/**
 * DAS marketing site — tracking initialization
 *
 * Loads Google Tag Manager + Meta Pixel + sets up an event API.
 *
 * ── How to activate ──
 *   1. Create a GTM container at https://tagmanager.google.com (free).
 *   2. Inside GTM, add tags for GA4 + Meta Pixel + any other pixels.
 *   3. Paste your GTM container ID below as GTM_CONTAINER_ID (format: 'GTM-XXXXXXX').
 *   4. Optionally paste your Meta Pixel ID directly as META_PIXEL_ID (skips the GTM hop).
 *   5. Redeploy.
 *
 *   Until then this script does no network IO — it just queues events to dataLayer
 *   so the moment a real container loads, the historical events are picked up.
 *
 * ── How to fire DAS events from page code ──
 *   window.dasTrack.viewItem({ sku, name, price, category })
 *   window.dasTrack.addToCart({ sku, name, price, qty })
 *   window.dasTrack.beginCheckout({ items: [...], total })
 *   window.dasTrack.purchase({ orderId, items: [...], total })
 *
 *   Each helper writes both to GA4-compatible dataLayer events AND to Meta's
 *   fbq() if the pixel is loaded. Safe to call when neither is configured.
 */

(function () {
  // ─── CONFIGURE THESE ────────────────────────────────────────────────────────
  // Replace with real IDs when accounts exist. Empty string = pixel not loaded.
  var GTM_CONTAINER_ID = ''; // e.g. 'GTM-XXXXXXX'
  var META_PIXEL_ID    = ''; // e.g. '1234567890123456'

  // Google Ads (Starbridge Holdings account 917-415-8774) — conversion tracking.
  // Labels come from Goals → Conversions → each action's event snippet.
  var GOOGLE_ADS_ID = 'AW-18300085783';
  var ADS_LABELS = {
    purchase:   'seB1COWsnsscEJfMlJZE', // Purchase — dynamic value, count Every
    lead:       'UI2iCOisnsscEJfMlJZE', // Quote Request — $150 fixed in Ads, count One
    calculator: '0Y8vCOusnsscEJfMlJZE', // calculator_complete — $25 fixed in Ads, count One
  };

  // ─── DataLayer (works without any container — events queue) ─────────────────
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

  // ─── Google Ads gtag loader ─────────────────────────────────────────────────
  if (GOOGLE_ADS_ID) {
    var adsScript = document.createElement('script');
    adsScript.async = true;
    adsScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_ADS_ID;
    var ref = document.getElementsByTagName('script')[0];
    if (ref && ref.parentNode) { ref.parentNode.insertBefore(adsScript, ref); }
    else { document.head.appendChild(adsScript); }
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GOOGLE_ADS_ID);
  }

  // Fire a Google Ads conversion by label. Safe no-op when Ads isn't configured.
  function adsConvert(label, params) {
    if (!GOOGLE_ADS_ID || !label || !window.gtag) return;
    var payload = { send_to: GOOGLE_ADS_ID + '/' + label };
    if (params) { for (var k in params) { if (params[k] != null) payload[k] = params[k]; } }
    window.gtag('event', 'conversion', payload);
  }

  // ─── GTM loader (only if container ID set) ──────────────────────────────────
  if (GTM_CONTAINER_ID) {
    var firstScript = document.getElementsByTagName('script')[0];
    var gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_CONTAINER_ID;
    firstScript.parentNode.insertBefore(gtmScript, firstScript);
  }

  // ─── Meta Pixel loader (only if pixel ID set) ───────────────────────────────
  if (META_PIXEL_ID) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', META_PIXEL_ID);
    window.fbq('track', 'PageView');
  }

  // ─── DAS event API ──────────────────────────────────────────────────────────
  // Pages call these — handlers fan out to GA4 (via dataLayer) and Meta.
  var fbq = function () { if (window.fbq) window.fbq.apply(window, arguments); };

  window.dasTrack = {
    viewItem: function (product) {
      if (!product) return;
      window.dataLayer.push({
        event: 'view_item',
        ecommerce: { items: [{ item_id: product.sku, item_name: product.name, price: product.price, item_category: product.category }] },
      });
      fbq('track', 'ViewContent', { content_ids: [product.sku], value: product.price, currency: 'USD' });
    },

    addToCart: function (product) {
      if (!product) return;
      window.dataLayer.push({
        event: 'add_to_cart',
        ecommerce: { items: [{ item_id: product.sku, item_name: product.name, price: product.price, quantity: product.qty || 1 }] },
      });
      fbq('track', 'AddToCart', { content_ids: [product.sku], value: (product.price || 0) * (product.qty || 1), currency: 'USD' });
    },

    beginCheckout: function (data) {
      if (!data) return;
      window.dataLayer.push({
        event: 'begin_checkout',
        ecommerce: { value: data.total, items: data.items || [] },
      });
      fbq('track', 'InitiateCheckout', { value: data.total, currency: 'USD', num_items: (data.items || []).length });
    },

    purchase: function (data) {
      if (!data) return;
      window.dataLayer.push({
        event: 'purchase',
        ecommerce: { transaction_id: data.orderId, value: data.total, items: data.items || [] },
      });
      adsConvert(ADS_LABELS.purchase, {
        value: Number(data.total) || 0,
        currency: 'USD',
        transaction_id: data.orderId || '',
      });
      fbq('track', 'Purchase', { value: data.total, currency: 'USD' });
    },

    lead: function (data) {
      // Quote requests / cart-save / exit-intent / newsletter signup
      window.dataLayer.push({ event: 'lead', email: data && data.email });
      adsConvert(ADS_LABELS.lead); // value fixed at $150 in Google Ads
      fbq('track', 'Lead');
    },

    calculatorComplete: function () {
      // Turnover calculator engagement — fires once per page view.
      if (window.__dasCalcFired) return;
      window.__dasCalcFired = true;
      window.dataLayer.push({ event: 'calculator_complete' });
      adsConvert(ADS_LABELS.calculator); // value fixed at $25 in Google Ads
      fbq('trackCustom', 'CalculatorComplete');
    },
  };
})();
