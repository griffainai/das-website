/* ============================================================================
   DAS SHOP — the facet engine and the shop assistant
   ----------------------------------------------------------------------------
   Jayden 2026-09-19: "We need a new shop design where it's actually filtered
   correctly and able to navigate. We need an AI that's helping on the shop so
   that they can talk to the AI to also help them shop."

   WHAT THIS REPLACES
   The old inline block in shop.html filtered by showing and hiding whole
   CATEGORY SECTIONS — one axis, one value at a time, and no way to ask for
   "kits I can order ten of, under $300". This is a real faceted engine over
   the SAME markup: it reads the product cards already in the page, derives
   every facet from their data attributes, and recomputes live counts.

   WHAT IT KEEPS
   - The fuzzy SEARCH_SYNONYMS map, carried across verbatim. It encodes real
     buyer vocabulary ("food" → food jar, "badge" → lapel pin) and was the best
     part of the code it replaces.
   - The ?category= URL contract and its slug aliases, so every existing inbound
     link and every cross-link from product.html still lands correctly.
   - The Mile Packs section ordering.

   FACET SEMANTICS (the part that makes counts trustworthy)
   Within one group the values OR together; across groups they AND. A value's
   count is the number of products that would match IF THAT VALUE WERE SELECTED,
   holding the OTHER groups fixed — which is why selecting "Kits" does not zero
   out every other program. A value that can return nothing keeps its row and
   greys out: a count of zero is information.

   THE ASSISTANT
   Talks to POST /api/chat — the existing Scout endpoint, already behind
   api/_ai-guard.js (kill switch, spend ceiling, rate ceiling, meter; workspace
   principle 16b). No new serverless function: DAS is near the Vercel 12-route
   cap and a second guard wall would be a second thing to get wrong.
   The model SUGGESTS a category in plain text; the PAGE applies the facet, so
   navigation stays deterministic and costs nothing extra.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('.shop2');
  if (!root) return;


  /* ── Category vocabulary ────────────────────────────────────────────────
     Order is the driver-recognition journey, not the alphabet (E96). The slugs
     are a URL contract — renaming a LABEL is safe, renaming a SLUG breaks every
     link ever shared, which is why "Safe Miles Programs" still reads milepacks. */
  var PROGRAMS = [
    { slug: 'appreciation', label: 'Driver Appreciation Kits' },
    { slug: 'milepacks',    label: 'Safe Miles Programs' },
    { slug: 'onboarding',   label: 'Onboarding Solutions' },
    { slug: 'safety',       label: 'Safety Recognition' },
    { slug: 'safedriver',   label: 'Safe Driver Awards' },
    { slug: 'milestone',    label: 'Service Milestone Awards' },
    { slug: 'medals',       label: 'Medals' },
    { slug: 'retirement',   label: 'Retirement Recognition' },
    { slug: 'birthday',     label: 'Birthday Recognition' },
    { slug: 'holiday',      label: 'Holiday & Seasonal' }
  ];
  /* The three recognition tracks map onto two shop programmes: career medals are
     Service Milestone Awards, and BOTH the Safe Service Miles medals and the
     Executive Collection (a premium upgrade ON safety, never on career) are
     Safety Recognition. */
  var TRACK_CAT = { career: 'milestone', safe: 'safety', exec: 'safety' };

  var CATEGORY_ALIASES = {
    'safe-miles-programs': 'milepacks', 'mile-packs': 'milepacks', 'safemiles': 'milepacks'
  };

  /* Price bands. DAS gates anything over $110 (pricing-gate.js), so a band a
     locked visitor can never see would be a dead row — these are deliberately
     coarse and stay useful either way. */
  var BANDS = [
    { id: 'u100',    label: 'Under $100',    test: function (p) { return p > 0 && p < 100; } },
    { id: '100-250', label: '$100 – $250',   test: function (p) { return p >= 100 && p < 250; } },
    { id: '250-500', label: '$250 – $500',   test: function (p) { return p >= 250 && p < 500; } },
    { id: 'o500',    label: '$500 and above', test: function (p) { return p >= 500; } }
  ];

  var ORDERING = [
    { id: 'single', label: 'Orderable individually', test: function (c) { return c.minQty <= 1; } },
    { id: 'fleet',  label: 'Fleet minimum (10+)',    test: function (c) { return c.minQty >= 10; } }
  ];

  var FEATURES = [
    { id: 'custom',   label: 'Custom-logo',        test: function (c) { return c.custom; } },
    { id: 'engraved', label: 'Engraving included', test: function (c) { return c.engraved; } }
  ];

  /* Fuzzy search vocabulary — carried across verbatim from the code this
     replaces. It maps how buyers actually talk onto what DAS actually
     stocks: "food" finds the food jar, "badge" finds the lapel pin. */
  const SEARCH_SYNONYMS = {
    food:['food jar','jar','soup','meal'], jar:['food jar'], meal:['food jar','lunch'],
    drink:['bottle','tumbler','rambler','water','drinkware'], drinkware:['bottle','tumbler','rambler'],
    cup:['bottle','tumbler','rambler','mug'], bottle:['rambler','tumbler','water bottle','drinkware'],
    tumbler:['rambler','bottle'], water:['bottle','rambler','tumbler'], rambler:['bottle','tumbler'], yeti:['rambler','roadie','camino','tumbler','cooler','tote','bottle'],
    bag:['tote','cooler','lunch bag','backpack','carryall','luggage','travel'], tote:['carryall','camino','bag'],
    cooler:['roadie','cooler','lunch bag'], lunch:['lunch bag','food jar'], carryall:['camino','tote'],
    backpack:['pack leader','backpack','tote'], pack:['pack leader','backpack'],
    badge:['lapel pin','pin','medal','patch'], pin:['lapel pin','badge'], lapel:['lapel pin','pin'],
    medal:['medal','award','medallion','milestone'], medallion:['medal','coin'], coin:['medallion','medal'],
    award:['medal','milestone','recognition','award'], trophy:['medal','award'], patch:['patch','embroidered'],
    shirt:['t-shirt','tee','apparel'], tee:['t-shirt','shirt'], apparel:['t-shirt','shirt','hat','cap'], hat:['cap'], cap:['hat'],
    tag:['luggage tag','road bag tag','luggage'], luggage:['luggage tag','tote','bag'], keychain:['keychain','key'], key:['keychain'],
    kit:['kit','recognition kit','essentials','travel','self-care','mile pack'], gift:['kit','gift','appreciation'], set:['kit','set','award'],
    safety:['safe miles','safe service miles','safe driver','safety recognition'], safe:['safe miles','safe service miles'],
    milestone:['milestone','service miles','mile','anniversary','tenure'], mile:['miles','milestone','service miles'], miles:['mile','milestone'],
    anniversary:['milestone','tenure'], tenure:['milestone','anniversary','years of service'], service:['service miles','milestone'],
    onboarding:['onboarding','welcome','new driver','new hire'], welcome:['onboarding','welcome kit'], new:['onboarding','new driver'],
    holiday:['holiday','seasonal'], seasonal:['holiday'], travel:['travel kit','self-care','shower'], shower:['self-care','travel'],
    soap:['dr squatch','soap','self-care'], towel:['towel','self-care'], wipes:['dude wipes','self-care'],
    steam:['steam cleaner'], pressure:['pressure washer'], coffee:['coffee maker'],
    premium:['executive','premium'], executive:['executive collection','premium'], million:['1 million','2 million','3 million','milestone'],
  };

  function searchTermsFor(q) {
    var terms = {};
    if (q) terms[q] = 1;
    q.split(/\s+/).filter(Boolean).forEach(function (t) {
      terms[t] = 1;
      var singular = (t.length > 3 && t.slice(-1) === 's') ? t.slice(0, -1) : null;
      if (singular) terms[singular] = 1;
      [t, singular].filter(Boolean).forEach(function (k) {
        (SEARCH_SYNONYMS[k] || []).forEach(function (s) { terms[s] = 1; });
      });
    });
    return Object.keys(terms).filter(Boolean);
  }

  /* ── State ──────────────────────────────────────────────────────────── */
  var state = {
    program: [],          // slugs, OR
    band: [],             // band ids, OR
    ordering: [],         // ordering ids, OR
    feature: [],          // feature ids, OR
    q: '',
    sort: 'featured',
    density: 'm'
  };
  var GROUPS = ['program', 'band', 'ordering', 'feature'];

  var cards = [];         // the index

  /* ── Indexing ───────────────────────────────────────────────────────────
     Several grids (#safety-medals-grid, #milestone-grid, #mile-packs-grid,
     #safety-exec-grid) are rendered by OTHER scripts after load, so the index
     cannot be built once and trusted. It is rebuilt whenever the results
     subtree changes, debounced. */
  function textOf(el) {
    return (el.textContent || '').toLowerCase().replace(/\s+/g, ' ');
  }
  function indexCards() {
    var out = [];
    root.querySelectorAll('.product-card').forEach(function (el, i) {
      var price = parseFloat(el.getAttribute('data-product-price') || '') || 0;
      var minQty = parseInt(el.getAttribute('data-product-min-qty') || '', 10);
      var section = el.closest('[data-category-section]');
      var body = textOf(el);
      /* WHICH PROGRAMME A CARD BELONGS TO — and why this is not just
         data-filter-cat. milestones.js stamps data-filter-cat="milestone" on ALL
         THREE tracks it renders: career medals, Safe Service Miles medals, and
         the Executive Collection. The safe and exec cards sit in the SAFETY
         section but claim the milestone category, so filtering on that attribute
         alone would list Safety products under Service Milestone Awards — the
         one thing the catalogue rules forbid outright ("Career and Safety must
         NEVER be mixed", an explicit repeated client requirement). The old pill
         bar never hit this because it filtered by SECTION and ignored the
         attribute entirely.
         Precedence: data-track (career|safe|exec) is the authoritative marker
         where it exists; otherwise the enclosing section; the attribute last.
         Verified: no static card's data-filter-cat disagrees with its section,
         so this changes nothing except the three tracked grids. */
      var track = el.getAttribute('data-track');
      var secSlug = section && section.getAttribute('data-category-section');
      out.push({
        el: el,
        order: i,
        slug: TRACK_CAT[track] || secSlug || el.getAttribute('data-filter-cat') || '',
        price: price,
        minQty: isNaN(minQty) ? 10 : minQty,
        custom: /custom-logo|custom logo|customiz/.test(body),
        engraved: /engrav/.test(body),
        name: (el.querySelector('.product-card-title') || {}).textContent || '',
        text: body,
        section: section
      });
    });
    cards = out;
  }

  /* ── Matching ───────────────────────────────────────────────────────────
     `skip` lets the count pass ask "what would this group look like if it were
     not constraining anything?" — the standard way to compute facet counts that
     do not collapse to zero the moment a value is chosen. */
  function matches(c, skip) {
    if (skip !== 'program' && state.program.length && state.program.indexOf(c.slug) < 0) return false;
    if (skip !== 'band' && state.band.length) {
      var okB = state.band.some(function (id) {
        var b = BANDS.filter(function (x) { return x.id === id; })[0];
        return b && b.test(c.price);
      });
      if (!okB) return false;
    }
    if (skip !== 'ordering' && state.ordering.length) {
      var okO = state.ordering.some(function (id) {
        var o = ORDERING.filter(function (x) { return x.id === id; })[0];
        return o && o.test(c);
      });
      if (!okO) return false;
    }
    if (skip !== 'feature' && state.feature.length) {
      var okF = state.feature.some(function (id) {
        var f = FEATURES.filter(function (x) { return x.id === id; })[0];
        return f && f.test(c);
      });
      if (!okF) return false;
    }
    if (state.q) {
      var terms = searchTermsFor(state.q.toLowerCase().trim());
      var hit = terms.some(function (t) { return c.text.indexOf(t) >= 0; });
      if (!hit) return false;
    }
    return true;
  }

  function countFor(group, test) {
    var n = 0;
    for (var i = 0; i < cards.length; i++) {
      if (matches(cards[i], group) && test(cards[i])) n++;
    }
    return n;
  }

  /* ── Render: the rail ───────────────────────────────────────────────── */
  var railEl = document.getElementById('shop2-rail');

  function rowHTML(group, value, label, n, on) {
    return '<button type="button" class="shop2-row" data-group="' + group + '" data-value="' + value +
      '" aria-pressed="' + (on ? 'true' : 'false') + '"' + (n === 0 && !on ? ' data-empty="true"' : '') + '>' +
      '<span class="shop2-row-name">' + label + '</span>' +
      '<span class="shop2-row-n">' + n + '</span></button>';
  }

  function renderRail() {
    if (!railEl) return;
    var open = {};
    railEl.querySelectorAll('.shop2-group').forEach(function (g) {
      open[g.getAttribute('data-group')] = g.getAttribute('data-collapsed') === 'true';
    });

    var h = '';

    /* A programme with NO product in the catalogue at all is not a facet — a
       facet that can never return anything is a dead control. Three of them
       (Safe Driver Awards, Retirement, Birthday) are real, quote-only
       programmes with a real section on this page, so they become NAVIGATION:
       links that jump to the section. 'medals' has no section and no product,
       so it is a dead slug from the old pill bar and is dropped.
       This is the "able to navigate" half of the brief. */
    var live = [], quoteOnly = [];
    PROGRAMS.forEach(function (p) {
      if (totalFor(p.slug) > 0) { live.push(p); return; }
      if (sectionOf(p.slug)) quoteOnly.push(p);
    });

    h += '<div class="shop2-group" data-group="program"' + (open.program ? ' data-collapsed="true"' : '') + '>' +
      groupHead('program', 'Program') + '<div class="shop2-rows">';
    live.forEach(function (p) {
      var n = countFor('program', function (c) { return c.slug === p.slug; });
      h += rowHTML('program', p.slug, p.label, n, state.program.indexOf(p.slug) >= 0);
    });
    h += '</div></div>';

    if (quoteOnly.length) {
      h += '<div class="shop2-group" data-group="quote"' + (open.quote ? ' data-collapsed="true"' : '') + '>' +
        groupHead('quote', 'Quote-only programmes') + '<div class="shop2-rows">';
      quoteOnly.forEach(function (p) {
        var sec = sectionOf(p.slug);
        h += '<a class="shop2-row shop2-row--link" href="#' + (sec.id || '') + '" data-jump="' + p.slug + '">' +
          '<span class="shop2-row-name">' + p.label + '</span>' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path stroke-linecap="round" d="M9 6l6 6-6 6"/></svg></a>';
      });
      h += '</div></div>';
    }

    h += '<div class="shop2-group" data-group="band"' + (open.band ? ' data-collapsed="true"' : '') + '>' +
      groupHead('band', 'Price') + '<div class="shop2-rows">';
    BANDS.forEach(function (b) {
      var n = countFor('band', function (c) { return b.test(c.price); });
      h += rowHTML('band', b.id, b.label, n, state.band.indexOf(b.id) >= 0);
    });
    h += '</div></div>';

    h += '<div class="shop2-group" data-group="ordering"' + (open.ordering ? ' data-collapsed="true"' : '') + '>' +
      groupHead('ordering', 'Order size') + '<div class="shop2-rows">';
    ORDERING.forEach(function (o) {
      var n = countFor('ordering', function (c) { return o.test(c); });
      h += rowHTML('ordering', o.id, o.label, n, state.ordering.indexOf(o.id) >= 0);
    });
    h += '</div></div>';

    h += '<div class="shop2-group" data-group="feature"' + (open.feature ? ' data-collapsed="true"' : '') + '>' +
      groupHead('feature', 'Personalisation') + '<div class="shop2-rows">';
    FEATURES.forEach(function (f) {
      var n = countFor('feature', function (c) { return f.test(c); });
      h += rowHTML('feature', f.id, f.label, n, state.feature.indexOf(f.id) >= 0);
    });
    h += '</div></div>';

    if (anyApplied()) h += '<button type="button" class="shop2-clear" id="shop2-clear">Clear all filters</button>';
    /* pricing-gate.js drops its "Have a planning code?" link beside the old
       filter bar. That bar is gone, so it gets a named slot instead — losing
       that entry point would quietly remove the only way to unlock pricing. */
    h += '<div id="plan-code-slot"></div>';

    railEl.innerHTML = h;
  }

  /* Unfiltered totals and section lookup — these ask what the CATALOGUE holds,
     not what the current filters leave, so they stay stable as facets change. */
  function totalFor(slug) {
    var n = 0;
    for (var i = 0; i < cards.length; i++) if (cards[i].slug === slug) n++;
    return n;
  }
  function sectionOf(slug) {
    return root.querySelector('[data-category-section="' + slug + '"]');
  }

  function groupHead(id, label) {
    return '<button type="button" class="shop2-group-head" data-toggle="' + id + '">' + label +
      '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">' +
      '<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>';
  }

  function anyApplied() {
    return GROUPS.some(function (g) { return state[g].length; }) || !!state.q;
  }

  /* ── Render: applied chips ──────────────────────────────────────────── */
  var chipsEl = document.getElementById('shop2-applied');
  var X = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function labelFor(group, value) {
    var src = group === 'program' ? PROGRAMS : group === 'band' ? BANDS : group === 'ordering' ? ORDERING : FEATURES;
    var hit = src.filter(function (x) { return (x.slug || x.id) === value; })[0];
    return hit ? hit.label : value;
  }

  function renderChips() {
    if (!chipsEl) return;
    var h = '';
    if (state.q) {
      h += '<button type="button" class="shop2-chip" data-clear-q>&ldquo;' + esc(state.q) + '&rdquo; ' + X + '</button>';
    }
    GROUPS.forEach(function (g) {
      state[g].forEach(function (v) {
        h += '<button type="button" class="shop2-chip" data-group="' + g + '" data-value="' + v + '">' +
          labelFor(g, v) + ' ' + X + '</button>';
      });
    });
    chipsEl.innerHTML = h;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ── Render: the results ────────────────────────────────────────────── */
  var titleEl = document.getElementById('shop2-title-text');
  var countEl = document.getElementById('shop2-count');
  var emptyEl = document.getElementById('shop2-empty');

  function apply() {
    var shown = 0;
    cards.forEach(function (c) {
      var ok = matches(c, null);
      c.el.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });

    /* A section with no surviving cards is noise — hide the heading too. The
       non-product blocks inside a section (programme explainers, the flagship
       card) ride with their section, which is why this tests the section and
       not each child. */
    root.querySelectorAll('[data-category-section]').forEach(function (sec) {
      var all = sec.querySelectorAll('.product-card');
      /* A section holding NO products is a quote-only programme (Safe Driver
         Awards, Retirement, Birthday) — prose and a quote CTA, not a listing.
         Testing 'are any of its cards visible' hides those forever, so they are
         shown on the unfiltered view and on their own programme filter, and
         stand aside when the visitor has narrowed to something else. */
      if (!all.length) {
        var slug = sec.getAttribute('data-category-section');
        sec.style.display = (!anyApplied() || state.program.indexOf(slug) >= 0) ? '' : 'none';
        return;
      }
      var any = Array.prototype.some.call(all, function (el) { return el.style.display !== 'none'; });
      sec.style.display = any ? '' : 'none';
    });

    sortCards();

    if (titleEl) {
      titleEl.textContent = state.program.length === 1
        ? labelFor('program', state.program[0])
        : (anyApplied() ? 'Filtered products' : 'All Products');
    }
    if (countEl) countEl.textContent = shown;
    if (emptyEl) emptyEl.style.display = shown === 0 ? '' : 'none';

    renderRail();
    renderChips();
    syncURL();
  }

  /* Sorting reorders inside each grid rather than flattening every product into
     one list, so the programme sections — which carry their own explainers and
     must never mix Career with Safety medals — stay intact. */
  function sortCards() {
    if (state.sort === 'featured') {
      root.querySelectorAll('.product-grid').forEach(function (grid) {
        Array.prototype.slice.call(grid.querySelectorAll('.product-card'))
          .sort(function (a, b) { return idx(a) - idx(b); })
          .forEach(function (el) { grid.appendChild(el); });
      });
      return;
    }
    var dir = state.sort === 'price-desc' ? -1 : 1;
    root.querySelectorAll('.product-grid').forEach(function (grid) {
      Array.prototype.slice.call(grid.querySelectorAll('.product-card')).sort(function (a, b) {
        var ca = byEl(a), cb = byEl(b);
        if (!ca || !cb) return 0;
        if (state.sort === 'name') return ca.name.localeCompare(cb.name);
        return (ca.price - cb.price) * dir;
      }).forEach(function (el) { grid.appendChild(el); });
    });
  }
  function byEl(el) { for (var i = 0; i < cards.length; i++) if (cards[i].el === el) return cards[i]; return null; }
  function idx(el) { var c = byEl(el); return c ? c.order : 0; }

  /* ── URL ────────────────────────────────────────────────────────────── */
  function syncURL() {
    var p = new URLSearchParams();
    if (state.program.length === 1) p.set('category', state.program[0]);
    else if (state.program.length > 1) p.set('programs', state.program.join(','));
    if (state.band.length) p.set('price', state.band.join(','));
    if (state.ordering.length) p.set('order', state.ordering.join(','));
    if (state.feature.length) p.set('feat', state.feature.join(','));
    if (state.q) p.set('q', state.q);
    if (state.sort !== 'featured') p.set('sort', state.sort);
    var qs = p.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
  }

  function readURL() {
    var p = new URLSearchParams(location.search);
    var cat = p.get('category');
    if (cat && CATEGORY_ALIASES[cat]) cat = CATEGORY_ALIASES[cat];
    if (cat && PROGRAMS.some(function (x) { return x.slug === cat; })) state.program = [cat];
    var progs = p.get('programs');
    if (progs) state.program = progs.split(',').filter(function (s) {
      return PROGRAMS.some(function (x) { return x.slug === s; });
    });
    ['price:band', 'order:ordering', 'feat:feature'].forEach(function (pair) {
      var bits = pair.split(':'), v = p.get(bits[0]);
      if (v) state[bits[1]] = v.split(',').filter(Boolean);
    });
    if (p.get('q')) state.q = p.get('q');
    if (p.get('sort')) state.sort = p.get('sort');
  }

  /* ── Saved items ────────────────────────────────────────────────────────
     There is ALREADY a favourites system: js/cart.js owns window.Favorites on
     das_favorites_v1 and ships a delegated handler for any [data-save-to-fav]
     button inside a [data-product-id] card. It builds the item, toggles the
     store, updates the .fav-count nav badge, fires das:favchange, syncs the
     icon and raises the toast.

     My first pass here wrote IDs to a second key (das_saved_v1). That is a
     silent divergence of exactly the kind that produces a bug report months
     later: a kit hearted on the shop would simply never appear on
     favorites.html, and nothing anywhere would error. The heart below is
     therefore only MARKUP — every behaviour is cart.js's. */
  var HEART = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1.1 1L12 21l7.7-7.7 1.1-1a5.5 5.5 0 000-7.8z"/></svg>';

  function mountHearts() {
    cards.forEach(function (c) {
      if (c.el.querySelector('.shop2-save')) return;
      /* cart.js finds the product via closest('[data-product-id]'), so a card
         without that attribute cannot be saved and must not offer to be. */
      if (!c.el.getAttribute('data-product-id')) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'shop2-save';
      b.setAttribute('data-save-to-fav', '');
      b.setAttribute('aria-label', 'Save ' + (c.name || 'product').trim() + ' for later');
      b.innerHTML = HEART;
      c.el.appendChild(b);
      if (window.Favorites && window.Favorites.has(c.el.getAttribute('data-product-id'))) {
        b.classList.add('fav-active');
        var svg = b.querySelector('svg');
        if (svg) svg.style.fill = 'currentColor';
      }
    });
  }

  /* ── Wiring ─────────────────────────────────────────────────────────── */
  function toggle(group, value) {
    var i = state[group].indexOf(value);
    if (i >= 0) state[group].splice(i, 1); else state[group].push(value);
    apply();
  }

  document.addEventListener('click', function (e) {
    var row = e.target.closest && e.target.closest('.shop2-row');
    if (row && railEl && railEl.contains(row)) {
      toggle(row.getAttribute('data-group'), row.getAttribute('data-value'));
      return;
    }
    var head = e.target.closest && e.target.closest('.shop2-group-head');
    if (head) {
      var g = head.closest('.shop2-group');
      g.setAttribute('data-collapsed', g.getAttribute('data-collapsed') === 'true' ? 'false' : 'true');
      return;
    }
    var chip = e.target.closest && e.target.closest('.shop2-chip');
    if (chip) {
      if (chip.hasAttribute('data-clear-q')) {
        state.q = '';
        var si = document.getElementById('shop2-search');
        if (si) si.value = '';
        apply();
      } else {
        toggle(chip.getAttribute('data-group'), chip.getAttribute('data-value'));
      }
      return;
    }
    if (e.target.id === 'shop2-clear' || e.target.id === 'shop2-empty-clear') {
      GROUPS.forEach(function (g) { state[g] = []; });
      state.q = '';
      var s2 = document.getElementById('shop2-search');
      if (s2) s2.value = '';
      apply();
      return;
    }
  });

  var searchEl = document.getElementById('shop2-search');
  if (searchEl) {
    var t;
    searchEl.addEventListener('input', function () {
      clearTimeout(t);
      t = setTimeout(function () { state.q = searchEl.value.trim(); apply(); }, 160);
    });
  }

  var sortEl = document.getElementById('shop2-sort');
  if (sortEl) sortEl.addEventListener('change', function () { state.sort = sortEl.value; apply(); });

  root.querySelectorAll('.shop2-density button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.density = b.getAttribute('data-density');
      root.setAttribute('data-density', state.density);
      root.querySelectorAll('.shop2-density button').forEach(function (x) {
        x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
      });
      try { localStorage.setItem('das_shop_density', state.density); } catch (e) {}
    });
  });

  var railToggle = document.getElementById('shop2-railtoggle');
  if (railToggle && railEl) {
    railToggle.addEventListener('click', function () {
      var open = railEl.getAttribute('data-open') === 'true';
      railEl.setAttribute('data-open', open ? 'false' : 'true');
      railToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  }

  /* ── Boot ───────────────────────────────────────────────────────────── */
  try {
    var d = localStorage.getItem('das_shop_density');
    if (d) state.density = d;
  } catch (e) {}
  root.setAttribute('data-density', state.density);
  root.querySelectorAll('.shop2-density button').forEach(function (x) {
    x.setAttribute('aria-pressed', x.getAttribute('data-density') === state.density ? 'true' : 'false');
  });

  readURL();
  if (searchEl && state.q) searchEl.value = state.q;
  if (sortEl && state.sort) sortEl.value = state.sort;

  /* Mile Packs is the 2nd section in the unfiltered scroll order, after Driver
     Appreciation Kits (carried over from the code this replaces). */
  (function () {
    var sections = root.querySelectorAll('[data-category-section]');
    var first = sections[0];
    var mp = root.querySelector('[data-category-section="milepacks"]');
    if (first && mp && first.parentNode && first !== mp) first.parentNode.insertBefore(mp, first.nextSibling);
  })();

  indexCards();
  mountHearts();
  apply();

  /* The medal, mile-pack and executive grids are filled by milestones.js /
     mile-packs.js AFTER this runs. Re-index when they land, or those products
     are invisible to every facet and every count is wrong. */
  var reT;
  var mo = new MutationObserver(function () {
    clearTimeout(reT);
    reT = setTimeout(function () {
      var before = cards.length;
      indexCards();
      if (cards.length !== before) { mountHearts(); apply(); }
    }, 60);
  });
  var results = document.getElementById('shop2-results');
  if (results) mo.observe(results, { childList: true, subtree: true });

  window.DASShop = {
    select: function (slug) {
      if (!PROGRAMS.some(function (p) { return p.slug === slug; })) return false;
      state.program = [slug];
      state.q = '';
      var s = document.getElementById('shop2-search');
      if (s) s.value = '';
      apply();
      var head = document.getElementById('shop2-head');
      if (head) head.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    },
    programs: PROGRAMS
  };
})();


