/* =============================================
   Tests for lib/fleet-calculators.js
   Run: node --test test/fleet-calculators.test.js
   Zero dependencies — Node built-in test runner + assert.

   Coverage philosophy ("match equation always working"):
     - Exact expected-value tests pin the formulas to known numbers.
     - Invariant / conservation tests assert the identities that MUST hold for
       any input (e.g. improvedCost + savings === baselineCost).
     - Property tests replay hundreds of seeded-random inputs against those
       invariants, so the math is proven across the whole input space, not just
       hand-picked cases. The PRNG is seeded → the suite is deterministic.
     - Edge + coercion tests prove no input can yield NaN/Infinity where a finite
       number is required.
   ============================================= */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const C = require('../lib/fleet-calculators.js');

// ─── helpers ──────────────────────────────────────────────────────────────────
function approx(a, b, msg) {
  const tol = 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  assert.ok(Math.abs(a - b) <= tol, (msg || 'approx') + `: ${a} !== ${b} (tol ${tol})`);
}
function finitePositive(x, msg) {
  assert.ok(Number.isFinite(x), (msg || 'value') + ` should be finite, got ${x}`);
  assert.ok(x >= 0, (msg || 'value') + ` should be >= 0, got ${x}`);
}
// Seeded PRNG (mulberry32) → deterministic property tests.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randIn = (r, lo, hi) => lo + r() * (hi - lo);

// ─── engine sanity ──────────────────────────────────────────────────────────
test('engine exposes version, benchmarks, calculators', () => {
  assert.equal(typeof C.VERSION, 'string');
  assert.ok(C.BENCHMARKS.replacementCostPerDriver.default > 0);
  assert.equal(typeof C.turnoverCost, 'function');
  assert.equal(typeof C.recognitionROI, 'function');
  assert.equal(typeof C.safetySavings, 'function');
});

test('benchmark defaults match researched figures', () => {
  assert.equal(C.BENCHMARKS.industryTurnoverPct, 89);            // ATA/ATRI OTR
  assert.equal(C.BENCHMARKS.crashCost.average, 91000);          // FMCSA
  assert.equal(C.BENCHMARKS.crashCost.fatal, 3600000);         // FMCSA
  assert.equal(C.BENCHMARKS.replacementCostPerDriver.low, 8000);
  assert.equal(C.BENCHMARKS.replacementCostPerDriver.high, 15000);
});

// ─── helpers unit ─────────────────────────────────────────────────────────────
test('num() coerces bad input to floor', () => {
  assert.equal(C.num(5), 5);
  assert.equal(C.num(-3), 0);
  assert.equal(C.num('abc'), 0);
  assert.equal(C.num(NaN), 0);
  assert.equal(C.num(Infinity), 0);
  assert.equal(C.num(undefined), 0);
  assert.equal(C.num(-3, -10), -3);
  assert.equal(C.num('12.5'), 12.5);
});
test('clamp() bounds correctly', () => {
  assert.equal(C.clamp(150, 0, 100), 100);
  assert.equal(C.clamp(-5, 0, 100), 0);
  assert.equal(C.clamp(50, 0, 100), 50);
  assert.equal(C.clamp(NaN, 0, 100), 0);
});
test('pctToFraction() and round2()', () => {
  approx(C.pctToFraction(89), 0.89);
  approx(C.pctToFraction(120), 1.2);
  assert.equal(C.round2(10.005), 10.01);
  assert.equal(C.round2(1080000), 1080000);
  assert.equal(C.formatUSD(1080000), '$1,080,000.00');
});

