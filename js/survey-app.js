/* ============================================================================
   DAS SURVEY — THE CLICK FUNNEL ENGINE
   ----------------------------------------------------------------------------
   One question per screen. Tap an answer, it advances itself. Definitions come
   from js/survey-defs.js; the server reads the SAME file to label the email, so
   the client posts answers only — never question text.

   WHY A FUNNEL AND NOT A FORM
   27 questions on a scrolling page is a wall. One question on a coloured screen
   with four tiles is a rhythm — you answer without deciding to. That is the whole
   difference between a survey a driver abandons at question 9 and one he finishes
   at a truck stop.

   WHAT CANNOT BE A CLICK
   3 of the driver survey's 27 questions and ~30 of the assessment's 74 are open
   written answers. Those keep the same full-bleed stage and the same rhythm, but
   they are typed — a text answer cannot be turned into a tile without throwing
   away the answer. They are the questions Shaq actually quotes back in a meeting.

   SCREENS
     role → [code → pick] → identity → (section → question…)× → review → done
   ========================================================================== */
(function () {
  'use strict';

  var DEFS = window.DAS_SURVEYS;
  if (!DEFS) return;

  var STORE_PREFIX = 'das_survey_v2_';
  var STORE_TTL_MS = 30 * 24 * 3600 * 1000;
  var ADVANCE_MS = 340;              // long enough to SEE the answer land
  var KEYS = 'ABCDEF';

  var state = {
    screen: 'role',
    role: null,
    code: '',
    pending: null,
    instrument: null,
    identity: {},
    answers: {},
    qIndex: 0,
    flat: [],
    resumed: false
  };

  var stage, foot, railFill, chipEl, sectionEl, root;
  var advanceTimer = null;

  /* ── helpers ──────────────────────────────────────────────────────────── */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function btn(cls, label) {
    var b = el('button', cls, label);
    b.type = 'button';
    return b;
  }
  function checkMark() {
    var w = el('span', 'svq-tile-check');
    w.innerHTML = '<svg viewBox="0 0 16 16" fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3.2L13 5"/></svg>';
    return w;
  }

  /* ── draft persistence ────────────────────────────────────────────────── */
  function saveDraft() {
    if (!state.instrument) return;
    try {
      localStorage.setItem(STORE_PREFIX + state.instrument, JSON.stringify({
        ts: Date.now(), identity: state.identity, answers: state.answers, qIndex: state.qIndex
      }));
    } catch (e) { /* private mode — the funnel still works, it just won't resume */ }
  }
  function readDraft(key) {
    try {
      var d = JSON.parse(localStorage.getItem(STORE_PREFIX + key) || 'null');
      return d && d.ts && Date.now() - d.ts <= STORE_TTL_MS ? d : null;
    } catch (e) { return null; }
  }
  function clearDraft() {
    try { localStorage.removeItem(STORE_PREFIX + state.instrument); } catch (e) {}
  }

  /* ── answers ──────────────────────────────────────────────────────────── */
  function isAnswered(v) {
    if (v == null || v === '') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') {
      return Object.keys(v).some(function (r) {
        return Object.keys(v[r] || {}).some(function (c) {
          return v[r][c] != null && String(v[r][c]).trim() !== '';
        });
      });
    }
    return true;
  }
  function answeredCount() {
    return state.flat.filter(function (q) { return isAnswered(state.answers[q.id]); }).length;
  }
  function setAnswer(id, value) {
    if (value == null || value === '') delete state.answers[id];
    else state.answers[id] = value;
    saveDraft();
  }

  /* ── chrome ───────────────────────────────────────────────────────────── */
  function setAccent(n) { root.setAttribute('data-accent', String(n)); }

  function paintTop() {
    var inFunnel = ['section', 'question', 'review', 'done'].indexOf(state.screen) > -1;
    document.getElementById('svq-top').style.visibility = inFunnel ? 'visible' : 'hidden';
    if (!inFunnel) return;

    var total = state.flat.length;
    var pos = state.screen === 'question' ? state.qIndex + 1
      : state.screen === 'section' ? state.qIndex
        : total;
    railFill.style.width = (total ? Math.round((pos / total) * 100) : 0) + '%';
    chipEl.textContent = state.screen === 'question'
      ? 'Q' + (state.qIndex + 1) + ' / ' + total
      : answeredCount() + ' / ' + total + ' answered';
    var q = state.flat[Math.min(state.qIndex, total - 1)];
    sectionEl.textContent = q ? q.section : '';
  }

  function paint(bodyNode, footNodes, ghost) {
    clearNode(stage); clearNode(foot);
    // The ghosted word is gone — the illustration field is the ground now (see
    // .svq-field in survey.css). What paint() still tracks is whether we are on an
    // opening screen, where the DAS lockup runs large, versus inside the funnel,
    // where it shrinks so the screen belongs to the question.
    document.body.classList.toggle('svq-intro',
      ['role', 'code', 'pick', 'identity'].indexOf(state.screen) > -1);
    var screen = el('div', 'svq-screen');
    screen.appendChild(bodyNode);
    stage.appendChild(screen);
    (footNodes || []).forEach(function (n) { foot.appendChild(n); });
    document.body.classList.toggle('svq-run', true);
    paintTop();
    window.scrollTo(0, 0);
  }

  /* ══ SCREEN · ROLE ═══════════════════════════════════════════════════════ */
  function screenRole() {
    state.screen = 'role';
    setAccent(0);
    var b = document.createDocumentFragment();
    b.appendChild(el('p', 'svq-eyebrow', 'Driver Recognition Intake'));
    var h = el('h1', 'svq-h svq-h1', 'Who is filling this out?');
    b.appendChild(h);
    b.appendChild(el('p', 'svq-lede', 'The questions are different depending on where you sit. Pick one and it starts.'));

    var picks = el('div', 'svq-picks');
    picks.appendChild(pickCard('das-driver', 'I Drive For A Fleet',
      '27 questions about your experience, how you are recognised, and what would actually mean something to you. Tap to answer — about four minutes.',
      'Open to all drivers', function () { startInstrument('driver'); }));
    picks.appendChild(pickCard('das-clipboard', "I'm With The Organization",
      'Leadership, safety, HR, operations or recruiting. The recognition assessment and the 2027 commitment planning guide.',
      'Access code required', function () { screenCode(); }));
    b.appendChild(picks);
    paint(b, [], 'VOICE');
  }

  function pickCard(ill, title, desc, tag, onClick) {
    var b = btn('svq-pick', null);
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'das-ill das-ill-' + ill.replace('das-', ''));
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + ill);  // local fragment — see js/das-sprite.js
    svg.appendChild(use);
    b.appendChild(svg);
    b.appendChild(el('h2', 'svq-pick-title', title));
    b.appendChild(el('p', 'svq-pick-desc', desc));
    b.appendChild(el('span', 'svq-pick-tag', tag));
    b.addEventListener('click', onClick);
    return b;
  }

  /* ══ SCREEN · ACCESS CODE ════════════════════════════════════════════════ */
  function screenCode(err) {
    state.screen = 'code';
    setAccent(0);
    var b = document.createDocumentFragment();
    b.appendChild(el('p', 'svq-eyebrow', 'Organization'));
    b.appendChild(el('h1', 'svq-h svq-h2', 'Enter your access code'));
    b.appendChild(el('p', 'svq-lede', 'Your DAS representative gives you this in the meeting. It keeps the organization questionnaires with the teams they were built for.'));

    var alert = el('div', 'svq-alert svq-alert--err' + (err ? ' is-on' : ''), err || '');
    alert.style.marginTop = '22px';
    b.appendChild(alert);

    var wrap = el('div');
    wrap.style.cssText = 'margin-top:18px;max-width:420px';
    var input = el('input', 'svq-field');
    input.type = 'text'; input.id = 'svq-code'; input.autocapitalize = 'characters';
    input.spellcheck = false; input.autocomplete = 'off';
    input.placeholder = 'Access code';
    input.value = state.code || '';
    wrap.appendChild(input);
    b.appendChild(wrap);

    var go = btn('svq-btn svq-btn-primary', 'Continue');
    go.addEventListener('click', function () {
      var v = input.value.trim();
      if (!v) { input.classList.add('is-invalid'); input.focus(); return; }
      state.code = v;
      if (state.pending) { var p = state.pending; state.pending = null; startInstrument(p); }
      else screenPick();
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });

    var back = btn('svq-skip', 'Back');
    back.addEventListener('click', screenRole);
    paint(b, [back, el('span', 'svq-spacer'), go], 'ACCESS');
    setTimeout(function () { input.focus(); }, 60);
  }

  /* ══ SCREEN · INSTRUMENT PICKER ══════════════════════════════════════════ */
  function screenPick() {
    state.screen = 'pick';
    setAccent(0);
    var b = document.createDocumentFragment();
    b.appendChild(el('p', 'svq-eyebrow', 'Organization'));
    b.appendChild(el('h1', 'svq-h svq-h2', 'Which one are you completing?'));
    b.appendChild(el('p', 'svq-lede', 'Both feed the same recommendation. Most teams start with the assessment.'));
    var picks = el('div', 'svq-picks');
    picks.appendChild(pickCard('das-clipboard', 'Recognition Assessment',
      '74 questions across eight sections: fleet profile, culture, onboarding and milestones, safety and behaviour, driver voice, administration, budget and readiness.',
      'Saves as you go', function () { startInstrument('assessment'); }));
    picks.appendChild(pickCard('das-calendar', '2027 Commitment Guide',
      'The leadership decision aid. Mark each initiative Commit, Explore or Defer, name the owner and date per workstream, and size the retroactive milestone population.',
      'Decision worksheet', function () { startInstrument('commitment'); }));
    b.appendChild(picks);
    var back = btn('svq-skip', 'Back');
    back.addEventListener('click', function () { screenCode(); });
    paint(b, [back], 'CHOOSE');
  }

  /* ══ SCREEN · IDENTITY ═══════════════════════════════════════════════════ */
  function identityFields() {
    // Organization routes the response, so it is required everywhere. A driver's
    // NAME is optional on purpose: a driver who signs "how valued do you feel"
    // softens the answer, and we lose nothing operationally.
    if (state.role === 'driver') {
      return [
        { id: 'organization', label: 'Your company / fleet', required: true, full: true, ph: 'e.g. Midwest Carriers' },
        { id: 'name', label: 'Your name', opt: 'optional' },
        { id: 'terminal', label: 'Terminal or location', opt: 'optional' }
      ];
    }
    return [
      { id: 'organization', label: 'Organization', required: true, full: true },
      { id: 'name', label: 'Your name', required: true },
      { id: 'title', label: 'Title / department', opt: 'optional' },
      { id: 'email', label: 'Work email', required: true, type: 'email' },
      { id: 'phone', label: 'Phone', opt: 'optional', type: 'tel' }
    ];
  }

  function screenIdentity() {
    state.screen = 'identity';
    setAccent(0);
    var inst = DEFS.get(state.instrument);
    var b = document.createDocumentFragment();
    b.appendChild(el('p', 'svq-eyebrow', inst.eyebrow));
    b.appendChild(el('h1', 'svq-h svq-h2', inst.name));
    b.appendChild(el('p', 'svq-lede', inst.blurb));

    if (state.resumed) {
      var info = el('div', 'svq-alert svq-alert--info is-on',
        'We found a saved draft on this device — ' + answeredCount() + ' answers. You will pick up where you left off.');
      info.style.marginTop = '20px';
      b.appendChild(info);
    }

    var alert = el('div', 'svq-alert svq-alert--err');
    alert.style.marginTop = '20px';
    b.appendChild(alert);

    var grid = el('div', 'svq-fields');
    grid.style.marginTop = '22px';
    identityFields().forEach(function (f) {
      var cell = el('div', f.full ? 'svq-full' : null);
      var lab = el('label', 'svq-label');
      lab.setAttribute('for', 'svq-id-' + f.id);
      lab.appendChild(document.createTextNode(f.label));
      if (f.opt) lab.appendChild(el('small', null, '  ' + f.opt));
      cell.appendChild(lab);
      var input = el('input', 'svq-field');
      input.type = f.type || 'text';
      input.id = 'svq-id-' + f.id;
      input.value = state.identity[f.id] || '';
      if (f.ph) input.placeholder = f.ph;
      /* iOS keyboard behaviour. Without these the email field gets a capital first
         letter and a red autocorrect underline, and the phone field gets the full
         QWERTY keyboard instead of the number pad — three small things that
         together make a web form feel unmistakably like a web form. */
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('spellcheck', 'false');
      if (f.type === 'email') { input.setAttribute('autocapitalize', 'off'); input.setAttribute('inputmode', 'email'); input.autocomplete = 'email'; }
      else if (f.type === 'tel') { input.setAttribute('inputmode', 'tel'); input.autocomplete = 'tel'; }
      else { input.setAttribute('autocapitalize', 'words'); }
      if (f.id === 'organization') input.autocomplete = 'organization';
      if (f.id === 'name') input.autocomplete = 'name';
      input.addEventListener('input', function () {
        state.identity[f.id] = input.value.trim();
        input.classList.remove('is-invalid');
        saveDraft();
      });
      cell.appendChild(input);
      grid.appendChild(cell);
    });
    b.appendChild(grid);

    b.appendChild(el('p', 'svq-lede', state.role === 'driver'
      ? 'We only need your company so your answers reach the right place. Your name is optional — answer honestly.'
      : 'So we know which organization this belongs to, and who to send the summary back to.'));

    var go = btn('svq-btn svq-btn-primary', state.resumed ? 'Continue where I left off' : "Let's go");
    go.addEventListener('click', function () {
      var ok = true;
      identityFields().forEach(function (f) {
        var input = document.getElementById('svq-id-' + f.id);
        var v = input.value.trim();
        var bad = (f.required && !v) || (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
        input.classList.toggle('is-invalid', bad);
        if (bad && ok) input.focus();
        if (bad) ok = false;
      });
      if (!ok) {
        alert.textContent = 'Please fill in the highlighted fields.';
        alert.classList.add('is-on');
        return;
      }
      saveDraft();
      if (state.resumed && state.qIndex > 0) screenQuestion();
      else screenSection(0);
    });

    var back = btn('svq-skip', 'Back');
    back.addEventListener('click', function () { DEFS.get(state.instrument).gated ? screenPick() : screenRole(); });
    paint(b, [back, el('span', 'svq-spacer'), go], 'START');
  }

  /* ══ SCREEN · SECTION INTERSTITIAL ═══════════════════════════════════════ */
  function screenSection(sectionIdx) {
    state.screen = 'section';
    var inst = DEFS.get(state.instrument);
    var sec = inst.sections[sectionIdx];
    setAccent((sectionIdx % 8) + 1);
    // park qIndex at this section's first question
    state.qIndex = state.flat.findIndex(function (q) { return q.sectionIdx === sectionIdx; });
    saveDraft();

    var count = inst.sections[sectionIdx].questions.length;
    var b = document.createDocumentFragment();
    var wrap = el('div', 'svq-sect');
    wrap.appendChild(el('div', 'svq-sect-num', String(sectionIdx + 1).padStart(2, '0')));
    wrap.appendChild(el('p', 'svq-eyebrow', 'Section ' + (sectionIdx + 1) + ' of ' + inst.sections.length));
    wrap.appendChild(el('h1', 'svq-h svq-h1', sec.title));
    wrap.appendChild(el('p', 'svq-lede', sec.lede || (count + ' question' + (count === 1 ? '' : 's'))));
    b.appendChild(wrap);

    var go = btn('svq-btn svq-btn-primary', 'Start section');
    go.addEventListener('click', screenQuestion);
    var back = btn('svq-skip', sectionIdx === 0 ? 'Back' : 'Previous section');
    back.addEventListener('click', function () {
      if (sectionIdx === 0) screenIdentity();
      else { state.qIndex = state.flat.findIndex(function (q) { return q.sectionIdx === sectionIdx; }) - 1; screenQuestion(); }
    });
    paint(b, [back, el('span', 'svq-spacer'), go], String(sectionIdx + 1).padStart(2, '0'));
  }

  /* ══ SCREEN · QUESTION ═══════════════════════════════════════════════════ */
  function screenQuestion() {
    state.screen = 'question';
    var q = state.flat[state.qIndex];
    if (!q) return screenReview();
    setAccent((q.sectionIdx % 8) + 1);
    saveDraft();

    var b = document.createDocumentFragment();
    b.appendChild(el('p', 'svq-eyebrow', q.section));
    b.appendChild(el('p', 'svq-qtext', (q.n != null ? q.n + '. ' : '') + q.label));
    if (q.help) b.appendChild(el('div', 'svq-help', q.help));

    var needsContinue = true;
    if (q.type === 'scale') { renderScale(q, b); needsContinue = false; }
    else if (q.type === 'choice') { renderChoice(q, b); needsContinue = false; }
    else if (q.type === 'multi') renderMulti(q, b);
    else if (q.type === 'matrix') renderMatrix(q, b);
    else renderTyped(q, b);

    var back = btn('svq-skip', 'Back');
    back.addEventListener('click', prev);
    var next = btn('svq-btn svq-btn-primary', needsContinue ? 'Continue' : 'Skip');
    if (!needsContinue) next.className = 'svq-btn svq-btn-ghost';
    next.addEventListener('click', advance);

    paint(b, [back, el('span', 'svq-spacer'), next], 'Q' + (state.qIndex + 1));
  }

  /* Single-select tiles — the Kahoot layer. Tap, it lands, it moves on. */
  function renderChoice(q, host) {
    // Anything that reads as a scale (agree↔disagree, never↔very often) gets the
    // diverging ramp; that direction is real information, not decoration.
    if (q.scaleLike) return renderLikert(q, host);
    var wrap = el('div', 'svq-tiles');
    wrap.setAttribute('data-count', String(q.options.length));
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', q.label);
    q.options.forEach(function (opt, i) {
      wrap.appendChild(tile(q, opt, i, wrap));
    });
    host.appendChild(wrap);
    if (isAnswered(state.answers[q.id])) wrap.classList.add('is-committed');
  }

  function renderLikert(q, host) {
    var wrap = el('div', 'svq-likert');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', q.label);
    q.options.forEach(function (opt, i) {
      var t = tile(q, opt, i, wrap);
      t.setAttribute('data-pos', String(i));
      wrap.appendChild(t);
    });
    host.appendChild(wrap);
    if (isAnswered(state.answers[q.id])) wrap.classList.add('is-committed');
  }

  function tile(q, opt, i, wrap) {
    var t = btn('svq-tile', null);
    t.style.setProperty('--tile', 'var(--t' + ((i % 6) + 1) + ')');
    t.style.setProperty('--tiled', 'var(--t' + ((i % 6) + 1) + 'd)');
    t.style.setProperty('--d', (i * 55) + 'ms');
    t.dataset.v = opt;
    if (q.decision) t.dataset.decision = opt;
    t.setAttribute('aria-pressed', state.answers[q.id] === opt ? 'true' : 'false');
    t.appendChild(el('span', 'svq-tile-key', KEYS[i] || String(i + 1)));
    t.appendChild(el('span', 'svq-tile-label', opt));
    t.appendChild(checkMark());
    t.addEventListener('click', function () {
      var already = t.getAttribute('aria-pressed') === 'true';
      Array.prototype.forEach.call(wrap.querySelectorAll('[data-v]'), function (x) {
        x.setAttribute('aria-pressed', 'false');
      });
      if (already) { setAnswer(q.id, null); wrap.classList.remove('is-committed'); return; }
      t.setAttribute('aria-pressed', 'true');
      wrap.classList.add('is-committed');
      setAnswer(q.id, opt);
      queueAdvance();
    });
    return t;
  }

  /* Scales ramp in weight, not in colour-as-judgement. */
  function renderScale(q, host) {
    var anchors = el('div', 'svq-anchors');
    anchors.appendChild(el('span', null, q.min + ' · ' + (q.low || '')));
    anchors.appendChild(el('span', null, q.max + ' · ' + (q.high || '')));
    host.appendChild(anchors);

    var wrap = el('div', 'svq-scale');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', q.label);
    var span = q.max - q.min;
    for (var v = q.min; v <= q.max; v++) wrap.appendChild(step(q, v, (v - q.min) / (span || 1), host));
    host.appendChild(wrap);

    if (q.extra) {
      var ex = el('div', 'svq-escape');
      ex.appendChild(step(q, q.extra, 0, host));
      host.appendChild(ex);
    }
  }

  /* `scope` is the question body, not the group: a scale plus its escape hatch
     are two groups but ONE answer, so deselect has to reach across both. */
  function step(q, value, ratio, scope) {
    var s = btn('svq-step', String(value));
    s.style.setProperty('--i', String(Math.round(ratio * 10) / 10));
    s.dataset.v = String(value);
    s.setAttribute('aria-pressed', state.answers[q.id] === String(value) ? 'true' : 'false');
    s.addEventListener('click', function () {
      var already = s.getAttribute('aria-pressed') === 'true';
      Array.prototype.forEach.call(scope.querySelectorAll('[data-v]'), function (x) {
        x.setAttribute('aria-pressed', 'false');
      });
      if (already) { setAnswer(q.id, null); return; }
      s.setAttribute('aria-pressed', 'true');
      setAnswer(q.id, String(value));
      queueAdvance();
    });
    return s;
  }

  /* Multi-select never auto-advances — you cannot know when they are done. */
  function renderMulti(q, host) {
    var current = Array.isArray(state.answers[q.id]) ? state.answers[q.id].slice() : [];
    var wrap = el('div', 'svq-tiles');
    wrap.setAttribute('data-count', String(q.options.length));
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', q.label + ' — choose any that apply');
    q.options.forEach(function (opt, i) {
      var t = btn('svq-tile', null);
      t.style.setProperty('--tile', 'var(--t' + ((i % 6) + 1) + ')');
      t.style.setProperty('--tiled', 'var(--t' + ((i % 6) + 1) + 'd)');
      t.style.setProperty('--d', (i * 45) + 'ms');
      t.dataset.v = opt;
      t.setAttribute('aria-pressed', current.indexOf(opt) > -1 ? 'true' : 'false');
      t.appendChild(el('span', 'svq-tile-key', KEYS[i] || String(i + 1)));
      t.appendChild(el('span', 'svq-tile-label', opt));
      t.appendChild(checkMark());
      t.addEventListener('click', function () {
        var on = t.getAttribute('aria-pressed') === 'true';
        t.setAttribute('aria-pressed', on ? 'false' : 'true');
        var idx = current.indexOf(opt);
        if (on && idx > -1) current.splice(idx, 1);
        else if (!on && idx === -1) current.push(opt);
        setAnswer(q.id, current.slice());
      });
      wrap.appendChild(t);
    });
    host.appendChild(wrap);
    host.appendChild(el('p', 'svq-lede', 'Choose any that apply, then continue.'));

    if (q.allowOther) {
      var other = el('input', 'svq-field');
      other.type = 'text';
      other.placeholder = 'If another group — who?';
      other.style.marginTop = '12px';
      other.value = state.answers[q.id + '_other'] || '';
      other.addEventListener('input', function () { setAnswer(q.id + '_other', other.value.trim()); });
      host.appendChild(other);
    }
  }

  /* The written answers. Same stage, same rhythm — but typed, because a written
     answer is the point of these and a tile would throw it away. */
  function renderTyped(q, host) {
    var long = q.type === 'text';
    var node = el(long ? 'textarea' : 'input', 'svq-field');
    if (!long) node.type = q.type === 'number' ? 'number' : 'text';
    if (q.type === 'number') { node.inputMode = 'numeric'; node.min = '0'; node.setAttribute('pattern', '[0-9]*'); }
    node.placeholder = long ? 'Type your answer…' : 'Your answer';
    node.setAttribute('aria-label', q.label);
    node.value = state.answers[q.id] || '';
    node.addEventListener('input', function () { setAnswer(q.id, node.value.trim()); });
    if (!long) node.addEventListener('keydown', function (e) { if (e.key === 'Enter') advance(); });
    host.appendChild(node);
    setTimeout(function () { node.focus({ preventScroll: true }); }, 120);
  }

  function renderMatrix(q, host) {
    var data = state.answers[q.id] && typeof state.answers[q.id] === 'object' ? state.answers[q.id] : {};
    var grid = el('div', 'svq-matrix');

    function recompute() {
      if (!q.computeEligible) return;
      var tot = { crossed: 0, recognized: 0, eligible: 0 };
      q.rows.forEach(function (r) {
        var row = data[r.id] || {};
        var c = parseInt(row.crossed, 10); c = isNaN(c) ? 0 : c;
        var g = parseInt(row.recognized, 10); g = isNaN(g) ? 0 : g;
        var e = Math.max(0, c - g);
        var cell = document.getElementById('svq-el-' + r.id);
        if (cell) cell.textContent = (row.crossed == null || row.crossed === '') ? '—' : String(e);
        tot.crossed += c; tot.recognized += g; tot.eligible += e;
      });
      ['crossed', 'recognized', 'eligible'].forEach(function (k) {
        var t = document.getElementById('svq-tot-' + k);
        if (t) t.textContent = String(tot[k]);
      });
    }

    q.rows.forEach(function (r) {
      var row = el('div', 'svq-mrow');
      row.style.setProperty('--cols', String(q.cols.length));
      var lab = el('div');
      lab.appendChild(el('span', 'svq-mrow-label', r.label));
      if (r.note) lab.appendChild(el('span', 'svq-mrow-note', r.note));
      row.appendChild(lab);
      q.cols.forEach(function (c) {
        var cell = el('div');
        cell.appendChild(el('span', 'svq-label', c.label));
        if (c.type === 'computed') {
          var out = el('span', 'svq-computed', '—');
          out.id = 'svq-el-' + r.id;
          cell.appendChild(out);
        } else {
          var input = el('input', 'svq-field');
          input.type = c.type === 'number' ? 'number' : (c.type === 'date' ? 'date' : 'text');
          if (c.type === 'number') { input.inputMode = 'numeric'; input.min = '0'; }
          input.value = (data[r.id] && data[r.id][c.id]) || '';
          input.setAttribute('aria-label', r.label + ' — ' + c.label);
          input.addEventListener('input', function () {
            data[r.id] = data[r.id] || {};
            if (input.value.trim() === '') delete data[r.id][c.id];
            else data[r.id][c.id] = input.value.trim();
            if (!Object.keys(data[r.id]).length) delete data[r.id];
            setAnswer(q.id, Object.keys(data).length ? data : null);
            recompute();
          });
          cell.appendChild(input);
        }
        row.appendChild(cell);
      });
      grid.appendChild(row);
    });

    if (q.computeEligible) {
      var totalRow = el('div', 'svq-mrow svq-mtotal');
      totalRow.style.setProperty('--cols', String(q.cols.length));
      totalRow.appendChild(el('span', 'svq-mrow-label', 'Total retroactive population'));
      q.cols.forEach(function (c) {
        var cell = el('div');
        cell.appendChild(el('span', 'svq-label', c.label));
        var s = el('span', 'svq-computed', '0');
        s.id = 'svq-tot-' + c.id;
        cell.appendChild(s);
        totalRow.appendChild(cell);
      });
      grid.appendChild(totalRow);
    }

    host.appendChild(grid);
    recompute();
  }

  /* ── movement ─────────────────────────────────────────────────────────── */
  function queueAdvance() {
    clearTimeout(advanceTimer);
    advanceTimer = setTimeout(advance, ADVANCE_MS);
  }
  function advance() {
    clearTimeout(advanceTimer);
    var cur = state.flat[state.qIndex];
    var nextQ = state.flat[state.qIndex + 1];
    state.qIndex += 1;
    if (!nextQ) return screenReview();
    // A new section gets its own title card — pacing, and it tells you where you are.
    if (cur && nextQ.sectionIdx !== cur.sectionIdx) return screenSection(nextQ.sectionIdx);
    screenQuestion();
  }
  function prev() {
    clearTimeout(advanceTimer);
    if (state.qIndex === 0) return screenIdentity();
    var cur = state.flat[state.qIndex];
    var prevQ = state.flat[state.qIndex - 1];
    state.qIndex -= 1;
    if (cur && prevQ.sectionIdx !== cur.sectionIdx) return screenSection(prevQ.sectionIdx);
    screenQuestion();
  }

  /* ══ SCREEN · REVIEW ═════════════════════════════════════════════════════ */
  function screenReview() {
    state.screen = 'review';
    state.qIndex = state.flat.length;
    setAccent(0);
    var inst = DEFS.get(state.instrument);
    var total = state.flat.length;
    var done = answeredCount();

    var b = document.createDocumentFragment();
    b.appendChild(el('p', 'svq-eyebrow', 'Last step'));
    b.appendChild(el('h1', 'svq-h svq-h1', 'Send it to the DAS team'));

    var sum = el('div', 'svq-summary');
    [['Instrument', inst.name],
     ['Organization', state.identity.organization || '—'],
     ['Completed by', state.identity.name || 'Not provided'],
     ['Answered', done + ' of ' + total]].forEach(function (r) {
      var line = el('div');
      line.appendChild(el('b', null, r[0] + ': '));
      line.appendChild(document.createTextNode(r[1]));
      sum.appendChild(line);
    });
    b.appendChild(sum);

    var alert = el('div', 'svq-alert' + (done < total ? ' svq-alert--info is-on' : ''),
      done < total
        ? (total - done) + ' question' + (total - done === 1 ? '' : 's') + ' left blank. You can send it as it is — blanks are reported as unanswered — or go back and fill them in.'
        : '');
    alert.style.marginTop = '20px';
    b.appendChild(alert);

    /* The driver's opt-in. Deliberately here and not on the identity screen: asking
       for an email up front reads as "we will contact you" and suppresses honesty on
       an anonymous survey. Asking at the end, after they have answered, reads as an
       offer. Unticked by default — opt-IN, never opt-out. */
    if (state.role === 'driver') {
      var opt = el('div', 'svq-optin');
      var row = el('label', 'svq-optin-row');
      var cb = el('input');
      cb.type = 'checkbox';
      cb.id = 'svq-emailme';
      row.appendChild(cb);
      row.appendChild(el('span', null, 'Email me a copy of my answers, plus what strong recognition looks like elsewhere.'));
      opt.appendChild(row);

      var mail = el('input', 'svq-field');
      mail.type = 'email';
      mail.id = 'svq-emailme-addr';
      mail.placeholder = 'your@email.com';
      mail.setAttribute('autocapitalize', 'off');
      mail.setAttribute('autocorrect', 'off');
      mail.setAttribute('spellcheck', 'false');
      mail.setAttribute('inputmode', 'email');
      mail.autocomplete = 'email';
      mail.style.display = 'none';
      mail.style.marginTop = '10px';
      mail.value = state.identity.email || '';
      opt.appendChild(mail);

      cb.addEventListener('change', function () {
        mail.style.display = cb.checked ? '' : 'none';
        state.emailMe = cb.checked;
        if (cb.checked) setTimeout(function () { mail.focus(); }, 40);
        else { state.identity.email = ''; mail.classList.remove('is-invalid'); }
      });
      mail.addEventListener('input', function () {
        state.identity.email = mail.value.trim();
        mail.classList.remove('is-invalid');
      });
      b.appendChild(opt);
    }

    var send = btn('svq-btn svq-btn-primary', 'Submit responses');
    send.addEventListener('click', function () { submit(send, alert); });
    var back = btn('svq-skip', 'Back to questions');
    back.addEventListener('click', function () { state.qIndex = total - 1; screenQuestion(); });
    paint(b, [back, el('span', 'svq-spacer'), send], 'SEND');
  }

  /* ══ SUBMIT ══════════════════════════════════════════════════════════════ */
  function submit(button, alert) {
    // If they ticked the box, the address has to be real or the copy silently
    // never arrives and they think we ignored them.
    if (state.emailMe) {
      var mail = document.getElementById('svq-emailme-addr');
      var v = mail ? mail.value.trim() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        if (mail) { mail.classList.add('is-invalid'); mail.focus(); }
        alert.textContent = 'That email address does not look right — or untick the box to submit without a copy.';
        alert.className = 'svq-alert svq-alert--err is-on';
        return;
      }
      state.identity.email = v;
    }
    button.disabled = true;
    button.textContent = 'Sending…';
    alert.classList.remove('is-on');

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formType: 'survey',
        instrument: state.instrument,
        accessCode: state.code,
        identity: state.identity,
        emailMe: state.emailMe === true,
        answers: state.answers
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.body && res.body.error) || 'Submission failed.');
        clearDraft();
        screenDone();
        requestAnalysis();   // phase two — the answers are already safe
      })
      .catch(function (err) {
        alert.textContent = err.message || 'Something went wrong. Please try again, or email info@driverappreciationsolutions.com.';
        alert.className = 'svq-alert svq-alert--err is-on';
        button.disabled = false;
        button.textContent = 'Submit responses';
      });
  }

  /* Phase two. Fired only AFTER the submission succeeded, so the answers are
     already emailed and stored before a model is ever contacted. Silent on
     purpose: the analysis goes to the DAS team, not to whoever just answered,
     and telling a respondent "preparing your summary" would promise them
     something they will never receive. Failure here is invisible and harmless. */
  function requestAnalysis() {
    try {
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formType: 'survey-analysis',
          instrument: state.instrument,
          accessCode: state.code,
          identity: state.identity,
          answers: state.answers
        }),
        keepalive: true
      }).catch(function () { /* never surfaced — the response is already safe */ });
    } catch (e) { /* same */ }
  }

  /* ══ SCREEN · DONE ═══════════════════════════════════════════════════════ */
  function screenDone() {
    state.screen = 'done';
    setAccent(5); // forest — arrival
    var inst = DEFS.get(state.instrument);
    var b = document.createDocumentFragment();
    var wrap = el('div', 'svq-done');

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'das-ill das-ill-medal');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#das-medal');  // local fragment — see js/das-sprite.js
    svg.appendChild(use);
    wrap.appendChild(svg);

    wrap.appendChild(el('p', 'svq-eyebrow', 'Received'));
    wrap.appendChild(el('h1', 'svq-h svq-h1', "That's in. Thank you."));
    wrap.appendChild(el('p', 'svq-lede', 'Your responses went straight to the Driver Appreciation Solutions team. Someone will follow up with what the answers point to.'));

    var sum = el('div', 'svq-summary');
    var rows = [['Submitted', inst.name],
      ['Organization', state.identity.organization || '—'],
      ['Answered', answeredCount() + ' of ' + state.flat.length]];
    if (state.identity.email && (state.role === 'organization' || state.emailMe)) {
      rows.push(['Copy sent to', state.identity.email]);
    }
    rows.forEach(function (r) {
      var line = el('div');
      line.appendChild(el('b', null, r[0] + ': '));
      line.appendChild(document.createTextNode(r[1]));
      sum.appendChild(line);
    });
    wrap.appendChild(sum);
    b.appendChild(wrap);

    var print = btn('svq-btn svq-btn-ghost', 'Save a copy');
    print.addEventListener('click', function () { window.print(); });
    var home = btn('svq-btn svq-btn-primary', 'Done');
    home.addEventListener('click', function () { window.location.href = '/'; });
    paint(b, [el('span', 'svq-spacer'), print, home], 'THANKS');
  }

  /* ── start ────────────────────────────────────────────────────────────── */
  function startInstrument(key) {
    var inst = DEFS.get(key);
    state.instrument = key;
    state.role = inst.audience;
    state.flat = [];
    inst.sections.forEach(function (sec, si) {
      sec.questions.forEach(function (q) {
        state.flat.push(Object.assign({}, q, { section: sec.title, sectionIdx: si }));
      });
    });

    var draft = readDraft(key);
    if (draft && (Object.keys(draft.answers || {}).length || Object.keys(draft.identity || {}).length)) {
      state.identity = Object.assign({}, draft.identity, state.identity);
      state.answers = draft.answers || {};
      state.qIndex = Math.min(draft.qIndex || 0, state.flat.length - 1);
      state.resumed = true;
    }
    screenIdentity();
  }

  function init() {
    root = document.getElementById('svq');
    stage = document.getElementById('svq-stage');
    foot = document.getElementById('svq-foot');
    railFill = document.getElementById('svq-rail-fill');
    chipEl = document.getElementById('svq-chip');
    sectionEl = document.getElementById('svq-section');
    if (!root || !stage) return;

    document.getElementById('svq-exit').addEventListener('click', function () {
      window.location.href = '/';
    });

    // Number keys pick an answer — the quiz reflex, and it makes a long
    // instrument genuinely fast on a laptop.
    document.addEventListener('keydown', function (e) {
      if (state.screen !== 'question') return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '').toUpperCase())) return;
      if (e.key >= '1' && e.key <= '9') {
        var opts = stage.querySelectorAll('.svq-tile, .svq-step');
        var pick = opts[parseInt(e.key, 10) - 1];
        if (pick) { pick.click(); e.preventDefault(); }
      } else if (e.key === 'Enter') {
        advance(); e.preventDefault();
      }
    });

    var want = new URLSearchParams(window.location.search).get('i');
    if (want && DEFS.get(want)) {
      if (DEFS.get(want).gated) { state.pending = want; screenCode(); return; }
      startInstrument(want);
      return;
    }
    screenRole();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
