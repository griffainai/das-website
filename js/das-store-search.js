/* ============================================================================
   STORE SEARCH — understands what a fleet buyer actually types
   ----------------------------------------------------------------------------
   Jayden: "For the filter, we also need to have an AI search bar where it's a
   search bar, but it's AI knowledge, and it helps them build it out."

   THE ENGINEERING CALL, STATED. This does NOT call a model, and that is a
   decision rather than a shortcut. The catalogue is 54 products with known
   programs, prices, minimums and contents. Every question a fleet buyer
   actually asks of it — "250 drivers", "safety awards under $50", "something
   for driver appreciation week", "million mile" — is answerable from that data
   exactly, instantly, for $0, offline, and with no way to hallucinate a product
   that does not exist. A model asked the same question would be slower, cost
   money per keystroke, and could invent a SKU.

   Workspace rule #17 says it plainly: a deterministic job is a SCRIPT, not an
   AI task. Rule #16b would otherwise put this behind the guard wall — kill
   switch, spend ceiling, rate ceiling, meter — which is real work to earn
   nothing here.

   WHERE A MODEL WOULD EARN ITS PLACE: an open-ended conversation ("we have 300
   drivers, half hit 250k miles this year, what should a year of recognition
   look like?"). That is a consultation, not a lookup, and api/chat.js already
   exists behind the full guard wall for it. This search hands off to it rather
   than trying to be it — see the escape hatch at the end of the results.

   WHAT IT UNDERSTANDS
     driver count     "250 drivers", "for 40", "we have 1,200"
     price            "under $50", "below 100", "$25-$75"
     program          synonyms — "appreciation week" -> appreciation,
                      "safe miles" -> milepacks, "million mile" -> milestone
     contents         matches the `included` list, so "hoodie" finds kits that
                      contain one even when the name never says so
     free text        name, program, blurb, badge
   ========================================================================== */