// ─── 1) turnoverCost — exact ────────────────────────────────────────────────
test('turnoverCost exact: 100 drivers @ 90% @ $12k', () => {
  const r = C.turnoverCost({ fleetSize: 100, turnoverPct: 90, replacementCostPerDriver: 12000 });
  approx(r.driversLostPerYear, 90);
  approx(r.annualTurnoverCost, 1080000);
  approx(r.costPerTruck, 10800);
  approx(r.monthlyTurnoverCost, 90000);
  approx(r.turnoverRate, 0.9);
});
test('turnoverCost applies benchmark defaults when omitted', () => {
  const r = C.turnoverCost({ fleetSize: 50 });
  approx(r.turnoverRate, 0.89);
  approx(r.replacementCostPerDriver, 12000);
  approx(r.annualTurnoverCost, 50 * 0.89 * 12000);
});
test('turnoverCost edge: zero fleet and zero turnover produce no NaN', () => {
  const z = C.turnoverCost({ fleetSize: 0, turnoverPct: 90 });
  approx(z.annualTurnoverCost, 0);
  approx(z.costPerTruck, 0);
  finitePositive(z.costPerTruck, 'costPerTruck');
  const t0 = C.turnoverCost({ fleetSize: 100, turnoverPct: 0 });
  approx(t0.annualTurnoverCost, 0);
});
test('turnoverCost allows turnover above 100% (trucking reality)', () => {
  const r = C.turnoverCost({ fleetSize: 200, turnoverPct: 120, replacementCostPerDriver: 10000 });
  approx(r.turnoverRate, 1.2);
  approx(r.driversLostPerYear, 240);
  approx(r.annualTurnoverCost, 2400000);
});
test('turnoverCost coerces garbage inputs', () => {
  const r = C.turnoverCost({ fleetSize: -50, turnoverPct: 'x', replacementCostPerDriver: NaN });
  finitePositive(r.annualTurnoverCost, 'cost');
  approx(r.fleetSize, 0);
});

// ─── 1) turnoverCost — invariants over random inputs ────────────────────────
test('turnoverCost invariants hold across 500 random fleets', () => {
  const r = rng(101);
  for (let i = 0; i < 500; i++) {
    const fleet = Math.floor(randIn(r, 0, 5000));
    const pct = randIn(r, 0, 200);
    const repl = randIn(r, 1000, 30000);
    const res = C.turnoverCost({ fleetSize: fleet, turnoverPct: pct, replacementCostPerDriver: repl });
    // core equation
    approx(res.annualTurnoverCost, fleet * (pct / 100) * repl, 'cost=fleet*rate*repl');
    // round-trip: per-truck × fleet reconstructs total
    if (fleet > 0) approx(res.costPerTruck * fleet, res.annualTurnoverCost, 'perTruck*fleet');
    approx(res.monthlyTurnoverCost * 12, res.annualTurnoverCost, 'monthly*12');
    finitePositive(res.annualTurnoverCost, 'cost');
  }
});
test('turnoverCost is linear in fleet size and monotonic', () => {
  const base = C.turnoverCost({ fleetSize: 100, turnoverPct: 80, replacementCostPerDriver: 11000 });
  const dbl = C.turnoverCost({ fleetSize: 200, turnoverPct: 80, replacementCostPerDriver: 11000 });
  approx(dbl.annualTurnoverCost, base.annualTurnoverCost * 2, 'doubling fleet doubles cost');
  const more = C.turnoverCost({ fleetSize: 100, turnoverPct: 81, replacementCostPerDriver: 11000 });
  assert.ok(more.annualTurnoverCost > base.annualTurnoverCost, 'monotonic in turnover');
});

