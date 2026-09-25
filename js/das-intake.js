/* ============================================================================
   THE STEPPER — one decision per screen, progress always visible
   ----------------------------------------------------------------------------
   Drives any form marked `data-intake` whose field groups are wrapped in
   `.ix-step[data-step-title]`. Nothing here knows about contact vs quote; both
   pages declare their own steps in markup and this runs them.

   THE RULE IT OBEYS: it never touches a field, a name, an id, or the submit.
   Both pages post to /api/contact through handlers that read every value by
   [name="..."], and those handlers are untouched — steps are hidden with the
   `hidden` attribute, so every value stays in the DOM and still submits. A
   prettier form that quietly stops capturing leads would be a bad trade, so
   this was built to make that outcome impossible rather than unlikely.

   Validation is per-step and only over VISIBLE required fields, because the
   browser cannot focus a control inside a hidden step — the classic symptom
   being a submit button that silently does nothing with no message on screen.
   Both forms carry `novalidate` and do their own checking, which is why this
   reports errors itself instead of calling reportValidity().
   ========================================================================== */
(function () {
  'use strict';

  var forms = document.querySelectorAll('form[data-intake]');
  if (!forms.length) return;

  Array.prototype.forEach.call(forms, function (form) { wire(form); });

  function wire(form) {
    var steps = Array.prototype.slice.call(form.querySelectorAll('.ix-step'));
    if (steps.length < 2) return;

    var bar = form.querySelector('.ix-bar > i');
    var label = form.querySelector('.ix-progress-label');
    var count = form.querySelector('.ix-of');
    var back = form.querySelector('[data-ix-back]');
    var next = form.querySelector('[data-ix-next]');
    var submitWrap = form.querySelector('[data-ix-submit]');
    var review = form.querySelector('.ix-review');
    var at = 0;

    function show(i, focus) {
      at = Math.max(0, Math.min(steps.length - 1, i));
      steps.forEach(function (s, n) { s.hidden = n !== at; });

      var last = at === steps.length - 1;
      if (back) back.hidden = at === 0;
      if (next) next.hidden = last;
      if (submitWrap) submitWrap.hidden = !last;

      var pct = ((at + 1) / steps.length) * 100;
      if (bar) bar.style.width = pct + '%';
      if (label) label.textContent = steps[at].getAttribute('data-step-title') || '';
      if (count) count.textContent = 'Step ' + (at + 1) + ' of ' + steps.length;
      if (last && review) review.innerHTML = summary(form);

      /* Only move the page when the user asked to move. On first paint this
         would yank them down to a form they had not scrolled to yet. */
      if (focus) {
        var top = form.getBoundingClientRect().top + window.scrollY - 90;
        window.scrollTo({ top: top, behavior: 'smooth' });
        var first = steps[at].querySelector('input:not([type=hidden]),select,textarea');
        if (first) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }, 220);
      }
    }

    /** Every required control in the current step that the user can actually see. */
    function invalidIn(step) {
      return Array.prototype.slice
        .call(step.querySelectorAll('[required]'))
        .filter(function (el) {
          if (el.disabled || el.offsetParent === null) return false;
          if (el.type === 'checkbox') return !el.checked;
          return !String(el.value || '').trim();
        });
    }

    function clearErrors(step) {
      step.querySelectorAll('.is-invalid').forEach(function (el) { el.classList.remove('is-invalid'); });
      step.querySelectorAll('.ix-err').forEach(function (el) { el.remove(); });
    }

    function flag(el) {
      el.classList.add('is-invalid');
      var host = el.closest('.cf-group') || el.parentElement;
      if (host && !host.querySelector('.ix-err')) {
        var p = document.createElement('p');
        p.className = 'ix-err';
        p.textContent = el.type === 'checkbox' ? 'Please confirm this to continue.' : 'This one is required.';
        host.appendChild(p);
      }
      el.addEventListener('input', function once() {
        el.classList.remove('is-invalid');
        var h = el.closest('.cf-group') || el.parentElement;
        var e = h && h.querySelector('.ix-err');
        if (e) e.remove();
        el.removeEventListener('input', once);
      });
    }

    function advance() {
      var step = steps[at];
      clearErrors(step);
      var bad = invalidIn(step);
      if (bad.length) {
        bad.forEach(flag);
        try { bad[0].focus({ preventScroll: true }); } catch (e) { bad[0].focus(); }
        bad[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
      show(at + 1, true);
    }

    if (next) next.addEventListener('click', function (e) { e.preventDefault(); advance(); });
    if (back) back.addEventListener('click', function (e) { e.preventDefault(); show(at - 1, true); });

    /* Enter inside a field should move the flow on, not submit from step one.
       A textarea keeps Enter for what Enter is for. */
    form.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var t = e.target;
      if (!t || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON') return;
      if (at < steps.length - 1) { e.preventDefault(); advance(); }
    });

    /* Last line of defence. If anything ever submits from an early step, stop
       it and walk the user to the first thing that is actually missing rather
       than failing silently. Capture phase, so this runs before the page's own
       submit handler. */
    form.addEventListener('submit', function (e) {
      for (var i = 0; i < steps.length; i++) {
        clearErrors(steps[i]);
        var wasHidden = steps[i].hidden;
        steps[i].hidden = false;
        var bad = invalidIn(steps[i]);
        steps[i].hidden = wasHidden;
        if (bad.length) {
          e.preventDefault();
          e.stopImmediatePropagation();
          show(i, true);
          setTimeout(function () { bad.forEach(flag); flag(bad[0]); }, 260);
          return;
        }
      }
    }, true);

    /** What we already have, shown before we ask for the last thing. */
    function summary(f) {
      var pick = function (n) {
        var el = f.querySelector('[name="' + n + '"]');
        if (!el) return '';
        if (el.tagName === 'SELECT') {
          var o = el.options[el.selectedIndex];
          return o && o.value ? o.textContent.trim() : '';
        }
        return String(el.value || '').trim();
      };
      var bits = [];
      var co = pick('company'); if (co) bits.push('<b>' + esc(co) + '</b>');
      var fs = pick('fleet_size') || pick('num_drivers'); if (fs) bits.push(esc(fs) + (/driver/i.test(fs) ? '' : ' drivers'));
      var pr = pick('inquiry_type') || pick('product_interest') || pick('need'); if (pr) bits.push(esc(pr));
      return bits.length ? bits.join(' &middot; ') : '';
    }

    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    show(0, false);
  }
})();
