/* ============================================================================
   DAS STORE — PRODUCT PAGE
   ----------------------------------------------------------------------------
   The reference's buy-box, ported: sticky gallery on the left with a thumb rail
   and an n/N counter, a 472px information column on the right carrying
   category, title, price, the variant selector, a 52px add button, the USP
   rows, the accordions, and Complete The Set beneath.

   TWO SUBSTITUTIONS, because a fleet buyer is not buying a garment:
     size selector -> QUANTITY selector, starting at the product's real minimum
     fit chips     -> the programme the piece belongs to

   THE GATED PATH IS FIRST-CLASS. DAS gates anything over $110 (js/pricing-gate.js)
   and 40 of 54 pieces are gated, so on those the buy column shows Request
   Pricing INSTEAD of a price and an add button. The page never prints a number
   the visitor is not cleared to see — the rule that was broken once before by
   prices leaking into marketing prose.

   Cart, favourites and checkout are js/cart.js's, untouched.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('.st-pdp');
  if (!root) return;

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var money = function (n) { return '$' + Number(n).toFixed(2); };

  var id = new URLSearchParams(location.search).get('id');
  var P = null, CAT = null, slide = 0, qty = null;

  function qtys(p) {
    var min = p.minQty || 10;
    var out = [min];
    [10, 25, 50, 100].forEach(function (q) { if (q > min && out.length < 4) out.push(q); });
    return out;
  }

  var TICK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/></svg>';

  function gallery() {
    var g = P.gallery && P.gallery.length ? P.gallery : [P.shot];
    var s = g[Math.min(slide, g.length - 1)];
    return '<div class="main">' +
        '<img src="' + esc(s.src) + '" srcset="' + esc(s.srcset) + '" alt="' + esc(P.name) + '" width="700" height="560" fetchpriority="high">' +
        (g.length > 1 ? '<span class="n st-micro">' + (slide + 1) + ' / ' + g.length + '</span>' : '') +
      '</div>' +
      (g.length > 1 ? '<div class="rail">' + g.map(function (x, i) {
        return '<button data-slide="' + i + '" aria-pressed="' + (i === slide) + '" aria-label="View photo ' + (i + 1) + '">' +
          '<img src="' + esc(x.src) + '" alt="" loading="lazy"></button>';
      }).join('') + '</div>' : '');
  }

  function buy() {
    var h = '';
    h += '<div class="cat st-ui">' + esc(P.programLabel) + '</div>';
    h += '<h1>' + esc(P.name) + '</h1>';

    if (P.gated) {
      /* No price, no add-to-bag. The quote IS the conversion on a gated piece. */
      h += '<div class="st-req">' +
        '<b>Priced to your fleet</b>' +
        '<p>This programme is quoted on driver count, customisation and timeline. A specialist replies in writing within one business day &mdash; a real number, not a range.</p>' +
        '<a class="st-cta st-cta--block" href="contact.html?intent=pricing&amp;product=' + encodeURIComponent(P.id) +
          '&amp;name=' + encodeURIComponent(P.name) + '">Request pricing</a>' +
        '</div>';
      h += '<p class="st-ui" style="color:var(--st-muted);margin-bottom:18px">Minimum ' + (P.minQty || 10) + ' units &middot; Net-30 for approved carriers</p>';
    } else {
      h += '<div class="price st-ui">' + money(P.price) + ' <span style="color:var(--st-muted)">per unit</span></div>';
      h += '<div class="lbl st-ui"><span>Quantity</span><a href="contact.html?intent=pricing">Need a different volume?</a></div>';
      h += '<div class="qty">' + qtys(P).map(function (q) {
        return '<button data-qty="' + q + '" aria-pressed="' + (q === qty) + '">' + q + '</button>';
      }).join('') + '</div>';
      h += '<button class="st-cta st-cta--block" id="pdp-add" style="margin-top:16px">Add to bag &mdash; <span id="pdp-total">' + money(P.price * (qty || P.minQty || 10)) + '</span></button>';
    }

    h += '<button class="st-cta st-cta--ghost st-cta--block" style="margin-top:8px" data-save-to-fav>Save for later</button>';

    h += '<div class="usp st-ui">' +
      '<div>' + TICK + '<span>Your logo, driver names and colours included</span></div>' +
      '<div>' + TICK + '<span>Ships on your program timeline after artwork approval</span></div>' +
      '<div>' + TICK + '<span>Net-30 for approved carriers &middot; POs accepted</span></div>' +
      '</div>';

    if (P.blurb) {
      h += '<details open><summary class="st-ui">Description</summary><div class="bd">' + esc(P.blurb) + '</div></details>';
    }
    if (P.included && P.included.length) {
      h += '<details><summary class="st-ui">What&rsquo;s included</summary><div class="bd"><ul>' +
        P.included.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></details>';
    }
    h += '<details><summary class="st-ui">Customisation &amp; artwork</summary><div class="bd">' +
      'Every piece is branded to your carrier. Send a logo at any resolution and the fleet team prepares the artwork, ' +
      'sends a proof, and only moves to production once you approve it. There is no setup fee and no artwork charge.' +
      '</div></details>';
    h += '<details><summary class="st-ui">Shipping &amp; returns</summary><div class="bd">' +
      'Standard orders ship per your program timeline once artwork is approved; express processing is available for ' +
      'time-sensitive programmes including Driver Appreciation Week. 30 days for unopened product &mdash; customised ' +
      'and personalised pieces are final sale.' +
      '</div></details>';
    return h;
  }

  /* Complete the set — other pieces from the same programme. */
  function alsoIn() {
    var others = CAT.products.filter(function (x) { return x.program === P.program && x.id !== P.id; }).slice(0, 4);
    if (!others.length) return '';
    return '<section class="st-sec"><div class="head st-ui"><h2>More in ' + esc(P.programLabel) + '</h2>' +
      '<sup>' + others.length + '</sup></div><div class="st-grid" data-view="4">' +
      others.map(function (p) {
        return '<article class="st-card st-ui">' +
          '<a class="frame" href="store-product.html?id=' + encodeURIComponent(p.id) + '">' +
          '<img src="' + esc(p.shot.src) + '" srcset="' + esc(p.shot.srcset) + '" alt="' + esc(p.name) + '" loading="lazy" width="700" height="560"></a>' +
          '<div class="foot"><div class="t">' + esc(p.name) + '</div>' +
          '<div class="p">' + (p.gated ? '<span class="gate">Request pricing</span>' : money(p.price)) + '</div></div>' +
          '</article>';
      }).join('') + '</div></section>';
  }

  function paint() {
    document.getElementById('pdp-gal').innerHTML = gallery();
    document.getElementById('pdp-buy').innerHTML = buy();
    var also = document.getElementById('pdp-also');
    if (also) also.innerHTML = alsoIn();
    document.title = P.name + ' — Driver Appreciation Solutions';
    /* the card the favourites handler reads its item from */
    root.setAttribute('data-product-id', P.id);
    root.setAttribute('data-product-name', P.name);
    root.setAttribute('data-product-price', P.price);
    root.setAttribute('data-product-category', P.programLabel);
    root.setAttribute('data-product-image', P.shot.src);
    root.setAttribute('data-product-min-qty', P.minQty || 10);
  }

  document.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('[data-slide]');
    if (s) { slide = parseInt(s.dataset.slide, 10); paint(); return; }
    var q = e.target.closest && e.target.closest('[data-qty]');
    if (q) {
      qty = parseInt(q.dataset.qty, 10);
      root.querySelectorAll('[data-qty]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === q)); });
      var t = document.getElementById('pdp-total');
      if (t) t.textContent = money(P.price * qty);
      return;
    }
    if (e.target.closest && e.target.closest('#pdp-add')) {
      if (!window.Cart) return;
      Cart.add({ id: P.id, name: P.name, price: P.price, image: P.shot.src, category: P.programLabel, minQty: P.minQty },
        qty || P.minQty || 10);
      if (window.showToast) showToast('Added to your bag', 'success');
      return;
    }
  });

  fetch('/store-catalog.json').then(function (r) { return r.json(); }).then(function (data) {
    CAT = data;
    P = data.products.filter(function (p) { return p.id === id || p.slug === id; })[0];
    if (!P) {
      root.innerHTML = '<div style="padding:60px 24px"><p class="st-ui" style="color:var(--st-muted)">' +
        'That product is not in the store. <a href="store.html" style="text-decoration:underline">Browse the collection</a>.</p></div>';
      return;
    }
    qty = P.minQty || 10;
    paint();
  }).catch(function () {
    root.innerHTML = '<div style="padding:60px 24px"><p class="st-ui" style="color:var(--st-muted)">' +
      'The catalogue could not be loaded. <a href="shop.html" style="text-decoration:underline">Browse the full shop</a>.</p></div>';
  });
})();
