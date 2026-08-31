/* ============================================================================
   MOBILE AUDIT — every page of the DAS site at true phone width
   ----------------------------------------------------------------------------
   Paste into the browser console on any page of the site (local dev or prod) and
   run. It loads every page into a same-origin 390x844 iframe and measures REAL
   layout, because the failures that matter are geometric and do not show up in
   the CSS when you read it.

   In scripts/, so it is .vercelignore'd and never becomes a public endpoint.

   WHY THIS EXISTS (2026-08-31): the survey shipped with three text inputs stacked
   at one invisible box — `position:absolute; inset:0` inherited from a duplicated
   class name. It passed every functional test, because setting `.value` on an
   invisible input works perfectly. Only geometry caught it. A form a script can
   fill is not a form a thumb can fill.

   WHAT IT CHECKS, and why each one is a real phone failure:
     · horizontal overflow ....... the page scrolls sideways; the classic mobile bug
     · elements past the right edge ... the cause, when overflow is present
     · text inputs under 16px .... iOS Safari ZOOMS the page on focus, which on a
                                   full-bleed flow throws the user out of it. It hit
                                   the cart's promo field at 11px, mid-checkout.
     · tap targets under 44px .... the accessibility floor; reported, not failed,
                                   because inline text links legitimately sit under it
   ========================================================================== */
(async () => {
  const PAGES = ('about account bulk-driver-appreciation-gifts cancelation-policy cart ' +
    'commercial-driver-gifts company-purchasing contact customer-service driver-appreciation-gift-ideas ' +
    'driver-appreciation-gifts driver-appreciation-week-2026 driver-appreciation-week-ideas ' +
    'driver-appreciation-week driver-milestone-awards driver-recognition-programs ' +
    'driver-retention-strategies driver-retention driver-turnover-cost-calculator favorites ' +
    'fleet-driver-retention-gifts forgot-password how-to-build-a-driver-recognition-program ideas ' +
    'index legal login million-mile-driver-awards new-driver-welcome-kit premium-appreciation-kits ' +
    'privacy product pub publications refund-policy return-policy safe-driver-award-programs shop ' +
    'signup sms-terms success surveys terms truck-driver-gifts women-in-transportation').split(' ');

  const W = 390, H = 844;
  const frame = document.createElement('iframe');
  frame.style.cssText = `position:fixed;left:-9999px;top:0;width:${W}px;height:${H}px;border:0`;
  document.body.appendChild(frame);

  const SKIP_TYPES = ['hidden', 'checkbox', 'radio', 'submit', 'button', 'range'];
  const rows = [];

  for (const page of PAGES) {
    await new Promise((res) => {
      frame.onload = () => setTimeout(res, 200);
      frame.src = `/${page}.html?bust=${Date.now()}`;
      setTimeout(res, 3500);                       // never hang on one bad page
    });
    try {
      const d = frame.contentDocument, w = frame.contentWindow;
      const overflow = Math.max(0, d.documentElement.scrollWidth - W);

      const wide = [];
      for (const el of d.body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width > 24 && r.right > W + 2) {
          const id = el.tagName.toLowerCase() +
            (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '');
          if (wide.length < 4 && !wide.includes(id)) wide.push(id);
        }
      }

      const smallInputs = [...d.querySelectorAll('input,textarea,select')].filter((el) => {
        const t = (el.getAttribute('type') || 'text').toLowerCase();
        if (SKIP_TYPES.includes(t)) return false;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;          // invisible fields cannot be focused
        return parseFloat(w.getComputedStyle(el).fontSize) < 16;
      }).map((el) => `${el.id || el.name || el.type} @${w.getComputedStyle(el).fontSize}`);

      const tinyTaps = [...d.querySelectorAll('a,button')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44);
      }).length;

      rows.push({ page, overflow, wide, smallInputs, tinyTaps, noViewport: !d.querySelector('meta[name="viewport"]') });
    } catch (e) {
      rows.push({ page, error: String(e).slice(0, 60) });
    }
  }
  frame.remove();

  const fails = rows.filter((r) => r.error || r.overflow > 0 || r.noViewport || r.smallInputs?.length);
  console.log(`audited ${rows.length} pages at ${W}x${H}`);
  console.log(`FAIL: ${fails.length}  (overflow / sub-16px input / missing viewport)`);
  if (fails.length) console.table(fails);
  console.log('tap targets under 44px, by page (informational — inline text links count here):');
  console.table(rows.filter((r) => r.tinyTaps).map((r) => ({ page: r.page, tinyTaps: r.tinyTaps })));
  return { audited: rows.length, failed: fails.length, fails };
})();
