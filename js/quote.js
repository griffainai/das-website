/* ============================================================================
   DAS Quote Cart (B2B). Lets a fleet buyer assemble MULTIPLE gated/program items
   into one quote, then submit a single request (instead of per-product). Pure
   progressive enhancement — self-contained, localStorage-backed, no dependencies.
   If anything here fails, every existing flow (gate, cart, checkout) is untouched.
   ============================================================================ */
(function () {
  'use strict';
  var KEY = 'das_quote_v1';
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function write(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {} render(); }
  function add(item) { var l = read(); if (item && item.id && !l.some(function (x) { return x.id === item.id; })) { l.push({ id: item.id, name: item.name || item.id }); write(l); } }
  function remove(id) { write(read().filter(function (x) { return x.id !== id; })); }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} render(); }
  window.DASQuote = { list: read, add: add, remove: remove, clear: clear };

  // ---- Floating "Request Quote (N)" pill ----
  function render() {
    var l = read(); var pill = document.getElementById('das-quote-pill');
    if (!l.length) { if (pill) pill.parentNode.removeChild(pill); return; }
    if (!pill) {
      pill = document.createElement('a'); pill.id = 'das-quote-pill';
      pill.href = 'company-purchasing.html?quote=1';
      pill.setAttribute('aria-label', 'Review your quote request');
      pill.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:9000;background:#1A2E6E;color:#fff;font-weight:700;font-size:.9rem;padding:12px 18px;border-radius:999px;box-shadow:0 10px 30px -8px rgba(0,0,0,.45);text-decoration:none;display:inline-flex;align-items:center;gap:8px';
      document.body.appendChild(pill);
    }
    pill.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11H5a2 2 0 0 0-2 2v7h18v-7a2 2 0 0 0-2-2h-4"/><path d="M9 7V4h6v3"/><path d="M9 11h6"/></svg> Request Quote (' + l.length + ')';
  }

  // ---- "+ Add to Quote" on a GATED product detail page ----
  function injectPDP() {
    var pe = document.getElementById('pi-price');
    if (!pe || !pe.querySelector('.plan-cta-label')) return false;   // only gated PDPs
    if (document.getElementById('das-add-quote')) return true;
    // Read the product from the URL (id) + the rendered title (name) — no dependency on page internals.
    var id = (new URLSearchParams(location.search)).get('id');
    var nameEl = document.getElementById('pi-name');
    var name = nameEl ? nameEl.textContent.trim() : ((window.currentProduct && window.currentProduct.name) || '');
    if (!id || !name) return false;
    var b = document.createElement('button'); b.id = 'das-add-quote'; b.type = 'button';
    b.textContent = '+ Add to Quote';
    b.style.cssText = 'display:block;margin-top:8px;background:#fff;border:1.5px solid #1A2E6E;color:#1A2E6E;font-weight:700;font-size:.82rem;padding:9px 14px;border-radius:8px;cursor:pointer;width:100%;font-family:inherit';
    b.addEventListener('click', function () {
      add({ id: id, name: name });
      b.textContent = '✓ Added — add another'; b.style.borderColor = '#059669'; b.style.color = '#059669';
    });
    var lm = pe.querySelector('.plan-learn-more');
    if (lm && lm.parentNode) lm.parentNode.insertBefore(b, lm.nextSibling); else pe.appendChild(b);
    return true;
  }

  // ---- On company-purchasing: show the assembled quote items ----
  function renderQuotePanel() {
    var l = read(); if (!l.length) return;
    if (document.getElementById('cr-quote-items')) return;
    var form = document.querySelector('form'); if (!form || !form.parentNode) return;
    var host = document.createElement('div'); host.id = 'cr-quote-items';
    host.style.cssText = 'background:#F1F4FB;border:1px solid #D5DBE6;border-radius:12px;padding:16px 18px;margin-bottom:22px';
    host.innerHTML = '<div style="font-weight:700;color:#16264F;margin-bottom:8px">Items in your quote (' + l.length + ')</div>' +
      '<ul style="margin:0;padding-left:18px;color:#475569;font-size:.9rem;line-height:1.7">' +
      l.map(function (x) { return '<li>' + x.name + '</li>'; }).join('') + '</ul>' +
      '<button type="button" id="cr-quote-clear" style="margin-top:10px;background:none;border:0;color:#9A7B2E;font-weight:600;font-size:.8rem;cursor:pointer;text-decoration:underline;padding:0">Clear quote</button>';
    form.parentNode.insertBefore(host, form);
    var cl = document.getElementById('cr-quote-clear');
    if (cl) cl.addEventListener('click', function () { clear(); host.parentNode.removeChild(host); });
  }

  function init() {
    render();
    var tries = 0;
    var iv = setInterval(function () { if (injectPDP() || ++tries > 25) clearInterval(iv); }, 280);
    if (/company-purchasing/.test(location.pathname) || /[?&]quote=1/.test(location.search)) {
      var t2 = 0; var iv2 = setInterval(function () { renderQuotePanel(); if (document.getElementById('cr-quote-items') || ++t2 > 25) clearInterval(iv2); }, 280);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
