/* ============================================================================
   DAW ANNOUNCEMENT TICKER — A/B test (Jayden, 2026-09-13)
   A = Red Alert · B = Stars & Stripes  (styles: css/daw-ticker.css)

   Load this script IMMEDIATELY after the <div data-daw-ticker> placeholder (not deferred):
   it renders synchronously, so the assigned variant paints with no flash.

   Assignment : ?daw_ticker=a|b forces (and remembers) a variant; otherwise the browser keeps
                the variant it was first given (localStorage); otherwise 50/50.
   Countdown  : National Truck Driver Appreciation Week 2026 is Sept 13–19 (ATA).
                before → counts to the start · during → counts to the END · after → timer hidden.
                (The old js/countdown.js counted to the start only, so it read 00:00:00:00
                for the whole week.) Visitor-local time, same convention as countdown.js.
   Measurement: dataLayer events `daw_ticker_view` and `daw_ticker_click`, each carrying
                `daw_ticker_variant` (red_alert | stars_stripes) and `daw_ticker_state`.
                GA4 only records them once a GTM trigger + GA4 event tag exist for these
                event names in container GTM-523F9QFC.
   ============================================================================ */
(function () {
  'use strict';
  var START = new Date('2026-09-13T00:00:00').getTime();
  var END = new Date('2026-09-20T00:00:00').getTime();
  var DAY = 86400000;
  var KEY = 'das_daw_ticker_v1';
  var NAMES = { a: 'red_alert', b: 'stars_stripes' };

  function pickVariant() {
    var forced = null;
    try { forced = new URLSearchParams(window.location.search).get('daw_ticker'); } catch (e) { /* old browser */ }
    if (forced === 'a' || forced === 'b') { try { localStorage.setItem(KEY, forced); } catch (e) { /* storage blocked */ } return forced; }
    var kept = null;
    try { kept = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    if (kept === 'a' || kept === 'b') return kept;
    var v = Math.random() < 0.5 ? 'a' : 'b';
    try { localStorage.setItem(KEY, v); } catch (e) { /* storage blocked — still 50/50 per view */ }
    return v;
  }

  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
  var CTA = '<a class="daw-tk__cta" data-cta href="/shop.html" data-href-after="/driver-recognition-programs.html">' +
    '<span class="daw-tk__long" data-s-before="Shop appreciation kits" data-s-live="Shop appreciation kits" data-s-after="Plan year-round recognition">Shop appreciation kits</span>' +
    '<span class="daw-tk__short" data-s-before="Shop kits" data-s-live="Shop kits" data-s-after="Plan ahead">Shop kits</span>' + ARROW + '</a>';

  var TEMPLATES = {
    a: '<div class="daw-tk__in">' +
      '<span class="daw-tk__lab"><span class="daw-tk__dot" aria-hidden="true"></span>' +
      '<span data-s-before="Driver Appreciation Week starts in:" data-s-live="Driver Appreciation Week ends in:" data-s-after="Driver Appreciation Week 2026 is a wrap">Driver Appreciation Week ends in:</span></span>' +
      '<span class="daw-tk__r2">' +
      '<span class="daw-tk__cd" role="timer" aria-label="Time remaining" data-live-only>' +
      '<b data-t="d"></b><i data-u="d" data-one="Day" data-many="Days">Days</i>' +
      '<b data-t="h"></b><i data-u="h" data-one="Hr" data-many="Hrs">Hrs</i>' +
      '<b data-t="m"></b><i data-u="m" data-one="Min" data-many="Mins">Mins</i>' +
      '<b data-t="s"></b><i data-u="s" data-one="Sec" data-many="Secs">Secs</i></span>' +
      CTA + '</span></div>',
    b: '<div class="daw-tk__in">' +
      '<span class="daw-tk__lab"><svg class="daw-tk__star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>' +
      '<span class="daw-tk__name">Driver Appreciation Week</span>' +
      '<span class="daw-tk__ends" data-s-before="Starts in" data-s-live="Ends in" data-s-after="Thank you, drivers">Ends in</span></span>' +
      '<span class="daw-tk__r2">' +
      '<span class="daw-tk__cd" role="timer" aria-label="Time remaining" data-live-only>' +
      '<span data-t="d"></span><i>D</i><span data-t="h"></span><i>H</i><span data-t="m"></span><i>M</i><span data-t="s"></span><i>S</i></span>' +
      CTA + '</span></div>',
  };

  var bars = document.querySelectorAll('[data-daw-ticker]');
  if (!bars.length) return;
  var variant = pickVariant();

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function stateAt(now) { return now < START ? 'before' : now < END ? 'live' : 'after'; }

  function paint(bar) {
    var now = Date.now();
    var state = stateAt(now);
    var left = Math.max(0, (state === 'before' ? START : END) - now);
    var p = { d: Math.floor(left / DAY), h: Math.floor((left % DAY) / 3600000), m: Math.floor((left % 3600000) / 60000), s: Math.floor((left % 60000) / 1000) };
    bar.classList.toggle('is-after', state === 'after');
    bar.setAttribute('data-state', state);
    var i, els;
    els = bar.querySelectorAll('[data-t]');
    for (i = 0; i < els.length; i++) { var k = els[i].getAttribute('data-t'); els[i].textContent = k === 'd' ? String(p.d) : pad(p[k]); }
    els = bar.querySelectorAll('[data-u]');
    for (i = 0; i < els.length; i++) { els[i].textContent = p[els[i].getAttribute('data-u')] === 1 ? els[i].getAttribute('data-one') : els[i].getAttribute('data-many'); }
    els = bar.querySelectorAll('[data-s-' + state + ']');
    for (i = 0; i < els.length; i++) { els[i].textContent = els[i].getAttribute('data-s-' + state); }
    if (state === 'after') {
      els = bar.querySelectorAll('[data-href-after]');
      for (i = 0; i < els.length; i++) { els[i].setAttribute('href', els[i].getAttribute('data-href-after')); }
    }
    return state;
  }

  window.dataLayer = window.dataLayer || [];
  var firstState = null;
  for (var b = 0; b < bars.length; b++) {
    var bar = bars[b];
    bar.className = 'daw-tk daw-tk--' + variant;
    bar.setAttribute('data-variant', NAMES[variant]);
    bar.innerHTML = TEMPLATES[variant];
    firstState = paint(bar);
    bar.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('[data-cta]') : null;
      if (!a) return;
      window.dataLayer.push({ event: 'daw_ticker_click', daw_ticker_variant: NAMES[variant], daw_ticker_state: stateAt(Date.now()), link_url: a.href });
    });
  }
  window.dataLayer.push({ event: 'daw_ticker_view', daw_ticker_variant: NAMES[variant], daw_ticker_state: firstState });

  setInterval(function () { for (var j = 0; j < bars.length; j++) paint(bars[j]); }, 1000);
})();
