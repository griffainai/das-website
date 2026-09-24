/* ============================================================================
   DAS FORMS — progressive disclosure on Company Purchasing
   ----------------------------------------------------------------------------
   The page measured 23 visible controls and a 2191px form on a 375px screen.
   The Accounts Payable block is only relevant to a buyer whose purchasing need
   implies it, so it is revealed by what they tick rather than shown to
   everyone.

   WHY NOTHING IS REMOVED FROM THE DOM. The fields keep their ids and their
   name attributes and stay inside the <form>. The submit handler serialises
   the same fields it always did and the API contract does not change; an
   unrevealed block posts empty strings, which is exactly what it posted before
   when nobody filled it in. Hiding is presentation, not data.

   The reveal is declarative: a container carries
     data-reveal-for="Checkbox Value,Another Value"
   and opens when any checkbox with one of those values is checked. Adding a
   new trigger is an HTML change, not a JS one.
   ========================================================================== */
(function () {
  'use strict';

  function wire(form) {
    var blocks = [].slice.call(form.querySelectorAll('[data-reveal-for]'));
    if (!blocks.length) return;

    var boxes = [].slice.call(form.querySelectorAll('input[type="checkbox"]'));

    function sync(animate) {
      blocks.forEach(function (block) {
        var wants = block.getAttribute('data-reveal-for').split(',')
          .map(function (v) { return v.trim(); }).filter(Boolean);
        var open = boxes.some(function (b) { return b.checked && wants.indexOf(b.value) > -1; });
        if (open === block.classList.contains('is-open')) return;
        block.classList.toggle('is-open', open);
        /* A block that appears below the fold has not appeared as far as the
           person is concerned. Only on open, only when they did something. */
        if (open && animate) {
          var r = block.getBoundingClientRect();
          if (r.bottom > window.innerHeight) {
            window.scrollBy({ top: Math.min(r.bottom - window.innerHeight + 24, 260), behavior: 'smooth' });
          }
        }
      });
    }

    boxes.forEach(function (b) { b.addEventListener('change', function () { sync(true); }); });
    sync(false);          /* honour a browser-restored state on reload */
  }

  function boot() {
    [].slice.call(document.querySelectorAll('form')).forEach(wire);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
