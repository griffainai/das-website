/* ============================================================================
   DAS Pricing Visibility + Program Planning (E104).
   Products priced over $110 invite buyers into a guided consultation instead of
   showing a public price. A sitewide "Planning Code" (validated server-side via
   /api/pricing-unlock) reveals all gated prices and restores normal purchasing;
   the unlocked state persists in the browser. Products $110 and under always
   show their price. Premium, consultative tone — never "locked / password".
   ============================================================================ */
(function () {
  'use strict';
  var THRESHOLD = 110;
  var LS_KEY = 'das_pricing_unlocked_v1';
  var CONSULT = 'company-purchasing.html?product=' +
    encodeURIComponent('Program Planning Consultation') + '&category=' + encodeURIComponent('Program Planning');
  var PLAN_LABEL = 'Let’s Plan Your Program';

  function isUnlocked() { try { return localStorage.getItem(LS_KEY) === '1'; } catch (e) { return false; } }
  function setUnlocked() { try { localStorage.setItem(LS_KEY, '1'); } catch (e) {} }

  // ---- styles (injected once) ----
  function injectCSS() {
    if (document.getElementById('pricing-gate-css')) return;
    var s = document.createElement('style'); s.id = 'pricing-gate-css';
    s.textContent =
      '.plan-cta-label{display:inline-block;font-weight:800;letter-spacing:-0.01em;color:#1A2E6E;font-size:1.0625rem;line-height:1.2}' +
      '.plan-cta-sub{display:block;font-size:0.6875rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#9A7B2E;margin-top:2px}' +
      '.plan-learn-more{display:inline-flex;align-items:center;justify-content:center;gap:7px;background:#1A2E6E;color:#fff;font-size:.82rem;font-weight:700;padding:10px 16px;border-radius:8px;text-decoration:none;width:100%;transition:background .18s}' +
      '.plan-learn-more:hover{background:#13235a}' +
      '#pi-price .plan-learn-more{width:auto;margin-top:10px}' +
      '.plan-code-link{display:inline-flex;align-items:center;gap:6px;background:none;border:0;color:#9A7B2E;font-weight:600;font-size:.8rem;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:4px;font-family:inherit}' +
      '.plan-code-link:hover{color:#1A2E6E}' +
      '.plan-code-link::before{content:"\\1F511";font-size:.85em;text-decoration:none}' +   /* small key glyph */
      '#pi-price .plan-code-link{margin-top:8px;display:block}' +
      '.plan-code-bar{text-align:right;margin:10px 2px 0}' +
      '.plan-modal-backdrop{position:fixed;inset:0;background:rgba(10,14,26,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px}' +
      '.plan-modal{background:#fff;border-radius:14px;max-width:420px;width:100%;padding:28px 26px;box-shadow:0 24px 60px -20px rgba(0,0,0,.5);font-family:inherit}' +
      '.plan-modal h3{margin:0 0 6px;font-size:1.2rem;color:#16264F;font-weight:800}' +
      '.plan-modal p{margin:0 0 16px;font-size:.9rem;color:#475569;line-height:1.5}' +
      '.plan-modal input{width:100%;padding:12px 14px;border:1.5px solid #D5DBE6;border-radius:9px;font-size:1rem;letter-spacing:.05em;text-transform:uppercase;box-sizing:border-box}' +
      '.plan-modal input:focus{outline:none;border-color:#1A2E6E}' +
      '.plan-modal-actions{display:flex;gap:10px;margin-top:16px}' +
      '.plan-modal-actions button{flex:1;padding:11px;border-radius:9px;font-weight:700;font-size:.9rem;cursor:pointer;border:0}' +
      '.plan-modal-go{background:linear-gradient(180deg,#E8C766,#C8A84B);color:#16264F}' +
      '.plan-modal-cancel{background:#F1F4FB;color:#16264F}' +
      '.plan-modal-msg{font-size:.82rem;margin-top:12px;min-height:1em;color:#B91C1C}' +
      '.plan-modal-msg.ok{color:#15803D}';
    document.head.appendChild(s);
  }

  function learnMoreBtn(href, label) {
    var a = document.createElement('a');
    a.href = href || CONSULT; a.className = 'plan-learn-more';
    a.innerHTML = (label || 'Learn More') + ' <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"/></svg>';
    return a;
  }
  // Discreet-but-findable entry point to enter the planning code (opens the modal).
  function codeTrigger(label) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'plan-code-link';
    b.textContent = label || 'Have a planning code?';
    b.addEventListener('click', openModal);
    return b;
  }

  // ---- shop / search / category / related cards ----
  function gateCard(card) {
    if (card.dataset.planGated === '1') return;
    var price = parseFloat(card.getAttribute('data-product-price'));
    if (!(price > THRESHOLD)) return;
    card.dataset.planGated = '1';
    var row = card.querySelector('.product-card-price-row');
    if (row) row.innerHTML = '<span class="plan-cta-label">' + PLAN_LABEL + '</span><span class="plan-cta-sub">Pricing by consultation</span>';
    var qty = card.querySelector('.qty-control'); if (qty) qty.style.display = 'none';
    var qtyL = card.querySelector('.qty-label'); if (qtyL) qtyL.style.display = 'none';
    // "Learn More" → the product's OWN detail page (image + full details), NOT straight to the
    // quote form. The PDP then carries the path to request pricing.
    var pdpLink = card.querySelector('a[href*="product.html"], a[href*="product?id="]');
    var pid = card.getAttribute('data-product-id');
    var pdpHref = (pdpLink && pdpLink.getAttribute('href')) || (pid ? 'product.html?id=' + encodeURIComponent(pid) : CONSULT);
    var actions = card.querySelector('.product-card-actions');
    if (actions) { actions.innerHTML = ''; actions.appendChild(learnMoreBtn(pdpHref, 'Learn More')); }
  }
  function gateCards(root) {
    (root || document).querySelectorAll('.product-card[data-product-price]').forEach(gateCard);
  }

  // ---- PDP main price + buy controls ----
  function gatePDP() {
    var pe = document.getElementById('pi-price');
    if (!pe) return;
    var price = (window.currentProduct && Number(window.currentProduct.price)) || null;
    if (price == null) { // fall back to the rendered $ amount
      var m = (pe.textContent || '').match(/\$\s*([\d,]+(?:\.\d+)?)/);
      if (m) price = parseFloat(m[1].replace(/,/g, ''));
    }
    if (!(price > THRESHOLD)) return;
    if (pe.dataset.planGated !== '1') {
      pe.dataset.planGated = '1';
      // On the PDP the buyer is already viewing the product — the CTA goes to THIS product's quote
      // form (the per-product "buy for company" link), not the generic consultation.
      var bf = document.getElementById('buy-for-company-link');
      var quoteHref = (bf && bf.getAttribute('href')) || CONSULT;
      pe.innerHTML = '<span class="plan-cta-label">' + PLAN_LABEL + '</span><span class="plan-cta-sub">Pricing by consultation</span>';
      pe.appendChild(learnMoreBtn(quoteHref, 'Request Pricing'));
      pe.appendChild(codeTrigger('Have a planning code? Enter it'));
    }
    // hide purchase controls (product stays fully visible — images, description, options)
    ['.qty-section', '.express-checkout-section', '#btn-add-to-cart', '#das-terms-cta'].forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { el.style.display = 'none'; });
    });
  }

  // ---- index featured flagship ($499 milestone kit) ----
  function gateFlagship() {
    document.querySelectorAll('.mrk-flagship-price').forEach(function (el) {
      if (el.dataset.planGated === '1') return;
      var m = (el.textContent || '').match(/\$\s*([\d,]+)/);
      if (!m || !(parseFloat(m[1].replace(/,/g, '')) > THRESHOLD)) return;
      el.dataset.planGated = '1';
      el.innerHTML = '<span class="plan-cta-label" style="color:#fff">' + PLAN_LABEL + '</span>';
    });
  }

  function gateAll() {
    if (isUnlocked()) return;
    gateCards(document); gatePDP(); gateFlagship();
  }

  // ---- Planning Code modal ----
  function openModal() {
    var bd = document.createElement('div'); bd.className = 'plan-modal-backdrop';
    bd.innerHTML =
      '<div class="plan-modal" role="dialog" aria-modal="true" aria-labelledby="plan-modal-title">' +
        '<h3 id="plan-modal-title">Continue Your Program</h3>' +
        '<p>Enter your planning code to view program pricing. Don’t have one? ' +
          '<a href="' + CONSULT + '" style="color:#1A2E6E;font-weight:700">Start a consultation</a> and our team will guide you.</p>' +
        '<label for="plan-code-input" style="display:block;font-size:.8rem;font-weight:600;color:#16264F;margin-bottom:6px">Planning code</label>' +
        '<input type="text" id="plan-code-input" placeholder="Enter your code" aria-label="Planning code" autocomplete="off" autocapitalize="characters" spellcheck="false">' +
        '<div class="plan-modal-msg" id="plan-code-msg"></div>' +
        '<div class="plan-modal-actions">' +
          '<button class="plan-modal-cancel" type="button">Cancel</button>' +
          '<button class="plan-modal-go" type="button">Continue</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bd);
    var input = bd.querySelector('#plan-code-input');
    var msg = bd.querySelector('#plan-code-msg');
    var lastFocus = document.activeElement;          // a11y: return focus to the trigger on close
    input.focus();
    function close() { bd.remove(); document.removeEventListener('keydown', onKey); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {                          // a11y: trap focus within the dialog
        var f = bd.querySelectorAll('a[href], button, input, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    bd.addEventListener('click', function (e) { if (e.target === bd) close(); });
    bd.querySelector('.plan-modal-cancel').addEventListener('click', close);
    async function submit() {
      var code = (input.value || '').trim();
      if (!code) return;
      msg.className = 'plan-modal-msg'; msg.textContent = 'Checking…';
      try {
        var res = await fetch('/api/pricing-unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code }) });
        var data = await res.json().catch(function () { return {}; });
        if (data.ok) { setUnlocked(); msg.className = 'plan-modal-msg ok'; msg.textContent = 'Pricing unlocked — loading…'; setTimeout(function () { location.reload(); }, 500); }
        else { msg.className = 'plan-modal-msg'; msg.textContent = 'The code you entered was not recognized. Please verify your planning code or contact us for assistance.'; }
      } catch (e) { msg.textContent = 'Something went wrong — please try again.'; }
    }
    bd.querySelector('.plan-modal-go').addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  // Discreet-but-findable entry points: footer (sitewide) + a line above the shop grid.
  function addEntryPoints() {
    if (isUnlocked()) return;
    var foot = document.querySelector('.footer-copyright') || document.querySelector('.footer .container') || document.querySelector('footer');
    if (foot && !document.getElementById('plan-code-link-footer')) {
      var fb = codeTrigger('Have a planning code? Unlock program pricing');
      fb.id = 'plan-code-link-footer'; fb.style.marginLeft = '10px';
      foot.appendChild(fb);
    }
    // Shop / search: a discreet line right above the product grid, by the category filters.
    var firstFilter = document.querySelector('.filter-btn');
    if (firstFilter && !document.getElementById('plan-code-link-shop')) {
      var bar = firstFilter.parentElement;
      if (bar && bar.parentElement) {
        var wrap = document.createElement('div');
        wrap.className = 'plan-code-bar';
        var sb = codeTrigger('Have a planning code? Unlock program pricing →');
        sb.id = 'plan-code-link-shop';
        wrap.appendChild(sb);
        bar.parentElement.insertBefore(wrap, bar.nextSibling);
      }
    }
  }

  function init() {
    if (isUnlocked()) return;   // unlocked: prices show normally, no gating, no code prompt
    injectCSS();
    gateAll();
    addEntryPoints();
    // Re-gate dynamically-rendered cards (shop milestone/medal grids, PDP price re-renders).
    // Debounced so our own DOM writes (and unrelated activity) never thrash.
    var t = null;
    var mo = new MutationObserver(function () { if (t) return; t = setTimeout(function () { t = null; gateAll(); }, 120); });
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', gateAll);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
