/* ============================================================================
   COLLECTION HEROES — the one source, read by two consumers.
   ----------------------------------------------------------------------------
   Each of the six programme tiles on the store picks its photograph BY NAME,
   because the alternative — "the first product in this programme" — pulled the
   250,000 COMING SOON placeholder onto Service Milestone Awards.

   This file exists so that rule lives in exactly one place:

     js/das-store.js              renders the tiles from it
     scripts/build-store-images   makes sure every named file HAS a derivative

   The second consumer is the reason it is a file rather than a constant. A hero
   named here but never referenced by a product would otherwise get no
   derivative, resolve to nothing, and fall back to the very placeholder the map
   exists to avoid — which is precisely what happened to wk-group-lifestyle.

   Keys are programme slugs; values are source file basenames under images/.
   The builder runs this with `vm`, exactly as it already runs milestones.js and
   mile-packs.js, so the values it sees are the values the browser sees.
   ========================================================================== */
(function (root) {
  root.DAS_STORE_HEROES = {
    appreciation: 'pak-command-center-kit-heroA',
    safety:       'safe-250k-3item-v2',
    milestone:    'medal-c-1m-v1',
    onboarding:   'pak-premium-onboarding-hero',
    milepacks:    'mp-04-1',
    holiday:      'wk-group-lifestyle',
  };

  root.DAS_STORE_SUBS = {
    appreciation: 'Driver Appreciation Week',
    safety:       'Safe miles, earned',
    milestone:    '250K to 6 million',
    onboarding:   'Day one, done right',
    milepacks:    'Quarterly recognition',
    holiday:      'The family sees this one',
  };
})(typeof window !== 'undefined' ? window : this);
