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

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exitCode = fail ? 1 : 0;
