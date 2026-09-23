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
     · a program band under the fold that sells the PROGRAM, not the piece

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

  /* ── MILESTONE + KIT CONFIG, ported from product.html ────────────────────
     These keys are a SERVER CONTRACT, not display strings.
     api/create-checkout.js validates item.milestone against MS_LABELS and
     returns 400 "Please select a milestone level" when it is missing or
     unknown, then bakes the label into the Stripe line-item name so the level
     reaches the order record, the confirmation email and fulfilment. Change a
     key here and orders start failing at checkout.

     Kit config is flat-priced — it never moves the price, it rides along to
     fulfilment. 'standard' is the default and is deliberately NOT sent
     (create-checkout ignores it), so only a real upgrade appears on the line. */
  var MS_MILES = [
    { key: '250k', n: '250,000' }, { key: '500k', n: '500,000' }, { key: '1m', n: '1 Million' },
    { key: '2m', n: '2 Million' }, { key: '3m', n: '3 Million' }, { key: '4m', n: '4 Million' },
    { key: '5m', n: '5 Million' }, { key: '6m', n: '6 Million' }
  ];
  var KIT_CONFIG = [
    { key: 'standard',         label: 'Standard kit — medal, 2 lapel pins, t-shirt, keychain & road bag tag' },
    { key: 'custom-tag',       label: 'Customized driver luggage tag (name & milestone engraved)' },
    { key: 'tag-medal-insert', label: 'Luggage tag with engraved medal insert' },
    { key: 'one-pin',          label: 'Single premium lapel pin' },
    { key: 'two-pins',         label: 'Two premium lapel pins (matched set)' }
  ];
  /** product.html defaults the level to 1M rather than the first option. */
  var msChoice = '1m', kitChoice = 'standard';

  function qtys(p) {
    var min = p.minQty || 10;
    var out = [min];
    [10, 25, 50, 100].forEach(function (q) { if (q > min && out.length < 4) out.push(q); });
    return out;
  }

  /* ── the stacked gallery ─────────────────────────────────────────────── */
  /* THE GALLERY IS A 1:1 PORT OF shop.griffain.io's PDP SWIPER.
     Jayden 2026-09-23: "why is there so much white space can we just do a
     identical copy of what the griffain io and match how their sizing and pdp
     looks exactly".

     The white space was mine. Trying to avoid a crop, I sized the figure by
     height against the fold, which made a portrait shot 731px wide inside a
     1397px column — two 333px gutters of nothing. He is right that that is
     worse than the problem it solved.

     MEASURED off the live reference at 1900x1000
     (shop.griffain.io/p/employees-hoodie?c=cement):
         gallery column   950px  == exactly 50% of the viewport
         gallery frame    950 x 1188, object-fit: cover, ground #f7f7f7
         image width      calc(100% + 1px)   (their rule, kills the seam)
         buy column       472px, sticky, min-height 100dvh, mx-auto in its half
         counter chip     12px at .54 opacity, white ground, 27px in, 28px up
         dots             3px tall; active 16px black, rest 6px at 30%
     Horizontal snap scroller, one photograph per slide, arrows at 20px.

     THE ONE DEVIATION, AND WHY. Their frame is 4:5 PORTRAIT because Represent
     shoots 4:5 apparel. DAS does not: of 54 primary shots, 50 are landscape or
     square and only 4 are portrait. Cover-fitting a 1.5 landscape kit photo
     into a 4:5 frame crops 47% of its WIDTH — half the kit gone on nearly
     every product. So the structure is copied exactly and the frame ratio is
     DAS's own modal 1.25, which is also what the card grid uses, so the store
     stays internally consistent. One token, --st-pdp-frame, if he wants literal
     4:5 anyway. Either way the photograph FILLS the frame: zero white space. */
  function gallery() {
    var g = (P.gallery && P.gallery.length) ? P.gallery : [P.shot];
    var slides = g.map(function (s, i) {
      var v = s.pdp || s;                        // uncropped variant; falls back if images predate it
      return '<figure class="pd-slide" data-i="' + i + '">' +
        '<img src="' + esc(v.src) + '" srcset="' + esc(v.srcset) + '" alt="' + esc(P.name) +
          (i ? ' — view ' + (i + 1) : '') + '" width="' + (v.w || 1400) + '" height="' + (v.h || 1120) + '"' +
          (i ? ' loading="lazy"' : ' fetchpriority="high"') + '>' +
      '</figure>';
    }).join('');

    var dots = g.map(function (_, k) {
      return '<button type="button" class="pd-dot' + (k ? '' : ' on') + '" data-go="' + k + '" aria-label="Photo ' + (k + 1) + '"></button>';
    }).join('');

    /* Arrows and the counter only earn their place when there is more than one
       photograph. Most of this catalogue has exactly one, and a dead arrow on a
       single-photo product is furniture. */
    var multi = g.length > 1;
    return '<div class="pd-track" id="pd-track">' + slides + '</div>' +
      (multi
        ? '<button type="button" class="pd-arw pd-prev" data-step="-1" aria-label="Previous slide">' +
            '<svg width="7" height="13" viewBox="0 0 7 13" fill="none"><path d="M6 1 1 6.5 6 12" stroke="currentColor"/></svg></button>' +
          '<button type="button" class="pd-arw pd-next" data-step="1" aria-label="Next slide">' +
            '<svg width="7" height="13" viewBox="0 0 7 13" fill="none"><path d="m1 1 5 5.5L1 12" stroke="currentColor"/></svg></button>'
        : '') +
      '<div class="pd-gbar">' +
        (multi
          ? '<div class="pd-count st-ui"><span id="pd-cur">1</span>/<span>' + g.length + '</span></div>' +
            '<div class="pd-dots">' + dots + '</div>'
          : '') +
        '<button type="button" class="pd-zoom" aria-label="Open product gallery">' +
          '<svg width="32" height="32" viewBox="0 0 32 32" fill="none">' +
          '<path d="M6 12V6h6M26 12V6h-6M6 20v6h6M26 20v6h-6" stroke="currentColor"/></svg></button>' +
      '</div>';
  }

  /* Keep the counter and dots honest about where the scroller actually is.
     Driving them off the scroll position rather than off the click means a
     finger swipe updates them too — the reference behaves the same way, and a
     counter that only moves when you use the arrows is a lie on a phone. */
  function wireGallery() {
    var tr = document.getElementById('pd-track');
    if (!tr || tr.children.length < 2) return;
    var cur = document.getElementById('pd-cur');
    var dots = document.querySelectorAll('.pd-dot');
    var tick;
    tr.addEventListener('scroll', function () {
      if (tick) return;                                  // one update per frame, not per scroll event
      tick = requestAnimationFrame(function () {
        tick = 0;
        var i = Math.round(tr.scrollLeft / (tr.clientWidth || 1));
        if (cur) cur.textContent = String(i + 1);
        for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('on', k === i);
      });
    }, { passive: true });
  }

  /* ── the buy column ──────────────────────────────────────────────────── */
  function buy() {
    var h = '';
    h += '<div class="eyebrow st-ui">' + esc(P.programLabel) + '</div>';
    h += '<h1>' + esc(P.name) + '</h1>';

    /* No price on a gated piece, and none on a comingSoon one either — that one
       is under the gate at $108.99 so it would otherwise print a figure for
       something the server will not sell. */
    if (!P.gated && !P.comingSoon) {
      h += '<div class="price st-ui">' + money(P.price) + ' <small>per unit</small></div>';
    }
    if (P.blurb) h += '<p class="blurb">' + esc(P.blurb) + '</p>';

    h += '<a class="pd-prog st-ui" href="store.html?c=' + esc(P.program) + '">' +
      'See the whole ' + esc(P.programLabel) + ' program' +
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path stroke-linecap="round" d="M5 12h14M13 6l6 6-6 6"/></svg></a>';

    /* ── The Executive Collection cross-link, both directions ──────────────
       The last thing the old /product PDP did that this one did not. The
       Executive Collection is a premium upgrade ON a Safe Service Miles medal
       and NEVER on a career one — the catalogue builder only ever attaches
       these to safe/exec pieces, so the Career/Safety separation holds. */
    if (P.execUpgrades && P.execUpgrades.length) {
      h += '<div class="pd-exec"><span class="k st-ui">Executive Collection available</span>' +
        P.execUpgrades.map(function (u) {
          return '<a class="row st-ui" href="store-product.html?id=' + encodeURIComponent(u.id) + '">' +
            '<span>' + esc(u.gift || 'Executive upgrade') + '</span>' +
            '<span class="up">' + (u.comingSoon ? 'Coming soon' : (u.upgrade ? '+$' + u.upgrade : 'View')) + '</span></a>';
        }).join('') + '</div>';
    }
    if (P.execBase) {
      h += '<a class="pd-prog st-ui" href="store-product.html?id=' + encodeURIComponent(P.execBase.id) + '">' +
        'Standard award without the executive gift' +
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path stroke-linecap="round" d="M5 12h14M13 6l6 6-6 6"/></svg></a>';
    }

    /* The three questions asked before quantity, answered before the control. */
    h += '<div class="pd-logi st-ui">' +
      '<div><b>' + (P.minQty || 10) + ' units</b><span>Minimum order</span></div>' +
      '<div><b>5&ndash;7 days</b><span>After artwork approval</span></div>' +
      '<div><b>Included</b><span>Logo &amp; personalization</span></div>' +
      '</div>';

    if (P.gated) {
      h += '<div class="st-req">' +
        '<b>Priced to your fleet</b>' +
        '<p>This program is quoted on driver count, customization and timeline. A specialist replies in writing within one business day &mdash; a real number, not a range.</p>' +
        '<a class="st-cta st-cta--block" href="contact.html?intent=pricing&amp;product=' + encodeURIComponent(P.id) +
          '&amp;name=' + encodeURIComponent(P.name) + '">Request pricing</a>' +
        '</div>';
    } else if (P.comingSoon) {
      /* Deliberately absent from lib/catalog.js, so Catalog.resolve() returns
         "unknown" and the server refuses it. Presenting it as buyable would
         send the buyer to a checkout that rejects them. */
      h += '<div class="st-req">' +
        '<b>Pricing coming soon</b>' +
        '<p>This option is not released for purchase yet. Tell us the fleet size and the occasion and the team will confirm pricing and availability.</p>' +
        '<a class="st-cta st-cta--block" href="contact.html?intent=pricing&amp;product=' + encodeURIComponent(P.id) +
          '&amp;name=' + encodeURIComponent(P.name) + '">Notify me / request pricing</a>' +
        '</div>';
    } else {
      /* Milestone level comes BEFORE quantity — it is the variant decision, and
         the server will not accept the line without it. */
      if (P.milestoneSelect) {
        var unit = P.safeMiles ? ' Safe Miles' : ' Miles';
        h += '<div class="pd-lbl st-ui"><span>Milestone level</span></div>' +
          '<select class="pd-select" id="pd-milestone" aria-label="Milestone level">' +
          MS_MILES.map(function (m) {
            return '<option value="' + m.key + '"' + (m.key === msChoice ? ' selected' : '') + '>' +
              m.n + unit + '</option>';
          }).join('') + '</select>';
        h += '<div class="pd-lbl st-ui"><span>Build your kit</span></div>' +
          '<select class="pd-select" id="pd-kitconfig" aria-label="Kit configuration">' +
          KIT_CONFIG.map(function (k) {
            return '<option value="' + k.key + '"' + (k.key === kitChoice ? ' selected' : '') + '>' +
              esc(k.label) + '</option>';
          }).join('') + '</select>';
        h += '<p class="pd-note">Images are representative. The award is customized to the milestone level you choose, at no extra cost.</p>';
      }
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
      '<div>' + TICK + '<span>Your logo, driver names and colors included &mdash; no setup or artwork fee</span></div>' +
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
      'Standard orders ship on your program timeline once artwork is approved; express processing is available ' +
      'for time-sensitive programs including Driver Appreciation Week. 30 days on unopened product &mdash; ' +
      'customized and personalized pieces are final sale.' +
      '</div></details>';
    h += '<details><summary class="st-ui">Ordering for a large fleet</summary><div class="bd">' +
      'Volume pricing unlocks at 100+ drivers on the same SKUs and the same quality. Multi-terminal delivery and ' +
      'annual program scheduling are coordinated by the fleet team. ' +
      '<a href="company-purchasing.html" style="color:var(--st-navy);text-decoration:underline">Buy for my company</a>.' +
      '</div></details>';
    return h;
  }

  function band() {
    return '<div class="in">' +
      '<div><p class="k st-ui">' + esc(P.programLabel) + '</p>' +
      '<h2>A program beats a parcel.</h2>' +
      '<p>One kit is a nice gesture. A calendar of them is what moves retention &mdash; and the fleet team builds the ' +
      'calendar around your driver count, your budget and the dates that already matter to your operation.</p></div>' +
      '<a class="st-cta st-cta--light" href="contact.html?intent=pricing">Build the program</a>' +
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
    var quoteOnly = P.gated || P.comingSoon;
    el.innerHTML = '<span class="n st-ui"><b>' + esc(P.name) + '</b>' +
      '<span>' + (P.comingSoon ? 'Pricing coming soon'
        : P.gated ? 'Priced to your fleet'
        : money(P.price) + ' per unit') + '</span></span>' +
      (quoteOnly
        ? '<a class="st-cta" href="contact.html?intent=pricing&amp;product=' + encodeURIComponent(P.id) + '">Request pricing</a>'
        : '<button class="st-cta" id="pd-add-bar">Add to bag</button>');
  }

  function paint() {
    document.getElementById('pd-gal').innerHTML = gallery();
    wireGallery();
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
    if (!window.Cart || P.gated || P.comingSoon) return;
    var n = qty || P.minQty || 10;
    var item = { id: P.id, name: P.name, price: P.price, image: P.shot.src, category: P.programLabel, minQty: P.minQty };

    if (P.milestoneSelect) {
      /* The server rejects the whole order without this, so refuse locally
         rather than let the buyer reach a 400 at checkout. */
      var sel = document.getElementById('pd-milestone');
      var key = sel ? sel.value : msChoice;
      var m = MS_MILES.filter(function (x) { return x.key === key; })[0];
      if (!m) { if (window.showToast) showToast('Choose a milestone level first', 'info'); return; }
      item.milestone = m.key;
      item.milestoneLabel = m.n + (P.safeMiles ? ' Safe Miles' : ' Miles');

      /* 'standard' is the default build and is NOT sent — create-checkout
         ignores it, and an unchanged default on the line is noise. */
      var kc = document.getElementById('pd-kitconfig');
      var ck = kc ? kc.value : kitChoice;
      if (ck && ck !== 'standard') {
        var k = KIT_CONFIG.filter(function (x) { return x.key === ck; })[0];
        if (k) { item.kitConfig = k.key; item.kitConfigLabel = k.label; }
      }
    }

    Cart.add(item, n);
    if (window.showToast) showToast('Added to your bag', 'success');
    track('addToCart', { sku: P.id, name: P.name, price: P.price, qty: n });
    push('add_to_cart_detail', { product_id: P.id, milestone: item.milestone || null, kit_config: item.kitConfig || null });
  }

  /* Analytics goes through the site's existing window.dasTrack (js/tracking.js),
     which already fans out to GA4, Google Ads and the Meta pixel. A second
     analytics layer would double-count every event. Guarded because
     tracking.js is deferred and a click can land before it parses. */
  function track(fn, payload) {
    try { if (window.dasTrack && window.dasTrack[fn]) window.dasTrack[fn](payload); } catch (e) {}
  }
  /** Store-specific events GA4 picks up off the dataLayer. The quote path is the
      primary conversion here — 40 of 54 products are gated — so it has to be
      measurable separately from add-to-cart or the funnel reads as mostly failure. */
  function push(event, data) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: event }, data || {}));
    } catch (e) {}
  }

  document.addEventListener('click', function (e) {
    /* Gallery controls, matching the reference's swiper: arrows step, dots jump,
       the zoom control toggles a full-bleed scale on the current slide. The
       track is a native scroll-snap scroller, so navigation is just scrollTo —
       no slide index to keep in sync with a transform, and a swipe on a phone
       and a click on the arrow end up in exactly the same place. */
    var arw = e.target.closest && e.target.closest('.pd-arw');
    var dot = e.target.closest && e.target.closest('[data-go]');
    if (arw || dot) {
      var tr = document.getElementById('pd-track');
      if (!tr) return;
      var per = tr.clientWidth || 1;
      var at = Math.round(tr.scrollLeft / per);
      var n = dot ? parseInt(dot.dataset.go, 10) : at + parseInt(arw.dataset.step, 10);
      var last = tr.children.length - 1;
      if (n < 0) n = last; else if (n > last) n = 0;      // wrap, as theirs does
      tr.scrollTo({ left: n * per, behavior: 'smooth' });
      return;
    }
    if (e.target.closest && e.target.closest('.pd-zoom')) {
      var gw = document.getElementById('pd-gal');
      if (gw) gw.setAttribute('data-zoom', gw.getAttribute('data-zoom') === 'true' ? 'false' : 'true');
      return;
    }
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

  /* Hold the chosen level and build in module state — paint() re-renders the
     whole buy column (a zoom or a quantity change does it), and a selection
     that lived only in the DOM would silently reset to 1M/standard. */
  document.addEventListener('change', function (e) {
    if (!e.target.id) return;
    if (e.target.id === 'pd-milestone') msChoice = e.target.value;
    if (e.target.id === 'pd-kitconfig') kitChoice = e.target.value;
  });

  fetch('/store-catalog.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (data) {
    CAT = data;
    P = data.products.filter(function (p) { return p.id === id || p.slug === id; })[0];
    if (!P) {
      root.innerHTML = '<div style="padding:60px 24px"><p class="st-ui" style="color:var(--st-muted)">' +
        'That product is not in the store. <a href="store.html" style="text-decoration:underline">Browse the collection</a>.</p></div>';
      return;
    }
    qty = P.minQty || 10;
    paint();
    track('viewItem', { sku: P.id, name: P.name, price: P.gated ? 0 : P.price, category: P.programLabel });
    push('view_product', { product_id: P.id, program: P.program, gated: !!P.gated });

    /* A click on Request Pricing is the conversion on 74% of this catalogue.
       It is recorded as a lead so it lands beside real leads in GA4 and Ads
       rather than disappearing as an outbound click. */
    var req = document.querySelector('.st-req .st-cta');
    if (req) req.addEventListener('click', function () {
      track('lead', {});
      push('request_pricing', { product_id: P.id, program: P.program, source: 'pdp' });
    });
  }).catch(function () {
    root.innerHTML = '<div style="padding:60px 24px"><p class="st-ui" style="color:var(--st-muted)">' +
      'The catalogue could not be loaded. <a href="shop.html" style="text-decoration:underline">Browse the full shop</a>.</p></div>';
  });
})();
