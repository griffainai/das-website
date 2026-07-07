/* =============================================
   DRIVER APPRECIATION SOLUTIONS — MILE PACKS
   23-kit recognition line. Single fixed price per kit (a tier LABEL +
   flat price), min 10 units. Prices are mirrored in lib/catalog.js
   (the server price authority) — keep the two in sync.

   Display data lives here; shop.html and product.html both read it.
   `image` paths are branded PLACEHOLDERS (images/mp-NN.jpg) — swap in
   real product photos per kit as they arrive (use a NEW filename, since
   /images is immutable-cached 1yr).
   ============================================= */
window.DAS_MILEPACKS = [
  { id:'mp-01', num:'01', name:'Road Warrior Fuel Pack', tier:'Premium', price:69.99, minQty:10,
    blurb:'Premium snacks and energy-sustaining protein for the driver who never stops.',
    description:'Built for the driver who doesn’t stop — premium snacks, energy-sustaining protein, and quality items that say "we see what you do out there." When they open this kit they’re not just getting fuel; they’re getting proof that the person who signed their paycheck thought about what their day actually looks like.',
    included:['Premium protein & jerky selection','Energy-forward snacks','Trail mix & nuts','Branded recognition card','Branded presentation packaging'] },
  { id:'mp-02', num:'02', name:'Hydration & Hustle Kit', tier:'Premium', price:69.99, minQty:10,
    photos:['/images/mp-02-1.jpg','/images/mp-02-2.jpg'],
    blurb:'Electrolyte hydration and performance replenishment for the long grind.',
    description:'Hours behind the wheel under heat, pressure, and deadlines take a toll — this kit says you understand that. Loaded with premium electrolyte hydration, coconut water, and performance replenishment, it tells drivers that wellness isn’t an afterthought in your operation, it’s a priority. The driver who receives it doesn’t just feel appreciated — they feel seen.',
    included:['Electrolyte hydration mixes','Coconut water','Performance replenishment items','Premium snacks','Branded recognition card'] },
  { id:'mp-03', num:'03', name:'The Rookie Welcome Kit', tier:'Premium', price:69.99, minQty:10,
    photos:['/images/mp-03-1.jpg'],
    blurb:'A premium first impression that sets the tone from day one.',
    description:'Day one sets everything. The Rookie Welcome Kit is your opening statement — a curated, premium first impression that communicates exactly what kind of company a new driver joined before they’ve driven their first loaded mile. Thoughtfully assembled with items built for life on the road, it tells your newest hire they made the right call.',
    included:['Welcome road-essentials set','Branded apparel item','On-the-road snacks','Personalized welcome card','Branded presentation packaging'] },
  { id:'mp-04', num:'04', name:'The Cab Comfort Kit', tier:'Signature', price:89.99, minQty:10,
    photos:['/images/mp-04-1.jpg','/images/mp-04-2.jpg'],
    blurb:'Personal care and comfort touches that elevate a long shift.',
    description:'The cab is your driver’s office, dining room, and living room — sometimes in the same twelve-hour stretch. The Cab Comfort Kit acknowledges that reality with personal-care essentials, comfort-focused items, and quality touches that elevate a long shift from endurable to genuinely comfortable. It’s the kit drivers share with their spouses when they get home.',
    included:['Personal-care essentials','Comfort & relaxation items','Premium beverage selection','Cab-friendly accessories','Branded presentation packaging'] },
  { id:'mp-05', num:'05', name:'The Long Haul Snack Pack', tier:'Essential', price:49.99, minQty:10,
    photos:['/images/mp-05-1.jpg'],
    blurb:'A premium variety built for the overnight and cross-country runs.',
    description:'Built for the drivers covering the real distance — overnight runs and cross-country loads that keep commerce moving while everyone else is asleep. Stacked with a premium variety of snacks engineered for sustained energy, flavor, and satisfaction across a full day in the seat. When they crack it open in the middle of nowhere at 2 AM, they’ll know their company was thinking about them.',
    included:['Premium snack variety','Sustained-energy bars','Savory & sweet selection','Trail mix','Branded recognition card'] },
  { id:'mp-06', num:'06', name:'The Safety Star Pack', tier:'Signature', price:89.99, minQty:10,
    photos:['/images/mp-06-1.jpg'],
    blurb:'A premium reward that puts weight behind your safety culture.',
    description:'Your safest driver just completed another clean record — no incidents, no violations, consistent professional execution of the most dangerous job in logistics. The Safety Star Pack is a tangible reward that puts weight behind your safety culture, because words in a safety meeting don’t move people the way a premium recognition kit does. A thank-you and a signal: we reward this, and we expect more of it.',
    included:['Safety achievement award','Recognition pin','Premium branded item','Personalized safety-record certificate','Branded presentation packaging'] },
  { id:'mp-07', num:'07', name:'Midnight Munch Pack', tier:'Premium', price:69.99, minQty:10,
    photos:['/images/mp-07-1.jpg'],
    blurb:'Energy-forward, bold late-night fuel built for the night shift.',
    description:'While the day-shift team clocks out, your night drivers are just getting started — delivering freight that needs to be there by morning, without the recognition that comes with being visible. The Midnight Munch Pack is built for the overnight grind: energy-forward, bold, satisfying. It tells your night drivers they’re not invisible — they’re the ones making everything else possible.',
    included:['Energy drinks & shots','Bold savory snacks','Protein & jerky','Late-night sweet selection','Branded recognition card'] },
  { id:'mp-08', num:'08', name:'Freightliner Breakroom Bundle', tier:'Essential', price:49.99, minQty:10,
    photos:['/images/mp-08-1.jpg'],
    blurb:'A generously stocked community tray that feeds the whole crew.',
    description:'Sometimes the most powerful thing you can do is walk into the terminal breakroom and leave something that feeds the whole crew. A generously stocked community tray of premium, shareable snacks designed to spark conversation, build camaraderie, and remind your entire team at once that leadership is paying attention. A communal spread does what a memo never can — it creates a moment.',
    included:['21-piece premium snack assortment','Shareable savory & sweet items','Variety packs','Breakroom-ready tray','Branded recognition card'] },
  { id:'mp-09', num:'09', name:'Safe Miles Appreciation Pack', tier:'Premium', price:69.99, minQty:10,
    blurb:'Recognize the steady, incident-free miles that keep your fleet running.',
    description:'Recognition for the quiet professionals who string together safe mile after safe mile. A premium appreciation kit that rewards the consistency most programs overlook — and reinforces the behavior you want every driver repeating.',
    included:['Premium recognition item','Safe-miles certificate','Branded apparel or accessory','Curated snack selection','Branded presentation packaging'] },
  { id:'mp-10', num:'10', name:'Retirement Road Tribute', tier:'Signature', price:89.99, minQty:10,
    blurb:'A signature send-off honoring a career spent moving freight.',
    description:'For the driver parking the rig for the last time. A signature tribute that honors a full career on the road — elevated, personal, and built to be displayed for years. The send-off that says this career mattered, and so did the person who lived it.',
    included:['Engraved commemorative award','Personalized tribute letter','Premium keepsake item','Career-milestone certificate','White-glove presentation box'] },
  { id:'mp-11', num:'11', name:'Iron Rig Recharge Box', tier:'Premium', price:69.99, minQty:10,
    blurb:'A rugged recharge kit for the drivers who run their equipment hard.',
    description:'For the drivers who run iron hard and keep rolling. A rugged recharge box of energy-forward fuel and quality road items — recognition built as tough as the work they do.',
    included:['Energy-forward snacks & drinks','Protein selection','Durable road accessory','Branded recognition card','Branded presentation packaging'] },
  { id:'mp-12', num:'12', name:'Reset Road Kit', tier:'Premium', price:69.99, minQty:10,
    blurb:'A reset-and-recover kit for the driver coming off a hard stretch.',
    description:'For the driver coming off a brutal stretch who needs to reset. A kit of recovery-minded snacks, hydration, and comfort items that help a driver come back to the road sharp — and feel that their company noticed the grind.',
    included:['Hydration & recovery items','Comfort snacks','Wellness accessory','Branded recognition card','Branded presentation packaging'] },
  { id:'mp-13', num:'13', name:'Dispatch Desk Drop', tier:'Essential', price:49.99, minQty:10,
    blurb:'A desk-side appreciation drop for the dispatchers behind the wheel-turners.',
    description:'The team that keeps every truck moving deserves recognition too. A desk-side appreciation drop of premium snacks and quality items for the dispatchers and coordinators who solve the problems drivers never see.',
    included:['Desk-friendly premium snacks','Beverage selection','Quality desk accessory','Branded recognition card','Branded packaging'] },
  { id:'mp-14', num:'14', name:'Night Dispatch Pack', tier:'Premium', price:69.99, minQty:10,
    blurb:'Built for the overnight operations crew keeping freight moving after dark.',
    description:'For the overnight operations crew running the board while the world sleeps. An energy-forward pack that keeps the night shift sharp and tells them their after-dark hours don’t go unnoticed.',
    included:['Energy drinks & shots','Bold savory snacks','Sustained-energy bars','Branded recognition card','Branded presentation packaging'] },
  { id:'mp-15', num:'15', name:'Trainer Appreciation Kit', tier:'Signature', price:89.99, minQty:10,
    blurb:'A signature thank-you for the veterans who build your next generation.',
    description:'Your trainers shape every driver who comes after them. A signature kit that recognizes the veterans who pass down the craft — elevated items that reflect the responsibility they carry and the standard they set.',
    included:['Premium branded item','Trainer recognition award','Personalized thank-you letter','Curated premium selection','White-glove presentation box'] },
  { id:'mp-16', num:'16', name:'Homestretch Kit', tier:'Premium', price:69.99, minQty:10,
    blurb:'A morale boost for the final push of a long run home.',
    description:'For the last leg of a long haul — the homestretch. A morale-boosting kit of premium fuel and quality touches that carry a driver through the final push and let them know the company is glad they’re almost home.',
    included:['Premium snacks','Energy & hydration items','Quality road accessory','Branded recognition card','Branded presentation packaging'] },
  { id:'mp-17', num:'17', name:'Family Appreciation Bundle', tier:'Premium', price:69.99, minQty:10,
    blurb:'Recognition that reaches past the cab to the family at home.',
    description:'Behind every driver is a family that shares the miles. A bundle that extends appreciation past the cab and into the home — because the people who keep the home running while a driver is on the road deserve a thank-you too.',
    included:['Family-friendly premium treats','Shareable snack selection','Keepsake item','Personalized family thank-you card','Branded presentation packaging'] },
  { id:'mp-18', num:'18', name:'Open Road Hydration & Fuel Kit', tier:'Premium', price:69.99, minQty:10,
    blurb:'A balanced hydration-and-fuel kit for the everyday long haul.',
    description:'The everyday workhorse kit — a balanced mix of premium hydration and sustaining fuel for drivers logging real distance. Reliable recognition that keeps a driver going and keeps your operation top of mind.',
    included:['Electrolyte hydration','Coconut water','Sustained-energy snacks','Protein selection','Branded recognition card'] },
  { id:'mp-19', num:'19', name:'Executive Fleet Recognition Box', tier:'Signature', price:89.99, minQty:10,
    blurb:'A signature, executive-grade recognition box for top performers.',
    description:'For your highest performers and most valued drivers. A signature, executive-grade recognition box — the most elevated expression of appreciation your fleet can hand someone, built to communicate that this person is exceptional and the company knows it.',
    included:['Executive-grade branded item','Premium keepsake','Personalized leadership letter','Recognition certificate','White-glove presentation box'] },
  { id:'mp-20', num:'20', name:'1 Million Miles Tribute', tier:'Signature', price:89.99, minQty:10,
    blurb:'A signature tribute for the rarest milestone in trucking.',
    description:'A million safe miles is the rarest achievement in trucking — a career’s worth of professionalism in a single number. This signature tribute honors that milestone with an award worthy of display, marking a driver who did the most dangerous job right, a million times over.',
    included:['Engraved million-mile award','Personalized milestone letter','Premium commemorative keepsake','Achievement certificate','White-glove presentation box'] },
  { id:'mp-21', num:'21', name:'Road Shield Wellness Kit', tier:'Premium', price:69.99, minQty:10,
    blurb:'A wellness-forward kit that protects the driver who protects your freight.',
    description:'The driver who protects your freight deserves protection too. A wellness-forward kit of health-minded items, hydration, and recovery essentials — recognition that says your operation invests in keeping drivers well, not just productive.',
    included:['Wellness & health items','Hydration essentials','Recovery & comfort items','Branded recognition card','Branded presentation packaging'] },
  { id:'mp-22', num:'22', name:'Cab Recovery Pack', tier:'Premium', price:69.99, minQty:10,
    blurb:'Recovery-focused comfort for the end of a demanding shift.',
    description:'For the end of a demanding shift, when a driver needs to recover before they roll again. A recovery-focused pack of comfort items, hydration, and quality touches that help a driver decompress — and feel the company noticed how hard they pushed.',
    included:['Recovery & comfort items','Hydration selection','Soothing snacks','Cab-friendly accessory','Branded presentation packaging'] },
  { id:'mp-23', num:'23', name:'Driver Health Essentials', tier:'Premium', price:69.99, minQty:10,
    blurb:'Everyday health essentials for life lived on the road.',
    description:'Life on the road makes health hard. A practical kit of everyday health essentials — better-for-you fuel, hydration, and wellness items that make the healthy choice the easy choice, and show drivers their wellbeing is part of how you do business.',
    included:['Better-for-you snacks','Hydration & electrolytes','Wellness essentials','Branded recognition card','Branded presentation packaging'] },
];

/* ════════ PRODUCT ARCHIVE ════════
   Archived products stay defined above (data retained) but are HIDDEN from the storefront —
   no shop card, no product page. To ARCHIVE a product, add its id here. To RESTORE it, remove
   the id. (Same `archived` flag is honored anywhere a renderer checks it — extend to other
   product sources as needed.)
   First archive batch (2026-05-30): the MILE PACKS that don't have real photos yet. */
window.DAS_MILEPACKS_ARCHIVED = [
  'mp-01',                                              // Road Warrior Fuel Pack (no photo yet)
  'mp-09','mp-10','mp-11','mp-12','mp-13','mp-14','mp-15',
  'mp-16','mp-17','mp-18','mp-19','mp-20','mp-21','mp-22','mp-23',
];
window.DAS_MILEPACKS.forEach(function (k) {
  if (window.DAS_MILEPACKS_ARCHIVED.indexOf(k.id) > -1) k.archived = true;
});
