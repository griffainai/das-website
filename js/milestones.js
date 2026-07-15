/* =============================================================================
   DRIVER APPRECIATION SOLUTIONS — SERVICE MILESTONE AWARDS
   Central config for the Service Milestone Award medal system.

   Two award tracks:
     • career  — "Service Milestone Awards": career mileage achievement.
     • safe     — "Safe Service Milestone Awards": verified accident-free / company-
                  defined safe miles. A HIGHER distinction (visually + textually set apart).

   Each entry is an individually purchasable product (single fixed price, min 1).
   Tiers: 250K & 500K are PHYSICAL placeholder awards ("coming soon"); 1M–6M are MEDALS.

   ── REPLACE-LATER NOTES (this is the one place to edit) ───────────────────────
   • Prices below are PLACEHOLDERS — drop in finals here (and mirror in lib/catalog.js).
   • Photos: add a `photos:['/images/<file>.jpg']` array to any item to override the
     branded placeholder (shop hero = photos[0], PDP gallery = full array). Use a NEW
     filename each time — /images is immutable-cached 1yr.
   • FUTURE ENHANCEMENTS (wire here / where flagged in product.html + shop.html):
       - custom company-logo option  → add `logoOption:true` + a checkout add-on line
       - engraving option            → add `engraving:{maxChars}` + a PDP text input
       - bulk ordering / volume price → switch an item to the `volume` pricingModel
                                         (see lib/catalog.js volumeTiers / das-006)
       - CSV recipient-name upload    → recipient list field on the order (api/portal.js)
       - ship-to-one vs ship-to-many  → fulfillment_type on the order (lib/shipping.js)
     Keep this data structure stable so a CMS/Supabase table can later replace this file
     1:1 (same fields: id, track, milestone, type, status, name, price, minQty, description, image).
   ============================================================================= */
