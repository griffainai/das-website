/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Fleet SEO calculator engine (UMD — browser + Node).

   Pure, deterministic math for the three free fleet tools:
     1. turnoverCost   — Driver Turnover Cost Calculator
     2. recognitionROI — Recognition / Retention ROI Calculator
     3. safetySavings  — Fleet Safety Savings Calculator

   Design rules (so the "match equation" is always internally consistent):
     - Every function is PURE: same input → same output, no side effects.
     - The engine returns EXACT (unrounded) numbers. Rounding is a display
       concern — call round2()/formatUSD() at the UI layer only. Keeping raw
       values exact means conservation identities hold (e.g. improvedCost +
       savings === baselineCost) without penny drift.
     - Inputs are COERCED, never trusted: num() forces a finite number ≥ min,
       so a bad/blank/negative field can never produce NaN/Infinity output.
     - Rates are entered as PERCENTAGES (what a fleet manager types: "90"),
       converted to fractions internally. Turnover may exceed 100% (common in
       OTR); reduction percentages are clamped to 0–100.

   Provenance of every default is in DATA_SOURCES below. The recognition-effect
   figures are DAS PLACEHOLDERS to be replaced by first-party "DAS Driver
   Recognition Index" data — they are clearly flagged, not presented as
   third-party statistics.
   ============================================= */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DASFleetCalculators = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  var VERSION = '1.0.0';

  // ─── Editable benchmark defaults ────────────────────────────────────────────
  // Percent fields are stored as PERCENTAGES here (turnoverPct 89 = 89%).
  var BENCHMARKS = {
    // Per-driver replacement cost (recruiting + orientation + training + lost
    // productivity). ATRI-cited industry range.
    replacementCostPerDriver: { low: 8000, default: 12000, high: 15000 },

    // Large-truckload OTR annual driver turnover, used as the industry baseline
    // a fleet compares itself against.
    industryTurnoverPct: 89,

    // FMCSA per-crash cost by severity (all-crash average / injury / fatal).
    crashCost: { average: 91000, injury: 200000, fatal: 3600000 },

    // Safety-calc convenience defaults (editable; fleets should enter their own).
    avgMilesPerTruck: 100000,          // typical OTR truck-year
    crashRatePerMillionMiles: 0.8,     // editable assumption, NOT an authority figure

    // ── DAS PLACEHOLDERS — replace with DAS Driver Recognition Index data ──
    // Typical annual recognition spend per driver for a structured program.
    recognitionSpendPerDriver: 75,
    // Modeled turnover reduction from a structured recognition program.
    turnoverReductionPct: 20,
    // Modeled preventable-incident reduction from a safety-recognition culture.
    incidentReductionPct: 10
  };

  // Documentation of where each default comes from (drives the transparency /
  // citation story; also lets the UI render a "sources" footnote).
  var DATA_SOURCES = {
    replacementCostPerDriver: 'ATRI — Operational Costs of Trucking (industry-cited $8k–$15k replacement range).',
    industryTurnoverPct: 'ATA / ATRI — large-truckload OTR annual turnover.',
    crashCost: 'FMCSA — Safety Is Good Business: avg large-truck crash ~$91k, injury ~$200k, fatal ~$3.6M.',
    recognition: 'DAS Driver Recognition Index (PLACEHOLDER — first-party data pending).'
  };

  // ─── Numeric helpers ────────────────────────────────────────────────────────
  // Coerce to a finite number ≥ min (default 0). NaN/blank/negative → min.
  function num(x, min) {
    var lo = (typeof min === 'number') ? min : 0;
    var n = Number(x);
    if (!isFinite(n)) return lo;
    return n < lo ? lo : n;
  }

  // Clamp to [lo, hi].
  function clamp(x, lo, hi) {
    var n = Number(x);
    if (!isFinite(n)) return lo;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  // Percentage (e.g. 89) → fraction (0.89). Coerced, never negative.
  function pctToFraction(pct) { return num(pct, 0) / 100; }

  // Round to cents for display. NEVER used inside the engine's own math.
  function round2(x) { return Math.round((Number(x) + Number.EPSILON) * 100) / 100; }

  function formatUSD(x) {
    var v = round2(x);
    return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ─── 1) Driver Turnover Cost ────────────────────────────────────────────────
  /**
   * @param {object} input
   * @param {number} input.fleetSize                 number of drivers
   * @param {number} input.turnoverPct               annual turnover, percent (may exceed 100)
   * @param {number} input.replacementCostPerDriver  USD to replace one driver
   * @returns {object} exact (unrounded) result
   */
  function turnoverCost(input) {
    input = input || {};
    var fleetSize = num(input.fleetSize, 0);
    var turnoverRate = pctToFraction(input.turnoverPct != null ? input.turnoverPct : BENCHMARKS.industryTurnoverPct);
    var replacementCost = num(input.replacementCostPerDriver != null
      ? input.replacementCostPerDriver : BENCHMARKS.replacementCostPerDriver.default);

    var driversLostPerYear = fleetSize * turnoverRate;
    var annualTurnoverCost = driversLostPerYear * replacementCost;
    var costPerTruck = fleetSize > 0 ? annualTurnoverCost / fleetSize : 0;

    var industryRate = pctToFraction(BENCHMARKS.industryTurnoverPct);

    return {
      fleetSize: fleetSize,
      turnoverRate: turnoverRate,
      replacementCostPerDriver: replacementCost,
      driversLostPerYear: driversLostPerYear,
      annualTurnoverCost: annualTurnoverCost,
      monthlyTurnoverCost: annualTurnoverCost / 12,
      costPerTruck: costPerTruck,
      industryTurnoverRate: industryRate,
      // >1 means this fleet is worse than the industry baseline, <1 better.
      vsIndustryRatio: industryRate > 0 ? turnoverRate / industryRate : 0
    };
  }

  // ─── 2) Recognition / Retention ROI ─────────────────────────────────────────
  /**
   * @param {object} input
   * @param {number} input.fleetSize
   * @param {number} input.turnoverPct                current annual turnover, percent
   * @param {number} input.replacementCostPerDriver
   * @param {number} input.recognitionSpendPerDriver  annual recognition $ per driver
   * @param {number} input.turnoverReductionPct       expected turnover reduction, 0–100
   * @returns {object}
   */
  function recognitionROI(input) {
    input = input || {};
    var fleetSize = num(input.fleetSize, 0);
    var currentRate = pctToFraction(input.turnoverPct != null ? input.turnoverPct : BENCHMARKS.industryTurnoverPct);
    var replacementCost = num(input.replacementCostPerDriver != null
      ? input.replacementCostPerDriver : BENCHMARKS.replacementCostPerDriver.default);
    var spendPerDriver = num(input.recognitionSpendPerDriver != null
      ? input.recognitionSpendPerDriver : BENCHMARKS.recognitionSpendPerDriver);
    // Reduction is a fraction of current turnover; can't exceed 100%.
    var reduction = clamp(input.turnoverReductionPct != null
      ? input.turnoverReductionPct : BENCHMARKS.turnoverReductionPct, 0, 100) / 100;

    var baselineTurnoverCost = fleetSize * currentRate * replacementCost;
    var improvedRate = currentRate * (1 - reduction);
    var improvedTurnoverCost = fleetSize * improvedRate * replacementCost;

    var turnoverSavings = baselineTurnoverCost - improvedTurnoverCost; // = baseline * reduction
    var driversRetained = fleetSize * currentRate * reduction;         // × replacementCost === savings
    var recognitionProgramCost = fleetSize * spendPerDriver;
    var netBenefit = turnoverSavings - recognitionProgramCost;

    var hasProgramCost = recognitionProgramCost > 0;
    var roiRatio = hasProgramCost ? turnoverSavings / recognitionProgramCost : null;   // $ returned per $1 spent
    var roiPct = hasProgramCost ? (netBenefit / recognitionProgramCost) * 100 : null;  // roiRatio*100 - 100
    // Months for savings to repay the program spend. null if it never pays back.
    var paybackMonths = (turnoverSavings > 0)
      ? recognitionProgramCost / (turnoverSavings / 12)
      : null;

    return {
      fleetSize: fleetSize,
      baselineTurnoverRate: currentRate,
      baselineTurnoverCost: baselineTurnoverCost,
      improvedTurnoverRate: improvedRate,
      improvedTurnoverCost: improvedTurnoverCost,
      driversRetained: driversRetained,
      turnoverSavings: turnoverSavings,
      recognitionProgramCost: recognitionProgramCost,
      netBenefit: netBenefit,
      roiRatio: roiRatio,
      roiPct: roiPct,
      paybackMonths: paybackMonths
    };
  }

  // ─── 3) Fleet Safety Savings ────────────────────────────────────────────────
  /**
   * crashesPerYear is used directly if provided (what a fleet actually knows).
   * Otherwise it is derived: fleetSize × avgMilesPerTruck ÷ 1e6 × crashRate/Mmi.
   *
   * @param {object} input
   * @param {number}  input.fleetSize
   * @param {number} [input.crashesPerYear]           preferred direct input
   * @param {number} [input.avgMilesPerTruck]         used only when deriving crashes
   * @param {number} [input.crashRatePerMillionMiles] used only when deriving crashes
   * @param {number} [input.avgCrashCost]             defaults to FMCSA all-crash average
   * @param {number} [input.incidentReductionPct]     expected reduction, 0–100
   * @param {number} [input.recognitionSpendPerDriver] optional → enables net/ROI
   * @returns {object}
   */
  function safetySavings(input) {
    input = input || {};
    var fleetSize = num(input.fleetSize, 0);
    var avgCrashCost = num(input.avgCrashCost != null ? input.avgCrashCost : BENCHMARKS.crashCost.average);
    var reduction = clamp(input.incidentReductionPct != null
      ? input.incidentReductionPct : BENCHMARKS.incidentReductionPct, 0, 100) / 100;

    var derived = false;
    var totalMiles = 0;
    var crashesPerYear;
    if (input.crashesPerYear != null) {
      crashesPerYear = num(input.crashesPerYear, 0);
    } else {
      derived = true;
      var avgMiles = num(input.avgMilesPerTruck != null ? input.avgMilesPerTruck : BENCHMARKS.avgMilesPerTruck);
      var rate = num(input.crashRatePerMillionMiles != null
        ? input.crashRatePerMillionMiles : BENCHMARKS.crashRatePerMillionMiles);
      totalMiles = fleetSize * avgMiles;
      crashesPerYear = (totalMiles / 1000000) * rate;
    }

    var baselineCrashCost = crashesPerYear * avgCrashCost;
    var crashesPrevented = crashesPerYear * reduction;
    var costAvoided = baselineCrashCost * reduction;            // = crashesPrevented × avgCrashCost
    var improvedCrashCost = baselineCrashCost - costAvoided;

    var result = {
      fleetSize: fleetSize,
      derivedCrashes: derived,
      totalMiles: totalMiles,
      crashesPerYear: crashesPerYear,
      avgCrashCost: avgCrashCost,
      baselineCrashCost: baselineCrashCost,
      crashesPrevented: crashesPrevented,
      costAvoided: costAvoided,
      improvedCrashCost: improvedCrashCost,
      recognitionProgramCost: null,
      netBenefit: null,
      roiRatio: null,
      roiPct: null
    };

    // Optional ROI overlay when a recognition spend is supplied.
    if (input.recognitionSpendPerDriver != null) {
      var spendPerDriver = num(input.recognitionSpendPerDriver, 0);
      var programCost = fleetSize * spendPerDriver;
      result.recognitionProgramCost = programCost;
      result.netBenefit = costAvoided - programCost;
      if (programCost > 0) {
        result.roiRatio = costAvoided / programCost;
        result.roiPct = (result.netBenefit / programCost) * 100;
      }
    }

    return result;
  }

  // ─── Dispatcher ─────────────────────────────────────────────────────────────
  var CALCULATORS = {
    turnover: turnoverCost,
    recognition: recognitionROI,
    safety: safetySavings
  };

  function calculate(type, input) {
    var fn = CALCULATORS[type];
    if (!fn) throw new Error('Unknown calculator type: ' + type);
    return fn(input);
  }

  return {
    VERSION: VERSION,
    BENCHMARKS: BENCHMARKS,
    DATA_SOURCES: DATA_SOURCES,
    // helpers
    num: num,
    clamp: clamp,
    pctToFraction: pctToFraction,
    round2: round2,
    formatUSD: formatUSD,
    // calculators
    turnoverCost: turnoverCost,
    recognitionROI: recognitionROI,
    safetySavings: safetySavings,
    calculate: calculate
  };
}));
