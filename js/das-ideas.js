/* ============================================================================
   DAS INSIGHTS & IDEAS — the rail, and the things the old index got wrong
   ----------------------------------------------------------------------------
   Runs AFTER the page's own setCategory(), which it wraps rather than replaces.
   That keeps the existing pill row, the featured-post handling and the empty
   state working exactly as before.

   Three real fixes ride along:

   1. THE COLUMN HAIRLINE. Linear's index tells columns apart with a rule in
      the gap, not with card borders. Expressing that as :nth-child(even)
      breaks the moment a filter hides a card, because nth-child counts hidden
      elements — filter to "Onboarding" and the single surviving card can land
      in the right-hand column with a stray rule down its left edge. Visible
      position is recomputed and stamped as data-col instead.

   2. THE COUNT. It was hardcoded to 5 on the "all" view while six cards were
      in the grid, with a comment explaining that one is a "coming soon"
      placeholder. A count that disagrees with what is on screen is the same
      defect the shop had; the placeholder is now marked as data-placeholder
      and excluded by measurement rather than by a magic number.

   3. THE RAIL COUNTS. Derived from the cards actually present, so a new
      article appears in the rail without anyone remembering to update it.
   ========================================================================== */
(function () {
  'use strict';

  var grid = document.getElementById('article-grid');
  var rail = document.getElementById('ideas-rail');
  if (!grid) return;

  var cards = Array.prototype.slice.call(grid.querySelectorAll('.article-card'));

  /* The categories, taken from the pill row so the two can never disagree. */
  var CATS = Array.prototype.slice.call(document.querySelectorAll('.cat-btn[data-cat]'))
    .map(function (b) { return { slug: b.dataset.cat, label: b.textContent.trim() }; })
    .filter(function (c, i, a) { return a.findIndex(function (x) { return x.slug === c.slug; }) === i; });

  function isPlaceholder(card) { return card.hasAttribute('data-placeholder'); }

  function countFor(slug) {
    return cards.filter(function (c) {
      if (isPlaceholder(c)) return false;
      return slug === 'all' || (c.dataset.cats || '').split(/\s+/).indexOf(slug) >= 0;
    }).length;
  }

  function renderRail(active) {
    if (!rail) return;
    var h = '<div class="idr-group"><span class="idr-head">Topic</span><div class="idr-rows">';
    CATS.forEach(function (c) {
      h += '<button type="button" class="idr-row" data-cat="' + c.slug + '" aria-pressed="' +
        (c.slug === active ? 'true' : 'false') + '">' +
        '<span class="idr-row-name">' + c.label.replace(/^All Articles$/, 'All topics') + '</span>' +
        '<span class="idr-row-n">' + countFor(c.slug) + '</span></button>';
    });
    h += '</div></div>' + RAIL_STATIC;
    rail.innerHTML = h;
  }

  /* Everything below the topic list. The Driver Appreciation Week countdown
     that used to sit at the top of this rail is GONE for the same reason the
     two DAW banners went (Jayden 2026-09-19: "the week's over and we will
     bring that back up ... probably January"). It was still announcing
     "Sep 13-19, 2026 · This week · Live" on the day the week ended. The dates
     stay in the calendar below, where a past week reads as history instead of
     as a live claim. */
  var RAIL_STATIC =
    '<div class="idr-group"><span class="idr-head">Recognition calendar</span><div class="idr-cal">' +
      '<div class="idr-cal-row"><span class="idr-cal-q">Q3</span><span><b class="idr-cal-b">Driver Appreciation Week</b><span class="idr-cal-d">Sep 13&ndash;19, 2026</span></span></div>' +
      '<div class="idr-cal-row"><span class="idr-cal-q">Q3</span><span><b class="idr-cal-b">Q3 Safety Review</b><span class="idr-cal-d">Jul&ndash;Sep 2026</span></span></div>' +
      '<div class="idr-cal-row"><span class="idr-cal-q">Q4</span><span><b class="idr-cal-b">Year-End Holiday Kits</b><span class="idr-cal-d">Nov&ndash;Dec 2026</span></span></div>' +
      '<div class="idr-cal-row"><span class="idr-cal-q">Q1</span><span><b class="idr-cal-b">Q1 Onboarding Push</b><span class="idr-cal-d">Jan 2027</span></span></div>' +
    '</div></div>' +
    '<div class="idr-group"><span class="idr-head">Quick guides</span>' +
      '<a class="idr-link" href="blog/fleet-operators-guide-appreciation-week.html">How to plan Driver Appreciation Week 2026</a>' +
      '<a class="idr-link" href="blog/roi-of-recognition.html">Recognition ROI analysis</a>' +
      '<a class="idr-link" href="blog/cost-of-driver-turnover.html">True cost of turnover</a>' +
      '<a class="idr-link" href="blog/year-round-recognition-calendar.html">Year-round calendar template</a>' +
    '</div>' +
    '<div class="idr-group"><span class="idr-head">Plan a program</span>' +
      '<a class="idr-cta" href="/contact.html">Get a custom quote' +
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path stroke-linecap="round" d="M5 12h14M13 6l6 6-6 6"/></svg></a>' +
    '</div>';

  /* Visible-position stamping — see note 1 at the top of this file. */
  function stampColumns() {
    var i = 0;
    cards.forEach(function (c) {
      if (c.style.display === 'none') { c.removeAttribute('data-col'); c.removeAttribute('data-firstrow'); return; }
      c.setAttribute('data-col', i % 2);
      if (i < 2) c.setAttribute('data-firstrow', ''); else c.removeAttribute('data-firstrow');
      i++;
    });
  }

  function liveCount(active) {
    var n = cards.filter(function (c) {
      return c.style.display !== 'none' && !isPlaceholder(c);
    }).length;
    var el = document.getElementById('article-count');
    if (el) el.textContent = n + ' article' + (n === 1 ? '' : 's');
    return n;
  }

  /* Wrap the page's own setCategory rather than reimplementing it. */
  var original = window.setCategory;
  window.setCategory = function (cat) {
    if (typeof original === 'function') original(cat);
    stampColumns();
    liveCount(cat);
    renderRail(cat);
    var head = document.getElementById('article-count');
    if (head && cat !== 'all') head.scrollIntoView({ block: 'nearest' });
  };

  if (rail) {
    rail.addEventListener('click', function (e) {
      var row = e.target.closest && e.target.closest('.idr-row');
      if (row) window.setCategory(row.dataset.cat);
    });
  }

  renderRail('all');
  stampColumns();
  liveCount('all');
})();
