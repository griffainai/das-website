/* ============================================================================
   THE AWARENESS CHECK — analysis of DAS survey submissions
   ----------------------------------------------------------------------------
   NOT a Vercel function (underscore prefix). Reached from api/_survey.js via
   api/contact.js, so the site stays under the 12-function cap.

   THE CENTRAL DESIGN DECISION
   The findings are COMPUTED IN CODE, not asked of the model. `readiness()` walks
   the answers and produces hard facts — "6 initiatives marked Commit, 1 of 6
   workstreams has a named owner, retroactive population unsized". Only then does
   a model turn those facts into prose.

   That ordering is the whole feature:
     • a computed gap cannot be hallucinated, so nothing false reaches a client
     • the rubric is DAS's OWN, published on page 4 of the 2027 Commitment Guide
       ("who qualifies, what happens, who owns it, what it costs, how completion
       will be verified — if one answer is missing, the initiative is not yet
       launch-ready"), so the verdict is their standard, not our opinion
     • it satisfies Jayden's constraint — "without destroying their company" —
       structurally. Facts drawn from their own answers do not insult anyone.

   TWO REGISTERS, ONE SET OF FACTS
     shaq   — blunt. Where the gap is, what it costs, where the opening is.
     client — same facts, framed as fixable, with a next step. NEVER auto-sent:
              it emails to Shaq as a draft for him to send. See _survey.js.

   NO PRODUCT PITCHING in either register (Jayden, 2026-08-30: "findings only,
   Shaq sells"). The knowledge block below deliberately carries the retention
   ECONOMICS and none of the product catalogue, so the model has nothing to sell.
   ========================================================================== */
'use strict';

const DEFS = require('../js/survey-defs.js');
const { callModel } = require('./_ai-guard.js');

const MODEL = process.env.ANALYSIS_MODEL || 'claude-sonnet-5';
const DRIVER_BATCH_MIN = Number(process.env.ANALYSIS_DRIVER_MIN || 5);

/* Retention economics and driver psychology, lifted from the same knowledge the
   site's advisor runs on (api/chat.js). Diagnostic facts only — no SKUs, no
   prices, nothing that lets the model turn an assessment into an ad. */
const KNOWLEDGE = `
DRIVER RETENTION ECONOMICS — use these numbers precisely, never invent others:
• Replacing one truck driver costs $12,799 (ATRI 2023) — recruiting, onboarding, training, lost productivity.
• Annual turnover: large carriers (1,000+ trucks) 90–94%; mid-size (100–999) 40–70%; small (<100) 25–45%.
• Drivers who feel recognised are 3× more likely to stay past year two.
• Formal recognition programs reduce turnover 20–30% (SHRM).
• The top reason drivers quit is feeling undervalued or disrespected — it beats pay in multiple surveys.
• Driver Appreciation Week participants see an average 18% year-over-year reduction in fall turnover.

WHAT DRIVERS ACTUALLY VALUE, IN ORDER:
1. Being seen as a person, not an operator.  2. Public recognition in front of peers and family.
3. Company pride — gear they will actually wear.  4. Safety milestones acknowledged formally.
5. Escalating tenure recognition.  6. Anything that reaches their family, not just their truck.

WHAT DESTROYS IT:
Generic "good job" emails · gift cards (drivers read them as lazy) · recognition only at annual
reviews · programs rushed into September · a milestone passing unacknowledged, which is a
resignation risk in itself.`;

