/* ============================================================================
   THE DAS CHAT WIDGET
   Structure and view model from 09_reference/chatbot-architecture/ (the GRIFFAIN
   widget, captured off griffain.io). Colours mapped to DAS navy.

   IMPORTANT — this replaces the SHELL, not the brain. The existing Scout in
   js/chat.js already talks to a working backend, and that contract is preserved
   exactly:

       POST /api/chat          streaming assistant replies
       POST /api/submit-quote  quote submission
       localStorage das_scout_messages   message persistence

   So swapping this in is a skin + navigation change, not an AI rebuild. Every
   network call below hits the same endpoints with the same payload shape.

   Set window.DAS_WIDGET_MOCK = true to run the lab preview without a backend.
   ============================================================================ */
(function () {
  'use strict';

  var API_URL     = '/api/chat';
  var SUBMIT_URL  = '/api/submit-quote';
  var STORE_KEY   = 'das_scout_messages';
  var PREVIEW_MS  = 9000;

  var WELCOME = "Hey — I'm Scout. I can size a recognition program for your fleet, " +
                "check lead times, or put a quote together. How many drivers are you recognising?";
  var QUICK = ['Size a program for my fleet', 'What are your lead times?', 'I need a quote'];

  var messages = [];       // { role:'user'|'assistant', content:string }
  var streaming = false;
  var view = 'home';
  var panel, launcher, msgsEl, inputEl, sendEl, quickEl, previewEl;

  /* ── icons ──────────────────────────────────────────────────────────────── */
  var I = {
    chat:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 01-9 8.4 9.1 9.1 0 01-3.3-.6L3 21l1.9-5.2A8.2 8.2 0 014 11.5 8.4 8.4 0 0112.5 3 8.4 8.4 0 0121 11.5z"/></svg>',
    down:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    home:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/></svg>',
    msgs:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4H4a1.5 1.5 0 00-1.5 1.5v10A1.5 1.5 0 004 17h3v4l4.5-4H20a1.5 1.5 0 001.5-1.5v-10A1.5 1.5 0 0020 4z"/></svg>',
    help:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 015 .9c0 1.8-2.5 2.2-2.5 3.9"/><circle cx="12" cy="17.4" r="1"/></svg>',
    back:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M15 5l-7 7 7 7"/></svg>',
    chev:  '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15"><path d="M9 5l7 7-7 7"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-3.6-3.6"/></svg>',
    send:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12L3.3 3.1A59.8 59.8 0 0121.5 12 59.8 59.8 0 013.3 20.9L6 12zm0 0h7.5"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.6c0-.6.5-1.1 1.1-1.1h8.9c.6 0 1.1.5 1.1 1.1V16H2.5z"/><path d="M13.6 9.2h3.2c.5 0 1 .3 1.3.7l2.2 3.3c.2.3.2.6.2.9V16h-6.9z"/><circle cx="7" cy="18.4" r="1.7"/><circle cx="17.2" cy="18.4" r="1.7"/></svg>'
  };

  function ill(name) {
    return '<svg class="das-ill das-ill-' + name + '" aria-hidden="true">' +
           '<use href="' + (window.DAS_SPRITE || '/images/das-illustrations.svg?v=2') + '#das-' + name + '"></use></svg>';
  }

  /* ── persistence — same key the old widget used, so history survives ────── */
  function load() {
    try { messages = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
    catch (e) { messages = []; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-40))); } catch (e) {}
  }

  /* ── markup ─────────────────────────────────────────────────────────────── */
  function build() {
    launcher = document.createElement('button');
    launcher.id = 'dwLaunch';
    launcher.setAttribute('aria-label', 'Chat with Scout');
    launcher.innerHTML = I.chat + '<span class="dw-dot"></span>';
    launcher.addEventListener('click', toggle);

    panel = document.createElement('div');
    panel.id = 'dwPanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat with Scout');
    panel.innerHTML = [
      /* HOME */
      '<div class="dw-view on" id="dwHome">',
      '  <div class="dw-home-head">',
      '    <div class="dw-brand"><span>Driver Appreciation Solutions</span></div>',
      '    <div class="dw-headright">',
      '      <div class="dw-avatars"><span class="av">S</span><span class="av">J</span></div>',
      '      <button class="dw-close" data-close aria-label="Close">&times;</button>',
      '    </div>',
      '  </div>',
      '  <div class="dw-greet">Hi there.<b>How can we help your fleet?</b></div>',
      '  <div class="dw-cards">',
      '    <button class="dw-card" data-go="thread">' + ill('headset') +
      '      <span class="dw-card-main"><span class="dw-card-title">Ask Scout</span>' +
      '      <span class="dw-card-sub">Program sizing, lead times, quotes</span></span>' + I.chev + '</button>',
      '    <button class="dw-card" data-ask="I need a quote for my fleet">' + ill('clipboard') +
      '      <span class="dw-card-main"><span class="dw-card-title">Request a quote</span>' +
      '      <span class="dw-card-sub">Back inside 24 hours</span></span>' + I.chev + '</button>',
      '  </div>',
      '  <div class="dw-search">',
      '    <div class="dw-search-row">' + I.search +
      '      <input id="dwSearch" placeholder="Search for help" aria-label="Search help"></div>',
      '    <button class="dw-article" data-help>What is the minimum order?' + I.chev + '</button>',
      '    <button class="dw-article" data-help>How long does engraving take?' + I.chev + '</button>',
      '    <button class="dw-article" data-help>Do you offer Net-30 terms?' + I.chev + '</button>',
      '  </div>',
      '</div>',
      /* MESSAGES */
      '<div class="dw-view" id="dwList">',
      '  <div class="dw-list-head"><span class="dw-list-title">Messages</span>',
      '    <button class="dw-close" data-close aria-label="Close">&times;</button></div>',
      '  <div class="dw-list-body" id="dwConvos"></div>',
      '</div>',
      /* THREAD */
      '<div class="dw-view" id="dwThread">',
      '  <div class="dw-thread-head">',
      '    <button class="dw-back" data-go="home" aria-label="Back">' + I.back + '</button>',
      '    <span class="dw-thread-av">' + I.truck + '</span>',
      '    <div><div class="dw-thread-title">Scout</div>',
      '      <div class="dw-thread-sub">Usually replies instantly</div></div>',
      '    <button class="dw-close" data-close aria-label="Close">&times;</button>',
      '  </div>',
      '  <div class="dw-msgs" id="dwMsgs"></div>',
      '  <div class="dw-quick" id="dwQuick"></div>',
      '  <div class="dw-composer">',
      '    <textarea id="dwText" rows="1" placeholder="Ask Scout anything…" aria-label="Message"></textarea>',
      '    <div class="dw-comp-row"><span class="hint">Enter to send</span>',
      '      <button class="dw-send" id="dwSend" aria-label="Send">' + I.send + '</button></div>',
      '  </div>',
      '  <p class="dw-consent">Scout is an AI assistant. Quotes are confirmed by a human before anything ships.</p>',
      '</div>',
      /* HELP */
      '<div class="dw-view" id="dwHelp">',
      '  <div class="dw-list-head">',
      '    <button class="dw-back" data-go="home" aria-label="Back">' + I.back + '</button>',
      '    <span class="dw-list-title">Help</span>',
      '    <button class="dw-close" data-close aria-label="Close">&times;</button></div>',
      '  <div class="dw-help-body">',
      helpRow('kit', 'Ordering', 'Minimums, lead times, bulk pricing'),
      helpRow('medal', 'Engraving', '48-hour turnaround, what we can personalise'),
      helpRow('semi', 'Delivery', 'Terminal drops and multi-location fleets'),
      helpRow('clipboard', 'Billing', 'Net-30, POs and vendor setup'),
      '  </div>',
      '</div>',
      /* TABS */
      '<div class="dw-tabs">',
      '  <button class="dw-tab on" data-go="home">' + I.home + 'Home</button>',
      '  <button class="dw-tab" data-go="list">' + I.msgs + 'Messages' +
      '    <span class="dw-tab-badge" id="dwBadge">1</span></button>',
      '  <button class="dw-tab" data-go="help">' + I.help + 'Help</button>',
      '</div>'
    ].join('\n');

    previewEl = document.createElement('div');
    previewEl.id = 'dwPreview';
    previewEl.innerHTML =
      '<button class="dw-preview-x" aria-label="Dismiss">&times;</button>' +
      '<div class="dw-preview-row"><span class="dw-preview-av">S</span>' +
      '<span><span class="dw-preview-who">Scout</span>' +
      '<span class="dw-preview-txt">Recognising drivers this quarter? I can size a program in about a minute.</span></span></div>';

    document.body.appendChild(panel);
    /* the dock owns the bottom-right corner (see js/das-dock.js) — the
       launcher AND the preview bubble join it as flex children so nothing in
       the corner can overlap anything else; the panel stays a fixed overlay */
    if (window.DASDock) {
      window.DASDock.mount(previewEl, 5);
      window.DASDock.mount(launcher, 90);
    } else {
      document.body.appendChild(previewEl);
      document.body.appendChild(launcher);
    }

    msgsEl  = panel.querySelector('#dwMsgs');
    inputEl = panel.querySelector('#dwText');
    sendEl  = panel.querySelector('#dwSend');
    quickEl = panel.querySelector('#dwQuick');
  }

  function helpRow(icon, name, desc) {
    return '<button class="dw-hrow"><span class="dw-hchip">' + ill(icon) + '</span>' +
           '<span class="dw-hmain"><span class="dw-hname">' + name + '</span>' +
           '<span class="dw-hdesc">' + desc + '</span></span>' +
           '<span class="dw-hchev">' + I.chev + '</span></button>';
  }

  /* ── navigation ─────────────────────────────────────────────────────────── */
  function go(v) {
    view = v;
    var map = { home: 'dwHome', list: 'dwList', thread: 'dwThread', help: 'dwHelp' };
    Object.keys(map).forEach(function (k) {
      panel.querySelector('#' + map[k]).classList.toggle('on', k === v);
    });
    panel.querySelectorAll('.dw-tab').forEach(function (t) {
      t.classList.toggle('on', t.dataset.go === v);
    });
    if (v === 'thread') { renderMsgs(); setTimeout(function () { inputEl.focus(); }, 120); }
    if (v === 'list') renderConvos();
  }

  function toggle(force) {
    var open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    if (window.DASDock) window.DASDock.setPanelOpen(open);
    launcher.setAttribute('aria-expanded', String(open));
    launcher.innerHTML = I.chat + '<span class="dw-dot"></span>';
    if (open) {
      launcher.classList.remove('has-unread');
      hidePreview();
      if (!messages.length) { messages.push({ role: 'assistant', content: WELCOME }); save(); }
    }
  }

  /* ── rendering ──────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderMsgs() {
    msgsEl.innerHTML = '<div class="dw-sysnote">Scout is an AI assistant for fleet recognition programs.</div>';
    messages.forEach(function (m) {
      var d = document.createElement('div');
      d.className = 'dw-msg ' + (m.role === 'user' ? 'me' : 'bot');
      d.innerHTML = esc(m.content).split(/\n{2,}/).map(function (p) {
        return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
      }).join('');
      msgsEl.appendChild(d);
    });
    quickEl.innerHTML = messages.length <= 1
      ? QUICK.map(function (q) { return '<button>' + esc(q) + '</button>'; }).join('')
      : '';
    quickEl.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { send(b.textContent); };
    });
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function renderConvos() {
    var box = panel.querySelector('#dwConvos');
    if (!messages.length) {
      box.innerHTML = '<div class="dw-empty">No messages yet.<br>Start one and it will live here.</div>' +
                      '<button class="dw-newmsg" data-go="thread">Ask a question</button>';
    } else {
      var last = messages[messages.length - 1];
      box.innerHTML =
        '<button class="dw-convo" data-go="thread"><span class="dw-convo-av">S</span>' +
        '<span class="dw-convo-main"><span class="dw-convo-name">Scout</span>' +
        '<span class="dw-convo-prev">' + esc(last.content).slice(0, 70) + '</span></span>' +
        '<span class="dw-convo-time">now</span></button>' +
        '<button class="dw-newmsg" data-go="thread">New message</button>';
    }
    wireGo(box);
  }

  function wireGo(root) {
    root.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () { go(b.dataset.go); };
    });
  }

  /* ── sending — SAME contract as js/chat.js ──────────────────────────────── */
  function send(text) {
    text = (text || inputEl.value || '').trim();
    if (!text || streaming) return;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    messages.push({ role: 'user', content: text });
    save(); go('thread'); renderMsgs();

    streaming = true; sendEl.disabled = true;
    var bubble = document.createElement('div');
    bubble.className = 'dw-msg bot';
    bubble.innerHTML = '<span class="dw-typing"><i></i><i></i><i></i></span>';
    msgsEl.appendChild(bubble);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    if (window.DAS_WIDGET_MOCK) {
      setTimeout(function () {
        finish(bubble, "Happy to help. For a fleet that size I'd usually start with the " +
          "Driver Appreciation Kits and add milestone awards for anyone crossing a mile marker " +
          "this year. Roughly how many drivers are we recognising?");
      }, 900);
      return;
    }

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (t) {
      finish(bubble, t);
    }).catch(function () {
      finish(bubble, "I couldn't reach the server just then. You can reach the team directly at " +
        "info@driverappreciationsolutions.com and we'll pick it up from there.");
    });
  }

  // The backend ends every reply with <suggested_replies>[...]</suggested_replies>
  // (and sometimes <quote_data>). Machine tags never reach the bubble; the
  // suggestions become tappable chips in the quick row.
  function parseTags(text) {
    var replies = [];
    var m = text.match(/<suggested_replies>([\s\S]*?)<\/suggested_replies>/);
    if (m) { try { replies = JSON.parse(m[1].trim()).filter(function (x) { return typeof x === 'string'; }).slice(0, 3); } catch (e) {} }
    var clean = text
      .replace(/<suggested_replies>[\s\S]*?(<\/suggested_replies>|$)/g, '')
      .replace(/<quote_data>[\s\S]*?(<\/quote_data>|$)/g, '')
      .trim();
    return { clean: clean, replies: replies };
  }

  function finish(bubble, content) {
    var parsed = parseTags(content);
    bubble.textContent = '';
    parsed.clean.split(/\n{2,}/).forEach(function (p) {
      var el = document.createElement('p'); el.textContent = p; bubble.appendChild(el);
    });
    messages.push({ role: 'assistant', content: parsed.clean });
    save();
    streaming = false; sendEl.disabled = false;
    msgsEl.scrollTop = msgsEl.scrollHeight;
    quickEl.innerHTML = parsed.replies.map(function (q) {
      return '<button>' + esc(q) + '</button>';
    }).join('');
    quickEl.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { quickEl.innerHTML = ''; send(b.textContent); };
    });
  }

  /* ── proactive preview ──────────────────────────────────────────────────── */
  var previewTimer = null;
  function showPreview() {
    if (panel.classList.contains('open')) return;
    previewEl.classList.add('open');
    requestAnimationFrame(function () { previewEl.classList.add('in'); });
    launcher.classList.add('has-unread');
    panel.querySelector('#dwBadge').classList.add('on');
    /* self-dismissing: nobody should have to press the X (Jayden, 2026-08-27) */
    clearTimeout(previewTimer);
    previewTimer = setTimeout(hidePreview, 6000);
  }
  function hidePreview() {
    previewEl.classList.remove('in');
    setTimeout(function () { previewEl.classList.remove('open'); }, 240);
  }

  /* ── boot ───────────────────────────────────────────────────────────────── */
  function init() {
    load();
    build();
    wireGo(panel);
    panel.querySelectorAll('[data-close]').forEach(function (b) {
      b.onclick = function () { toggle(false); };
    });
    panel.querySelectorAll('[data-ask]').forEach(function (b) {
      b.onclick = function () { send(b.dataset.ask); };
    });
    panel.querySelectorAll('[data-help]').forEach(function (b) {
      b.onclick = function () { send(b.textContent.trim()); };
    });
    sendEl.onclick = function () { send(); };
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
    inputEl.addEventListener('input', function () {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + 'px';
    });
    previewEl.onclick = function (e) {
      if (e.target.classList.contains('dw-preview-x')) { hidePreview(); return; }
      toggle(true); go('thread');
    };
    setTimeout(showPreview, PREVIEW_MS);
    window.DASWidget = { open: function () { toggle(true); }, go: go, send: send };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
