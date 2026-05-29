/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Recognition tier engine (UMD — browser + Node).

   Maps a (recognition track, milestone) pair to a recommended tier. Admins
   can override the recommendation — the engine only suggests.

   Tiers (Shakir spec §4):
     Tier 1 — Essential Recognition
     Tier 2 — Professional Recognition
     Tier 3 — Elite Recognition
     Tier 4 — Legacy Recognition

   Prestige rule: Safe Mile recognition is bumped one tier above Career
   Mileage at the same mileage level (100K career → Tier 1, 100K safe → Tier 2).

   Ported verbatim from das-portal/src/lib/recognition-tiers.ts.
   ============================================= */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else { root.DASRecognition = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {

  var TIER_LABELS = {
    tier_1: {
      name: 'Tier 1 — Essential Recognition',
      description: 'Foundational recognition for early milestones and first-year achievements.',
      includesExamples: ['Certificate', 'Snack kit', 'Appreciation insert', 'Basic branded item'],
    },
    tier_2: {
      name: 'Tier 2 — Professional Recognition',
      description: 'Elevated recognition for sustained performance and 100K safe-mile drivers.',
      includesExamples: ['Upgraded snack kit', 'T-shirt', 'Premium tumbler', 'Challenge coin', 'Premium packaging'],
    },
    tier_3: {
      name: 'Tier 3 — Elite Recognition',
      description: 'Premium recognition for high-mileage drivers and 500K safe-mile achievements.',
      includesExamples: ['Premium backpack', 'YETI or Hydro Flask style drinkware', 'Embroidered apparel', 'Collectible recognition item', 'Upgraded packaging'],
    },
    tier_4: {
      name: 'Tier 4 — Legacy Recognition',
      description: 'Lifetime achievement, retirement, and hall-of-honor recognition.',
      includesExamples: ['Executive recognition package', 'Engraved premium products', 'Framed recognition', 'Family appreciation insert', 'Custom presentation packaging'],
    },
  };

  var MILESTONES_BY_TRACK = {
    career_mileage: [
      { id: 'career_100k', label: '100,000 career miles',    tier: 'tier_1' },
      { id: 'career_250k', label: '250,000 career miles',    tier: 'tier_2' },
      { id: 'career_500k', label: '500,000 career miles',    tier: 'tier_3' },
      { id: 'career_1m',   label: '1,000,000 career miles',  tier: 'tier_3' },
      { id: 'career_2m',   label: '2,000,000 career miles',  tier: 'tier_4' },
      { id: 'career_3m',   label: '3,000,000+ career miles', tier: 'tier_4' },
    ],
    safe_mileage: [
      // Prestige bump — each safe-mile milestone is one tier above career at the same level.
      { id: 'safe_100k', label: '100,000 safe miles',    tier: 'tier_2' },
      { id: 'safe_250k', label: '250,000 safe miles',    tier: 'tier_3' },
      { id: 'safe_500k', label: '500,000 safe miles',    tier: 'tier_3' },
      { id: 'safe_1m',   label: '1,000,000 safe miles',  tier: 'tier_4' },
      { id: 'safe_2m',   label: '2,000,000 safe miles',  tier: 'tier_4' },
      { id: 'safe_3m',   label: '3,000,000+ safe miles', tier: 'tier_4' },
    ],
    years_of_service: [
      { id: 'service_1yr',  label: '1 year of service',    tier: 'tier_1' },
      { id: 'service_3yr',  label: '3 years of service',   tier: 'tier_2' },
      { id: 'service_5yr',  label: '5 years of service',   tier: 'tier_2' },
      { id: 'service_10yr', label: '10 years of service',  tier: 'tier_3' },
      { id: 'service_15yr', label: '15 years of service',  tier: 'tier_3' },
      { id: 'service_20yr', label: '20+ years of service', tier: 'tier_4' },
    ],
    trainer_mentor: [
      { id: 'trainer_excellence', label: 'Trainer Excellence', tier: 'tier_2' },
      { id: 'mentor_recognition', label: 'Mentor Recognition', tier: 'tier_2' },
    ],
    family: [
      { id: 'family_appreciation', label: 'Family Appreciation', tier: 'tier_2' },
    ],
    retirement: [
      { id: 'retirement', label: 'Retirement Recognition', tier: 'tier_4' },
    ],
    driver_appreciation_week: [
      { id: 'daw_general', label: 'Driver Appreciation Week',           tier: 'tier_1' },
      { id: 'daw_premium', label: 'Driver Appreciation Week — Premium', tier: 'tier_2' },
    ],
    special_recognition: [
      { id: 'inspection_excellence', label: 'Inspection Excellence',        tier: 'tier_2' },
      { id: 'driver_of_quarter',     label: 'Driver of the Quarter',        tier: 'tier_2' },
      { id: 'winter_ops_excellence', label: 'Winter Operations Excellence', tier: 'tier_2' },
    ],
    custom: [
      { id: 'custom_award', label: 'Custom Award', tier: 'tier_1' },
    ],
  };

  var TRACK_LABELS = {
    career_mileage:           { name: 'Career Milestone Recognition',     description: 'Total miles driven — recognizes dedication and tenure.' },
    safe_mileage:             { name: 'Safe Mile Achievement Recognition', description: 'Verified consecutive safe miles — a higher-prestige distinction than career mileage.' },
    years_of_service:         { name: 'Years of Service',                  description: 'Service-anniversary recognition tied to hire date.' },
    trainer_mentor:           { name: 'Trainer / Mentor Recognition',      description: 'Recognition for drivers who train and mentor others.' },
    family:                   { name: 'Family Appreciation',               description: "Recognition that includes the driver's family." },
    retirement:               { name: 'Retirement Recognition',            description: 'Lifetime achievement and retirement honors.' },
    driver_appreciation_week: { name: 'Driver Appreciation Week',          description: 'Annual campaign-style recognition for all drivers.' },
    special_recognition:      { name: 'Special Recognition',               description: 'Inspection Excellence, Driver of the Quarter, Winter Ops, and other awards.' },
    custom:                   { name: 'Custom Recognition',                description: "Anything else — write your own milestone label." },
  };

  var ALL_TRACKS = [
    'career_mileage', 'safe_mileage', 'years_of_service', 'trainer_mentor',
    'family', 'retirement', 'driver_appreciation_week', 'special_recognition', 'custom',
  ];

  function recommendTier(track, milestoneId) {
    var list = MILESTONES_BY_TRACK[track];
    if (!list) return 'tier_1';
    for (var i = 0; i < list.length; i++) if (list[i].id === milestoneId) return list[i].tier;
    return 'tier_1';
  }

  function getMilestone(track, milestoneId) {
    var list = MILESTONES_BY_TRACK[track];
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === milestoneId) return list[i];
    return null;
  }

  function tierNumber(tier) { return Number(String(tier).replace('tier_', '')) || 1; }

  return {
    TIER_LABELS: TIER_LABELS,
    MILESTONES_BY_TRACK: MILESTONES_BY_TRACK,
    TRACK_LABELS: TRACK_LABELS,
    ALL_TRACKS: ALL_TRACKS,
    recommendTier: recommendTier,
    getMilestone: getMilestone,
    tierNumber: tierNumber,
  };
}));
