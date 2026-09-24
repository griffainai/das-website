/* ============================================================================
   STORE SEARCH — a guided doorway, not a text filter
   ----------------------------------------------------------------------------
   Jayden: "The AI search bar needs to be designed differently and show that
   it's an AI search and offer suggestions of what to search... it shouldn't be
   based on the exact name. If they misspell it, it should be redirected."

   WHAT CHANGED FROM THE FIRST VERSION
     · It suggests before you type, so the empty state teaches the vocabulary.
     · It suggests WHILE you type, as a panel of real destinations — pieces,
       programs, pages — and Enter goes to the top one.
     · It forgives spelling. "hoodee", "aprecation", "milion mile" all land.
     · It routes. On the shop it filters the grid; anywhere else it navigates.
     · It hands genuinely open questions to Scout at /api/chat.

   THE MODEL QUESTION, ANSWERED HONESTLY. Matching 54 known products by name,
   program, contents and price is a lookup: the data is right here, the answer
   is exact, it costs nothing, it works offline, and it cannot invent a SKU that
   does not exist. Rule #17 — a deterministic job is a script. What a model is
   genuinely better at is the open question ("300 drivers, half hit 250k miles,
   what should a year look like?"), and that goes to api/chat.js, which already
   sits behind the guard wall: one chokepoint, kill switch, spend ceiling, rate
   ceiling, meter. So the fast path is free and the smart path is metered, and
   neither pretends to be the other.
   ========================================================================== */
