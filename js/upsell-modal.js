/* =============================================
   DAS — Add-to-cart upsell modal (public site)
   Fires after [data-add-to-cart] adds an item. Shows a single
   personalized cross-sell at 10% off with a 1-click add CTA.
   ============================================= */

(function () {
  'use strict';

  const MODAL_ID = 'das-upsell-modal';
  const SESSION_LOCK = 'das_upsell_modal_session_lock'; // dedupe per session — show at most once per page-load
  const UPSELL_DISCOUNT_PCT = 0.10;

  function fmtMoney(n) {
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function fetchUpsell(triggerSku) {
    if (!triggerSku) return null;
    try {
      const res = await fetch('/api/upsell-rules?placement=cart_modal&triggerSku=' + encodeURIComponent(triggerSku));
      if (!res.ok) return null;
      const data = await res.json();
      if (!Array.isArray(data.rules) || data.rules.length === 0) return null;
      // Pick the top-priority rule whose upsell_product isn't already in the cart.
      const cart    = (window.Cart && window.Cart.get()) || [];
      const inCart  = new Set(cart.map(function (c) { return c.id; }));
      for (let i = 0; i < data.rules.length; i++) {
        const r = data.rules[i];
        const p = r.upsell_product;
        if (p && p.id && !inCart.has(p.id)) return { rule: r, product: p };
      }
      return null;
    } catch (err) {
      console.warn('[upsell-modal] fetch failed', err);
      return null;
    }
  }

  function inject(rule, product, addedName) {
    // Remove any prior modal (safety)
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    const discountedPrice = Math.round(product.price * (1 - UPSELL_DISCOUNT_PCT) * 100) / 100;
    const savings         = Math.round((product.price - discountedPrice) * 100) / 100;

    const overlay = document.createElement('div');
    overlay.id    = MODAL_ID;
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = ''
      + '<div style="background:#fff;width:100%;max-width:420px;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.25);margin:16px">'
      +   '<div style="background:#ECFDF5;border-bottom:1px solid #D1FAE5;padding:14px 20px;display:flex;align-items:center;gap:10px">'
      +     '<span style="width:28px;height:28px;border-radius:50%;background:#D1FAE5;color:#059669;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">✓</span>'
      +     '<div style="flex:1;min-width:0">'
      +       '<p style="margin:0;font-size:13px;font-weight:700;color:#065F46">Added to cart</p>'
      +       '<p style="margin:0;font-size:11px;color:#059669;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(addedName) + '</p>'
      +     '</div>'
      +     '<button data-close style="background:none;border:0;color:#10B981;cursor:pointer;font-size:18px;padding:4px;line-height:1">×</button>'
      +   '</div>'
      +   '<div style="padding:18px 20px">'
      +     '<p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280">' + escapeHtml(rule.headline || 'Customers who added this also added') + '</p>'
      +     '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:14px">'
      +       (product.image_url ? '<img src="' + escapeAttr(product.image_url) + '" alt="" style="width:56px;height:56px;border-radius:10px;object-fit:cover;flex-shrink:0">' : '<div style="width:56px;height:56px;border-radius:10px;background:rgba(26,46,110,0.08);flex-shrink:0"></div>')
      +       '<div style="flex:1;min-width:0">'
      +         '<p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111827">' + escapeHtml(product.name) + '</p>'
      +         (rule.body_copy ? '<p style="margin:0 0 6px;font-size:12px;color:#6B7280;line-height:1.4">' + escapeHtml(rule.body_copy) + '</p>' : '')
      +         '<div style="display:flex;align-items:baseline;gap:8px">'
      +           '<span style="font-size:16px;font-weight:900;color:#1A2E6E">' + fmtMoney(discountedPrice) + '</span>'
      +           '<span style="font-size:12px;color:#9CA3AF;text-decoration:line-through">' + fmtMoney(product.price) + '</span>'
      +           '<span style="font-size:11px;font-weight:700;color:#059669">Save ' + fmtMoney(savings) + '</span>'
      +         '</div>'
      +       '</div>'
      +     '</div>'
      +     '<button data-accept style="width:100%;background:#1A2E6E;color:#fff;border:0;border-radius:12px;padding:10px;font-size:13px;font-weight:700;cursor:pointer">+ Add — Save ' + fmtMoney(savings) + '</button>'
      +     '<button data-decline style="display:block;width:100%;margin-top:8px;background:none;border:0;color:#9CA3AF;font-size:13px;padding:4px;cursor:pointer">No thanks, continue shopping</button>'
      +   '</div>'
      + '</div>';

    document.body.appendChild(overlay);

    function close() { overlay.remove(); }

    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.querySelector('[data-decline]').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

    overlay.querySelector('[data-accept]').addEventListener('click', function () {
      if (window.Cart && typeof window.Cart.add === 'function') {
        window.Cart.add({
          id:       product.id,
          sku:      product.sku,
          name:     product.name,
          price:    discountedPrice,
          minQty:   product.min_qty || 10,
          image:    product.image_url || null,
          upsell:   true,
        }, product.min_qty || 10);
      }
      if (window.dasTrack && window.dasTrack.addToCart) {
        window.dasTrack.addToCart({ sku: product.sku, name: product.name, price: discountedPrice, qty: product.min_qty || 10 });
      }
      close();
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ── Hook into the existing cart change event ──
  // js/cart.js dispatches 'das:cartchange' after every modification. We trigger
  // the modal after a successful add by inspecting the last addition.
  let lastSize = 0;
  let lastIds  = new Set();
  function refreshSnapshot() {
    const items = (window.Cart && window.Cart.get()) || [];
    lastSize = items.length;
    lastIds  = new Set(items.map(function (i) { return i.id; }));
  }

  window.addEventListener('das:cartchange', async function (ev) {
    if (sessionStorage.getItem(SESSION_LOCK)) return; // already shown this session
    const cart = (ev.detail && ev.detail.cart) || [];
    // Detect newly-added items
    const newOnes = cart.filter(function (i) { return !lastIds.has(i.id); });
    refreshSnapshot();
    if (newOnes.length === 0) return; // remove or qty-update, not an add
    if (newOnes.some(function (i) { return i.upsell || i.bundle; })) return; // came from us, skip recursion

    const triggerItem = newOnes[0];
    if (!triggerItem || !triggerItem.sku) return;

    const hit = await fetchUpsell(triggerItem.sku);
    if (hit) {
      sessionStorage.setItem(SESSION_LOCK, '1');
      inject(hit.rule, hit.product, triggerItem.name);
    }
  });

  // initial snapshot once cart is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshSnapshot);
  } else {
    refreshSnapshot();
  }
})();
