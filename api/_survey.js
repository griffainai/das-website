/* ============================================================================
   DAS ELECTRONIC SURVEYS — submission handler
   ----------------------------------------------------------------------------
   NOT a Vercel function. The underscore prefix keeps it off the routing table so
   the site stays under the 12-function cap (currently 10 routes). It is reached
   through api/contact.js, which dispatches on `formType: 'survey'` — the same
   pattern the company-purchasing pathway already uses.

   Three instruments (js/survey-defs.js):
     driver     — public, no code
     assessment — access code
     commitment — access code

   The client posts { instrument, identity, answers } and NOT the question text.
   Labels come from the same definitions file the browser rendered from, so the
   email can never describe a question that no longer exists.

   Delivery: a formatted HTML email to the DAS team + the raw JSON attached, a
   copy back to the organization rep, and a best-effort Supabase row. The email is
   the gate — a Supabase failure must never lose a response.
   ========================================================================== */
'use strict';

const DEFS = require('../js/survey-defs.js');
const { brandShell, esc, NAVY, BRASS, MUTED, HAIR, INK, UI_FONT, HEAD_FONT } = require('../lib/email-brand');

/* Same four addresses the company-purchasing pathway routes to. */
const DEFAULT_TO =
  'ssshafeek@driverappreciationsolutions.com,info@driverappreciationsolutions.com,shaqisvictory@gmail.com,afaust@offdutynotdrivingrewards.com';

/* A missing env var must not lock the rep out mid-meeting. The consequence of a
   leaked code is that someone fills in a discovery questionnaire — reliability
   outranks secrecy here. Set SURVEY_ACCESS_CODE to rotate it. */
const DEFAULT_CODE = 'DAS2027';

const MAX_TEXT = 4000;   // per free-text answer
const MAX_FIELD = 200;   // per identity field

function clip(v, max) {
  return String(v == null ? '' : v).slice(0, max || MAX_TEXT).trim();
}

/* ── Turn a stored answer into something a human reads in an email ───────── */
function renderAnswer(q, value) {
  if (value == null || value === '') return null;

  if (Array.isArray(value)) {
    const list = value.filter(Boolean).map((v) => esc(clip(v, MAX_FIELD)));
    return list.length ? list.join(' · ') : null;
  }

  if (typeof value === 'object') {
    // matrix — workstream owners, retroactive census, leadership commitments
    if (!q || q.type !== 'matrix') return esc(clip(JSON.stringify(value)));
    const rows = q.rows
      .map((r) => {
        const cells = value[r.id] || {};
        const parts = q.cols
          .filter((c) => c.type !== 'computed')
          .map((c) => (cells[c.id] ? `<b>${esc(c.label)}:</b> ${esc(clip(cells[c.id], MAX_FIELD))}` : null))
          .filter(Boolean);
        if (!parts.length) return null;
        // The census's eligible column is derived, not typed — recompute it here so
        // the email carries the number leadership actually saw on screen.
        let derived = '';
        if (q.computeEligible) {
          const crossed = parseInt(cells.crossed, 10);
          const recog = parseInt(cells.recognized, 10);
          if (!isNaN(crossed)) {
            derived = ` · <b>Eligible:</b> ${Math.max(0, crossed - (isNaN(recog) ? 0 : recog))}`;
          }
        }
        return `<div style="padding:5px 0;border-bottom:1px solid ${HAIR}"><span style="color:${INK};font-weight:600">${esc(r.label)}</span><br>${parts.join(' · ')}${derived}</div>`;
      })
      .filter(Boolean);
    return rows.length ? rows.join('') : null;
  }

  return esc(clip(value, MAX_TEXT));
}