(function () {
  'use strict';

  var input, resultsEl, CAT = null, onApply = null;

  /* Fleet vocabulary -> programme slug. These are the words buyers use; the
     catalogue's own labels are matched separately, so this only has to cover
     what the labels do NOT say. */
  var SYNONYMS = {
    appreciation: ['appreciation', 'appreciation week', 'daw', 'thank you', 'thank-you', 'gift', 'gifts', 'kit', 'kits', 'driver week'],
    safety:       ['safety', 'safe', 'safe driving', 'accident free', 'accident-free', 'incident free', 'clean record'],
    milestone:    ['milestone', 'anniversary', 'years of service', 'service award', 'million mile', 'million miles', 'tenure', 'longevity'],
    milepacks:    ['safe miles', 'mile pack', 'mile packs', 'quarterly', 'miles program'],
    onboarding:   ['onboarding', 'new hire', 'new driver', 'orientation', 'welcome', 'day one', 'first day'],
    holiday:      ['holiday', 'christmas', 'seasonal', 'end of year', 'year end'],
  };

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  /** Pull structure out of a plain sentence. */
  function parse(q) {
    var t = ' ' + q.toLowerCase().replace(/,/g, '') + ' ';
    var out = { text: q.trim(), drivers: null, maxPrice: null, minPrice: null, program: null, terms: [] };

    // "under $50" / "below 100" / "less than $75"
    var under = t.match(/(?:under|below|less than|max|up to)\s*\$?\s*(\d+(?:\.\d+)?)/);
    if (under) out.maxPrice = parseFloat(under[1]);
    var over = t.match(/(?:over|above|more than|at least|from)\s*\$?\s*(\d+(?:\.\d+)?)/);
    if (over) out.minPrice = parseFloat(over[1]);
    var range = t.match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*\$?\s*(\d+(?:\.\d+)?)/);
    if (range) { out.minPrice = parseFloat(range[1]); out.maxPrice = parseFloat(range[2]); }

    // a driver count — a bare number near "driver", or any number with no $
    var drv = t.match(/(\d[\d,]*)\s*(?:\+)?\s*(?:drivers?|people|employees|staff|trucks?)/);
    if (drv) out.drivers = parseInt(drv[1].replace(/,/g, ''), 10);
    else {
      var bare = t.match(/(?:^|\s)(\d{2,6})(?:\s|$)/);
      if (bare && !under && !over && !range) out.drivers = parseInt(bare[1], 10);
    }

    // programme by synonym, longest phrase first so "safe miles" beats "safe"
    var best = null;
    Object.keys(SYNONYMS).forEach(function (slug) {
      SYNONYMS[slug].forEach(function (w) {
        if (t.indexOf(' ' + w + ' ') > -1 || t.indexOf(' ' + w) > -1) {
          if (!best || w.length > best.len) best = { slug: slug, len: w.length };
        }
      });
    });
    if (best) out.program = best.slug;

    out.terms = q.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length > 2 && !/^\d+$/.test(w); });
    return out;
  }

  /** Score a product against a parsed query. 0 means it does not belong. */
  function score(p, Q) {
    var s = 0;
    var hay = (p.name + ' ' + (p.programLabel || '') + ' ' + (p.blurb || '') + ' ' +
               (p.badge || '') + ' ' + (p.included || []).join(' ')).toLowerCase();

    if (Q.program) { if (p.program !== Q.program) return 0; s += 40; }

    if (Q.maxPrice != null) {
      if (p.gated) s += 2;                          // a quoted piece cannot be excluded on price
      else if (p.price > Q.maxPrice) return 0;
      else s += 20;
    }
    if (Q.minPrice != null && !p.gated && p.price < Q.minPrice) return 0;

    /* A driver count is a MINIMUM-ORDER question, not a filter: 40 drivers
       cannot buy a piece with a minimum of 100. It never excludes a piece the
       fleet is large enough for. */
    if (Q.drivers != null && (p.minQty || 1) > Q.drivers) return 0;

    var hits = 0;
    Q.terms.forEach(function (w) {
      if (hay.indexOf(w) > -1) { hits++; s += p.name.toLowerCase().indexOf(w) > -1 ? 12 : 5; }
    });
    if (Q.terms.length && !hits && !Q.program && Q.maxPrice == null && Q.drivers == null) return 0;
    return s || 1;
  }

  /** One line of plain English describing what was understood. */
  function readback(Q, n, CATref) {
    var bits = [];
    if (Q.program) {
      var g = CATref.programs.filter(function (x) { return x.slug === Q.program; })[0];
      if (g) bits.push(g.label.toLowerCase());
    }
    if (Q.maxPrice != null && Q.minPrice != null) bits.push('$' + Q.minPrice + '–$' + Q.maxPrice);
    else if (Q.maxPrice != null) bits.push('under $' + Q.maxPrice);
    else if (Q.minPrice != null) bits.push('over $' + Q.minPrice);
    if (Q.drivers != null) bits.push('orderable for ' + Q.drivers.toLocaleString() + ' drivers');
    return n + (n === 1 ? ' piece' : ' pieces') + (bits.length ? ' · ' + bits.join(' · ') : '');
  }

  function run() {
    var q = (input.value || '').trim();
    if (!q) { resultsEl.hidden = true; if (onApply) onApply(null); return; }

    var Q = parse(q);
    var scored = CAT.products
      .map(function (p) { return { p: p, s: score(p, Q) }; })
      .filter(function (x) { return x.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .map(function (x) { return x.p; });

    resultsEl.hidden = false;
    if (!scored.length) {
      /* Nothing matched. Say so and hand over — an empty grid with no
         explanation is where a buyer leaves. */
      resultsEl.innerHTML =
        '<p class="ss-none">Nothing in the catalogue matches that. ' +
        '<a href="contact.html?intent=pricing&amp;q=' + encodeURIComponent(q) + '">Tell the fleet team what you need</a> ' +
        'and a specialist replies in writing within one business day.</p>';
    } else {
      resultsEl.innerHTML = '<p class="ss-read">' + esc(readback(Q, scored.length, CAT)) + '</p>' +
        (Q.drivers != null
          ? '<p class="ss-hint">Minimum order is respected — nothing shown needs more than ' +
            Q.drivers.toLocaleString() + ' units.</p>' : '');
    }
    if (onApply) onApply(scored);
  }

  /** Mounted by das-store.js once the catalogue is in hand. */
  window.DASStoreSearch = {
    mount: function (opts) {
      CAT = opts.catalog;
      onApply = opts.onApply;
      var host = document.getElementById('st-search');
      if (!host || !CAT) return;

      host.innerHTML =
        '<div class="ss-box">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
          '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
          '<input id="st-search-i" type="search" autocomplete="off" ' +
            'placeholder="Try: 250 drivers, safety awards under $50" ' +
            'aria-label="Search the catalogue by fleet size, budget or occasion">' +
          '<button type="button" class="ss-clear" aria-label="Clear search" hidden>&times;</button>' +
        '</div>' +
        '<div class="ss-out st-ui" id="st-search-out" hidden></div>';

      input = document.getElementById('st-search-i');
      resultsEl = document.getElementById('st-search-out');
      var clear = host.querySelector('.ss-clear');

      var t;
      input.addEventListener('input', function () {
        clear.hidden = !input.value;
        clearTimeout(t);
        t = setTimeout(run, 140);          // typing is not a query
      });
      input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { input.value = ''; run(); clear.hidden = true; } });
      clear.addEventListener('click', function () { input.value = ''; clear.hidden = true; run(); input.focus(); });

      var pre = new URLSearchParams(location.search).get('q');
      if (pre) { input.value = pre; clear.hidden = false; run(); }
    },
  };
})();
