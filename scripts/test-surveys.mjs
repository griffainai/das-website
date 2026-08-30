/* ============================================================================
   Survey system checks —  node scripts/test-surveys.mjs
   ----------------------------------------------------------------------------
   Lives in scripts/ (NOT api/) and is .vercelignore'd, per the guard-wall rule:
   anything in api/ becomes a public endpoint that runs on every cold start.

   Sends no email and writes no rows — the handler is driven with RESEND_API_KEY
   unset and NODE_ENV unset, which is its documented dev path.
   ========================================================================== */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const DEFS = require('../js/survey-defs.js');
const { handleSurvey, buildBody } = require('../api/_survey.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}
function eq(name, actual, expected) {
  ok(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

/* ── fake req/res ───────────────────────────────────────────────────────── */
function mock(body) {
  const res = { statusCode: null, payload: null, headers: {} };
  return [
    { method: 'POST', body, headers: {}, socket: { remoteAddress: '10.0.0.1' } },
    {
      status(c) { res.statusCode = c; return this; },
      json(p) { res.payload = p; return this; },
      setHeader(k, v) { res.headers[k] = v; },
      end() { return this; },
    },
    res,
  ];
}

console.log('\n1. DEFINITION INTEGRITY');
eq('driver has 27 questions', DEFS.questions('driver').length, 27);
eq('assessment has 74 questions', DEFS.questions('assessment').length, 74);
ok('commitment has questions', DEFS.questions('commitment').length > 0);

for (const key of DEFS.order) {
  const qs = DEFS.questions(key);
  const ids = qs.map((q) => q.id);
  ok(`${key}: ids are unique`, new Set(ids).size === ids.length,
    'dupes: ' + ids.filter((v, i) => ids.indexOf(v) !== i).join(','));

  const badChoice = qs.filter((q) => (q.type === 'choice' || q.type === 'multi') && (!q.options || !q.options.length));
  ok(`${key}: every choice/multi has options`, badChoice.length === 0, badChoice.map((q) => q.id).join(','));

  const badScale = qs.filter((q) => q.type === 'scale' && (q.min == null || q.max == null || !q.low || !q.high));
  ok(`${key}: every scale has bounds and both anchor words`, badScale.length === 0, badScale.map((q) => q.id).join(','));

  const badMatrix = qs.filter((q) => q.type === 'matrix' && (!q.rows?.length || !q.cols?.length));
  ok(`${key}: every matrix has rows and cols`, badMatrix.length === 0, badMatrix.map((q) => q.id).join(','));

  const noLabel = qs.filter((q) => !q.label || !q.label.trim());
  ok(`${key}: every question has label text`, noLabel.length === 0, noLabel.map((q) => q.id).join(','));

  const known = ['scale', 'choice', 'multi', 'text', 'short', 'number', 'matrix'];
  const badType = qs.filter((q) => known.indexOf(q.type) === -1);
  ok(`${key}: no unknown question types`, badType.length === 0, badType.map((q) => q.id + ':' + q.type).join(','));

  ok(`${key}: byId resolves every question`, ids.every((id) => !!DEFS.byId(key)[id]));
}

console.log('\n2. ACCESS CODE GATE');
{
  const [req, res, out] = mock({ instrument: 'assessment', identity: { organization: 'X', name: 'Y', email: 'y@z.com' }, answers: {} });
  await handleSurvey(req, res);
  eq('gated instrument without a code → 403', out.statusCode, 403);
}
{
  const [req, res, out] = mock({ instrument: 'assessment', accessCode: 'wrong-code', identity: { organization: 'X', name: 'Y', email: 'y@z.com' }, answers: {} });
  await handleSurvey(req, res);
  eq('gated instrument with a wrong code → 403', out.statusCode, 403);
}
{
  const [req, res, out] = mock({ instrument: 'assessment', accessCode: ' das2027 ', identity: { organization: 'X', name: 'Y', email: 'y@z.com' }, answers: {} });
  await handleSurvey(req, res);
  eq('correct code, case/space insensitive → 200', out.statusCode, 200);
}
{
  const [req, res, out] = mock({ instrument: 'driver', identity: { organization: 'X' }, answers: {} });
  await handleSurvey(req, res);
  eq('driver survey needs NO code → 200', out.statusCode, 200);
}
{
  const [req, res, out] = mock({ instrument: 'nope', identity: { organization: 'X' }, answers: {} });
  await handleSurvey(req, res);
  eq('unknown instrument → 400', out.statusCode, 400);
}

console.log('\n3. IDENTITY RULES');
{
  const [req, res, out] = mock({ instrument: 'driver', identity: { name: 'Anon' }, answers: {} });
  await handleSurvey(req, res);
  eq('driver without organization → 400', out.statusCode, 400);
}
{
  const [req, res, out] = mock({ instrument: 'driver', identity: { organization: 'Midwest Carriers' }, answers: { d1: '1–3 years' } });
  await handleSurvey(req, res);
  eq('driver WITHOUT a name is accepted (anonymity by design) → 200', out.statusCode, 200);
}
{
  const [req, res, out] = mock({ instrument: 'assessment', accessCode: 'DAS2027', identity: { organization: 'X', name: 'Y', email: 'not-an-email' }, answers: {} });
  await handleSurvey(req, res);
  eq('company rep with a bad email → 400', out.statusCode, 400);
}
{
  const [req, res, out] = mock({ instrument: 'assessment', accessCode: 'DAS2027', identity: { organization: 'X', email: 'y@z.com' }, answers: {} });
  await handleSurvey(req, res);
  eq('company rep without a name → 400', out.statusCode, 400);
}

console.log('\n4. EMAIL BODY RENDERING');
{
  const answers = {
    d1: '4–7 years',
    d3: '2',
    d7: 'Strongly disagree',
    d11: 'Not applicable',
    d25: 'They remember birthdays. <script>alert(1)</script>',
  };
  const { html, answered, total } = buildBody('driver', { organization: 'Midwest Carriers' }, answers);
  eq('answered count is right', answered, 5);
  eq('total is right', total, 27);
  ok('question text appears in the email', html.includes('How valued do you currently feel by the organization?'));
  ok('a selected answer appears', html.includes('4–7 years'));
  ok('the scale "extra" answer survives', html.includes('Not applicable'));
  ok('blanks are marked, not dropped', html.includes('Not answered'));
  ok('free text is HTML-escaped', html.includes('&lt;script&gt;') && !html.includes('<script>alert'));
  ok('organization is in the body', html.includes('Midwest Carriers'));
}
{
  // The retroactive census: eligible must be derived server-side, because it is a
  // computed column on screen and is never posted.
  const answers = {
    cc: { m250: { crossed: '40', recognized: '15' }, m1: { crossed: '6', recognized: '0' } },
    c1: 'Commit',
  };
  const { html } = buildBody('commitment', { organization: 'Acme', name: 'Dana' }, answers);
  ok('census row label renders', html.includes('250,000 safe miles'));
  ok('eligible is recomputed for the email (40 - 15 = 25)', html.includes('Eligible:</b> 25'));
  ok('second census row recomputes (6 - 0 = 6)', html.includes('Eligible:</b> 6'));
  ok('a Commit decision renders', html.includes('Commit'));
}
{
  const answers = { a3: ['Local', 'Regional'], a10: ['Safety'], a10_other: 'Terminal ops council' };
  const { html } = buildBody('assessment', { organization: 'Acme', name: 'Dana' }, answers);
  ok('multi-select joins values', html.includes('Local · Regional'));
  ok('the "other" free text is attached to its question', html.includes('Terminal ops council'));
}

/* ══════════════════════════════════════════════════════════════════════════
   THE AWARENESS CHECK
   The findings are computed in code precisely so they cannot be hallucinated.
   That guarantee is worth nothing unless the computation itself is tested.
   ══════════════════════════════════════════════════════════════════════════ */
const A = require('../api/_analysis.js');
const { handleAnalysis } = require('../api/_survey.js');

console.log('\n5. COMMITMENT READINESS (the guide scores itself)');
{
  // Six things committed, nobody behind any of them — the case the feature exists for.
  const r = A.commitmentReadiness({
    c1: 'Commit', c2: 'Commit', c4: 'Commit', c5: 'Commit', c8: 'Commit', c9: 'Commit',
    c3: 'Pilot', c10: 'Defer',
  });
  eq('counts the commitments', r.committed.length, 6);
  eq('counts what is only being explored', r.exploring.length, 1);
  eq('counts deferrals', r.deferred.length, 1);
  ok('names the initiatives, not their ids', r.committed[0].includes('Driver of the Year'));
  ok('states the central exposure', /6 initiative\(s\) committed while 6 of 6 workstreams have no owner/.test(r.exposure || ''), r.exposure);
  eq('every rubric item fails on an unstaffed worksheet', r.failing, 5);
}
{
  const rows = {};
  ['gov', 'data', 'award', 'ful', 'comms', 'rep'].forEach((k) => { rows[k] = { owner: 'J. Alvarez', date: '2026-11-15' }; });
  const r = A.commitmentReadiness({
    c1: 'Commit',
    cw: rows,
    cc: { m250: { crossed: '40', recognized: '15' }, m1: { crossed: '6', recognized: '1' } },
    cl: { r1: { what: 'Driver of the Year', owner: 'Dana', date: '2027-01-01' } },
    c14: ['Driver name', 'Hire date', 'Verified safe miles'],
    c15: 'Company-safe miles from telematics, excluding personal conveyance.',
  });
  eq('a fully staffed worksheet passes every test', r.failing, 0);
  ok('no exposure line when every workstream is owned', r.exposure === null);
  ok('eligible population computed from their numbers (25 + 5)', r.rubric[1].detail.includes('30 drivers eligible'), r.rubric[1].detail);
}

console.log('\n6. ASSESSMENT READINESS');
{
  const r = A.assessmentReadiness({
    a1: '250', a7: '110',
    a14: '3', a15: '9', a17: '2', a18: '4', a35: '8',
    a16: 'Rarely', a21: 'No', a28: 'Often', a34: 'Lagging outcomes', a43: 'Company selects',
    a19: 'Retention, because we are bleeding second-year drivers.',
  });
  eq('turnover cost uses the ATRI figure', r.turnoverCost, 110 * 12799);
  eq('surfaces every rating of 4 or below', r.weak.length, 3);
  eq('surfaces what their own leadership rates strong', r.strong.length, 2);
  ok('flags an unstandardised first day', r.flags.some((f) => f.includes('not standardised')), r.flags.join(' | '));
  ok('flags lagging-outcome incentives', r.flags.some((f) => f.includes('lagging outcomes')));
  ok('carries their stated priority through', (r.priority || '').includes('bleeding second-year'));
}

console.log('\n7. DRIVER BATCH (a set, not one bad week)');
{
  const rows = [
    { answers: { d3: '2', d5: '1', d6: 'Never',     d23: 'Yes',          d25: 'They remember birthdays.' } },
    { answers: { d3: '3', d5: '2', d6: 'Rarely',    d23: 'Probably yes', d26: 'Pay attention to milestones.' } },
    { answers: { d3: '2', d5: '2', d6: 'Sometimes', d23: 'Yes' } },
    { answers: { d3: '4', d5: '3', d6: 'Never',     d23: 'Unsure' } },
    { answers: { d3: '4', d5: '2', d6: 'Often',     d23: 'Yes' } },
  ];
  const r = A.driverReadiness(rows);
  eq('counts the set', r.n, 5);
  eq('averages the experience score', r.scores.overallExperience, 3);
  eq('averages how valued they feel', r.scores.feelValued, 2);
  eq('percentage never or rarely recognised', r.rarelyRecognised, 60);
  eq('percentage who would stay for better recognition', r.stayIfRecognised, 80);
  eq('collects the written comments', r.verbatims.length, 2);
}

console.log('\n8. PROMPT SAFETY');
{
  const facts = A.commitmentReadiness({ c1: 'Commit' });
  const block = A.factsBlock(facts, { organization: 'Acme Freight', name: 'Dana' });
  ok('the facts block carries the organisation', block.includes('Acme Freight'));
  ok('it cites the guide own page-4 test', block.includes('page 4'));
  ok('it marks what is NOT established', block.includes('NOT ESTABLISHED'));

  const sys = A.systemPrompt();
  ok('the model is forbidden from inventing findings', /may NOT invent a finding/.test(sys));
  ok('the model is forbidden from recommending a product', /never recommend a product/.test(sys));
  ok('driver anonymity is enforced in the prompt', /Never name or identify an individual driver/.test(sys));
  ok('no SKU or price can leak into either register', !/\$249|\$499|\$59\.99|Onboarding Pack/.test(sys));
  ok('retention economics ARE available to reason with', sys.includes('12,799'));
}

console.log('\n9. REGISTER SPLIT (never present half-parsed output as client-ready)');
{
  const good = A.splitRegisters('===SHAQ===\nBlunt read.\n===CLIENT===\nDiplomatic read.');
  eq('splits the blunt register', good.shaq, 'Blunt read.');
  eq('splits the client register', good.client, 'Diplomatic read.');
  ok('malformed output is discarded, not guessed at', A.splitRegisters('just some prose') === null);
  ok('a missing client block is discarded', A.splitRegisters('===SHAQ===\nonly one half') === null);
}

console.log('\n10. ANALYSIS ENDPOINT');
{
  const [req, res, out] = mock({ instrument: 'commitment', accessCode: 'nope', identity: { organization: 'X' }, answers: {} });
  await handleAnalysis(req, res);
  eq('gated instrument still needs the code', out.statusCode, 403);
}
{
  const [req, res, out] = mock({ instrument: 'driver', identity: {}, answers: {} });
  await handleAnalysis(req, res);
  eq('organisation is still required', out.statusCode, 400);
}
{
  // Supabase is unconfigured here, so the roster reads empty and the batch must hold.
  const [req, res, out] = mock({ instrument: 'driver', identity: { organization: 'Midwest Carriers' }, answers: {} });
  await handleAnalysis(req, res);
  eq('driver batch holds below the threshold', out.statusCode, 200);
  ok('and says pending rather than analysing one response', out.payload && out.payload.pending === true, JSON.stringify(out.payload));
  eq('reporting the threshold it needs', out.payload.need, 5);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exitCode = fail ? 1 : 0;