/* ── Build the email body, section by section ───────────────────────────── */
function buildBody(instrument, identity, answers) {
  const inst = DEFS.get(instrument);
  const map = DEFS.byId(instrument);
  const all = DEFS.questions(instrument);
  const answered = all.filter((q) => {
    const v = answers[q.id];
    return v != null && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);
  }).length;

  const idRows = [
    ['Organization', identity.organization],
    ['Name', identity.name],
    ['Title / department', identity.title],
    ['Terminal / location', identity.terminal],
    ['Email', identity.email],
    ['Phone', identity.phone],
  ]
    .filter((r) => r[1])
    .map(
      (r) =>
        `<tr><td style="padding:7px 12px;background:#F5F7FB;font-weight:600;width:170px;font-size:13px">${esc(r[0])}</td><td style="padding:7px 12px;border-bottom:1px solid ${HAIR};font-size:13px">${esc(clip(r[1], MAX_FIELD))}</td></tr>`
    )
    .join('');

  let html = `
    <div style="font-size:12px;color:${MUTED};line-height:1.7;margin:0 0 16px">
      <b style="color:${INK}">${esc(inst.name)}</b><br>
      ${answered} of ${all.length} questions answered
    </div>
    <table style="width:100%;border-collapse:collapse;margin:0 0 26px">${idRows}</table>`;

  inst.sections.forEach((sec, i) => {
    html += `<div style="font-family:${HEAD_FONT};font-size:16px;text-transform:uppercase;letter-spacing:.02em;color:${NAVY};margin:26px 0 4px">${i + 1}. ${esc(sec.title)}</div>
      <div style="height:2px;background:${BRASS};width:44px;margin:0 0 14px"></div>`;

    sec.questions.forEach((q) => {
      const rendered = renderAnswer(map[q.id], answers[q.id]);
      const extra = answers[q.id + '_other'] ? ` <i>(${esc(clip(answers[q.id + '_other'], MAX_FIELD))})</i>` : '';
      html += `<div style="margin:0 0 13px">
        <div style="font-size:12px;color:${MUTED};line-height:1.5">${q.n != null ? q.n + '. ' : ''}${esc(q.label)}</div>
        <div style="font-size:14px;color:${rendered ? INK : '#A6AEC2'};line-height:1.6;margin-top:3px">${rendered ? rendered + extra : '<i>Not answered</i>'}</div>
      </div>`;
    });
  });

  return { html, answered, total: all.length };
}

/* ── The copy that goes back to the organization rep ─────────────────────── */
function repCopyBody(inst, identity, answered, total) {
  return `
    <div style="font-size:15px;line-height:1.75;color:${INK}">
      <p style="margin:0 0 16px">Thank you — your <b>${esc(inst.name)}</b> has been received by the Driver Appreciation Solutions team.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
        <tr><td style="padding:7px 12px;background:#F5F7FB;font-weight:600;width:170px;font-size:13px">Organization</td><td style="padding:7px 12px;border-bottom:1px solid ${HAIR};font-size:13px">${esc(clip(identity.organization, MAX_FIELD))}</td></tr>
        <tr><td style="padding:7px 12px;background:#F5F7FB;font-weight:600;font-size:13px">Completed by</td><td style="padding:7px 12px;border-bottom:1px solid ${HAIR};font-size:13px">${esc(clip(identity.name, MAX_FIELD))}</td></tr>
        <tr><td style="padding:7px 12px;background:#F5F7FB;font-weight:600;font-size:13px">Answered</td><td style="padding:7px 12px;border-bottom:1px solid ${HAIR};font-size:13px">${answered} of ${total}</td></tr>
      </table>
      <p style="margin:0 0 8px;font-size:14px;color:${MUTED}">Your full responses are attached as a file for your records. A DAS representative will follow up with what the answers point to.</p>
    </div>`;
}

/* ── Best-effort archive. The email is the gate; this is the aggregation layer.
     A missing table or unset credentials must never cost us a response. ───── */