// ─── 2) recognitionROI — exact ──────────────────────────────────────────────
test('recognitionROI exact: 100 drivers, 90% turnover, $12k, $75 spend, 20% cut', () => {
  const r = C.recognitionROI({
    fleetSize: 100, turnoverPct: 90, replacementCostPerDriver: 12000,
    recognitionSpendPerDriver: 75, turnoverReductionPct: 20
  });
  approx(r.baselineTurnoverCost, 1080000);
  approx(r.improvedTurnoverRate, 0.72);              // 0.9 * (1-0.2)
  approx(r.improvedTurnoverCost, 864000);            // 100*0.72*12000
  approx(r.turnoverSavings, 216000);                 // 1,080,000 * 0.20
  approx(r.driversRetained, 18);                     // 100*0.9*0.2
  approx(r.recognitionProgramCost, 7500);            // 100*75
  approx(r.netBenefit, 208500);                      // 216000 - 7500
  approx(r.roiRatio, 216000 / 7500);                 // 28.8
  approx(r.roiPct, (208500 / 7500) * 100);           // 2780%
  approx(r.paybackMonths, 7500 / (216000 / 12));     // ~0.4167 months
});
test('recognitionROI conservation + identities across 500 random inputs', () => {
  const r = rng(202);
  for (let i = 0; i < 500; i++) {
    const inp = {
      fleetSize: Math.floor(randIn(r, 0, 4000)),
      turnoverPct: randIn(r, 0, 180),
      replacementCostPerDriver: randIn(r, 1000, 30000),
      recognitionSpendPerDriver: randIn(r, 0, 500),
      turnoverReductionPct: randIn(r, 0, 100)
    };
    const res = C.recognitionROI(inp);
    // conservation: improved + savings === baseline
    approx(res.improvedTurnoverCost + res.turnoverSavings, res.baselineTurnoverCost, 'conservation');
    // savings === baseline × reduction
    approx(res.turnoverSavings, res.baselineTurnoverCost * (inp.turnoverReductionPct / 100), 'savings=base*reduction');
    // retained drivers × replacement cost === savings
    approx(res.driversRetained * inp.replacementCostPerDriver, res.turnoverSavings, 'retained*repl=savings');
    // net + programCost === savings
    approx(res.netBenefit + res.recognitionProgramCost, res.turnoverSavings, 'net+cost=savings');
    // roiRatio and roiPct relationship (when a program cost exists)
    if (res.recognitionProgramCost > 0) {
      approx(res.roiRatio - 1, res.roiPct / 100, 'roiRatio-1 = roiPct/100');
      // payback identity
      if (res.turnoverSavings > 0) {
        approx((res.paybackMonths / 12) * res.turnoverSavings, res.recognitionProgramCost, 'payback identity');
      }
    }
    finitePositive(res.turnoverSavings, 'savings');
    finitePositive(res.recognitionProgramCost, 'programCost');
  }
});
test('recognitionROI boundary reductions', () => {
  const none = C.recognitionROI({ fleetSize: 100, turnoverPct: 90, replacementCostPerDriver: 12000, recognitionSpendPerDriver: 75, turnoverReductionPct: 0 });
  approx(none.turnoverSavings, 0);
  approx(none.roiPct, -100);                          // spent, saved nothing
  assert.equal(none.paybackMonths, null);            // never pays back
  const full = C.recognitionROI({ fleetSize: 100, turnoverPct: 90, replacementCostPerDriver: 12000, recognitionSpendPerDriver: 75, turnoverReductionPct: 100 });
  approx(full.improvedTurnoverCost, 0);
  approx(full.turnoverSavings, full.baselineTurnoverCost);
});
test('recognitionROI clamps reduction > 100 and handles zero spend', () => {
  const over = C.recognitionROI({ fleetSize: 100, turnoverPct: 90, replacementCostPerDriver: 12000, recognitionSpendPerDriver: 75, turnoverReductionPct: 250 });
  approx(over.improvedTurnoverCost, 0, 'reduction clamps to 100%');
  const freeProgram = C.recognitionROI({ fleetSize: 100, turnoverPct: 90, replacementCostPerDriver: 12000, recognitionSpendPerDriver: 0, turnoverReductionPct: 20 });
  assert.equal(freeProgram.roiRatio, null, 'no ROI ratio without program cost');
  approx(freeProgram.paybackMonths, 0, 'free program pays back instantly');
});

