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
  /* null = no search running. An empty ARRAY is a real result meaning "nothing
     matched", and must not be mistaken for "no search" — that distinction is
     the whole difference between an empty grid and the full catalogue. */
  var searchResults = null;

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  var money = function (n) { return '$' + Number(n).toFixed(2); };

  /* CARD IMAGE — the composed 4:5 derivative, not the 5:4 cover one.
     The grid frame is portrait now (one ratio site-wide, matching the
     reference), and the cover derivative is landscape, so using it here would
     crop 47% off a landscape kit shot — the exact thing the composed frames
     were built to avoid. `pdp` is already 4:5, already filled, already
     ladder-sized; `sizes` is what lets the browser pick the right rung for a
     ~380px card instead of assuming the full viewport. */
  function cardImg(p, eager) {
    var v = (p.shot && p.shot.pdp) || p.shot || {};
    return '<img src="' + esc(v.src) + '" srcset="' + esc(v.srcset) + '"' +
      (v.sizes ? ' sizes="(min-width:1024px) 20vw, 50vw"' : '') +
      ' alt="' + esc(p.name) + '" width="' + (v.w || 1120) + '" height="' + (v.h || 1400) + '"' +
      (eager ? '' : ' loading="lazy"') + '>';
  }


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
          '<a class="frame" href="/store-product.html?id=' + encodeURIComponent(p.id) + '" aria-label="' + esc(p.name) + '">' +
            (p.badge ? '<span class="badge">' + esc(p.badge) + '</span>' : '') +
            cardImg(p, i < 8) +
          '</a>' +
          '<button class="fav' + (saved ? ' fav-active' : '') + '" data-save-to-fav aria-label="Save ' + esc(p.name) + ' for later">' + heart(saved) + '</button>' +
          /* a bare 12x12 plus glyph, not a bordered box */
          /* A milestone kit cannot be quick-added: api/create-checkout.js rejects
             400 "Please select a milestone level"
           when the line has no level, so a "+" here would put a buyer into a
           bag that fails at checkout. Those route to the product page instead.
           comingSoon pieces are not purchasable at all (Catalog.resolve returns
           "unknown" and the server refuses them). */
        /* EVERY preview now offers an action on hover, not only the 14
           purchasable ones. A gated piece cannot be added to a bag — its price
           is not public — so its hover CTA is the one that actually moves it
           forward: request pricing, carrying the product so the form arrives
           pre-filled. Offering a "+" that cannot work would be worse than
           offering nothing. */
        (p.comingSoon ? '' :
          p.gated
            ? '<a class="choose" href="/contact.html?intent=pricing&amp;product=' + encodeURIComponent(p.id) +
              '&amp;name=' + encodeURIComponent(p.name) + '">Request pricing</a>'
            : p.milestoneSelect
              ? '<a class="choose" href="/store-product.html?id=' + encodeURIComponent(p.id) + '">Choose level</a>'
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
            '<a class="t" href="/store-product.html?id=' + encodeURIComponent(p.id) + '">' + esc(p.name) + '</a>' +
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
    if (searchResults) return searchResults;
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

  /* ── THE INDEX — option D ────────────────────────────────────────────────
     Jayden picked this from /store-lab: type leads, one photograph follows the
     cursor. It reads fastest of the five, costs the least vertical space after
     the scroll rail, and it is the only option that survives the photography
     being mid-reshoot — which matters while all six programme banners are
     placeholders. */
  function index() {
    var el = document.getElementById('st-index');
    if (!el) return;
    var gs = groups();
    if (!gs.length) return;

    el.innerHTML =
      '<div class="ix-list">' + gs.map(function (g, i) {
        return '<a class="ix-row" href="/collections/' + esc(g.slug) + '" data-jump="' + esc(g.slug) + '" data-i="' + i + '"' +
          (i ? '' : ' aria-current="true"') + '>' +
          '<span class="n">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<span class="t">' + esc(g.label) + '</span>' +
          '<span class="c">' + g.count + '</span></a>';
      }).join('') + '</div>' +
      '<div class="ix-shot">' + gs.map(function (g, i) {
        var v = (g.shot && g.shot.pdp) || g.shot;
        return '<img class="' + (i ? '' : 'on') + '" data-i="' + i + '" src="' + esc(v.src) + '"' +
          ' srcset="' + esc(v.srcset) + '" sizes="(min-width:1024px) 50vw, 100vw"' +
          ' alt="' + esc(g.label) + '"' + (i ? ' loading="lazy"' : '') + '>';
      }).join('') + '</div>';

    var shots = el.querySelectorAll('.ix-shot img');
    el.addEventListener('mouseover', function (e) {
      var row = e.target.closest && e.target.closest('.ix-row');
      if (!row) return;
      el.querySelectorAll('.ix-row').forEach(function (r) { r.removeAttribute('aria-current'); });
      row.setAttribute('aria-current', 'true');
      shots.forEach(function (im) { im.classList.toggle('on', im.dataset.i === row.dataset.i); });
    });
  }

  /** The six programmes that actually have products, with their hero shot. */
  function groups() {
    var HERO = window.DAS_STORE_HEROES || {};
    var SUB = window.DAS_STORE_SUBS || {};
    return CAT.programs.filter(function (g) { return g.count; }).map(function (g) {
      var list = CAT.products.filter(function (p) { return p.program === g.slug; });
      var key = HERO[g.slug];
      var shot = (key && CAT.shots && CAT.shots[key]) || (list[0] && list[0].shot);
      return { slug: g.slug, label: g.label, count: g.count, sub: SUB[g.slug] || '', shot: shot, list: list };
    }).filter(function (g) { return g.shot; });
  }

  /* Arrows show only when there is somewhere to go, and update as the row
     moves — an arrow that does nothing is worse than no arrow. */
  function wireRows() {
    document.querySelectorAll('.st-rowwrap').forEach(function (wrap) {
      var row = wrap.querySelector('.st-row');
      var prev = wrap.querySelector('.rw-prev');
      var next = wrap.querySelector('.rw-next');
      if (!row || !prev || !next) return;

      function sync() {
        var over = row.scrollWidth > row.clientWidth + 4;
        /* AT REST THE ROW IS NOT AT ZERO. It carries 24px of side padding, so
           its resting scrollLeft is 24 and a "< 8" test called that scrolled --
           the back arrow sat there on first paint pointing at nothing. The
           first card's own offset is the only honest floor. */
        var first = row.querySelector('.st-card');
        var rest = first ? first.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft : 0;
        prev.hidden = !over || row.scrollLeft <= rest + 4;
        next.hidden = !over || row.scrollLeft > row.scrollWidth - row.clientWidth - 8;
      }
      /* SCROLL TO A SNAP POINT, NEVER BETWEEN TWO. The row is
         scroll-snap-type:x mandatory, so a scrollBy() of an arbitrary distance
         is snapped back to the nearest card the moment the animation settles --
         which, for a page-sized jump, was the card it started on. The arrow
         appeared dead: clicked, animated, returned to 24. Landing on a card's
         exact offset keeps the snap and the arrow agreeing. */
      function step(dir) {
        var cards = [].slice.call(row.querySelectorAll('.st-card'));
        if (!cards.length) return;
        var rl = row.getBoundingClientRect().left;
        var at = cards.map(function (c) { return c.getBoundingClientRect().left - rl + row.scrollLeft; });

        var cur = 0;
        for (var i = 0; i < at.length; i++) if (at[i] <= row.scrollLeft + 4) cur = i;

        var per = Math.max(1, Math.floor(row.clientWidth / (cards[0].getBoundingClientRect().width + 1)));
        var want = Math.min(at.length - 1, Math.max(0, cur + dir * per));
        row.scrollTo({ left: at[want], behavior: 'smooth' });
      }
      prev.addEventListener('click', function () { step(-1); });
      next.addEventListener('click', function () { step(1); });

      var t;
      row.addEventListener('scroll', function () {
        if (t) return;
        t = requestAnimationFrame(function () { t = 0; sync(); });
      }, { passive: true });
      window.addEventListener('resize', sync);
      /* images change the width as they load, so re-check once settled */
      sync();
      setTimeout(sync, 400);
      setTimeout(sync, 1400);
    });
  }

  /* A BANNER IS TWO PHOTOGRAPHS OF ONE THING, NOT ONE PHOTOGRAPH TWICE.
     .st-banner is height:clamp(300px,34vw,650px) with object-fit:cover, so its
     aspect changes with the window: 2.94 at 1900px wide, 1.30 at 390px. The
     2400x820 desktop cut covering a 1.30 box keeps only its middle 44% of
     width — and in this art direction the product sits FAR RIGHT, so a phone
     would have shown six banners of empty concrete with the product cropped
     clean off the edge. srcset cannot fix that: w-descriptors choose by
     resolved width, and what changes here is the CROP, not the resolution.
     So <picture> with a media source, and scripts/cut-banners.mjs cuts a
     right-anchored 1080x830 from the same master. Same object, same light,
     framed for the slot it lands in. */
  function bannerImg(b, alt, lazy, slot) {
    var img = '<img src="' + esc(b.src) + '" srcset="' + esc(b.srcset) + '" sizes="100vw"' +
      ' alt="' + esc(alt || '') + '" width="' + b.w + '" height="' + b.h + '"' +
      (lazy ? ' loading="lazy"' : '') + '>';
    /* THE COLLECTION HERO IS A DIFFERENT SLOT, NOT A SMALLER ONE. On a phone
       .st-banner is 375x300 (1.25) and .cl-hero is 375x180 (2.08). The phone
       crop puts the product dead centre under the hero's title; the wide crop
       loses 29% of its width there, which in this art direction IS the
       product. So each takes the cut composed for it. */
    var narrow = slot === 'hero'
      ? { src: b.hero, w: b.heroW || 1100, h: b.heroH || 530 }
      : { src: b.mobile, w: b.mobileW || 1080, h: b.mobileH || 830 };
    if (!narrow.src) return img;
    return '<picture>' +
      '<source media="(max-width:767px)" srcset="' + esc(narrow.src) + '"' +
        ' width="' + narrow.w + '" height="' + narrow.h + '">' +
      img +
    '</picture>';
  }

  /* THE COLLECTION HERO — only on /collections/<slug>. The banner the home
     rhythm uses, with the programme's name, its count and one line on what it
     is for, so a collection page announces itself instead of opening on a
     bare grid. */
  function collectionHero() {
    var el = document.getElementById('cl-hero');
    if (!el) return;
    var g = groups().filter(function (x) { return x.slug === state.program; })[0];
    if (!g) { el.remove(); return; }

    var b = (BANNERS && BANNERS[g.slug]) || null;
    el.innerHTML =
      (b ? bannerImg(b, '', false, 'hero') : '') +
      '<div class="cl-copy">' +
        '<p class="k st-micro">' + esc(g.sub || 'Collection') + '</p>' +
        '<h1>' + esc(g.label) + '</h1>' +
        '<p class="n st-ui">' + g.count + ' ' + (g.count === 1 ? 'piece' : 'pieces') + '</p>' +
      '</div>';
    if (b && b.kind === 'placeholder') el.setAttribute('data-placeholder', 'true');

    var crumb = document.getElementById('cl-crumb-now');
    if (crumb) crumb.textContent = g.label;
    document.title = g.label + ' — Driver Appreciation Solutions';
  }

  /* ── THE HOME RHYTHM ─────────────────────────────────────────────────────
     Jayden 2026-09-24: "why does it just scrojll down on all the products not
     categorized and not looking like the 1-1 siiite i asked u to copy".

     Measured on shop.griffain.io's home: ELEVEN sections alternating a
     full-bleed banner (1900x650) with a horizontal product row (606px tall,
     cards 356x567, gap 1px, heading 12px/16px weight 500) — never one long
     grid. This page was a collections strip followed by all 54 products in a
     single four-column grid, which is the opposite arrangement.

     So: banner, that programme's products, repeat. The banners come from
     images/store/banner-manifest.json, where all six are currently branded
     PLACEHOLDERS naming the shot that is missing — no DAS photograph is
     anywhere near 2.93:1. See PHOTO-SHOT-LIST.md. */
  function home() {
    var el = document.getElementById('st-home');
    if (!el) return;
    var gs = groups();

    el.innerHTML = gs.map(function (g) {
      var b = (BANNERS && BANNERS[g.slug]) || null;
      var banner = b
        ? '<a class="st-banner" href="/collections/' + esc(g.slug) + '" data-jump="' + esc(g.slug) + '"' +
            (b.kind === 'placeholder' ? ' data-placeholder="true"' : '') + '>' +
            bannerImg(b, g.label, true) +
            (b.kind === 'placeholder' ? '' :
              '<span class="cap"><b>' + esc(g.label) + '</b><span>' + esc(g.sub) + '</span></span>') +
          '</a>'
        : '';

      /* THE ROW CARRIES THE WHOLE COLLECTION. Jayden 2026-09-24: "if they don't
         want to see all, they should be able to scroll. We should really show
         all the products in that cat collection, but if we do see all, then it
         takes us to that page." So the rail holds every piece in the programme
         and scrolls; "See all N" is the escape to the collection page for
         anyone who would rather have a grid. Lazy loading keeps the cost flat —
         only the cards actually scrolled into view fetch an image. */
      var six = g.list;
      return '<section class="st-prog" id="prog-' + esc(g.slug) + '">' +
        banner +
        '<div class="st-rowhead st-ui">' +
          '<h2>' + esc(g.label) + '</h2>' +
          '<a href="/collections/' + esc(g.slug) + '" data-jump="' + esc(g.slug) + '">See all ' + g.count + '</a>' +
        '</div>' +
        /* A SCROLLER NOBODY CAN SEE IS NOT A SCROLLER. The row has always been
           overflow-x:auto, but with no scrollbar and no arrows there was
           nothing to say so, and a mouse cannot scroll sideways at all —
           "there's no scroller on mobile and desktop". Arrows appear only when
           the row actually overflows, and are hidden at the ends. */
        '<div class="st-rowwrap">' +
          '<button type="button" class="rw-arw rw-prev" data-row="-1" aria-label="Scroll ' + esc(g.label) + ' left" hidden>' +
            '<svg width="8" height="14" viewBox="0 0 7 13" fill="none"><path d="M6 1 1 6.5 6 12" stroke="currentColor" stroke-width="1.5"/></svg></button>' +
          '<div class="st-row">' + six.map(card).join('') + '</div>' +
          '<button type="button" class="rw-arw rw-next" data-row="1" aria-label="Scroll ' + esc(g.label) + ' right" hidden>' +
            '<svg width="8" height="14" viewBox="0 0 7 13" fill="none"><path d="m1 1 5 5.5L1 12" stroke="currentColor" stroke-width="1.5"/></svg></button>' +
        '</div>' +
      '</section>';
    }).join('');
  }

  /* -- SHOP BY PROGRAM: the full-bleed parallax -------------------------
     A 1:1 rebuild of the section at the bottom of shop.griffain.io
     (id="shopify-section-parallax"). Every number below was read off theirs:

       media    one panel per collection, height 100vh, object-fit:cover,
                a desktop <source> at 1920x1080 and a mobile <img> at 1920x2364
       content  sticky at top:40vh with a matching margin-top:40vh, 79px of
                vertical padding, 44px between its three blocks, centred, caps
       eyebrow  11/15, weight 500
       titles   30px (32 at lg), weight 700, tracking -1.5px, leading none;
                resting opacity .3, hover .5, active 1, 300ms
       CTA      a 12x9 arrow then the program name, 11/15

     Both columns occupy the SAME grid cell, so the row is as tall as the media
     (N x 100vh) and the content stays pinned through all of it. That is the
     whole mechanism -- there is no scroll library on their page and there is
     none on ours.

     Every panel is a placeholder until the photographs exist; see
     PHOTO-SHOT-LIST-PARALLAX.md for the two crops each program needs. */
  function parallax() {
    var el = document.getElementById('st-parallax');
    if (!el || !PARALLAX) return;
    var gs = groups().filter(function (g) { return PARALLAX[g.slug]; });
    if (gs.length < 2) return;

    var first = gs[0].slug;

    var media = gs.map(function (g) {
      var m = PARALLAX[g.slug];
      return '<div class="px-panel" id="px-' + esc(g.slug) + '" aria-label="' + esc(g.label) + '">' +
        '<a href="/collections/' + esc(g.slug) + '" tabindex="-1" aria-hidden="true">' +
          '<picture>' +
            '<source media="(min-width:1024px)" srcset="' + esc(m.desktop) + '" width="1920" height="1080">' +
            '<img src="' + esc(m.mobile) + '" width="1920" height="2364" loading="lazy" alt="">' +
          '</picture>' +
        '</a></div>';
    }).join('');

    var list = gs.map(function (g, i) {
      return '<h3><button type="button" data-px="' + esc(g.slug) + '"' +
        (i === 0 ? ' aria-current="true"' : '') + '>' + esc(g.label) + '</button></h3>';
    }).join('');

    el.innerHTML =
      '<section class="st-px" data-active="' + esc(first) + '">' +
        '<div class="px-media">' + media + '</div>' +
        '<div class="px-content">' +
          '<div class="px-in st-ui">' +
            '<h2 class="px-eyebrow">Shop by program</h2>' +
            '<div class="px-list">' + list + '</div>' +
            '<div class="px-foot">' +
              '<a class="px-go" data-px-cta href="/collections/' + esc(first) + '">' +
                '<svg width="12" height="9" viewBox="0 0 12 9" fill="none" aria-hidden="true">' +
                  '<path d="M1 4.5h10" stroke="currentColor"/><path d="M7.5 1 11 4.5" stroke="currentColor"/>' +
                  '<path d="M7.5 8 11 4.5" stroke="currentColor"/></svg>' +
                '<span>Shop ' + esc(gs[0].label) + '</span>' +
              '</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';

    wireParallax(el, gs);
  }

  /* The active program is whichever panel is crossing the line the sticky type
     sits on. Read on scroll rather than observed, because an IntersectionObserver
     on 100vh panels fires on thresholds, not on a line, and the type would swap
     a third of a screen early. */
  function wireParallax(el, gs) {
    var sec = el.querySelector('.st-px');
    var panels = [].slice.call(el.querySelectorAll('.px-panel'));
    var buttons = [].slice.call(el.querySelectorAll('[data-px]'));
    var cta = el.querySelector('[data-px-cta]');
    var ctaText = cta && cta.querySelector('span');
    var current = null;

    function sync() {
      var line = window.innerHeight * 0.45;          /* where the sticky type sits */
      var hit = null;
      for (var i = 0; i < panels.length; i++) {
        var r = panels[i].getBoundingClientRect();
        if (r.top <= line && r.bottom > line) { hit = panels[i]; break; }
      }
      if (!hit) {
        /* above the first panel or below the last -- hold the nearest end */
        var firstR = panels[0].getBoundingClientRect();
        hit = firstR.top > line ? panels[0] : panels[panels.length - 1];
      }
      var slug = hit.id.replace(/^px-/, '');
      if (slug === current) return;
      current = slug;
      sec.setAttribute('data-active', slug);
      buttons.forEach(function (b) {
        if (b.dataset.px === slug) b.setAttribute('aria-current', 'true');
        else b.removeAttribute('aria-current');
      });
      var g = gs.filter(function (x) { return x.slug === slug; })[0];
      if (cta && g) {
        cta.setAttribute('href', '/collections/' + g.slug);
        if (ctaText) ctaText.textContent = 'Shop ' + g.label;
      }
    }

    /* Throttled on the clock, not on a frame. sync() reads six rects and sets
       one attribute; that is cheaper than the rAF bookkeeping around it, and a
       frame callback is throttled to nothing whenever the document is not
       visible -- which silently makes the whole section look broken. */
    var last = 0;
    function onScroll() {
      var now = Date.now();
      if (now - last < 60) return;
      last = now;
      sync();
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    /* clicking a name scrolls to its panel, exactly as theirs does */
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var t = document.getElementById('px-' + b.dataset.px);
        if (!t) return;
        var y = t.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.4;
        window.scrollTo({ top: y, behavior: 'smooth' });
        push('parallax_jump', { program: b.dataset.px });
      });
    });

    sync();
  }

  /* NOTE: the rows use the SAME card() declared above — deliberately not a
     second, simpler one. A duplicate here would hoist over the real card and
     silently drop its data-product-* attributes, which js/cart.js reads to
     build a favourite, and its quick-add controls. */

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
    /* A COLLECTION LINK IS A LINK. This used to catch [data-jump] as well and
       call preventDefault() on it, so every banner, index row and "See all"
       was swallowed and turned into an in-page filter — the collection pages
       existed, the hrefs were correct, and clicking one never left the home
       page. That is why the whole thing read as "not connected".

       Now only the CHIPS are intercepted, because a chip genuinely filters the
       list in place. Anything with an href navigates, and is recorded on the
       way out without being stopped. */
    var jump = e.target.closest && e.target.closest('[data-jump]');
    if (jump && jump.getAttribute('href')) {
      push('collection_tile', { program: jump.dataset.jump });
      return;                                   // let the browser do its job
    }

    var chip = e.target.closest && e.target.closest('#st-chips button');
    if (chip) {
      e.preventDefault();
      state.program = chip.dataset.f;
      /* Which occasion actually drives demand is the second-most useful number
         on this store, so a tile click and a chip click are recorded separately. */
      push('filter_program', { program: state.program });
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
  var BANNERS = null;
  var PARALLAX = null;
  Promise.all([
    fetch('/store-catalog.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }),
    /* The banners are optional: if the manifest is missing the rhythm still
       renders, just without its banner images, rather than the whole page
       failing on a file that only affects decoration. */
    fetch('/images/store/banner-manifest.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    fetch('/images/store/parallax-manifest.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
  ]).then(function (both) {
    var data = both[0];
    BANNERS = (both[1] && both[1].banners) || null;
    PARALLAX = both[2] || null;
    CAT = data;
    /* A lookup of every shot by file key, so a collection hero can be chosen by
       name. SEEDED FROM THE CATALOGUE, not rebuilt: this used to start empty
       and take only product shots, so any hero that is not some product's
       primary photo — medal-c-1m-v1, for one — never resolved, and every
       collection tile silently fell back to "the first product in the
       programme". For Service Milestone Awards that first product is the
       250,000 placeholder, which is the exact outcome the HERO map exists to
       prevent. */
    CAT.shots = Object.assign({}, data.shots || {});
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
    /* /collections/<slug> is a real page now, so the slug can arrive in the
       PATH as well as the query. Both resolve to the same state. */
    var pathSlug = (location.pathname.match(/\/collections\/([a-z0-9-]+)/i) || [])[1];
    var want = pathSlug || q;
    if (want && CAT.programs.some(function (g) { return g.slug === want; })) state.program = want;
    /* A filtered view genuinely IS one list, so ?c=<programme> keeps the grid.
       With no filter the home shows the rhythm instead. */
    var filtered = state.program !== 'all';
    var homeEl = document.getElementById('st-home');
    var shopEl = document.getElementById('st-shop');
    var idxEl = document.getElementById('st-index');
    if (homeEl) homeEl.hidden = filtered;
    if (idxEl) idxEl.hidden = filtered;
    if (shopEl) shopEl.hidden = !filtered;

    /* Repaint on every cart change, not just at load. cart.js now fires
       cart:change from its single announcement point. */
    document.addEventListener('cart:change', paintBag);

    /* Name the list. The grid heading is static markup ("Shop all" on the
       store, "Collection" on a collection page), so it has to be told what it
       is actually showing — otherwise a filtered view lies about itself. */
    var titleEl = document.getElementById('st-shop-title');
    if (titleEl) {
      var tg = CAT.programs.filter(function (x) { return x.slug === state.program; })[0];
      titleEl.textContent = tg ? tg.label : 'Shop all';
    }

    /* THE SEARCH drives the same render path as the chips, so a query and a
       filter cannot disagree about what the grid is showing. Passing null
       clears the override and the chips take back over. */
    if (window.DASStoreSearch) {
      window.DASStoreSearch.mount({
        catalog: CAT,
        onApply: function (list) { searchResults = list; render(); },
      });
    }

    collectionHero();

    chips();
    index();
    if (!filtered) home();
    if (!filtered) parallax();
    /* AFTER home(), not before — the rows do not exist until it renders them,
       so wiring first found nothing and every arrow stayed hidden. */
    wireRows();
    render();
    paintBag();
    document.querySelectorAll('[data-wish-count]').forEach(function (e) {
      e.textContent = window.Favorites ? Favorites.load().length : 0;
    });
  }).catch(function () {
    gridEl.innerHTML = '<p class="st-ui" style="padding:40px 0;color:#737373">The catalogue could not be loaded. ' +
      '<a href="/shop.html" style="text-decoration:underline">Browse the full shop</a>.</p>';
  });
})();