/* ============================================================================
   THE SHOP ASSISTANT
   ----------------------------------------------------------------------------
   A shell on the existing Scout brain. POST /api/chat streams plain text and is
   already guarded by api/_ai-guard.js — this adds no second model path.

   The one thing it adds is NAVIGATION: after a reply lands, any DAS programme
   named in it becomes a button that drives the facet engine directly. The model
   proposes in prose; the page performs the action itself. That keeps the
   filtering deterministic, costs nothing extra per turn, and means a wrong or
   hallucinated category simply never renders a button.
   ========================================================================== */
(function () {
  'use strict';

  var panel = document.getElementById('sa-panel');
  var openBtn = document.getElementById('sa-open');
  if (!panel || !openBtn || !window.DASShop) return;

  var log = document.getElementById('sa-log');
  var form = document.getElementById('sa-form');
  var input = document.getElementById('sa-input');
  var send = document.getElementById('sa-send');
  var STORE = 'das_shop_assistant_v1';

  var messages = [];
  var busy = false;

  var WELCOME = "I'm Scout. Tell me about your fleet — how many drivers, and what you're recognising — and I'll point you at the right programme and narrow the catalogue for you.";
  var SEEDS = [
    'I have 40 drivers and a $5k budget',
    'What do you send a new hire on day one?',
    'We want to reward 1M safe miles'
  ];

  function setOpen(on) {
    panel.setAttribute('data-open', on ? 'true' : 'false');
    openBtn.hidden = !!on;
    if (on) { input && input.focus(); scroll(); }
  }
  openBtn.addEventListener('click', function () { setOpen(true); });
  document.getElementById('sa-x').addEventListener('click', function () { setOpen(false); openBtn.focus(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && panel.getAttribute('data-open') === 'true') { setOpen(false); openBtn.focus(); }
  });

  function scroll() { if (log) log.scrollTop = log.scrollHeight; }

  /* Minimal markdown: bold, italic, line breaks. Everything is escaped first,
     so a reply can never inject markup into the page. */
  function render(text) {
    var s = String(text)
      .replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
      .replace(/\n/g, '<br>');
    return s;
  }

  /* The action strip. A programme is offered only when the reply actually names
     it, so the buttons can never point somewhere the answer did not go. */
  function actionsFor(text) {
    var low = text.toLowerCase();
    var hits = window.DASShop.programs.filter(function (p) {
      return low.indexOf(p.label.toLowerCase()) >= 0;
    }).slice(0, 3);
    if (!hits.length) return '';
    return '<div class="sa-acts">' + hits.map(function (p) {
      return '<button type="button" class="sa-act" data-go="' + p.slug + '">Show ' + p.label + '</button>';
    }).join('') + '</div>';
  }

  function add(role, text) {
    var el = document.createElement('div');
    el.className = 'sa-msg ' + (role === 'user' ? 'me' : 'bot');
    el.innerHTML = role === 'user' ? render(text) : render(text) + actionsFor(text);
    log.appendChild(el);
    scroll();
    return el;
  }

  log.addEventListener('click', function (e) {
    var go = e.target.closest && e.target.closest('[data-go]');
    if (!go) return;
    window.DASShop.select(go.getAttribute('data-go'));
    if (window.matchMedia('(max-width: 720px)').matches) setOpen(false);
  });

  function seeds() {
    var el = document.createElement('div');
    el.className = 'sa-acts';
    el.innerHTML = SEEDS.map(function (s) {
      return '<button type="button" class="sa-act" data-seed="' + s.replace(/"/g, '&quot;') + '">' + s + '</button>';
    }).join('');
    el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-seed]');
      if (!b) return;
      input.value = b.getAttribute('data-seed');
      form.dispatchEvent(new Event('submit', { cancelable: true }));
    });
    log.appendChild(el);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (busy) return;
    var text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    add('user', text);
    messages.push({ role: 'user', content: text });
    ask();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.dispatchEvent(new Event('submit', { cancelable: true })); }
  });
  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });

  function ask() {
    busy = true;
    if (send) send.disabled = true;
    var bubble = document.createElement('div');
    bubble.className = 'sa-msg bot';
    bubble.innerHTML = '<span class="sa-typing"><i></i><i></i><i></i></span>';
    log.appendChild(bubble);
    scroll();

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (!r.body) return r.text();
      var reader = r.body.getReader(), dec = new TextDecoder(), acc = '';
      function pump() {
        return reader.read().then(function (res) {
          if (res.done) return acc;
          acc += dec.decode(res.value, { stream: true });
          bubble.innerHTML = render(acc);
          scroll();
          return pump();
        });
      }
      return pump();
    }).then(function (full) {
      var text = String(full || '').trim();
      if (!text) throw new Error('empty');
      bubble.innerHTML = render(text) + actionsFor(text);
      messages.push({ role: 'assistant', content: text });
      save();
      scroll();
    }).catch(function () {
      /* The guard wall refuses by design (kill switch, spend ceiling, rate
         ceiling) and a refusal must not look like a broken page. Every failure
         lands on a path a buyer can still act on. */
      bubble.innerHTML = render(
        "I can't reach my assistant right now. The catalogue filters on the left still work, " +
        "and the fleet team answers within one business day — **[contact.html](contact.html)**."
      );
    }).then(function () {
      busy = false;
      if (send) send.disabled = false;
      input.focus();
    });
  }

  function save() {
    try { sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-12))); } catch (e) {}
  }

  try {
    var prior = JSON.parse(sessionStorage.getItem(STORE) || '[]');
    if (prior.length) {
      messages = prior;
      prior.forEach(function (m) { add(m.role, m.content); });
    }
  } catch (e) {}

  if (!messages.length) { add('assistant', WELCOME); seeds(); }
})();
