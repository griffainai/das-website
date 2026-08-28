/* ============================================================================
   DAS PROMO POPUPS — the shop.griffain.io rotating-set architecture, ported.
   Source spec: griffain-merch app/rp/Popups.tsx (SHOP-SPEC §6, popups v2).

   RULES (identical to the reference):
   - rotate p1 → p4 across visits; show at most ONE per session
   - suppressed 14 days after a dismiss, forever after a subscribe
   - fires only after ≥8s AND ≥40% scroll — except p4 (slim bar: time only)
     and p5 (exit-intent: cart must have items; exempt from both)
   - never on cart / checkout / auth / form pages

   DESIGN is DAS, not Represent: Anton headlines, Inter UI, navy grounds,
   pill CTAs, real catalog photography. Every promise is real: subscribing
   sends an actual welcome email (Resend) and joins the fleet newsletter;
   the dates and the Aug 7 deadline are the site's own.
   ============================================================================ */
(function () {
  'use strict';

  var KEY = 'das-popups-v1';
  var API = '/api/newsletter-subscribe';
  var BLOCKED = /(^|\/)(cart|success|login|signup|forgot-password|account|contact|company-purchasing)(\.html)?$/;
  var ORDER = ['p1', 'p2', 'p3', 'p4'];
  var IMG = {
    p1: '/images/das-da-kit-1.webp',
    p2: '/images/home-hero-1400.webp',
    p3: '/images/mrk-hero-card.webp',
    p4: '/images/das-da-kit-case-2026.webp',
    p5: '/images/pak-collection-hero.webp'
  };

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function cartCount() {
    try { return (JSON.parse(localStorage.getItem('das_cart_v1') || '[]')).length; } catch (e) { return 0; }
  }

  var path = location.pathname;
  if (BLOCKED.test(path === '/' ? '/index' : path)) return;

  var st = load();
  if (st.subscribed) return;
  if (st.dismissedAt && Date.now() - st.dismissedAt < 14 * 864e5) return;
  try { if (sessionStorage.getItem(KEY + ':shown')) return; } catch (e) {}

  var next = ORDER[(ORDER.indexOf(st.last || 'p4') + 1) % ORDER.length];
  var timeOk = false, scrollOk = false, fired = false;

  function styles() {
    if (document.getElementById('das-popup-css')) return;
    var s = document.createElement('style');
    s.id = 'das-popup-css';
    s.textContent = [
      '#dasPop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;padding:0}',
      '@media(min-width:760px){#dasPop{align-items:center;padding:16px}}',
      '#dasPop .bk{position:absolute;inset:0;background:rgba(6,14,36,.5);backdrop-filter:blur(6px)}',
      '#dasPop .card{position:relative;overflow:hidden;width:100%;background:#fff;color:#0B1020;',
      '  box-shadow:0 40px 90px -40px rgba(6,14,36,.8)}',
      '@media(min-width:760px){#dasPop .card{border-radius:18px}}',
      '#dasPop .x{position:absolute;top:10px;right:10px;z-index:20;width:36px;height:36px;border:0;cursor:pointer;',
      '  border-radius:999px;background:rgba(255,255,255,.9);color:#0C1840;display:grid;place-items:center;font-size:15px;line-height:1}',
      '#dasPop .x.lt{background:rgba(12,24,64,.55);color:#fff}',
      '#dasPop .eb{font-family:Inter,-apple-system,sans-serif;font-size:10.5px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#9A7B2E}',
      '#dasPop .eb.lt{color:#9CC4F5}',
      '#dasPop h2{font-family:Anton,sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.01em;',
      '  font-size:clamp(26px,4.6vw,38px);line-height:.98;margin:8px 0 0;color:#0C1840}',
      '#dasPop h2.lt{color:#fff}',
      '#dasPop p.bd{font-family:Inter,-apple-system,sans-serif;font-size:13.5px;line-height:1.6;color:#67718A;margin:10px 0 0}',
      '#dasPop p.bd.lt{color:rgba(255,255,255,.82)}',
      '#dasPop input[type=email],#dasPop input[type=text]{height:48px;width:100%;padding:0 16px;font:500 16px Inter,-apple-system,sans-serif;',
      '  color:#0B1020;background:#F7F9FD;border:1.5px solid #E3E8F2;border-radius:12px;outline:0}',
      '#dasPop input:focus{border-color:#1A2E6E}',
      '#dasPop .lt input[type=email],#dasPop .lt input[type=text]{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.3);color:#fff}',
      '#dasPop .cta{height:50px;width:100%;border:0;cursor:pointer;border-radius:999px;',
      '  font:500 15px Inter,-apple-system,sans-serif;color:#fff;',
      '  background:linear-gradient(96deg,#16264F 0%,#1A2E6E 46%,#2E4FA8 100%);',
      '  box-shadow:0 10px 30px rgba(46,79,168,.42),inset 0 1px 0 rgba(255,255,255,.3)}',
      '#dasPop .cta:hover{filter:brightness(1.1)}',
      '#dasPop .cta.wh{background:#fff;color:#0C1840;box-shadow:none}',
      '#dasPop .no{font:600 11px Inter,-apple-system,sans-serif;letter-spacing:.08em;text-transform:uppercase;',
      '  color:#93A0B8;background:none;border:0;cursor:pointer;text-decoration:underline;align-self:center;margin-top:2px}',
      '#dasPop .no.lt{color:rgba(255,255,255,.6)}',
      '#dasPop .frm{display:flex;flex-direction:column;gap:12px}',
      '#dasPop .ok{font-family:Inter,-apple-system,sans-serif;font-size:14px;font-weight:600;color:#1A2E6E}',
      '#dasPop .ok.lt{color:#fff}',
      /* p1 split */
      '#dasPop .sp{display:grid;grid-template-columns:1fr;max-height:92vh;overflow:auto;max-width:820px}',
      '@media(min-width:760px){#dasPop .sp{grid-template-columns:1fr 1fr}}',
      '#dasPop .sp .ph{position:relative;height:38vh;min-height:220px}',
      '@media(min-width:760px){#dasPop .sp .ph{height:auto;min-height:500px}}',
      '#dasPop .sp .ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
      '#dasPop .sp form{padding:22px 22px 26px}',
      '@media(min-width:760px){#dasPop .sp form{padding:40px;display:flex;flex-direction:column;justify-content:center}}',
      /* p2 full bleed */
      '#dasPop .fb{position:relative;max-width:960px;aspect-ratio:4/5;max-height:92vh}',
      '@media(min-width:760px){#dasPop .fb{aspect-ratio:16/9}}',
      '#dasPop .fb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
      '#dasPop .fb .scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,14,36,.3),rgba(6,14,36,0) 35%,rgba(6,14,36,.92) 100%)}',
      '@media(min-width:760px){#dasPop .fb .scrim{background:linear-gradient(90deg,rgba(6,14,36,.88) 0%,rgba(6,14,36,.4) 55%,rgba(6,14,36,0) 100%)}}',
      '#dasPop .fb form{position:absolute;inset-inline:0;bottom:0;padding:22px}',
      '@media(min-width:760px){#dasPop .fb form{inset:0 auto 0 0;max-width:440px;padding:44px;display:flex;flex-direction:column;justify-content:center}}',
      /* p3 portrait */
      '#dasPop .pt{display:flex;flex-direction:column;max-width:420px;max-height:92vh;overflow:auto}',
      '#dasPop .pt .ph{position:relative;height:44vh;min-height:240px}',
      '#dasPop .pt .ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
      '#dasPop .pt .ph .ov{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,14,36,.3),rgba(6,14,36,0) 40%,rgba(6,14,36,.82) 100%)}',
      '#dasPop .pt .ph .tx{position:absolute;left:20px;right:20px;bottom:16px}',
      '#dasPop .pt form{padding:20px 20px 24px}',
      /* p4 slim bar */
      '#dasBar{position:fixed;bottom:16px;right:16px;z-index:2147483000;width:calc(100vw - 32px);max-width:430px;',
      '  display:flex;align-items:stretch;overflow:hidden;border-radius:16px;background:#0C1840;color:#fff;',
      '  box-shadow:0 18px 50px rgba(6,14,36,.5)}',
      '#dasBar img{width:104px;object-fit:cover;flex:none}',
      '#dasBar form{flex:1;min-width:0;padding:14px 14px 14px 16px;display:flex;flex-direction:column;gap:8px;justify-content:center}',
      '#dasBar .ln{font:600 13px/1.35 Inter,-apple-system,sans-serif;color:#fff}',
      '#dasBar .row{display:flex;gap:6px}',
      '#dasBar input{flex:1;min-width:0;height:40px;padding:0 12px;font:500 16px Inter,sans-serif;color:#fff;',
      '  background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.3);border-radius:10px;outline:0}',
      '#dasBar button.go{height:40px;padding:0 14px;border:0;border-radius:10px;cursor:pointer;',
      '  font:600 12px Inter,sans-serif;color:#0C1840;background:#fff;white-space:nowrap}',
      '#dasBar .x{position:absolute;top:6px;right:6px;width:30px;height:30px;border:0;cursor:pointer;border-radius:999px;',
      '  background:rgba(255,255,255,.15);color:#fff;display:grid;place-items:center;font-size:13px}',
      '@media(prefers-reduced-motion:no-preference){#dasPop .card,#dasBar{animation:dasPopIn .32s cubic-bezier(.2,.8,.3,1)}}',
      '@keyframes dasPopIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function dismiss() {
    save(Object.assign(load(), { dismissedAt: Date.now() }));
    remove();
  }
  function remove() {
    var n = document.getElementById('dasPop') || document.getElementById('dasBar');
    if (n) n.remove();
  }

  function submit(form, doneMsg, light) {
    var email = form.querySelector('input[type=email]');
    if (!email || !email.value) return;
    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value })
    }).then(function (r) {
      if (!r.ok) throw 0;
      save(Object.assign(load(), { subscribed: true }));
      try { localStorage.setItem('das_promo_v1', 'WELCOME10'); } catch (e) {}
      form.innerHTML = '<p class="ok' + (light ? ' lt' : '') + '">' + doneMsg + '</p>';
      setTimeout(remove, 2200);
    }).catch(function () {
      form.querySelector('.cta, .go').textContent = 'Try again';
    });
  }

  var EYEBROW = 'Driver Appreciation Week &middot; Sept 13&ndash;19, 2026';

  function show(which) {
    styles();
    try { sessionStorage.setItem(KEY + ':shown', which); } catch (e) {}
    save(Object.assign(load(), which === 'p5' ? {} : { last: which }));

    if (which === 'p4') {
      var bar = document.createElement('div');
      bar.id = 'dasBar';
      bar.setAttribute('role', 'dialog');
      bar.innerHTML =
        '<img src="' + IMG.p4 + '" alt="">' +
        '<form novalidate><div class="ln">DAW is Sept 13&ndash;19. Order deadline: <b>Aug 7</b>.</div>' +
        '<div class="row"><input type="email" required placeholder="Email address" aria-label="Email address">' +
        '<button type="submit" class="go">Get reminders</button></div></form>' +
        '<button type="button" class="x" aria-label="Close">&#10005;</button>';
      document.body.appendChild(bar);
      bar.querySelector('.x').onclick = dismiss;
      bar.querySelector('form').onsubmit = function (e) { e.preventDefault(); submit(this, 'Code <b>WELCOME10</b> is yours &mdash; applied at checkout.', true); };
      return;
    }

    var pop = document.createElement('div');
    pop.id = 'dasPop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    var inner = '';

    if (which === 'p1') inner =
      '<div class="card sp"><button type="button" class="x" aria-label="Close">&#10005;</button>' +
      '<div class="ph"><img src="' + IMG.p1 + '" alt=""></div>' +
      '<form class="frm" novalidate><span class="eb">' + EYEBROW + '</span>' +
      '<h2>Never miss<br>DAW again</h2>' +
      '<p class="bd"><b>10% off your first kit order</b> with code WELCOME10, plus deadline reminders and fleet recognition insights.</p>' +
      '<input type="email" required placeholder="Work email" aria-label="Email address">' +
      '<button type="submit" class="cta">Get the reminders</button>' +
      '<button type="button" class="no">No thanks</button></form></div>';

    else if (which === 'p2') inner =
      '<div class="card fb" style="background:#0C1840"><button type="button" class="x lt" aria-label="Close">&#10005;</button>' +
      '<img src="' + IMG.p2 + '" alt=""><div class="scrim"></div>' +
      '<form class="frm" novalidate><span class="eb lt">' + EYEBROW + '</span>' +
      '<h2 class="lt">The fleets that win<br>recognize first</h2>' +
      '<p class="bd lt">Sign up for <b>10% off your first kit order</b> &mdash; plus monthly recognition insights and every seasonal deadline.</p>' +
      '<input type="email" required placeholder="Work email" aria-label="Email address">' +
      '<button type="submit" class="cta wh">Sign up</button></form></div>';

    else if (which === 'p3') inner =
      '<div class="card pt"><button type="button" class="x lt" aria-label="Close">&#10005;</button>' +
      '<div class="ph"><img src="' + IMG.p3 + '" alt=""><div class="ov"></div>' +
      '<div class="tx"><span class="eb lt">' + EYEBROW + '</span><h2 class="lt">Plan DAW<br>like a pro</h2></div></div>' +
      '<form class="frm" novalidate>' +
      '<p class="bd"><b>10% off your first kit order</b>, and the Aug&nbsp;7 deadline reminder before it costs you the window.</p>' +
      '<input type="text" placeholder="First name" aria-label="First name">' +
      '<input type="email" required placeholder="Work email" aria-label="Email address">' +
      '<button type="submit" class="cta">Get the reminders</button>' +
      '<button type="button" class="no">No thanks</button></form></div>';

    else inner = /* p5 exit intent — cart has items */
      '<div class="card sp" style="background:#0C1840;color:#fff"><button type="button" class="x lt" aria-label="Close">&#10005;</button>' +
      '<div class="ph"><img src="' + IMG.p5 + '" alt=""></div>' +
      '<form class="frm" novalidate><span class="eb lt">' + cartCount() + ' kit line' + (cartCount() === 1 ? '' : 's') + ' saved</span>' +
      '<h2 class="lt">Your kits are<br>still in the cart</h2>' +
      '<p class="bd lt">Checkout takes two minutes &mdash; or take the deadline reminder and come back before Aug&nbsp;7.</p>' +
      '<a class="cta wh" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="cart.html">Review my cart</a>' +
      '<input type="email" placeholder="Or email me the reminder" aria-label="Email address">' +
      '<button type="submit" class="cta" style="background:rgba(255,255,255,.15);box-shadow:none">Remind me</button>' +
      '<button type="button" class="no lt">Keep shopping</button></form></div>';

    pop.innerHTML = '<div class="bk"></div>' + inner;
    document.body.appendChild(pop);
    pop.querySelector('.bk').onclick = dismiss;
    pop.querySelector('.x').onclick = dismiss;
    var no = pop.querySelector('.no'); if (no) no.onclick = dismiss;
    var f = pop.querySelector('form');
    var light = which !== 'p1' && which !== 'p3';
    f.onsubmit = function (e) { e.preventDefault(); submit(this, "You're in &mdash; code <b>WELCOME10</b> is applied to your cart and in your inbox.", light); };
  }

  function tryFire() {
    if (fired) return;
    if (timeOk && (scrollOk || next === 'p4')) { fired = true; show(next); }
  }

  setTimeout(function () { timeOk = true; tryFire(); }, 8000);
  window.addEventListener('scroll', function () {
    var max = document.documentElement.scrollHeight - innerHeight;
    if (max > 0 && scrollY / max >= 0.4) { scrollOk = true; tryFire(); }
  }, { passive: true });
  document.addEventListener('mouseout', function (e) {
    if (fired) return;
    if (e.relatedTarget) return;   // still inside the page
    if (e.clientY > 8) return;     // exit-intent = leaving through the top edge
    if (cartCount() === 0) return; // only worth interrupting when kits are saved
    fired = true; show('p5');
  });
})();
