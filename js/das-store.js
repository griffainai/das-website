/* ============================================================================
   DAS STORE — the shop grid, the collections, the bag
   ----------------------------------------------------------------------------
   Renders from /store-catalog.json (built by scripts/build-store-catalog.mjs).

   WHAT THIS DOES NOT OWN. The cart and checkout already exist and keep working
   exactly as they do everywhere else on this site:
     window.Cart       js/cart.js  — add / get / total / remove / setQty
     window.Favorites  js/cart.js  — the das_favorites_v1 store favourites.html reads
     goToCheckout()    js/cart.js  — POSTs to /api/create-checkout (Stripe)
   This file never touches localStorage directly and never prices anything. A
   second cart or a second saved-list is the exact silent divergence that made a
   kit hearted on the shop never appear on the saved page.

   PRICE IS NOT AUTHORITATIVE HERE EITHER. api/create-checkout.js re-prices every
   line from lib/catalog.js and rejects anything that does not match a real tier.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('.st');
  if (!root) return;

  var CAT = null;
  var state = { program: 'all', view: '4' };

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var money = function (n) { return '$' + Number(n).toFixed(2); };

  /* Analytics rides the site's existing window.dasTrack (js/tracking.js), which
     already fans out to GA4, Google Ads and the Meta pixel. A second layer would
     double-count. Guarded: tracking.js is deferred and a click can beat it. */
  function track(fn, payload) {
    try { if (window.dasTrack && window.dasTrack[fn]) window.dasTrack[fn](payload); } catch (e) {}
  }
  function push(event, data) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: event }, data || {}));
    } catch (e) {}
  }

  /* Quantities, not garment sizes. Same control, same place as the reference's
     size grid — a fleet buyer picks a unit count, never a Medium. The first
     option is always the product's real minimum. */
  function qtys(p) {
    var min = p.minQty || 10;
    var out = [min];
    [10, 25, 50, 100].forEach(function (q) { if (q > min && out.length < 4) out.push(q); });
    return out;
  }

  function heart(on) {
    return '<svg width="15" height="15" viewBox="0 0 24 24" fill="' + (on ? 'currentColor' : 'none') +
      '" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 000-7.8z"/></svg>';
  }

  /* ── the card ───────────────────────────────────────────────────────────
     data-product-* are the attributes js/cart.js's delegated [data-save-to-fav]
     handler reads to build a favourite. Keep them or the heart stops working. */
  function card(p, i) {
    var saved = window.Favorites && window.Favorites.has(p.id);
    return '<article class="st-card st-ui" data-open="false" data-id="' + esc(p.id) + '"' +
      ' data-product-id="' + esc(p.id) + '"' +
      ' data-product-name="' + esc(p.name) + '"' +
      ' data-product-price="' + esc(p.price) + '"' +
      ' data-product-category="' + esc(p.programLabel) + '"' +
      ' data-product-image="' + esc(p.shot.src) + '"' +
      ' data-product-min-qty="' + esc(p.minQty) + '">' +
        /* The photograph and everything that sits ON it. Their structure: a bare
           relative block, no border and no padding — the card's only inset is on
           the text beneath. */
        '<div class="shot">' +
          '<a class="frame" href="store-product.html?id=' + encodeURIComponent(p.id) + '" aria-label="' + esc(p.name) + '">' +
            (p.badge ? '<span class="badge">' + esc(p.badge) + '</span>' : '') +
            '<img src="' + esc(p.shot.src) + '" srcset="' + esc(p.shot.srcset) + '" alt="' + esc(p.name) + '"' +
              (i < 8 ? '' : ' loading="lazy"') + ' width="700" height="560">' +
          '</a>' +
          '<button class="fav' + (saved ? ' fav-active' : '') + '" data-save-to-fav aria-label="Save ' + esc(p.name) + ' for later">' + heart(saved) + '</button>' +
          /* a bare 12x12 plus glyph, not a bordered box */
          /* A milestone kit cannot be quick-added: api/create-checkout.js rejects
             400 "Please select a milestone level"
           when the line has no level, so a "+" here would put a buyer into a
           bag that fails at checkout. Those route to the product page instead.
           comingSoon pieces are not purchasable at all (Catalog.resolve returns
           "unknown" and the server refuses them). */
        (p.gated || p.comingSoon ? '' :
          p.milestoneSelect
            ? '<a class="choose" href="store-product.html?id=' + encodeURIComponent(p.id) + '">Choose level</a>'
            : '<button class="plus" aria-label="Choose a quantity of ' + esc(p.name) + '">' +
              '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
              '<line x1="6" y1="0" x2="6" y2="12" stroke="currentColor"/><line x1="0" y1="6" x2="12" y2="6" stroke="currentColor"/></svg></button>') +
          /* the variant bar: full width across the bottom of the photograph */
          (p.gated || p.comingSoon || p.milestoneSelect ? '' :
            '<div class="qtys">' +
              '<button class="close" type="button" aria-label="Close">' +
              '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
              '<line x1="1" y1="1" x2="11" y2="11" stroke="currentColor"/><line x1="11" y1="1" x2="1" y2="11" stroke="currentColor"/></svg></button>' +
              '<div class="row">' + qtys(p).map(function (q) {
                return '<button class="q" data-add="' + esc(p.id) + '" data-qty="' + q + '" aria-label="Add ' + q + ' units">' + q + '</button>';
              }).join('') + '</div>' +
            '</div>') +
        '</div>' +
        /* stacked on mobile, title-left / price-right on desktop */
        '<div class="foot">' +
          '<div class="grp">' +
            '<a class="t" href="store-product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.name) + '</a>' +
            '<span class="c">' + esc(p.programLabel) + '</span>' +
          '</div>' +
          '<div class="p">' + (p.comingSoon
            ? '<span class="gate">Pricing coming soon</span>'
            : p.gated
              ? '<span class="gate">Request pricing</span>'
              : money(p.price)) + '</div>' +
        '</div>' +
      '</article>';
  }

  /* ── render ─────────────────────────────────────────────────────────────── */
  var gridEl = document.getElementById('st-grid');
  var countEl = document.getElementById('st-count');

  function visible() {
    return state.program === 'all'
      ? CAT.products
      : CAT.products.filter(function (p) { return p.program === state.program; });
  }

  function render() {
    var items = visible();
    gridEl.innerHTML = items.map(card).join('');
    if (countEl) countEl.textContent = items.length;
    document.querySelectorAll('#st-chips button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.f === state.program));
    });
    var url = state.program === 'all' ? location.pathname : location.pathname + '?c=' + state.program;
    history.replaceState(null, '', url);
  }

  function chips() {
    var el = document.getElementById('st-chips');
    if (!el) return;
    el.innerHTML = '<button class="st-ui" data-f="all" aria-pressed="true">All</button>' +
      CAT.programs.filter(function (g) { return g.count; }).map(function (g) {
        return '<button class="st-ui" data-f="' + esc(g.slug) + '" aria-pressed="false">' +
          esc(g.label) + ' (' + g.count + ')</button>';
      }).join('');
  }

  function collections() {
    var el = document.getElementById('st-coll');
    if (!el) return;
    /* One hero per collection, chosen not found — taking "the first product with
       a photo" pulled a COMING SOON placeholder onto Service Milestones, and a
       collection tile is the one image that has to carry. */
    var HERO = {
      appreciation: 'pak-command-center-kit-heroA',
      safety:       'safe-250k-3item-v2',
      milestone:    'medal-c-1m-v1',
      onboarding:   'pak-premium-onboarding-hero',
      milepacks:    'mp-04-1',
      holiday:      'wk-group-lifestyle'
    };
    var SUB = {
      appreciation: 'Driver Appreciation Week',
      safety:       'Safe miles, earned',
      milestone:    '250K to 6 million',
      onboarding:   'Day one, done right',
      milepacks:    'Quarterly recognition',
      holiday:      'The family sees this one'
    };
    el.innerHTML = CAT.programs.filter(function (g) { return g.count; }).map(function (g) {
      var first = CAT.products.filter(function (p) { return p.program === g.slug; })[0];
      var key = HERO[g.slug];
      var s = (key && CAT.shots && CAT.shots[key]) || (first && first.shot);
      if (!s) return '';
      return '<a href="?c=' + esc(g.slug) + '" data-jump="' + esc(g.slug) + '">' +
        '<img src="' + esc(s.src) + '" srcset="' + esc(s.srcset) + '" alt="' + esc(g.label) + '" width="700" height="560">' +
        '<span class="lab st-ui"><b>' + esc(g.label) + '</b>' +
        '<span>' + esc(SUB[g.slug] || (g.count + ' pieces')) + '</span></span></a>';
    }).join('');
  }

  /* ── the bag ────────────────────────────────────────────────────────────── */
  var FREE_FREIGHT = 1500; // fleet orders — the threshold the cart page already states

  function paintBag() {
    if (!window.Cart) return;
    var items = Cart.get();
    var total = Cart.total();
    var n = items.reduce(function (s, i) { return s + i.qty; }, 0);
    document.querySelectorAll('[data-bag-count]').forEach(function (e) { e.textContent = n; });
    var lines = document.getElementById('st-lines');
    if (lines) {
      lines.innerHTML = items.length ? items.map(function (l, idx) {
        return '<div class="line st-ui">' +
          '<span class="ph"><img src="' + esc(l.image || '') + '" alt=""></span>' +
          '<span><span class="t">' + esc(l.name) + '</span>' +
          '<span class="c" style="display:block">' + esc(l.category || '') + '</span>' +
          '<span class="c" style="display:block">Qty ' + l.qty + '</span>' +
          '<span style="display:block">' + money(l.price * l.qty) + '</span>' +
          '<button class="rm st-micro" data-remove="' + idx + '">Remove</button></span></div>';
      }).join('') : '<p class="empty st-ui">Your bag is empty.</p>';
    }
    var sub = document.getElementById('st-subtotal');
    if (sub) sub.textContent = money(total);
    var pct = Math.min(100, total / FREE_FREIGHT * 100);
    var bar = document.getElementById('st-tierbar');
    if (bar) bar.style.width = pct + '%';
    var txt = document.getElementById('st-tiertext');
    if (txt) txt.textContent = total >= FREE_FREIGHT
      ? 'Free freight unlocked'
      : 'Add ' + money(FREE_FREIGHT - total) + ' for free freight';
    var btn = document.getElementById('st-checkout');
    if (btn) btn.disabled = !items.length;
  }

  function openBag(on) {
    var d = document.getElementById('st-drawer');
    var s = document.getElementById('st-scrim');
    if (d) d.setAttribute('data-open', String(on));
    if (s) s.setAttribute('data-open', String(on));
    document.body.style.overflow = on ? 'hidden' : '';
  }

  /* ── wiring ─────────────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var chip = e.target.closest && e.target.closest('#st-chips button, [data-jump]');
    if (chip) {
      e.preventDefault();
      state.program = chip.dataset.f || chip.dataset.jump;
      /* Which occasion actually drives demand is the second-most useful number
         on this store, so a tile click and a chip click are recorded separately. */
      push(chip.dataset.jump ? 'collection_tile' : 'filter_program', { program: state.program });
      render();
      var h = document.getElementById('st-shop');
      if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    var plus = e.target.closest && e.target.closest('.st-card .plus');
    if (plus) {
      var c = plus.closest('.st-card');
      c.setAttribute('data-open', c.getAttribute('data-open') === 'true' ? 'false' : 'true');
      return;
    }
    /* The variant bar covers the bottom of the photograph while open, so it
       needs its own way out — on touch there is no hover to dismiss it. */
    var close = e.target.closest && e.target.closest('.st-card .qtys .close');
    if (close) { close.closest('.st-card').setAttribute('data-open', 'false'); return; }
    var add = e.target.closest && e.target.closest('[data-add]');
    if (add) {
      var p = CAT.products.filter(function (x) { return x.id === add.dataset.add; })[0];
      if (p && window.Cart) {
        var n = parseInt(add.dataset.qty, 10);
        Cart.add({ id: p.id, name: p.name, price: p.price, image: p.shot.src, category: p.programLabel, minQty: p.minQty }, n);
        add.closest('.st-card').setAttribute('data-open', 'false');
        track('addToCart', { sku: p.id, name: p.name, price: p.price, qty: n });
        push('quick_add', { product_id: p.id, program: p.program, qty: n });
        paintBag(); openBag(true);
      }
      return;
    }
    var rm = e.target.closest && e.target.closest('[data-remove]');
    if (rm && window.Cart) { Cart.removeAt(parseInt(rm.dataset.remove, 10)); paintBag(); return; }
    if (e.target.closest && e.target.closest('[data-open-bag]')) { paintBag(); openBag(true); return; }
    if (e.target.closest && e.target.closest('[data-close-bag]')) { openBag(false); return; }
  });

  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') openBag(false); });
  window.addEventListener('das:favchange', function () {
    document.querySelectorAll('[data-wish-count]').forEach(function (e) {
      e.textContent = window.Favorites ? Favorites.load().length : 0;
    });
  });

  root.querySelectorAll('[data-view]').forEach(function (b) {
    b.addEventListener('click', function () {
      state.view = b.dataset.view;
      gridEl.setAttribute('data-view', state.view);
      root.querySelectorAll('[data-view]').forEach(function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
    });
  });

  /* ── boot ───────────────────────────────────────────────────────────────── */
  fetch('/store-catalog.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (data) {
    CAT = data;
    /* a lookup of every shot by file key, so a collection hero can be chosen by name */
    CAT.shots = {};
    CAT.products.forEach(function (p) {
      var k = p.shot.src.split('/').pop().replace('.webp', '');
      CAT.shots[k] = p.shot;
      (p.gallery || []).forEach(function (g) {
        CAT.shots[g.src.split('/').pop().replace('.webp', '')] = g;
      });
    });
      /* This script also runs on the PDP, where the shop grid does not exist.
       Without this guard render() dereferences a null #st-grid, throws, and
       takes paintBag() down with it — so the bag counter in the header would
       silently read 0 on every product page. */
    if (!gridEl) { paintBag(); return; }
    /* `c` is this store's param. `category` is the OLD shop's, and it is still
       carried by inbound links, the /solution-* redirects and anything anyone
       has ever shared — /shop now 301s here, so those arrive with it. The old
       slug aliases come across too, for the same reason they existed there. */
    var sp = new URLSearchParams(location.search);
    var ALIAS = { 'safe-miles-programs': 'milepacks', 'mile-packs': 'milepacks', 'safemiles': 'milepacks' };
    var q = sp.get('c') || sp.get('category');
    if (q && ALIAS[q]) q = ALIAS[q];
    if (q && CAT.programs.some(function (g) { return g.slug === q; })) state.program = q;
    chips(); collections(); render(); paintBag();
    document.querySelectorAll('[data-wish-count]').forEach(function (e) {
      e.textContent = window.Favorites ? Favorites.load().length : 0;
    });
  }).catch(function () {
    gridEl.innerHTML = '<p class="st-ui" style="padding:40px 0;color:#737373">The catalogue could not be loaded. ' +
      '<a href="shop.html" style="text-decoration:underline">Browse the full shop</a>.</p>';
  });
})();