(function () {
  'use strict';

  var input, panel, host, CAT = null, onApply = null, mounted = false;
  var rows = [], cursor = -1, lastQ = '';

  var SEEDS = [
    'Safety awards under $50',
    'Something for 250 drivers',
    'Million mile milestone',
    'New driver welcome kit',
    'Holiday gift for the whole fleet',
  ];

  var SYNONYMS = {
    appreciation: ['appreciation', 'appreciation week', 'daw', 'thank you', 'thank-you', 'gift', 'gifts', 'kit', 'kits', 'driver week'],
    safety:       ['safety', 'safe', 'safe driving', 'accident free', 'accident-free', 'incident free', 'clean record'],
    milestone:    ['milestone', 'anniversary', 'years of service', 'service award', 'million mile', 'million miles', 'tenure', 'longevity'],
    milepacks:    ['safe miles', 'mile pack', 'mile packs', 'quarterly', 'miles program'],
    onboarding:   ['onboarding', 'new hire', 'new driver', 'orientation', 'welcome', 'day one', 'first day'],
    holiday:      ['holiday', 'christmas', 'seasonal', 'end of year', 'year end'],
  };

  var PAGES = [
    { label: 'Buy for my company', href: '/company-purchasing.html', words: 'company purchasing po net 30 invoice procurement bulk' },
    { label: 'Request a quote',    href: '/contact.html?intent=pricing', words: 'quote pricing price cost estimate budget' },
    { label: 'Your bag',           href: '/store-cart.html', words: 'bag cart checkout order' },
    { label: 'Saved kits',         href: '/store-saved.html', words: 'saved favourites favorites wishlist' },
    { label: 'Driver surveys',     href: '/surveys.html', words: 'survey feedback driver opinion' },
    { label: 'Insights & ideas',   href: '/ideas.html', words: 'ideas insights blog articles guides' },
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* Levenshtein, capped. Bails as soon as the best possible score exceeds the
     cap, because a distance of 9 and a distance of 4 are equally useless here. */
  function dist(a, b, cap) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > cap) return cap + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur[0] = i;
      var best = i;
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1,
                          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
        if (cur[j] < best) best = cur[j];
      }
      if (best > cap) return cap + 1;
      prev = cur.slice();
    }
    return prev[b.length];
  }

  /* How well one typed word matches a haystack of words. Forgiving by design:
     a prefix counts, and so does a near-miss whose length makes a typo likely. */
  function wordScore(w, words) {
    var best = 0;
    for (var i = 0; i < words.length; i++) {
      var t = words[i];
      if (!t) continue;
      if (t === w) { best = Math.max(best, 10); continue; }
      if (t.indexOf(w) === 0) { best = Math.max(best, 8); continue; }
      if (w.length > 3 && t.indexOf(w) > -1) { best = Math.max(best, 6); continue; }
      if (w.length >= 4) {
        var cap = w.length >= 7 ? 2 : 1;
        var d = dist(w, t, cap);
        if (d <= cap) best = Math.max(best, 6 - d);          /* "hoodee" -> "hoodie" */
      }
    }
    return best;
  }

  function parse(q) {
    var t = ' ' + norm(q) + ' ';
    var out = { drivers: null, maxPrice: null, minPrice: null, program: null, words: [] };

    var under = t.match(/(?:under|below|less than|max|up to)\s*(\d+(?:\.\d+)?)/);
    if (under) out.maxPrice = parseFloat(under[1]);
    var over = t.match(/(?:over|above|more than|at least|from)\s*(\d+(?:\.\d+)?)/);
    if (over) out.minPrice = parseFloat(over[1]);
    var range = t.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/);
    if (range) { out.minPrice = parseFloat(range[1]); out.maxPrice = parseFloat(range[2]); }

    var drv = t.match(/(\d+)\s*\+?\s*(?:drivers?|people|employees|staff|trucks?)/);
    if (drv) out.drivers = parseInt(drv[1], 10);
    else {
      var bare = t.match(/(?:^|\s)(\d{2,6})(?:\s|$)/);
      if (bare && !under && !over && !range) out.drivers = parseInt(bare[1], 10);
    }

    var best = null;
    Object.keys(SYNONYMS).forEach(function (slug) {
      SYNONYMS[slug].forEach(function (w) {
        if (t.indexOf(' ' + w) > -1 && (!best || w.length > best.len)) best = { slug: slug, len: w.length };
      });
    });
    if (best) out.program = best.slug;

    out.words = norm(q).split(' ').filter(function (w) { return w.length > 2 && !/^\d+$/.test(w); });
    return out;
  }

  function productScore(p, Q) {
    var words = norm(p.name + ' ' + (p.programLabel || '') + ' ' + (p.blurb || '') + ' ' +
                     (p.badge || '') + ' ' + (p.included || []).join(' ')).split(' ');
    var nameWords = norm(p.name).split(' ');
    var s = 0;

    if (Q.program) { if (p.program !== Q.program) return 0; s += 30; }
    if (Q.maxPrice != null) {
      if (p.gated) s += 2;                       /* a quoted piece cannot be excluded on price */
      else if (p.price > Q.maxPrice) return 0;
      else s += 16;
    }
    if (Q.minPrice != null && !p.gated && p.price < Q.minPrice) return 0;
    /* A driver count is a MINIMUM-ORDER question: 40 drivers cannot buy a piece
       with a minimum of 100. It never excludes a piece the fleet is big enough for. */
    if (Q.drivers != null && (p.minQty || 1) > Q.drivers) return 0;
    if (Q.drivers != null) s += 8;

    var hits = 0;
    for (var i = 0; i < Q.words.length; i++) {
      var w = Q.words[i];
      var got = Math.max(wordScore(w, nameWords) * 2, wordScore(w, words));
      if (got > 0) hits++;
      s += got;
    }
    if (Q.words.length && !hits && !Q.program && Q.maxPrice == null && Q.drivers == null) return 0;
    return s;
  }

  function shotSrc(p) {
    var v = (p.shot && (p.shot.card || p.shot.pdp)) || p.shot || {};
    return v.src || '';
  }
  function priceLabel(p) {
    if (p.comingSoon) return 'Coming soon';
    if (p.gated) return 'Quoted';
    return p.price != null ? '$' + p.price : '';
  }

  function matched(Q) {
    return (CAT.products || []).map(function (p) { return { p: p, sc: productScore(p, Q) }; })
      .filter(function (x) { return x.sc > 0; })
      .sort(function (a, b) { return b.sc - a.sc; })
      .map(function (x) { return x.p; });
  }

  function build(q) {
    var Q = parse(q);
    var out = [];

    (CAT.programs || []).forEach(function (g) {
      var sc = Q.program === g.slug ? 40 : 0;
      var gw = norm(g.label).split(' ');
      Q.words.forEach(function (w) { sc += wordScore(w, gw) * 2; });
      if (sc > 6) out.push({ kind: 'Program', label: g.label, href: '/collections/' + g.slug, sc: sc, meta: 'Collection' });
    });

    matched(Q).slice(0, 6).forEach(function (p) {
      out.push({ kind: 'Product', label: p.name, href: '/store-product.html?id=' + encodeURIComponent(p.id),
                 sc: productScore(p, Q), meta: p.programLabel || '', price: priceLabel(p), img: shotSrc(p), id: p.id });
    });

    PAGES.forEach(function (pg) {
      var sc = 0, pw = norm(pg.label + ' ' + pg.words).split(' ');
      Q.words.forEach(function (w) { sc += wordScore(w, pw); });
      if (sc > 7) out.push({ kind: 'Page', label: pg.label, href: pg.href, sc: sc, meta: 'Page' });
    });

    out.sort(function (a, b) { return b.sc - a.sc; });
    return { Q: Q, rows: out.slice(0, 8) };
  }

  function readback(Q, n) {
    var bits = [];
    if (Q.program) {
      var g = (CAT.programs || []).filter(function (x) { return x.slug === Q.program; })[0];
      if (g) bits.push(g.label.toLowerCase());
    }
    if (Q.maxPrice != null && Q.minPrice != null) bits.push('$' + Q.minPrice + '–$' + Q.maxPrice);
    else if (Q.maxPrice != null) bits.push('under $' + Q.maxPrice);
    else if (Q.minPrice != null) bits.push('over $' + Q.minPrice);
    if (Q.drivers != null) bits.push('orderable for ' + Q.drivers.toLocaleString() + ' drivers');
    return n + (n === 1 ? ' match' : ' matches') + (bits.length ? ' · ' + bits.join(' · ') : '');
  }

  var ICON_PROGRAM = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
    '<rect x="1" y="1" width="5" height="5" stroke="currentColor"/><rect x="8" y="1" width="5" height="5" stroke="currentColor"/>' +
    '<rect x="1" y="8" width="5" height="5" stroke="currentColor"/><rect x="8" y="8" width="5" height="5" stroke="currentColor"/></svg>';
  var ICON_PAGE = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">' +
    '<rect x="2" y="1" width="10" height="12" stroke="currentColor"/>' +
    '<path d="M4.5 4.5h5M4.5 7h5M4.5 9.5h3" stroke="currentColor"/></svg>';

  function rowHTML(r, i) {
    var thumb = r.img
      ? '<span class="th"><img src="' + esc(r.img) + '" alt="" width="40" height="50" loading="lazy"></span>'
      : '<span class="th gl">' + (r.kind === 'Program' ? ICON_PROGRAM : ICON_PAGE) + '</span>';
    return '<a class="ss-row" role="option" id="ss-r' + i + '" data-i="' + i + '" href="' + esc(r.href) + '">' +
      thumb +
      '<span class="tx"><span class="nm">' + esc(r.label) + '</span>' +
      '<span class="mt">' + esc(r.meta || r.kind) + '</span></span>' +
      (r.price ? '<span class="pr">' + esc(r.price) + '</span>' : '') +
      '</a>';
  }

  function open() { host.classList.add('ss-open'); input.setAttribute('aria-expanded', 'true'); }
  function close() { host.classList.remove('ss-open'); input.setAttribute('aria-expanded', 'false'); cursor = -1; }

  function paintEmpty() {
    panel.innerHTML =
      '<div class="ss-head"><span class="ss-ai">Ask</span>fleet size, budget or occasion &mdash; plain English</div>' +
      '<div class="ss-seeds">' + SEEDS.map(function (s) {
        return '<button type="button" class="ss-seed" data-seed="' + esc(s) + '">' + esc(s) + '</button>';
      }).join('') + '</div>';
    rows = []; cursor = -1;
    open();
  }

  function paint(q) {
    var r = build(q);
    rows = r.rows;
    var body;
    if (!rows.length) {
      body = '<p class="ss-none">Nothing in the catalogue matches <b>' + esc(q) + '</b>.</p>';
    } else {
      body = '<div class="ss-head">' + esc(readback(r.Q, rows.length)) + '</div>' +
        '<div class="ss-rows" role="listbox">' + rows.map(rowHTML).join('') + '</div>';
    }
    /* Always offer the real conversation. A lookup answers "which piece"; it
       cannot answer "what should a year of recognition look like". */
    body += '<button type="button" class="ss-ask" data-ask>' +
      '<span class="ss-ai">Ask Scout</span><span class="q">&ldquo;' + esc(q) + '&rdquo;</span>' +
      '<span class="go" aria-hidden="true">&rarr;</span></button>';
    panel.innerHTML = body;
    cursor = -1;
    open();
    if (onApply) onApply(matched(r.Q));
  }

  function move(d) {
    var els = panel.querySelectorAll('.ss-row');
    if (!els.length) return;
    cursor += d;
    if (cursor >= els.length) cursor = 0;
    if (cursor < 0) cursor = els.length - 1;
    for (var i = 0; i < els.length; i++) els[i].classList.toggle('on', i === cursor);
    input.setAttribute('aria-activedescendant', 'ss-r' + cursor);
  }

  function ask(q) {
    if (!q) return;
    /* Hand the open question to the guarded endpoint. Nothing is streamed into
       this panel: the chat widget owns the conversation, so there is one place
       a model reply can appear and one place it is metered. */
    if (window.DASChat && window.DASChat.openWith) { window.DASChat.openWith(q); close(); return; }
    var btn = document.querySelector('[data-open-chat],.das-chat-launch,#das-chat-launch');
    if (btn) { try { sessionStorage.setItem('das_chat_seed', q); } catch (e) {} btn.click(); close(); return; }
    location.href = '/contact.html?intent=pricing&q=' + encodeURIComponent(q);
  }

  function run() {
    var q = (input.value || '').trim();
    if (q === lastQ) return;
    lastQ = q;
    if (!q) { paintEmpty(); if (onApply) onApply(null); return; }
    paint(q);
  }

  function mount(opts) {
    if (mounted) return;
    host = document.getElementById('st-search');
    CAT = opts && opts.catalog;
    onApply = (opts && opts.onApply) || null;
    if (!host || !CAT) return;
    mounted = true;

    host.innerHTML =
      '<div class="ss-box">' +
        '<span class="ss-spark" aria-hidden="true">' +
          '<svg width="15" height="15" viewBox="0 0 16 16" fill="none">' +
          '<path d="M8 1.4 9.3 5.3 13.2 6.6 9.3 7.9 8 11.8 6.7 7.9 2.8 6.6 6.7 5.3 8 1.4Z" fill="currentColor"/>' +
          '<path d="M12.7 10.4 13.3 12l1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z" fill="currentColor"/></svg>' +
        '</span>' +
        '<input id="st-search-i" type="search" autocomplete="off" role="combobox" aria-expanded="false" ' +
          'aria-controls="st-search-p" placeholder="Ask for a kit, a budget, a fleet size…" ' +
          'aria-label="Ask the catalogue">' +
        '<button type="button" class="ss-clear" aria-label="Clear" hidden>&times;</button>' +
      '</div>' +
      '<div class="ss-panel st-ui" id="st-search-p"></div>';

    input = document.getElementById('st-search-i');
    panel = document.getElementById('st-search-p');
    var clear = host.querySelector('.ss-clear');

    var t;
    input.addEventListener('input', function () {
      clear.hidden = !input.value;
      clearTimeout(t);
      t = setTimeout(run, 110);                     /* typing is not a query */
    });
    input.addEventListener('focus', function () { lastQ = '\u0000'; run(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; clear.hidden = true; lastQ = '\u0000'; run(); close(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
      if (e.key === 'Enter') {
        var els = panel.querySelectorAll('.ss-row');
        var pick = els[cursor > -1 ? cursor : 0];
        if (pick) { e.preventDefault(); location.href = pick.getAttribute('href'); }
        else if (input.value.trim()) { e.preventDefault(); ask(input.value.trim()); }
      }
    });
    clear.addEventListener('click', function () {
      input.value = ''; clear.hidden = true; lastQ = '\u0000'; run(); input.focus();
    });

    panel.addEventListener('click', function (e) {
      var seed = e.target.closest && e.target.closest('[data-seed]');
      if (seed) { input.value = seed.dataset.seed; clear.hidden = false; lastQ = '\u0000'; run(); input.focus(); return; }
      if (e.target.closest && e.target.closest('[data-ask]')) ask(input.value.trim());
    });

    document.addEventListener('click', function (e) { if (host && !host.contains(e.target)) close(); });

    var pre = new URLSearchParams(location.search).get('q');
    if (pre) { input.value = pre; clear.hidden = false; run(); }
  }

  window.DASStoreSearch = { mount: mount };

  /* SELF-MOUNT. The field is in the header on every store page now, but only
     the shop and a collection run das-store.js. Anywhere else, fetch the
     catalogue and mount in navigate-only mode — a search box that is present
     and dead is worse than no search box. */
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      if (mounted || !document.getElementById('st-search')) return;
      fetch('/store-catalog.json').then(function (r) { return r.json(); })
        .then(function (cat) { mount({ catalog: cat }); })
        .catch(function () {});
    }, 80);
  });
})();
