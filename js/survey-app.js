/* ============================================================================
   DAS SURVEY ENGINE  —  js/survey-app.js
   ----------------------------------------------------------------------------
   Drives the whole flow on /surveys from the definitions in js/survey-defs.js.

   FLOW
     role ──► (code, company only) ──► identity ──► (pick, company only) ──► form ──► done

   The client posts only { instrument, identity, answers }. It does NOT post
   question text: the server reads the SAME definitions file to label the email,
   so a reworded question can never produce an email that describes the old one.

   DELIBERATE: no question is individually required. 74 mandatory fields is an
   abandonment machine. Progress shows "X of N answered", submit is always live,
   and unanswered items are reported as such in the email. Identity is the only
   hard gate.
   ========================================================================== */
(function () {
  'use strict';

  var DEFS = window.DAS_SURVEYS;
  if (!DEFS) return;

  var STORE_PREFIX = 'das_survey_v1_';
  var STORE_TTL_MS = 30 * 24 * 3600 * 1000; // a stale draft is worse than none

  var state = {
    role: null,          // 'driver' | 'organization'
    code: '',
    instrument: null,    // 'driver' | 'assessment' | 'commitment'
    identity: {},
    answers: {},
    sectionIndex: 0
  };

  /* ── tiny DOM helpers ─────────────────────────────────────────────────── */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function showStep(id) {
    $$('.sv-step').forEach(function (s) { s.classList.remove('is-active'); });
    var target = document.getElementById(id);
    if (target) target.classList.add('is-active');
    var prog = $('.sv-progress');
    if (prog) prog.style.display = (id === 'sv-form') ? '' : 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function alertBox(box, msg, kind) {
    if (!box) return;
    box.textContent = msg || '';
    box.className = 'sv-alert sv-alert--' + (kind || 'err') + (msg ? ' is-on' : '');
  }

  /* ── draft persistence ────────────────────────────────────────────────── */
  function storeKey() { return STORE_PREFIX + state.instrument; }
  function saveDraft() {
    if (!state.instrument) return;
    try {
      localStorage.setItem(storeKey(), JSON.stringify({
        ts: Date.now(), identity: state.identity, answers: state.answers, sectionIndex: state.sectionIndex
      }));
    } catch (e) { /* private mode / quota — the form still works, it just won't resume */ }
  }
  function readDraft(key) {
    try {
      var raw = localStorage.getItem(STORE_PREFIX + key);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || !d.ts || Date.now() - d.ts > STORE_TTL_MS) return null;
      return d;
    } catch (e) { return null; }
  }
  function clearDraft() {
    try { localStorage.removeItem(storeKey()); } catch (e) {}
  }

  /* ── answer bookkeeping ───────────────────────────────────────────────── */
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
    return DEFS.questions(state.instrument).filter(function (q) { return isAnswered(state.answers[q.id]); }).length;
  }
  function setAnswer(id, value) {
    if (value == null || value === '') delete state.answers[id];
    else state.answers[id] = value;
    updateProgress();
    saveDraft();
  }

  function updateProgress() {
    var inst = DEFS.get(state.instrument);
    if (!inst) return;
    var total = DEFS.questions(state.instrument).length;
    var done = answeredCount();
    var sec = inst.sections[state.sectionIndex];
    var lbl = $('#sv-progress-label');
    var cnt = $('#sv-progress-count');
    var fill = $('#sv-progress-fill');
    if (lbl) lbl.textContent = 'Section ' + (state.sectionIndex + 1) + ' of ' + inst.sections.length + (sec ? ' · ' + sec.title : '');
    if (cnt) cnt.textContent = done + ' of ' + total + ' answered';
    if (fill) fill.style.width = (total ? Math.round((done / total) * 100) : 0) + '%';
  }

  /* ══ QUESTION RENDERERS ═════════════════════════════════════════════════
     One renderer per mechanic. Each mechanic gets a visually distinct shape —
     that is the whole point (see css/survey.css header).
     ════════════════════════════════════════════════════════════════════════ */

  /* Segmented toggle group.
     `scope` is the question body, NOT the group — a scale with an `extra`
     ("Not applicable") renders TWO groups that are one answer, so deselecting
     must reach across both. Scoping the clear to the body makes that automatic
     instead of depending on how the groups happen to be nested. */
  function segGroup(q, values, scope, opts) {
    opts = opts || {};
    var wrap = el('div', 'sv-scale' + (opts.words ? ' sv-scale--words' : ''));
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', q.label);
    values.forEach(function (v) {
      var b = el('button', 'sv-seg', String(v));
      b.type = 'button';
      b.dataset.v = String(v);
      b.setAttribute('aria-pressed', state.answers[q.id] === String(v) ? 'true' : 'false');
      b.addEventListener('click', function () {
        var already = b.getAttribute('aria-pressed') === 'true';
        $$('[data-v]', scope).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', already ? 'false' : 'true');
        setAnswer(q.id, already ? null : String(v));
        markAnswered(b);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function markAnswered(node) {
    var card = node.closest ? node.closest('.sv-q') : null;
    if (card) card.classList.toggle('is-answered', isAnswered(state.answers[card.dataset.qid]));
  }

  function renderScale(q, body) {
    var anchors = el('div', 'sv-scale-anchors');
    anchors.appendChild(el('span', null, q.min + ' ' + (q.low || '')));
    anchors.appendChild(el('span', null, q.max + ' ' + (q.high || '')));
    body.appendChild(anchors);

    var nums = [];
    for (var i = q.min; i <= q.max; i++) nums.push(i);
    body.appendChild(segGroup(q, nums, body));

    // "Not applicable" / "No program" — a real answer on paper, so it stays an answer here.
    if (q.extra) {
      var ex = el('div', 'sv-extra');
      ex.appendChild(segGroup(q, [q.extra], body));
      body.appendChild(ex);
    }
  }

  function renderChoice(q, body) {
    if (q.scaleLike) {
      body.appendChild(segGroup(q, q.options, body, { words: true }));
      return;
    }
    var wrap = el('div', q.decision ? 'sv-decide' : 'sv-pills');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', q.label);
    q.options.forEach(function (opt) {
      var b = el('button', 'sv-pill', opt);
      b.type = 'button';
      b.dataset.v = opt;
      b.setAttribute('aria-pressed', state.answers[q.id] === opt ? 'true' : 'false');
      b.addEventListener('click', function () {
        var already = b.getAttribute('aria-pressed') === 'true';
        $$('[data-v]', wrap).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', already ? 'false' : 'true');
        setAnswer(q.id, already ? null : opt);
        markAnswered(b);
      });
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
  }

  function renderMulti(q, body) {
    var current = Array.isArray(state.answers[q.id]) ? state.answers[q.id].slice() : [];
    var wrap = el('div', 'sv-pills');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', q.label);
    q.options.forEach(function (opt) {
      var b = el('button', 'sv-pill sv-chip', opt);
      b.type = 'button';
      b.dataset.v = opt;
      b.setAttribute('aria-pressed', current.indexOf(opt) > -1 ? 'true' : 'false');
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') === 'true';
        b.setAttribute('aria-pressed', on ? 'false' : 'true');
        var idx = current.indexOf(opt);
        if (on && idx > -1) current.splice(idx, 1);
        else if (!on && idx === -1) current.push(opt);
        setAnswer(q.id, current.slice());
        markAnswered(b);
      });
      wrap.appendChild(b);
    });
    body.appendChild(wrap);

    if (q.allowOther) {
      var other = el('input', 'sv-input');
      other.type = 'text';
      other.placeholder = 'If another group — who?';
      other.style.marginTop = '10px';
      other.value = state.answers[q.id + '_other'] || '';
      other.addEventListener('input', function () { setAnswer(q.id + '_other', other.value.trim()); });
      body.appendChild(other);
    }
  }

  function renderText(q, body) {
    var isLong = q.type === 'text';
    var node = el(isLong ? 'textarea' : 'input', isLong ? 'sv-textarea' : 'sv-input');
    if (!isLong) node.type = (q.type === 'number') ? 'number' : 'text';
    if (q.type === 'number') { node.inputMode = 'numeric'; node.min = '0'; }
    node.value = state.answers[q.id] || '';
    node.addEventListener('input', function () {
      setAnswer(q.id, node.value.trim());
      markAnswered(node);
    });
    body.appendChild(node);
  }

  function renderMatrix(q, body) {
    var data = state.answers[q.id] && typeof state.answers[q.id] === 'object' ? state.answers[q.id] : {};

    var table = el('table', 'sv-matrix');
    var thead = el('thead');
    var htr = el('tr');
    htr.appendChild(el('th', null, ''));
    q.cols.forEach(function (c) { htr.appendChild(el('th', null, c.label)); });
    thead.appendChild(htr);
    table.appendChild(thead);

    var tbody = el('tbody');

    function recompute() {
      if (!q.computeEligible) return;
      var totals = { crossed: 0, recognized: 0, eligible: 0 };
      q.rows.forEach(function (r) {
        var row = data[r.id] || {};
        var crossed = parseInt(row.crossed, 10);
        var recog = parseInt(row.recognized, 10);
        crossed = isNaN(crossed) ? 0 : crossed;
        recog = isNaN(recog) ? 0 : recog;
        var eligible = Math.max(0, crossed - recog);
        var cell = $('#sv-elig-' + q.id + '-' + r.id);
        if (cell) cell.textContent = (row.crossed == null || row.crossed === '') ? '—' : String(eligible);
        totals.crossed += crossed; totals.recognized += recog; totals.eligible += eligible;
      });
      ['crossed', 'recognized', 'eligible'].forEach(function (k) {
        var t = $('#sv-tot-' + q.id + '-' + k);
        if (t) t.textContent = String(totals[k]);
      });
    }

    q.rows.forEach(function (r) {
      var tr = el('tr');
      var labCell = el('td');
      var lab = el('span', 'sv-matrix-row-label', r.label);
      labCell.appendChild(lab);
      if (r.note) labCell.appendChild(el('span', 'sv-matrix-row-note', r.note));
      tr.appendChild(labCell);

      q.cols.forEach(function (c) {
        var td = el('td');
        td.setAttribute('data-col', c.label);
        if (c.type === 'computed') {
          var out = el('span', 'sv-computed', '—');
          out.id = 'sv-elig-' + q.id + '-' + r.id;
          td.appendChild(out);
        } else {
          var input = el('input', 'sv-input');
          input.type = c.type === 'number' ? 'number' : (c.type === 'date' ? 'date' : 'text');
          if (c.type === 'number') { input.inputMode = 'numeric'; input.min = '0'; }
          input.value = (data[r.id] && data[r.id][c.id]) || '';
          input.setAttribute('aria-label', r.label + ' — ' + c.label);
          input.addEventListener('input', function () {
            data[r.id] = data[r.id] || {};
            if (input.value.trim() === '') delete data[r.id][c.id];
            else data[r.id][c.id] = input.value.trim();
            if (Object.keys(data[r.id]).length === 0) delete data[r.id];
            setAnswer(q.id, Object.keys(data).length ? data : null);
            recompute();
            markAnswered(input);
          });
          td.appendChild(input);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    if (q.computeEligible) {
      var totalRow = el('tr', 'sv-matrix-total');
      totalRow.appendChild(el('td', null, 'Total retroactive population'));
      q.cols.forEach(function (c) {
        var td = el('td');
        td.setAttribute('data-col', 'Total ' + c.label);
        var s = el('span', 'sv-computed', '0');
        s.id = 'sv-tot-' + q.id + '-' + c.id;
        td.appendChild(s);
        totalRow.appendChild(td);
      });
      tbody.appendChild(totalRow);
    }

    table.appendChild(tbody);
    body.appendChild(table);
    recompute();
  }

  function renderQuestion(q) {
    var card = el('div', 'sv-q' + (q.decision ? ' sv-q--decision' : ''));
    card.dataset.qid = q.id;
    if (isAnswered(state.answers[q.id])) card.classList.add('is-answered');

    var head = el('div', 'sv-q-head');
    head.appendChild(el('span', 'sv-q-n', q.n != null ? String(q.n) : ''));
    head.appendChild(el('p', 'sv-q-label', q.label));
    card.appendChild(head);

    if (q.help) card.appendChild(el('div', 'sv-q-help', q.help));

    var body = el('div');
    if (q.type === 'scale') renderScale(q, body);
    else if (q.type === 'choice') renderChoice(q, body);
    else if (q.type === 'multi') renderMulti(q, body);
    else if (q.type === 'matrix') renderMatrix(q, body);
    else renderText(q, body);
    card.appendChild(body);
    return card;
  }

  /* ══ FORM STEP ═════════════════════════════════════════════════════════ */
  function renderSection() {
    var inst = DEFS.get(state.instrument);
    var sec = inst.sections[state.sectionIndex];
    var host = $('#sv-questions');
    host.innerHTML = '';

    var head = el('div', 'sv-section-head');
    var eb = el('p', 'sv-eyebrow', inst.shortName);
    head.appendChild(eb);
    var h = el('h2', 'sv-h sv-h2', sec.title);
    head.appendChild(h);
    if (sec.lede) head.appendChild(el('p', 'sv-section-lede', sec.lede));
    host.appendChild(head);

    sec.questions.forEach(function (q) { host.appendChild(renderQuestion(q)); });

    var last = state.sectionIndex === inst.sections.length - 1;
    $('#sv-back').style.visibility = state.sectionIndex === 0 ? 'hidden' : 'visible';
    $('#sv-next').textContent = last ? 'Review & submit' : 'Continue';
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function gotoSection(i) {
    var inst = DEFS.get(state.instrument);
    state.sectionIndex = Math.max(0, Math.min(i, inst.sections.length - 1));
    saveDraft();
    renderSection();
  }

  /* ══ IDENTITY ══════════════════════════════════════════════════════════ */
  function identityFields() {
    // Driver: organization routes the response, so it is the only required field.
    // Name is optional on purpose — a driver who signs "how valued do you feel"
    // softens the answer, and we lose nothing operationally.
    if (state.role === 'driver') {
      return [
        { id: 'organization', label: 'Your company / fleet', required: true, ph: 'e.g. Midwest Carriers' },
        { id: 'name',   label: 'Your name', required: false, opt: 'optional' },
        { id: 'terminal', label: 'Terminal or location', required: false, opt: 'optional' },
        { id: 'email',  label: 'Email', required: false, opt: 'optional', type: 'email' }
      ];
    }
    return [
      { id: 'organization', label: 'Organization', required: true },
      { id: 'name',  label: 'Your name', required: true },
      { id: 'title', label: 'Title / department', required: false, opt: 'optional' },
      { id: 'email', label: 'Work email', required: true, type: 'email' },
      { id: 'phone', label: 'Phone', required: false, opt: 'optional', type: 'tel' }
    ];
  }

  function renderIdentity() {
    var host = $('#sv-identity-fields');
    host.innerHTML = '';
    var grid = el('div', 'sv-grid2');
    identityFields().forEach(function (f) {
      var field = el('div', 'sv-field');
      var lab = el('label', 'sv-field-label');
      lab.setAttribute('for', 'sv-id-' + f.id);
      lab.appendChild(document.createTextNode(f.label));
      if (f.opt) lab.appendChild(el('span', 'sv-field-opt', ' — ' + f.opt));
      field.appendChild(lab);
      var input = el('input', 'sv-input');
      input.type = f.type || 'text';
      input.id = 'sv-id-' + f.id;
      input.name = f.id;
      input.autocomplete = f.id === 'organization' ? 'organization' : (f.id === 'name' ? 'name' : (f.type || 'on'));
      if (f.ph) input.placeholder = f.ph;
      if (f.required) input.required = true;
      input.value = state.identity[f.id] || '';
      input.addEventListener('input', function () {
        state.identity[f.id] = input.value.trim();
        input.classList.remove('is-invalid');
        saveDraft();
      });
      field.appendChild(input);
      grid.appendChild(field);
    });
    host.appendChild(grid);

    var sub = $('#sv-identity-sub');
    sub.textContent = state.role === 'driver'
      ? 'We only need your company so your answers reach the right place. Your name is optional — answer honestly.'
      : 'So we know which organization this belongs to and who to send the summary back to.';
  }

  function validateIdentity() {
    var ok = true;
    identityFields().forEach(function (f) {
      var input = document.getElementById('sv-id-' + f.id);
      if (!input) return;
      var v = input.value.trim();
      var bad = (f.required && !v) || (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
      input.classList.toggle('is-invalid', bad);
      if (bad && ok) input.focus();
      if (bad) ok = false;
    });
    return ok;
  }

  /* ══ SUBMIT ════════════════════════════════════════════════════════════ */
  function submit() {
    var btn = $('#sv-submit');
    var box = $('#sv-review-alert');
    btn.disabled = true;
    btn.textContent = 'Sending…';
    alertBox(box, '');

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formType: 'survey',
        instrument: state.instrument,
        accessCode: state.code,
        identity: state.identity,
        answers: state.answers
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error((res.body && res.body.error) || 'Submission failed.');
        clearDraft();
        var inst = DEFS.get(state.instrument);
        $('#sv-done-what').textContent = inst.name;
        $('#sv-done-org').textContent = state.identity.organization || '';
        $('#sv-done-count').textContent = answeredCount() + ' of ' + DEFS.questions(state.instrument).length;
        var copy = $('#sv-done-copy');
        if (copy) {
          copy.style.display = (state.role === 'organization' && state.identity.email) ? '' : 'none';
          var to = $('#sv-done-copy-to');
          if (to) to.textContent = state.identity.email || '';
        }
        showStep('sv-done');
      })
      .catch(function (err) {
        alertBox(box, err.message || 'Something went wrong. Please try again, or email info@driverappreciationsolutions.com.', 'err');
        btn.disabled = false;
        btn.textContent = 'Submit responses';
      });
  }

  function renderReview() {
    var inst = DEFS.get(state.instrument);
    var total = DEFS.questions(state.instrument).length;
    var done = answeredCount();
    $('#sv-review-what').textContent = inst.name;
    $('#sv-review-org').textContent = state.identity.organization || '—';
    $('#sv-review-who').textContent = state.identity.name || 'Not provided';
    $('#sv-review-count').textContent = done + ' of ' + total;
    var box = $('#sv-review-alert');
    if (done < total) {
      alertBox(box, (total - done) + ' question' + (total - done === 1 ? '' : 's') +
        ' left blank. You can submit as-is — blanks are reported as unanswered — or go back and fill them in.', 'info');
    } else {
      alertBox(box, '');
    }
  }

  /* ══ ENTRY / WIRING ════════════════════════════════════════════════════ */
  function startInstrument(key) {
    state.instrument = key;
    var inst = DEFS.get(key);
    state.role = inst.audience;

    var draft = readDraft(key);
    if (draft && (Object.keys(draft.answers || {}).length || Object.keys(draft.identity || {}).length)) {
      state.identity = Object.assign({}, draft.identity, state.identity);
      state.answers = draft.answers || {};
      state.sectionIndex = draft.sectionIndex || 0;
      var resume = $('#sv-resume');
      if (resume) {
        resume.classList.add('is-on');
        $('#sv-resume-text').textContent = 'We found a saved draft of the ' + inst.shortName +
          ' on this device — ' + answeredCount() + ' answers. Continuing where you left off.';
      }
    }

    // The driver path is role → identity (2 steps); the organization path adds the
    // code and the picker (3). Counting them the same way misreports one of them.
    var stepLabel = $('#sv-identity-step');
    if (stepLabel) stepLabel.textContent = inst.gated ? 'Step 3 of 3' : 'Step 2 of 2';

    $('#sv-identity-title').textContent = inst.name;
    $('#sv-identity-lede').textContent = inst.blurb;
    renderIdentity();
    showStep('sv-identity');
  }

  function init() {
    /* Role picker */
    $$('[data-role]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.role = b.dataset.role;
        if (state.role === 'driver') startInstrument('driver');
        else { alertBox($('#sv-code-alert'), ''); showStep('sv-code'); }
      });
    });

    /* Access code — this is only the door. The code is verified for real on the
       server at submit time, so skipping this screen buys nothing. */
    $('#sv-code-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('#sv-code-input').value.trim();
      if (!v) {
        alertBox($('#sv-code-alert'), 'Enter the access code your DAS representative gave you.', 'err');
        $('#sv-code-input').classList.add('is-invalid');
        return;
      }
      state.code = v;
      // A deep link (/surveys?i=assessment) already named the instrument — skip the picker.
      if (state.pending) {
        var p = state.pending;
        state.pending = null;
        startInstrument(p);
      } else {
        showStep('sv-pick');
      }
    });

    /* Instrument picker (company side) */
    $$('[data-instrument]').forEach(function (b) {
      b.addEventListener('click', function () { startInstrument(b.dataset.instrument); });
    });

    /* Identity → form */
    $('#sv-identity-form').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateIdentity()) return;
      saveDraft();
      showStep('sv-form');
      gotoSection(state.sectionIndex || 0);
    });

    /* Section nav */
    $('#sv-back').addEventListener('click', function () { gotoSection(state.sectionIndex - 1); });
    $('#sv-next').addEventListener('click', function () {
      var inst = DEFS.get(state.instrument);
      if (state.sectionIndex >= inst.sections.length - 1) {
        renderReview();
        showStep('sv-review');
      } else {
        gotoSection(state.sectionIndex + 1);
      }
    });

    $('#sv-review-back').addEventListener('click', function () {
      showStep('sv-form');
      renderSection();
    });
    $('#sv-submit').addEventListener('click', submit);

    $('#sv-print').addEventListener('click', function () { window.print(); });
    $('#sv-restart').addEventListener('click', function () { window.location.href = '/surveys'; });

    /* Deep link: /surveys?i=driver|assessment|commitment */
    var want = new URLSearchParams(window.location.search).get('i');
    if (want && DEFS.get(want)) {
      if (DEFS.get(want).gated) { state.pending = want; showStep('sv-code'); }
      else startInstrument(want);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
