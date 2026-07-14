/* =============================================
   Tests for api/calculator-submit.js (handler-level, no live server).
   Run: node --test test/calculator-submit.test.js

   Supabase env is intentionally unset here, so the handler runs in dev mode:
   it computes + returns the result but performs no network I/O. That lets us
   prove the endpoint's server-side math is IDENTICAL to the engine, and that
   input sanitization / guards behave, without any external dependency.
   ============================================= */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const handler = require('../api/calculator-submit.js');
const Calc = require('../lib/fleet-calculators.js');

// Minimal Vercel-style res mock.
function mockRes() {
  return {
    statusCode: null, headers: {}, body: undefined, ended: false,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    end() { this.ended = true; return this; },
  };
}
async function call(req) {
  const res = mockRes();
  await handler({ headers: {}, ...req }, res);
  return res;
}

test('OPTIONS preflight → 204', async () => {
  const res = await call({ method: 'OPTIONS' });
  assert.equal(res.statusCode, 204);
  assert.ok(res.ended);
});

test('GET → 405 method not allowed', async () => {
  const res = await call({ method: 'GET' });
  assert.equal(res.statusCode, 405);
});

test('unknown calculator → 400', async () => {
  const res = await call({ method: 'POST', body: { calculator: 'bogus', inputs: {} } });
  assert.equal(res.statusCode, 400);
});

test('turnover submission returns result identical to the engine', async () => {
  const inputs = { fleetSize: 120, turnoverPct: 85, replacementCostPerDriver: 13000 };
  const res = await call({ method: 'POST', body: { calculator: 'turnover', inputs } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.result, Calc.turnoverCost(inputs), 'endpoint === engine');
});

test('recognition submission matches engine and echoes sanitized inputs', async () => {
  const inputs = { fleetSize: 300, turnoverPct: 92, replacementCostPerDriver: 11500, recognitionSpendPerDriver: 80, turnoverReductionPct: 25 };
  const res = await call({ method: 'POST', body: { calculator: 'recognition', inputs } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.result, Calc.recognitionROI(inputs));
  assert.deepEqual(res.body.inputs, inputs);
});

test('safety submission matches engine', async () => {
  const inputs = { fleetSize: 200, crashesPerYear: 12, avgCrashCost: 91000, incidentReductionPct: 15, recognitionSpendPerDriver: 60 };
  const res = await call({ method: 'POST', body: { calculator: 'safety', inputs } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.result, Calc.safetySavings(inputs));
});

test('sanitizes: drops unknown fields, coerces numeric strings, ignores garbage', async () => {
  const res = await call({ method: 'POST', body: {
    calculator: 'turnover',
    inputs: { fleetSize: '150', turnoverPct: '90', replacementCostPerDriver: 12000, evil: 'DROP TABLE', extra: 999 }
  }});
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.inputs, { fleetSize: 150, turnoverPct: 90, replacementCostPerDriver: 12000 });
  assert.ok(!('evil' in res.body.inputs) && !('extra' in res.body.inputs), 'unknown keys stripped');
  assert.deepEqual(res.body.result, Calc.turnoverCost({ fleetSize: 150, turnoverPct: 90, replacementCostPerDriver: 12000 }));
});

test('empty inputs fall back to benchmark defaults (still 200)', async () => {
  const res = await call({ method: 'POST', body: { calculator: 'recognition', inputs: {} } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.result, Calc.recognitionROI({}));
});

test('malformed email is ignored but submission still succeeds', async () => {
  const res = await call({ method: 'POST', body: { calculator: 'turnover', inputs: { fleetSize: 10 }, email: 'not-an-email' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
});
