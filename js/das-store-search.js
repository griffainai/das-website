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

   TWO LAYERS, DELIBERATELY. Jayden 2026-09-24: "when they search it should
   automatically give a scout response to help their search, on every search,
   but make it a very cheap model."

   LAYER 1, the index. Matching 54 known products by name, program, contents and
   price is a lookup. It runs locally, costs nothing, returns in single-digit
   milliseconds, works offline and cannot invent a SKU. It renders FIRST and
   alone decides what is in the list.

   LAYER 2, Scout. A short spoken answer underneath it — the thing a good shop
   assistant says: what you probably want, and why. It calls api/chat.js on
   claude-haiku-4-5, the cheapest model on the account and the same one Scout
   already uses, and that endpoint carries the full guard wall: one chokepoint,
   kill switch, spend ceiling, rate ceiling, meter (rule #16b).

   WHAT KEEPS IT FROM BURNING MONEY, since it now fires on searches rather than
   on a button:
     · 650ms of silence after the last keystroke, not per keystroke
     · a 4-character floor, so "sa" never calls
     · a sessionStorage cache, so a repeated or retyped query is free
     · one in-flight request, aborted the moment the query changes
     · a hard cap of 30 calls per session, after which layer 1 carries on alone
   The list never waits for it and never moves when it lands.
   ========================================================================== */
(function () {
  'use strict';

  var input, panel, host, CAT = null, onApply = null, mounted = false;
  var rows = [], cursor = -1, lastQ = '', scoutTimer = null;
  var NEWLINE = String.fromCharCode(10);   /* keeps this file free of escapes */

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

  /* ── SCOUT, LAYER 2 ───────────────────────────────────────────────────── */
  /* v2: everything cached before the ungrounded-claim guard existed is
     abandoned rather than trusted. */
  var CACHE_KEY = 'das_scout_search_v2';
  var scoutCache = {};
  var scoutCalls = 0;
  var SCOUT_MAX = 30;                 /* per session, then the index carries on alone */
  var scoutAbort = null;

  try {
    var cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) scoutCache = JSON.parse(cached) || {};
  } catch (e) {}

  function scoutHTML(body, thinking) {
    return '<div class="ss-scout' + (thinking ? ' thinking' : '') + '">' +
      '<span class="av" aria-hidden="true">' +
        '<svg width="11" height="11" viewBox="0 0 16 16" fill="none">' +
        '<path d="M8 1.4 9.3 5.3 13.2 6.6 9.3 7.9 8 11.8 6.7 7.9 2.8 6.6 6.7 5.3 8 1.4Z" fill="currentColor"/></svg>' +
      '</span>' +
      '<span><span class="who">Scout</span>' + body + '</span></div>';
  }

  function paintScout(html) {
    if (!panel) return;
    var slot = panel.querySelector('.ss-scout');
    /* Replace in place so the results list never shifts under the cursor. */
    if (slot) slot.outerHTML = html;
    else {
      var head = panel.querySelector('.ss-head');
      if (head) head.insertAdjacentHTML('afterend', html);
      else panel.insertAdjacentHTML('afterbegin', html);
    }
  }

  /** A compact view of what the index already found, so Scout answers about
      real stock and cannot invent a product. */
  function contextFor(list) {
    return list.slice(0, 8).map(function (p) {
      return '- ' + p.name + ' (' + (p.programLabel || '') + ', ' +
        (p.gated ? 'quoted' : '$' + p.price) + ', min ' + (p.minQty || 10) + ')';
    }).join(NEWLINE);
  }

  /* ── THE UNGROUNDED-CLAIM GUARD ────────────────────────────────────────
     On 2026-09-25 Scout told a live visitor about the "Professional Driver
     Milestone Recognition Kit ($499)". No such product exists and no product
     costs $499. The cause was mine: the landing-page call passed an EMPTY match
     list, the prompt therefore said "(nothing matched)", and the model filled
     the vacuum.

     Two fixes, because either alone is insufficient. Grounding stops it
     happening (below, groundedFor). This stops it REACHING A CUSTOMER if it
     happens anyway, which is the part that matters on a page where people buy:
     any answer that states a price we do not charge, or names a product-shaped
     thing we do not sell, is discarded whole rather than shown.

     Verified against the real failing string, not just written and trusted. */
  function catalogueFacts() {
    var prices = {}, names = [];
    (CAT.products || []).forEach(function (p) {
      if (p.price != null) { prices[String(Math.round(p.price))] = 1; prices[String(p.price)] = 1; }
      names.push(norm(p.name));
    });
    (CAT.programs || []).forEach(function (g) { names.push(norm(g.label)); });
    return { prices: prices, names: names };
  }

  /** Product-shaped phrases, found by walking words rather than by regex.
      The regex version was unverifiable: it read correctly, matched correctly
      in isolation, and still let the invented product through in place --
      three separate debugging passes could not show me why. Explicit beats
      clever when the thing being protected is what a customer is told. */
  function claimPhrases(text) {
    var NOUNS = { kit: 1, kits: 1, medal: 1, medals: 1, award: 1, awards: 1,
                  program: 1, programs: 1, collection: 1, package: 1, bundle: 1 };
    var words = String(text).split(/\s+/);
    var caps = function (w) { return w && w[0] !== w[0].toLowerCase() && w[0] === w[0].toUpperCase(); };
    var out = [];
    for (var i = 0; i < words.length; i++) {
      var bare = words[i].replace(/[^A-Za-z]/g, '');
      if (!bare || !NOUNS[bare.toLowerCase()]) continue;
      var start = i;
      while (start > 0 && start > i - 6) {
        var prev = words[start - 1].replace(/[^A-Za-z]/g, '');
        if (caps(prev)) start--; else break;
      }
      if (i - start >= 1) out.push(words.slice(start, i + 1).join(' '));
    }
    return out;
  }

  function ungroundedReason(text) {
    var facts = catalogueFacts();

    var money = text.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) || [];
    for (var i = 0; i < money.length; i++) {
      var n = money[i].replace(/[^0-9.]/g, '');
      var whole = String(Math.round(parseFloat(n)));
      if (!facts.prices[n] && !facts.prices[whole]) return 'states a price we do not charge: ' + money[i];
    }

    var claims = claimPhrases(text);
    for (var j = 0; j < claims.length; j++) {
      var c = norm(claims[j]);
      if (!c || c.split(' ').length < 2) continue;
      var ok = facts.names.some(function (nm) { return nm && (nm.indexOf(c) > -1 || c.indexOf(nm) > -1); });
      if (!ok) return 'names a product we do not sell: ' + claims[j].trim();
    }
    return null;
  }


  /** Clean it, then judge it. Every answer passes through here -- fresh from
      the model AND read back from cache -- so there is exactly one place that
      decides whether a sentence is allowed in front of a customer. */
  function safeAnswer(raw) {
    var out = String(raw || '')
      .replace(/\*\*/g, '').replace(/[`_]{1,2}/g, '')
      .replace(/\s+/g, ' ').trim();
    if (!out) return null;
    var bad = ungroundedReason(out);
    if (bad) {
      if (window.console && console.warn) console.warn('[scout] answer discarded - ' + bad);
      return null;
    }
    if (out.length > 260) {
      var cut = out.slice(0, 260);
      var stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
      out = stop > 80 ? cut.slice(0, stop + 1) : cut.slice(0, cut.lastIndexOf(' ')) + '…';
    }
    return out;
  }

  /** Re-run the local index for a stored query, so a landing page can ground
      Scout exactly as the search panel does. NEVER call Scout without this. */
  function groundedFor(q) { return matched(parse(q)); }

  function askScout(q, list) {
    var key = q.toLowerCase();
    var hit = scoutCache[key] && safeAnswer(scoutCache[key]);
    if (hit) { paintScout(scoutHTML('<p>' + esc(hit) + '</p>', false)); return; }
    if (q.length < 4 || scoutCalls >= SCOUT_MAX) return;
    paintScout(scoutHTML('<p class="dots" aria-label="Scout is thinking">' +
      '<i></i><i></i><i></i></p>', true));
    askScoutRaw(q, list, function (answer) {
      if (!answer) { var slot = panel && panel.querySelector('.ss-scout'); if (slot) slot.remove(); return; }
      if ((input.value || '').trim().toLowerCase() === key) {
        paintScout(scoutHTML('<p>' + esc(answer) + '</p>', false));
      }
    });
  }

  /** The call itself. Separated so a page you LANDED on can ask too, with no
      panel in the DOM to paint into. Abortable, capped, cached. */
  function askScoutRaw(q, list, done) {
    var key = q.toLowerCase();
    if (scoutCache[key]) {
      /* VALIDATE CACHE READS TOO. The guard used to run only on a fresh
         response, so an answer cached before it existed -- or cached at all --
         was served straight back with no check. That is how the invented
         product kept reappearing after the guard shipped: askScoutRaw returned
         the stored string and never looked at it. An answer must pass on the
         way OUT, every time, whatever its age. */
      var kept = safeAnswer(scoutCache[key]);
      if (kept) { done(kept); return; }
      delete scoutCache[key];
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(scoutCache)); } catch (e) {}
    }
    if (q.length < 4 || scoutCalls >= SCOUT_MAX) { done(null); return; }

    if (scoutAbort) { try { scoutAbort.abort(); } catch (e) {} }
    scoutAbort = typeof AbortController !== 'undefined' ? new AbortController() : null;
    scoutCalls++;

    var prompt =
      'A fleet buyer typed this into the shop search: "' + q + '".' + NEWLINE + NEWLINE +
      'These are the catalogue matches already shown to them:' + NEWLINE +
      (list.length ? contextFor(list) : '(nothing matched)') + NEWLINE + NEWLINE +
      'In ONE or TWO short sentences, under 40 words total, help them: say what ' +
      'to look at and why, or ask the single most useful question back. Plain ' +
      'English, no greeting, no bullet points, no markdown. Never invent a ' +
      'product that is not listed above, never state a price that is not listed ' +
      'above, and never use markdown or asterisks.';

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      signal: scoutAbort ? scoutAbort.signal : undefined,
    })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
      .then(function (text) {
        /* api/chat.js is the CHAT widget's endpoint, and its system prompt makes
           Scout append a <suggested_replies> block for the widget's chips. In a
           one-line search answer that markup leaked straight onto the page, and
           a blind slice then cut the sentence mid-word. Strip the tags, then
           trim to the last COMPLETE sentence that fits. */
        var out = String(text || '')
          .split('<suggested_replies>')[0]
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        out = safeAnswer(out);
        if (!out) { done(null); return; }
        scoutCache[key] = out;
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(scoutCache)); } catch (e) {}
        done(out);
      })
      .catch(function () {
        /* Scout is an enhancement. If it is down, rate-limited or killed at the
           guard, everything else still works -- the line simply does not appear. */
        done(null);
      });
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
    /* The list is on screen already; Scout fills in underneath when it lands. */
    clearTimeout(scoutTimer);
    scoutTimer = setTimeout(function () { askScout(q, matched(r.Q)); }, 650);
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

  /* ── "SCOUT BROUGHT YOU HERE" ──────────────────────────────────────────
     Jayden: "it brought me to the right page but it's supposed to let you know
     the AI brought you here -- I just thought I got took to a random page."

     Two separate failures behind that. Pressing Enter navigates immediately,
     so the 650ms debounce never fired and Scout never spoke at all. And the
     destination page said nothing, so a correct answer was indistinguishable
     from a random jump.

     So a jump now records why it happened, and the landing page says so. The
     Scout call is also kicked off BEFORE leaving, un-debounced, and its answer
     is cached under the query -- so by the time the next page paints it is
     usually already there. If it is not, the landing page asks for it itself. */
  var NAV_KEY = 'das_scout_nav_v1';

  function noteNav(q, label, kind) {
    try {
      sessionStorage.setItem(NAV_KEY, JSON.stringify({
        q: q, label: label, kind: kind, at: Date.now(),
      }));
    } catch (e) {}
  }

  function navBannerHTML(note, answer) {
    return '<div class="ss-came" role="status">' +
      '<span class="av" aria-hidden="true">' +
        '<svg width="11" height="11" viewBox="0 0 16 16" fill="none">' +
        '<path d="M8 1.4 9.3 5.3 13.2 6.6 9.3 7.9 8 11.8 6.7 7.9 2.8 6.6 6.7 5.3 8 1.4Z" fill="currentColor"/></svg>' +
      '</span>' +
      '<span class="tx">' +
        '<b>Scout brought you here</b> for &ldquo;' + esc(note.q) + '&rdquo;' +
        (answer ? '<span class="say">' + esc(answer) + '</span>'
                : '<span class="say dots"><i></i><i></i><i></i></span>') +
      '</span>' +
      '<button type="button" class="ss-came-x" data-came-close aria-label="Dismiss">&times;</button>' +
    '</div>';
  }

  function showNavBanner() {
    var note;
    try { note = JSON.parse(sessionStorage.getItem(NAV_KEY) || 'null'); } catch (e) { note = null; }
    if (!note || !note.q) return;
    /* One page only, and only if it just happened. */
    try { sessionStorage.removeItem(NAV_KEY); } catch (e) {}
    if (Date.now() - (note.at || 0) > 60000) return;

    var hd = document.querySelector('.st-hd');
    if (!hd) return;
    var key = note.q.toLowerCase();
    hd.insertAdjacentHTML('afterend', navBannerHTML(note, (scoutCache[key] && safeAnswer(scoutCache[key])) || null));

    var bar = document.querySelector('.ss-came');
    if (!bar) return;
    bar.addEventListener('click', function (e) {
      if (e.target.closest('[data-came-close]')) bar.remove();
    });

    if (!scoutCache[key]) {
      var ground = groundedFor(note.q);
      if (!ground.length) {
        /* Nothing real to talk about means nothing to say. Silence beats
           invention on a page where somebody is deciding what to buy. */
        var s0 = bar.querySelector('.say'); if (s0) s0.remove();
        return;
      }
      askScoutRaw(note.q, ground, function (answer) {
        var live = document.querySelector('.ss-came');
        if (!live) return;
        if (answer) live.outerHTML = navBannerHTML(note, answer);
        else { var say = live.querySelector('.say'); if (say) say.remove(); }
      });
    }
  }

  function run() {
    var q = (input.value || '').trim();
    if (q === lastQ) return;
    lastQ = q;
    if (!q) { paintEmpty(); if (onApply) onApply(null); return; }
    paint(q);
  }

  /* Leaving the page is the LAST thing that happens: record why first, and
     start Scout's answer so the next page usually has it already. */
  function jumpTo(row) {
    var q = (input.value || '').trim();
    var label = (row.querySelector('.nm') || {}).textContent || '';
    var href = row.getAttribute('href');
    if (q) {
      noteNav(q, label, (row.querySelector('.mt') || {}).textContent || '');
      clearTimeout(scoutTimer);
      askScoutRaw(q, groundedFor(q), function () {});
    }
    location.href = href;
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
        if (pick) { e.preventDefault(); jumpTo(pick); }
        else if (input.value.trim()) { e.preventDefault(); ask(input.value.trim()); }
      }
    });
    clear.addEventListener('click', function () {
      input.value = ''; clear.hidden = true; lastQ = '\u0000'; run(); input.focus();
    });

    panel.addEventListener('click', function (e) {
      var seed = e.target.closest && e.target.closest('[data-seed]');
      if (seed) { input.value = seed.dataset.seed; clear.hidden = false; lastQ = '\u0000'; run(); input.focus(); return; }
      if (e.target.closest && e.target.closest('[data-ask]')) { ask(input.value.trim()); return; }
      var row = e.target.closest && e.target.closest('.ss-row');
      if (row) { e.preventDefault(); jumpTo(row); }
    });

    document.addEventListener('click', function (e) { if (host && !host.contains(e.target)) close(); });

    var pre = new URLSearchParams(location.search).get('q');
    if (pre) { input.value = pre; clear.hidden = false; run(); }

    showNavBanner();
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