// ─── 3) safetySavings — exact + derived ─────────────────────────────────────
test('safetySavings exact with direct crashesPerYear', () => {
  const r = C.safetySavings({ fleetSize: 100, crashesPerYear: 8, avgCrashCost: 91000, incidentReductionPct: 10 });
  approx(r.baselineCrashCost, 728000);               // 8 * 91000
  approx(r.crashesPrevented, 0.8);                   // 8 * 0.10
  approx(r.costAvoided, 72800);                      // 728000 * 0.10
  approx(r.improvedCrashCost, 655200);               // 728000 - 72800
  assert.equal(r.derivedCrashes, false);
});
test('safetySavings derives crashes from miles × rate', () => {
  const r = C.safetySavings({ fleetSize: 100, avgMilesPerTruck: 100000, crashRatePerMillionMiles: 0.8, avgCrashCost: 91000, incidentReductionPct: 10 });
  approx(r.totalMiles, 10000000);                    // 100 * 100k
  approx(r.crashesPerYear, 8);                       // 10M/1M * 0.8
  approx(r.baselineCrashCost, 728000);
  assert.equal(r.derivedCrashes, true);
});
test('safetySavings ROI overlay when spend supplied', () => {
  const r = C.safetySavings({ fleetSize: 100, crashesPerYear: 8, avgCrashCost: 91000, incidentReductionPct: 10, recognitionSpendPerDriver: 75 });
  approx(r.recognitionProgramCost, 7500);
  approx(r.netBenefit, 72800 - 7500);
  approx(r.roiRatio, 72800 / 7500);
});
test('safetySavings invariants across 500 random inputs', () => {
  const r = rng(303);
  for (let i = 0; i < 500; i++) {
    const useDirect = r() > 0.5;
    const inp = {
      fleetSize: Math.floor(randIn(r, 0, 3000)),
      avgCrashCost: randIn(r, 20000, 500000),
      incidentReductionPct: randIn(r, 0, 100)
    };
    if (useDirect) inp.crashesPerYear = randIn(r, 0, 200);
    else { inp.avgMilesPerTruck = randIn(r, 10000, 150000); inp.crashRatePerMillionMiles = randIn(r, 0, 3); }
    const res = C.safetySavings(inp);
    // conservation
    approx(res.improvedCrashCost + res.costAvoided, res.baselineCrashCost, 'safety conservation');
    // crashesPrevented × cost === costAvoided
    approx(res.crashesPrevented * inp.avgCrashCost, res.costAvoided, 'prevented*cost=avoided');
    // baseline === crashes × cost
    approx(res.baselineCrashCost, res.crashesPerYear * inp.avgCrashCost, 'baseline=crashes*cost');
    finitePositive(res.baselineCrashCost, 'baselineCrashCost');
    finitePositive(res.costAvoided, 'costAvoided');
  }
});
test('safetySavings edge: zero reduction and zero fleet', () => {
  const z = C.safetySavings({ fleetSize: 0, incidentReductionPct: 50 });
  approx(z.baselineCrashCost, 0);
  approx(z.costAvoided, 0);
  const nored = C.safetySavings({ fleetSize: 100, crashesPerYear: 8, incidentReductionPct: 0 });
  approx(nored.costAvoided, 0);
  approx(nored.improvedCrashCost, nored.baselineCrashCost);
});

// ─── dispatcher + determinism ───────────────────────────────────────────────
test('calculate() dispatches to the right function', () => {
  const a = C.calculate('turnover', { fleetSize: 10, turnoverPct: 50, replacementCostPerDriver: 10000 });
  const b = C.turnoverCost({ fleetSize: 10, turnoverPct: 50, replacementCostPerDriver: 10000 });
  assert.deepEqual(a, b);
  assert.throws(() => C.calculate('nope', {}), /Unknown calculator type/);
});
test('all calculators are deterministic (pure)', () => {
  const inp = { fleetSize: 137, turnoverPct: 77, replacementCostPerDriver: 13500, recognitionSpendPerDriver: 60, turnoverReductionPct: 18, incidentReductionPct: 12, crashesPerYear: 5 };
  assert.deepEqual(C.turnoverCost(inp), C.turnoverCost(inp));
  assert.deepEqual(C.recognitionROI(inp), C.recognitionROI(inp));
  assert.deepEqual(C.safetySavings(inp), C.safetySavings(inp));
});
test('no-arg calls fall back to benchmark defaults without throwing', () => {
  assert.doesNotThrow(() => C.turnoverCost());
  assert.doesNotThrow(() => C.recognitionROI());
  assert.doesNotThrow(() => C.safetySavings());
  const r = C.recognitionROI();
  finitePositive(r.baselineTurnoverCost, 'default baseline');
});
