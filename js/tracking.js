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

  // ─── DataLayer (works without any container — events queue) ─────────────────
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });

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
      fbq('track', 'Purchase', { value: data.total, currency: 'USD' });
    },

    lead: function (data) {
      // Used by cart-save / exit-intent / newsletter signup
      window.dataLayer.push({ event: 'lead', email: data && data.email });
      fbq('track', 'Lead');
    },
  };
})();
