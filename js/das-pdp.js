/* ============================================================================
   DAS STORE — PRODUCT PAGE (v2)
   ----------------------------------------------------------------------------
   WHAT CHANGED FROM v1, AND WHY
   v1 rendered one photograph with a thumbnail rail beneath it. That is not the
   behaviour of either store this system comes from: the gallery is a STACKED
   COLUMN of every photograph, scrolling past a buy box pinned beside it. On a
   catalogue where a kit carries four or five shots, that difference is most of
   the page — so the gallery is now the page and the buy box rides along it.

   Added with it:
     · click-to-zoom on any frame (1.55x, second click restores)
     · a sticky mobile buy bar — the single biggest mobile conversion device,
       because on a phone the add button otherwise scrolls away forever
     · a logistics strip answering the three questions a fleet buyer asks
       BEFORE quantity: minimum, lead time, what branding costs
     · quantity tiles that carry their own line total, so the number the buyer
       is deciding about is on the control they are deciding with
     · a programme band under the fold that sells the PROGRAMME, not the piece

   THE GATED PATH IS STILL FIRST-CLASS. 40 of 54 pieces are over the $110 gate,
   so Request Pricing replaces price, quantity and add entirely on those — the
   page never prints a figure the visitor is not cleared to see.

   Cart, favourites and checkout remain js/cart.js's.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('.st-pdp2');
  if (!root) return;

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var money = function (n) { return '$' + Number(n).toFixed(2); };
  var TICK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/></svg>';

  var id = new URLSearchParams(location.search).get('id');
  var P = null, CAT = null, qty = null;

  function qtys(p) {
    var min = p.minQty || 10;
    var out = [min];
    [10, 25, 50, 100].forEach(function (q) { if (q > min && out.length < 4) out.push(q); });
    return out;
  }

  /* ── the stacked gallery ─────────────────────────────────────────────── */
  function gallery() {
    var g = (P.gallery && P.gallery.length) ? P.gallery : [P.shot];
    return g.map(function (s, i) {
      return '<figure data-zoom="false" data-i="' + i + '">' +
        '<img src="' + esc(s.src) + '" srcset="' + esc(s.srcset) + '" alt="' + esc(P.name) +
          (i ? ' — view ' + (i + 1) : '') + '" width="700" height="560"' +
          (i ? ' loading="lazy"' : ' fetchpriority="high"') + '>' +
        '<figcaption>' + (i + 1) + ' / ' + g.length + '</figcaption>' +
      '</figure>';
    }).join('');
  }

  /* ── the buy column ──────────────────────────────────────────────────── */
  function buy() {
    var h = '';
    h += '<div class="eyebrow st-ui">' + esc(P.programLabel) + '</div>';
    h += '<h1>' + esc(P.name) + '</h1>';

    if (!P.gated) {
      h += '<div class="price st-ui">' + money(P.price) + ' <small>per unit</small></div>';
    }
    if (P.blurb) h += '<p class="blurb">' + esc(P.blurb) + '</p>';

    h += '<a class="pd-prog st-ui" href="store.html?c=' + esc(P.program) + '">' +
      'See the whole ' + esc(P.programLabel) + ' programme' +
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path stroke-linecap="round" d="M5 12h14M13 6l6 6-6 6"/></svg></a>';

    /* The three questions asked before quantity, answered before the control. */
    h += '<div class="pd-logi st-ui">' +
      '<div><b>' + (P.minQty || 10) + ' units</b><span>Minimum order</span></div>' +
      '<div><b>5&ndash;7 days</b><span>After artwork approval</span></div>' +
      '<div><b>Included</b><span>Logo &amp; personalisation</span></div>' +
      '</div>';

    if (P.gated) {
      h += '<div class="st-req">' +
        '<b>Priced to your fleet</b>' +
        '<p>This programme is quoted on driver count, customisation and timeline. A specialist replies in writing within one business day &mdash; a real number, not a range.</p>' +
        '<a class="st-cta st-cta--block" href="contact.html?intent=pricing&amp;product=' + encodeURIComponent(P.id) +
          '&amp;name=' + encodeURIComponent(P.name) + '">Request pricing</a>' +
        '</div>';
    } else {
      h += '<div class="pd-lbl st-ui"><span>Quantity</span><a href="contact.html?intent=pricing">Need a different volume?</a></div>';
      h += '<div class="pd-qty st-ui">' + qtys(P).map(function (q) {
        return '<button data-qty="' + q + '" aria-pressed="' + (q === qty) + '">' + q +
          '<small>' + money(P.price * q) + '</small></button>';
      }).join('') + '</div>';
      h += '<button class="st-cta st-cta--block" id="pd-add" style="margin-top:14px">' +
        'Add to bag &mdash; <span id="pd-total">' + money(P.price * (qty || P.minQty || 10)) + '</span></button>';
    }

    h += '<button class="st-cta st-cta--ghost st-cta--block" style="margin-top:8px" data-save-to-fav>Save for later</button>';

    h += '<div class="pd-usp st-ui">' +
      '<div>' + TICK + '<span>Your logo, driver names and colours included &mdash; no setup or artwork fee</span></div>' +
      '<div>' + TICK + '<span>Artwork proofed and approved before anything is produced</span></div>' +
      '<div>' + TICK + '<span>Net-30 for approved carriers &middot; purchase orders accepted</span></div>' +
      '</div>';

    if (P.included && P.included.length) {
      h += '<details open><summary class="st-ui">What&rsquo;s included</summary><div class="bd"><ul>' +
        P.included.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></details>';
    }
    h += '<details><summary class="st-ui">Customisation &amp; artwork</summary><div class="bd">' +
      'Send a logo at any resolution. The fleet team prepares the artwork, sends a proof, and only moves to ' +
      'production once you approve it. Driver names and a custom message are included at every tier.' +
      '</div></details>';
    h += '<details><summary class="st-ui">Shipping &amp; returns</summary><div class="bd">' +
      'Standard orders ship on your programme timeline once artwork is approved; express processing is available ' +
      'for time-sensitive programmes including Driver Appreciation Week. 30 days on unopened product &mdash; ' +
      'customised and personalised pieces are final sale.' +
      '</div></details>';
    h += '<details><summary class="st-ui">Ordering for a large fleet</summary><div class="bd">' +
      'Volume pricing unlocks at 100+ drivers on the same SKUs and the same quality. Multi-terminal delivery and ' +
      'annual programme scheduling are coordinated by the fleet team. ' +
      '<a href="company-purchasing.html" style="color:var(--st-navy);text-decoration:underline">Buy for my company</a>.' +
      '</div></details>';
    return h;
  }

  function band() {
    return '<div class="in">' +
      '<div><p class="k st-ui">' + esc(P.programLabel) + '</p>' +
      '<h2>A programme beats a parcel.</h2>' +
      '<p>One kit is a nice gesture. A calendar of them is what moves retention &mdash; and the fleet team builds the ' +
      'calendar around your driver count, your budget and the dates that already matter to your operation.</p></div>' +
      '<a class="st-cta st-cta--light" href="contact.html?intent=pricing">Build the programme</a>' +
      '</div>';
  }

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

  function bar() {
    var el = document.getElementById('pd-bar');
    if (!el) return;
    el.innerHTML = '<span class="n st-ui"><b>' + esc(P.name) + '</b>' +
      '<span>' + (P.gated ? 'Priced to your fleet' : money(P.price) + ' per unit') + '</span></span>' +
      (P.gated
        ? '<a class="st-cta" href="contact.html?intent=pricing&amp;product=' + encodeURIComponent(P.id) + '">Request pricing</a>'
        : '<button class="st-cta" id="pd-add-bar">Add to bag</button>');
  }

  function paint() {
    document.getElementById('pd-gal').innerHTML = gallery();
    document.getElementById('pd-buy').innerHTML = buy();
    var b = document.getElementById('pd-band'); if (b) b.innerHTML = band();
    var also = document.getElementById('pd-also'); if (also) also.innerHTML = alsoIn();
    bar();
    document.title = P.name + ' — Driver Appreciation Solutions';
    root.setAttribute('data-product-id', P.id);
    root.setAttribute('data-product-name', P.name);
    root.setAttribute('data-product-price', P.price);
    root.setAttribute('data-product-category', P.programLabel);
    root.setAttribute('data-product-image', P.shot.src);
    root.setAttribute('data-product-min-qty', P.minQty || 10);
  }

  function addToBag() {
    if (!window.Cart || P.gated) return;
    Cart.add({ id: P.id, name: P.name, price: P.price, image: P.shot.src, category: P.programLabel, minQty: P.minQty },
      qty || P.minQty || 10);
    if (window.showToast) showToast('Added to your bag', 'success');
  }

  document.addEventListener('click', function (e) {
    var fig = e.target.closest && e.target.closest('.pd-gal figure');
    if (fig) { fig.setAttribute('data-zoom', fig.getAttribute('data-zoom') === 'true' ? 'false' : 'true'); return; }
    var q = e.target.closest && e.target.closest('[data-qty]');
    if (q) {
      qty = parseInt(q.dataset.qty, 10);
      root.querySelectorAll('[data-qty]').forEach(function (b2) { b2.setAttribute('aria-pressed', String(b2 === q)); });
      var t = document.getElementById('pd-total');
      if (t) t.textContent = money(P.price * qty);
      return;
    }
    if (e.target.closest && (e.target.closest('#pd-add') || e.target.closest('#pd-add-bar'))) addToBag();
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