async function archive(payload) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const { getServiceClient } = require('./_supabase');
    const { error } = await getServiceClient().from('survey_responses').insert(payload);
    if (error) console.error('[Survey] Supabase insert failed (email still sent):', error.message);
  } catch (e) {
    console.error('[Survey] Supabase archive skipped:', e && e.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════ */
async function handleSurvey(req, res) {
  const b = req.body || {};
  const instrument = clip(b.instrument, 40);
  const inst = DEFS.get(instrument);

  if (!inst) return res.status(400).json({ error: 'Unknown survey.' });

  /* Access code — the real check. The browser step is only a door. */
  if (inst.gated) {
    const expected = (process.env.SURVEY_ACCESS_CODE || DEFAULT_CODE).trim().toLowerCase();
    const given = clip(b.accessCode, 100).toLowerCase();
    if (!given || given !== expected) {
      return res.status(403).json({ error: 'That access code is not valid. Check with your DAS representative.' });
    }
  }

  const identity = {
    organization: clip((b.identity || {}).organization, MAX_FIELD),
    name: clip((b.identity || {}).name, MAX_FIELD),
    title: clip((b.identity || {}).title, MAX_FIELD),
    terminal: clip((b.identity || {}).terminal, MAX_FIELD),
    email: clip((b.identity || {}).email, MAX_FIELD),
    phone: clip((b.identity || {}).phone, MAX_FIELD),
  };

  /* Organization is what routes the response, so it is always required.
     A driver's NAME is deliberately optional — see the plan doc. */
  if (!identity.organization) {
    return res.status(400).json({ error: 'Please tell us which organization this is for.' });
  }
  if (inst.audience === 'organization') {
    if (!identity.name) return res.status(400).json({ error: 'Please enter your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)) {
      return res.status(400).json({ error: 'Please enter a valid work email address.' });
    }
  }
  if (identity.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const answers = b.answers && typeof b.answers === 'object' && !Array.isArray(b.answers) ? b.answers : {};
  const { html: bodyHtml, answered, total } = buildBody(instrument, identity, answers);

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const FROM_ADDRESS = process.env.FROM_EMAIL || 'noreply@driverappreciationsolutions.com';
  const RECIPIENTS = (process.env.SURVEY_TO || DEFAULT_TO).split(',').map((s) => s.trim()).filter(Boolean);

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = (identity.organization || 'organization').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  const attachment = {
    filename: `${instrument}-${slug}-${stamp}.json`,
    content: Buffer.from(
      JSON.stringify({ instrument, instrumentName: inst.name, submittedAt: new Date().toISOString(), identity, answers }, null, 2)
    ).toString('base64'),
  };

  if (!RESEND_API_KEY) {
    // In production a missing key means the response is SILENTLY LOST. Never
    // report success — same doctrine as the contact form.
    const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    if (isProd) {
      console.error('[Survey] RESEND_API_KEY missing in production — response NOT delivered:', { instrument, org: identity.organization });
      return res.status(500).json({ error: 'We could not submit your responses right now. Please email info@driverappreciationsolutions.com.' });
    }
    console.log('[Survey] RESEND_API_KEY not set (dev) — would send:', { instrument, identity, answered, total });
    await archive({
      instrument, organization: identity.organization, respondent_name: identity.name || null,
      respondent_title: identity.title || null, respondent_email: identity.email || null,
      respondent_phone: identity.phone || null, answered_count: answered, question_count: total,
      answers,
    });
    return res.status(200).json({ ok: true, dev: true });
  }

  const subject = `[${inst.shortName}] ${identity.organization} — ${answered}/${total} answered`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Driver Appreciation Solutions <${FROM_ADDRESS}>`,
        to: RECIPIENTS,
        reply_to: identity.email || undefined,
        subject,
        html: brandShell({
          preheader: `${inst.name} — ${identity.organization}`,
          eyebrow: inst.eyebrow,
          title: inst.shortName,
          sub: `${esc(identity.organization)}${identity.name ? ' · ' + esc(identity.name) : ''}`,
          bodyRows: bodyHtml,
          footNote: 'Submitted from driverappreciationsolutions.com/surveys. Full responses attached as JSON.',
        }),
        attachments: [attachment],
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('[Survey][Resend Error]', resp.status, err);
      return res.status(500).json({ error: 'We could not submit your responses. Please try again, or email info@driverappreciationsolutions.com.' });
    }
  } catch (e) {
    console.error('[Survey] Network error:', e && e.message);
    return res.status(500).json({ error: 'Network error. Please try again.' });
  }

  /* Copy back to the organization rep — it is their artifact, and it is a
     follow-up hook. Best-effort: never fail the submission on it. */
  if (inst.audience === 'organization' && identity.email) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `Driver Appreciation Solutions <${FROM_ADDRESS}>`,
          to: [identity.email],
          reply_to: 'info@driverappreciationsolutions.com',
          subject: `Your ${inst.shortName} — copy of what you submitted`,
          html: brandShell({
            preheader: `Copy of your ${inst.shortName} responses`,
            eyebrow: 'Received',
            title: 'Thank you',
            sub: esc(inst.name),
            bodyRows: repCopyBody(inst, identity, answered, total),
            footNote: 'Questions? info@driverappreciationsolutions.com · 302.681.0995',
          }),
          attachments: [attachment],
        }),
      });
    } catch (e) {
      console.error('[Survey] Rep copy failed:', e && e.message);
    }
  }

  await archive({
    instrument,
    organization: identity.organization,
    respondent_name: identity.name || null,
    respondent_title: identity.title || null,
    respondent_email: identity.email || null,
    respondent_phone: identity.phone || null,
    answered_count: answered,
    question_count: total,
    answers,
  });

  return res.status(200).json({ ok: true, answered, total });
}

// buildBody/renderAnswer are exported for scripts/test-surveys.mjs — the email body
// is the actual deliverable here, so it has to be assertable without sending mail.
module.exports = { handleSurvey, buildBody, renderAnswer };