window.DAS_MILESTONES = (function () {
  var items = [];

  // ── 250K & 500K — early-career awards. Career track = placeholder (coming soon).
  //    Safe track = REAL Recognition Kits (medallion + 10 uniform patches + 2 lapel pins),
  //    with real product photography + kit components (CC tasks E42/E44/E45, 2026-06-17). ──
  var physical = [
    { mk:'250k', track:'career', name:'250,000 Service Miles',      price:29.99, desc:'An early-career recognition award honoring meaningful professional mileage achievement. Physical item coming soon.' },
    { mk:'250k', track:'safe',   name:'250,000 Safe Service Miles', price:649.00,
      status:'Recognition Kit Available',
      photos:['/images/safe-250k-3item-v2.webp','/images/safe-250k-combo.webp','/images/safe-250k-patch.webp','/images/safe-250k-hat.webp'],
      demoBranding:true,
      imageAlt:'250,000 Safe Service Miles recognition kit — engraved medallion and embroidered uniform patch',
      desc:'The 250,000 Safe Service Miles Recognition Kit celebrates one of the most important milestones in a professional driver’s career. Reaching 250,000 consecutive safe miles without a preventable accident demonstrates discipline, professionalism, and an unwavering commitment to protecting lives, equipment, cargo, and the motoring public. The kit delivers both an immediate presentation experience and long-term visibility: the 10 embroidered patches outfit up to five uniform shirts, and the two matching lapel pins let the driver display the achievement daily — one for wear, one as a keepsake.',
      included:['1 Custom 250,000 Safe Service Miles Recognition Award','10 Embroidered Uniform Patches (outfits up to 5 shirts)','2 Matching Lapel Pins','Professional recognition presentation'] },
    { mk:'500k', track:'career', name:'500,000 Service Miles',      price:39.99, desc:'A major career milestone recognizing sustained service and professional dedication. Physical item coming soon.' },
    { mk:'500k', track:'safe',   name:'500,000 Safe Service Miles', price:749.00,
      status:'Recognition Kit Available',
      photos:['/images/safe-500k-3item.webp','/images/safe-500k-combo.webp','/images/safe-500k-hat.webp'],
      demoBranding:true,
      imageAlt:'500,000 Safe Service Miles recognition kit — engraved medallion and embroidered uniform patch',
      desc:'Half a million miles. Zero preventable accidents. The 500,000 Safe Service Miles Recognition Kit honors professional drivers who have achieved a remarkable milestone — 500,000 consecutive safe miles without a preventable accident. It reflects years of focused decision-making, defensive driving, and dedication to protecting lives, equipment, cargo, and the motoring public. The 10 embroidered patches outfit up to five uniform shirts for ongoing visibility, and the two matching lapel pins provide a versatile recognition option — one for the ceremony, one as a commemorative keepsake.',
      included:['1 Custom 500,000 Safe Service Miles Recognition Award','10 Embroidered Uniform Patches (outfits up to 5 shirts)','2 Matching Lapel Pins','Professional recognition presentation'] },
  ];
  physical.forEach(function (p) {
    items.push({
      id: 'msm-' + (p.track === 'safe' ? 's' : 'c') + '-' + p.mk,
      track: p.track, milestone: p.mk.toUpperCase(), type: 'physical',
      status: p.status || 'Placeholder Award — Final Item Coming Soon',
      name: p.name, price: p.price, minQty: 1, description: p.desc,
      photos: p.photos || undefined,
      imageAlt: p.imageAlt || undefined,
      included: p.included || undefined,
      demoBranding: !!p.demoBranding,
    });
  });

  // ── 1M–6M — MEDALS (per-track pricing; Safe is the higher distinction) ──
  // E90 2026-06-24: all medals flat $249 (career + safe, 1M–6M).
  var MED_PRICE = {
    career: { 1:249, 2:249, 3:249, 4:249, 5:249, 6:249 },
    safe:   { 1:249, 2:249, 3:249, 4:249, 5:249, 6:249 },
  };
  var WORD = { 1:'1 Million', 2:'2 Million', 3:'3 Million', 4:'4 Million', 5:'5 Million', 6:'6 Million' };
  var LOWER = { 1:'1 million', 2:'2 million', 3:'3 million', 4:'4 million', 5:'5 million', 6:'6 million' };
  // Real medal product photos — full collection. Career: 1M–6M. Safe: 1M–6M.
  var CAREER_PHOTO = { 1:'/images/medal-c-1m-v1.webp', 2:'/images/medal-c-2m-v1.webp', 3:'/images/medal-c-3m-v1.webp', 4:'/images/medal-c-4m-v1.webp', 5:'/images/5-million-mile-medal.webp', 6:'/images/medal-c-6m-v1.webp' };
  var CAREER_ALT   = { 5:'5 Million Mile Professional Driver Recognition Medal', 6:'6 Million Mile Professional Driver Recognition Medal' };  // exact required alt
  // Mile Club recognition apparel that accompanies the milestone (CC task O13, 2026-07-14).
  // Appended AFTER the medal — the product IS the medal, so it stays photos[0].
  var CAREER_EXTRA = {
    1: ['/images/club-1m-tee-2026.webp', '/images/club-1m-jacket-2026.webp', '/images/club-1m-lifestyle-2026.webp', '/images/club-1m-lifestyle-2-2026.webp'],
    2: ['/images/club-2m-tee-2026.webp', '/images/club-2m-hat-2026.webp', '/images/club-2m-tee-2-2026.webp', '/images/club-2m-hero-2026.webp'],
  };
  var SAFE_PHOTO   = { 1:'/images/medal-s-1m-v1.webp', 2:'/images/medal-s-2m-v1.webp', 3:'/images/medal-s-3m-v1.webp', 4:'/images/medal-s-4m-v1.webp', 5:'/images/medal-s-5m-v1.webp', 6:'/images/medal-s-6m-v1.webp' };
  var SAFE_ALT     = { 5:'5 Million Safe Miles Professional Driver Recognition Medal', 6:'6 Million Mile Professional Driver Recognition Medal' };  // exact required alt
  [1,2,3,4,5,6].forEach(function (m) {
    items.push({
      id:'msm-c-' + m + 'm', track:'career', milestone:m + 'M', type:'medal', status:'Medal Available',
      name: WORD[m] + ' Service Miles Medal', price: MED_PRICE.career[m], minQty: 1,
      description: 'A premium medal honoring the professional achievement of reaching ' + LOWER[m] + ' career service miles.',
      photos: CAREER_PHOTO[m] ? [CAREER_PHOTO[m]].concat(CAREER_EXTRA[m] || []) : undefined,
      imageAlt: CAREER_ALT[m] || undefined,
    });
    items.push({
      id:'msm-s-' + m + 'm', track:'safe', milestone:m + 'M', type:'medal', status:'Medal Available',
      name: WORD[m] + ' Safe Service Miles Medal', price: MED_PRICE.safe[m], minQty: 1,
      description: 'A premium safety-distinction medal honoring ' + LOWER[m] + ' verified safe service miles.',
      photos: SAFE_PHOTO[m] ? [SAFE_PHOTO[m]] : undefined,
      imageAlt: SAFE_ALT[m] || undefined,
    });
  });

  // Branded placeholder image per item (16:9). Replace via an item `photos:[...]` array later.
  items.forEach(function (it) {
    if (!it.photos) it.image = '/images/milestone-' + it.id.replace('msm-', '') + '.jpg';
    else it.image = it.photos[0];
  });

  // ── EXECUTIVE DRIVER RECOGNITION COLLECTION ─────────────────────────────────
  //   A premium UPGRADE on each SAFE milestone — NOT a separate mileage qualification.
  //   Same Safe medal + packaging + recognition materials PLUS a premium executive gift.
  //   Purchasable: price = safe base + upgrade; server-validated as <safe-id>-exec.
  //   Gift images are branded placeholders for launch (swap real YETI photos later).
  //   A milestone maps to ONE executive gift, EXCEPT 500K which offers a CHOICE of
  //   THREE (Water Bottle / Food Jar / Lunch Bag) — each becomes its own selectable
  //   exec package. The Food Jar option is `comingSoon` (price not finalized → not
  //   purchasable; shows "Executive Upgrade Pricing Coming Soon").
  //   Real product photos (.jpg) now lead the gallery/card; the medal follows.
  //   `extra` = additional gallery photos (detail / co-brand / lifestyle shots).
  var EXEC = {
    '250K': { gift:'Premium YETI 32 oz Water Bottle', short:'32 oz Water Bottle', upgrade:150, img:'/images/exec-bottle-card.webp',
      extra:[],
      alt:'Premium YETI water bottle executive gift for Safe Service Miles recognition award',
      blurb:'An elevated drinkware upgrade designed to give professional drivers a premium everyday recognition gift they can take on the road.' },
    '500K': [
      { slug:'bottle',   gift:'Premium YETI 32 oz Water Bottle', short:'32 oz Water Bottle', upgrade:150, img:'/images/exec-bottle-card.webp',
        extra:[],
        alt:'Premium YETI water bottle executive gift for Safe Service Miles recognition award',
        blurb:'An elevated drinkware upgrade designed to give professional drivers a premium everyday recognition gift they can take on the road. The cost-neutral entry into the Executive Collection at the 500,000 Safe Miles level.' },
      { slug:'foodjar',  gift:'YETI Insulated Food Jar', short:'Insulated Food Jar', comingSoon:true, img:'/images/exec-foodjar-card.webp',
        extra:[], darkImg:true,
        alt:'YETI Insulated Food Jar executive gift for Safe Service Miles recognition award',
        blurb:'A practical premium upgrade designed for professional drivers who need reliable meal storage on the road. The YETI Insulated Food Jar gives companies a useful executive recognition gift that supports daily driver comfort, preparedness, and appreciation.' },
      { slug:'lunchbag', gift:'YETI Lunch Bag', short:'Lunch Bag', upgrade:150, img:'/images/exec-lunchbag-v3.webp',
        extra:[],
        alt:'YETI Lunch Bag executive recognition gift for 500,000 Safe Miles achievement',
        blurb:'A premium recognition upgrade that combines everyday practicality with executive-level presentation. Built for professional drivers who appreciate quality gear both on and off duty.' },
    ],
    '1M':   { gift:'YETI Camino® 35 Carryall Tote', short:'Camino® 35 Tote', upgrade:680, img:'/images/exec-tote-card.webp',
      extra:[], darkImg:true,
      alt:'YETI Camino 35 Carryall Tote Bag executive gift for 1 Million Safe Miles recognition award',
      blurb:'A premium carryall upgrade designed for professional drivers who have reached the elite achievement of 1 Million Safe Miles. Practical, durable, and executive in presentation, this gift gives companies a meaningful way to honor safe performance with a useful recognition item built for life on the road.' },
    '2M':   { gift:'YETI Roadie® 15 Hard Cooler', short:'Roadie® 15 Cooler', upgrade:700, img:'/images/exec-cooler-card.webp',
      extra:[],
      alt:'Customized YETI Roadie 15 hard cooler executive gift for Safe Service Miles recognition award',
      blurb:'A premium cooler upgrade designed to honor professional drivers who achieve elite Safe Service Miles milestones with a practical, high-value gift built for life on the road.' },
    '3M':   PACK_LEADER(), '4M': PACK_LEADER(), '5M': PACK_LEADER(), '6M': PACK_LEADER(),
  };
  function PACK_LEADER() {
    return { gift:'The Pack Leader Executive Collection', short:'Pack Leader Collection',
      secondary:'Premium Backpack + YETI Drinkware Package', upgrade:750,
      img:'/images/exec-packleader-card.webp', extra:['/images/exec-packleader-2.jpg'], darkImg:true, flagship:true,
      alt:'The Pack Leader Executive Driver Recognition Collection featuring premium backpack and customized YETI drinkware for Safe Service Miles achievement awards',
      blurb:'Reserved for the transportation industry’s most accomplished professional drivers, The Pack Leader Executive Collection combines premium drinkware and executive travel gear into a recognition package worthy of elite Safe Service Miles achievement.' };
  }
  items.filter(function (s) { return s.track === 'safe'; }).forEach(function (s) {
    var e = EXEC[s.milestone]; if (!e) return;
    var opts = Array.isArray(e) ? e : [e];
    var multi = opts.length > 1;
    var baseName = s.name.replace(/ Medal$/, '');
    opts.forEach(function (o) {
      var soon = !!o.comingSoon;
      var gallery = [o.img].concat(o.extra || []).concat([s.image]);  // gift photo leads, medal closes
      items.push({
        id: multi ? s.id + '-exec-' + o.slug : s.id + '-exec',
        track: 'exec',
        milestone: s.milestone,
        type: s.type,
        status: 'Executive Collection',
        comingSoon: soon,
        flagship: !!o.flagship,
        darkImg: !!o.darkImg,
        name: baseName + ' — Executive Collection' + (multi ? ' · ' + o.short : ''),
        price: soon ? null : Math.round((s.price + o.upgrade) * 100) / 100,
        minQty: 1,
        executive: { gift: o.gift, short: o.short, secondary: o.secondary || null,
          upgrade: soon ? null : o.upgrade, giftImg: o.img, baseId: s.id, basePrice: s.price },
        imageAlt: o.alt || null,
        description: o.blurb
          ? o.blurb + ' You receive EVERYTHING in the ' + baseName + ' Recognition Kit — the Safe Service Miles medal, two lapel pins, recognition t-shirt, keychain, and driver road-bag tag — in premium presentation packaging, plus a company-issued recognition certificate, AND this premium executive upgrade. Choosing the Executive Collection means the driver gets the full recognition kit and the elevated gift together.'
          : 'The ' + baseName + ' recognition, elevated. The Executive Collection includes EVERYTHING in the ' + baseName + ' Recognition Kit (medal, two lapel pins, recognition t-shirt, keychain, driver road-bag tag, premium packaging) plus a company-issued recognition certificate and a premium executive gift — the ' + o.gift + '. The driver receives the complete kit and the upgrade together.',
        image: o.img,
        photos: gallery,
      });
    });
  });

  return items;
})();

/* The intro copy explaining the Career vs Safe distinction (rendered in shop.html). */
window.DAS_MILESTONE_INTRO = 'A Service Milestone Award recognizes a driver’s career mileage achievement and honors the professional dedication required to reach major distance milestones. A Safe Service Milestone Award is a higher distinction reserved for verified accident-free or company-defined safe miles. It allows an organization to separately honor not only how far a driver has gone, but how safely they have served along the way.';