/* ── small helpers ─────────────────────────────────────────────────────── */
const has = (v) => v != null && String(v).trim() !== '';
function label(instrument, id) {
  const q = DEFS.byId(instrument)[id];
  return q ? q.label : id;
}
function num(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

/* ══════════════════════════════════════════════════════════════════════════
   READINESS — the computed facts. No model involved.
   ══════════════════════════════════════════════════════════════════════════ */

/* The 2027 Commitment Guide scores itself. This walks their answers against the
   five things the guide demands of any initiative marked Commit. */
function commitmentReadiness(a) {
  const DECISIONS = ['c1','c2','c3','c4','c5','c6','c7','c8','c9','c10'];
  const committed = DECISIONS.filter((id) => a[id] === 'Commit');
  const exploring = DECISIONS.filter((id) => a[id] && a[id] !== 'Commit' && a[id] !== 'Defer');
  const deferred  = DECISIONS.filter((id) => a[id] === 'Defer');
  const undecided = DECISIONS.filter((id) => !has(a[id]));

  const WS = [['gov','Program governance'],['data','Driver data'],['award','Award measurement'],
              ['ful','Fulfillment'],['comms','Communications'],['rep','Reporting']];
  const ws = a.cw || {};
  const owned  = WS.filter(([k]) => ws[k] && has(ws[k].owner));
  const dated  = WS.filter(([k]) => ws[k] && has(ws[k].date));
  const orphan = WS.filter(([k]) => !ws[k] || !has(ws[k].owner));

  const census = a.cc || {};
  const censusRows = Object.keys(census).filter((r) => has(census[r].crossed));
  let eligible = 0;
  censusRows.forEach((r) => {
    const c = num(census[r].crossed) || 0;
    const g = num(census[r].recognized) || 0;
    eligible += Math.max(0, c - g);
  });

  const cl = a.cl || {};
  const leadership = ['r1','r2','r3','r4','r5'];
  const fullCommitments = leadership.filter((r) => cl[r] && has(cl[r].what) && has(cl[r].owner) && has(cl[r].date));
  const namedOnly = leadership.filter((r) => cl[r] && has(cl[r].what) && !(has(cl[r].owner) && has(cl[r].date)));

  const dataPull = Array.isArray(a.c14) ? a.c14 : [];
  const safeMilesDefined = has(a.c15);

  /* The guide's own five. Each is PASS only if their answers actually establish it. */
  const rubric = [
    { test: 'Who owns it',            pass: orphan.length === 0,
      detail: orphan.length ? `${orphan.length} of 6 workstreams have no named owner: ${orphan.map((w) => w[1]).join(', ')}` : 'all six workstreams have a named owner' },
    { test: 'Who qualifies',          pass: censusRows.length > 0,
      detail: censusRows.length ? `retroactive population sized across ${censusRows.length} milestone band(s); ${eligible} drivers eligible` : 'the retroactive census is empty — the eligible population is unknown' },
    { test: 'How it is verified',     pass: safeMilesDefined && dataPull.length > 0,
      detail: `${dataPull.length ? 'data available: ' + dataPull.join(', ') : 'no driver data fields confirmed as pullable'}; safe-mile definition ${safeMilesDefined ? 'stated' : 'NOT stated'}` },
    { test: 'When it launches',       pass: dated.length === WS.length,
      detail: `${dated.length} of 6 workstreams carry a target date` },
    { test: 'What leadership commits', pass: fullCommitments.length > 0,
      detail: fullCommitments.length ? `${fullCommitments.length} commitment(s) fully specified (what, owner, date)` : `${namedOnly.length} commitment(s) named with no owner or date` },
  ];

  return {
    kind: 'commitment',
    headline: `${committed.length} initiative(s) marked Commit, ${exploring.length} exploring/piloting, ${deferred.length} deferred, ${undecided.length} left blank.`,
    committed: committed.map((id) => label('commitment', id)),
    exploring: exploring.map((id) => `${label('commitment', id)} (${a[id]})`),
    deferred: deferred.map((id) => label('commitment', id)),
    rubric,
    failing: rubric.filter((r) => !r.pass).length,
    /* The line that does the work: a commitment with nobody behind it. */
    exposure: committed.length > 0 && orphan.length > 0
      ? `${committed.length} initiative(s) committed while ${orphan.length} of 6 workstreams have no owner.`
      : null,
  };
}

/* The 74-question assessment: the gap between the culture leadership says it
   wants and the machinery actually operating. */
function assessmentReadiness(a) {
  const RATINGS = [
    ['a14','consistency of the driver experience across locations'],
    ['a15','visibility of senior leadership to drivers'],
    ['a17','how well recognition reflects the culture leadership wants'],
    ['a18','leadership’s own rating of the current program'],
    ['a35','whether managers can explain how recognition is earned'],
    ['a44','how well rewards reflect differences between drivers'],
    ['a49','whether recognition feels fair and attainable'],
    ['a55','whether leadership can see who was recognised and why'],
    ['a56','consistency of rules and approvals across managers'],
  ];
  const scored = RATINGS.filter(([id]) => has(a[id])).map(([id, what]) => ({ id, what, score: num(a[id]) }));
  const weak = scored.filter((r) => r.score != null && r.score <= 4);
  const strong = scored.filter((r) => r.score != null && r.score >= 8);

  const flags = [];
  if (a.a16 && ['Rarely','Annually'].indexOf(a.a16) > -1) flags.push(`Positive feedback unrelated to a problem reaches drivers only ${String(a.a16).toLowerCase()}.`);
  if (a.a21 && ['No','Varies by location'].indexOf(a.a21) > -1) flags.push(`Onboarding gift is "${a.a21}" — a new driver's first day is not standardised.`);
  if (a.a28 && ['Often','Very often'].indexOf(a.a28) > -1) flags.push(`Late orders or missing sizes weaken the recognition moment "${String(a.a28).toLowerCase()}".`);
  if (a.a33 && ['Annually','Not consistently'].indexOf(a.a33) > -1) flags.push(`Positive safety performance is recognised "${a.a33}".`);
  if (a.a34 === 'Lagging outcomes') flags.push('Incentives are based on lagging outcomes, so they reward luck as much as behaviour.');
  if (a.a43 === 'Company selects') flags.push('The company selects one item for everyone — no driver choice.');
  if (a.a53 === 'Yes') flags.push('The organisation warehouses branded merchandise, carrying obsolescence risk.');
  if (a.a54 && ['Often','Sometimes'].indexOf(a.a54) > -1) flags.push(`Branded inventory goes obsolete "${String(a.a54).toLowerCase()}".`);

  const fleet = num(a.a1);
  const leavers = num(a.a7);
  const turnoverCost = fleet && leavers ? leavers * 12799 : null;

  return {
    kind: 'assessment',
    headline: `${scored.length} of 9 leadership ratings answered; ${weak.length} scored 4 or below.`,
    fleetSize: fleet,
    annualLeavers: leavers,
    turnoverCost,
    weak: weak.map((r) => `${r.score}/10 — ${r.what}`),
    strong: strong.map((r) => `${r.score}/10 — ${r.what}`),
    flags,
    priority: a.a19 || null,
    successMetric: a.a41 || null,
    urgency: a.a59 || null,
    timing: a.a66 || null,
    blockers: a.a67 || null,
  };
}

/* The driver survey, analysed as a SET. One driver's 27 answers is a bad week;
   five is a pattern. */
function driverReadiness(rows) {
  const answers = rows.map((r) => r.answers || {});
  const n = answers.length;
  const mean = (id) => {
    const vals = answers.map((a) => num(a[id])).filter((v) => v != null);
    return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10 : null;
  };
  const pct = (id, set) => {
    const vals = answers.map((a) => a[id]).filter(has);
    if (!vals.length) return null;
    return Math.round((vals.filter((v) => set.indexOf(v) > -1).length / vals.length) * 100);
  };
  const verbatims = [];
  ['d25','d26','d27'].forEach((id) => {
    answers.forEach((a) => { if (has(a[id])) verbatims.push({ q: label('driver', id), text: String(a[id]).slice(0, 400) }); });
  });

  return {
    kind: 'driver',
    n,
    headline: `${n} driver responses.`,
    scores: {
      overallExperience: mean('d3'),
      wouldRecommend: mean('d4'),
      feelValued: mean('d5'),
      giftsMeaningful: mean('d10'),
      currentEffortsOverall: mean('d24'),
      wouldParticipate: mean('d22'),
    },
    rarelyRecognised: pct('d6', ['Never', 'Rarely']),
    recognitionUnfair: pct('d7', ['Strongly disagree', 'Disagree']),
    stayIfRecognised: pct('d23', ['Probably yes', 'Yes']),
    wantsYearRound: pct('d16', ['Probably yes', 'Yes']),
    wantsChoice: mean('d17'),
    deliveryPreference: (() => {
      const tally = {};
      answers.forEach((a) => { if (has(a.d20)) tally[a.d20] = (tally[a.d20] || 0) + 1; });
      return tally;
    })(),
    verbatims: verbatims.slice(0, 24),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   PROMPTING — the model writes prose ABOUT facts it is handed. It is told, in
   as many words, that it may not introduce findings of its own.
   ══════════════════════════════════════════════════════════════════════════ */
function systemPrompt() {
  return `You are the analyst behind Driver Appreciation Solutions' Awareness Check. You read a fleet's own answers and tell them, plainly, how ready they actually are.

${KNOWLEDGE}

HOW YOU WORK — these are absolute:
1. You are given COMPUTED FACTS drawn from the respondent's own answers. Every finding you state must trace to one of them. You may interpret and prioritise; you may NOT invent a finding, a number, or a quote.
2. If a fact is absent, say the data is missing. Never fill a gap with a plausible guess.
3. You never recommend a product, a kit, a price, or a purchase. This is a diagnostic, not a proposal. A named recommendation would make the whole thing read as an advertisement and destroy its credibility.
4. Never name or identify an individual driver. Driver comments are given to you anonymously and must stay that way — a leader who can guess who said something has been handed a weapon.
5. Use the retention economics above only where the respondent's own numbers make them relevant.

YOU WRITE TWO VERSIONS OF THE SAME TRUTH.

===SHAQ===
For the DAS representative only. Blunt and commercial. What the gap actually is, what it is costing them in dollars where their numbers support it, which single thing to raise first in the next conversation, and the one question that will make the decision-maker uncomfortable in a useful way. No hedging. 200 words maximum.

===CLIENT===
For the fleet's leadership. Same facts, no softening of the substance — but every gap framed as a decision still available to them, with a concrete next step they can take without buying anything. Respectful of the fact that they are trying. Never say they are failing, behind, or bad; say what is not yet in place and what putting it in place looks like. Open with the one thing they are doing WELL, drawn from the facts. 350 words maximum.

Output EXACTLY those two blocks with those exact delimiters, nothing before or after.`;
}

function factsBlock(facts, identity) {
  const lines = [`ORGANIZATION: ${identity.organization || 'not given'}`];
  if (identity.name) lines.push(`COMPLETED BY: ${identity.name}${identity.title ? ', ' + identity.title : ''}`);
  lines.push('');

  if (facts.kind === 'commitment') {
    lines.push('INSTRUMENT: 2027 Driver Recognition Commitment Guide (a leadership decision worksheet).');
    lines.push(facts.headline, '');
    if (facts.committed.length) lines.push('COMMITTED TO:\n- ' + facts.committed.join('\n- '));
    if (facts.exploring.length) lines.push('EXPLORING / PILOTING:\n- ' + facts.exploring.join('\n- '));
    if (facts.deferred.length) lines.push('DEFERRED:\n- ' + facts.deferred.join('\n- '));
    lines.push('', "READINESS AGAINST DAS'S OWN PUBLISHED TEST (guide, page 4 — if one answer is missing, the initiative is not launch-ready):");
    facts.rubric.forEach((r) => lines.push(`- ${r.test}: ${r.pass ? 'ESTABLISHED' : 'NOT ESTABLISHED'} — ${r.detail}`));
    if (facts.exposure) lines.push('', 'THE CENTRAL EXPOSURE: ' + facts.exposure);
  }

  if (facts.kind === 'assessment') {
    lines.push('INSTRUMENT: Driver Experience & Recognition Assessment (74 questions, completed by the organisation).');
    lines.push(facts.headline, '');
    if (facts.fleetSize) lines.push(`FLEET: ${facts.fleetSize} drivers.`);
    if (facts.annualLeavers) lines.push(`DRIVERS LEAVING PER YEAR: ${facts.annualLeavers}.`);
    if (facts.turnoverCost) lines.push(`IMPLIED ANNUAL TURNOVER COST at the ATRI figure: $${facts.turnoverCost.toLocaleString()}.`);
    if (facts.strong.length) lines.push('', 'RATED STRONG BY THEIR OWN LEADERSHIP:\n- ' + facts.strong.join('\n- '));
    if (facts.weak.length) lines.push('', 'RATED WEAK BY THEIR OWN LEADERSHIP:\n- ' + facts.weak.join('\n- '));
    if (facts.flags.length) lines.push('', 'OPERATIONAL FLAGS FROM THEIR ANSWERS:\n- ' + facts.flags.join('\n- '));
    if (facts.priority) lines.push('', 'THEIR STATED PRIORITY: ' + facts.priority);
    if (facts.successMetric) lines.push('WHAT THEY WOULD CALL SUCCESS: ' + facts.successMetric);
    if (facts.urgency) lines.push('WHY NOW: ' + facts.urgency);
    if (facts.timing) lines.push('REALISTIC TIMING: ' + facts.timing);
    if (facts.blockers) lines.push('WHAT COULD BLOCK APPROVAL: ' + facts.blockers);
  }

  if (facts.kind === 'driver') {
    lines.push(`INSTRUMENT: Driver Feedback Survey, aggregated across ${facts.n} anonymous driver responses.`);
    lines.push('');
    lines.push('AVERAGE SCORES (1–5):');
    Object.keys(facts.scores).forEach((k) => { if (facts.scores[k] != null) lines.push(`- ${k}: ${facts.scores[k]}`); });
    lines.push('');
    if (facts.rarelyRecognised != null) lines.push(`- ${facts.rarelyRecognised}% say a manager recognises them never or rarely.`);
    if (facts.recognitionUnfair != null) lines.push(`- ${facts.recognitionUnfair}% disagree that recognition is applied fairly.`);
    if (facts.stayIfRecognised != null) lines.push(`- ${facts.stayIfRecognised}% say stronger recognition would make them more likely to stay.`);
    if (facts.wantsYearRound != null) lines.push(`- ${facts.wantsYearRound}% want rewards year-round rather than only at annual events.`);
    if (facts.wantsChoice != null) lines.push(`- Importance of choosing their own reward: ${facts.wantsChoice}/5.`);
    lines.push(`- Delivery preference tally: ${JSON.stringify(facts.deliveryPreference)}`);
    if (facts.verbatims.length) {
      lines.push('', 'ANONYMOUS DRIVER COMMENTS (never attribute these to a person):');
      facts.verbatims.forEach((v) => lines.push(`- [${v.q}] "${v.text}"`));
    }
  }

  return lines.join('\n');
}

function splitRegisters(text) {
  const m = /===SHAQ===([\s\S]*?)===CLIENT===([\s\S]*)$/.exec(text || '');
  if (!m) return null;
  const shaq = m[1].trim();
  const client = m[2].trim();
  return shaq && client ? { shaq, client } : null;
}

/**
 * Produce the two registers. Returns null on any failure — a missing analysis
 * must never cost us the response itself, and half-parsed model output must
 * never be presented as a client-ready document.
 */
async function analyze({ instrument, identity, facts }) {
  const res = await callModel({
    model: MODEL,
    max_tokens: 1600,
    system: systemPrompt(),
    messages: [{ role: 'user', content: factsBlock(facts, identity) }],
  }, { feature: 'awareness-check', trust: 'public' });

  if (!res.ok) {
    console.error('[Analysis] model call refused or failed:', res.reason);
    return null;
  }
  const split = splitRegisters(res.text);
  if (!split) {
    // Never guess at which half is which. Log it and fall back to no analysis.
    console.error('[Analysis] could not split registers; output discarded. First 200:', (res.text || '').slice(0, 200));
    return null;
  }
  return split;
}

module.exports = {
  analyze,
  commitmentReadiness,
  assessmentReadiness,
  driverReadiness,
  factsBlock,
  splitRegisters,
  systemPrompt,
  DRIVER_BATCH_MIN,
  MODEL,
};
