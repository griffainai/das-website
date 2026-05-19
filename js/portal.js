/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Portal Data Layer — localStorage-backed
   ============================================= */

const PK = {
  account:   'das_portal_account_v1',
  orders:    'das_portal_orders_v1',
  templates: 'das_portal_templates_v1',
  programs:  'das_portal_programs_v1',
  roster:    'das_portal_roster_v1',
  invoices:  'das_portal_invoices_v1',
  quotes:    'das_portal_quotes_v1',
  ideas:     'das_portal_ideas_v1',
  tickets:   'das_portal_tickets_v1',
  brand:     'das_portal_brand_v1',
  team:      'das_portal_team_v1',
};

function pGet(key)      { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function pSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function uid()          { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function fmtDate(iso)   { return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
function fmtMoney(n)    { return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* ── Account / Onboarding ─────────────────── */
const PortalAccount = {
  get()         { return pGet(PK.account) || {}; },
  set(d)        { pSet(PK.account, { ...this.get(), ...d }); },
  isOnboarded() { return !!(pGet(PK.account) || {}).onboarded; },
  complete(data){ this.set({ ...data, onboarded: true, onboardedAt: new Date().toISOString() }); },

  loyaltyTier(spend) {
    if (spend >= 35000) return { name:'Fleet Elite',   discount:20, color:'#1A2E6E', next:null,           nextAt:null  };
    if (spend >= 15000) return { name:'Fleet Pro',     discount:15, color:'#0066CC', next:'Fleet Elite',  nextAt:35000 };
    if (spend >= 5000)  return { name:'Fleet Partner', discount:8,  color:'#059669', next:'Fleet Pro',    nextAt:15000 };
    return               { name:'Starter',       discount:0,  color:'#6B7280', next:'Fleet Partner',nextAt:5000  };
  },

  referralCode(uid) {
    const h = [...(uid||'x')].reduce((a,c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
    return 'DAS-' + h.toString(36).toUpperCase().slice(0,6);
  },
};

/* ── Orders ───────────────────────────────── */
const PortalOrders = {
  get()      { return pGet(PK.orders) || []; },
  save(l)    { pSet(PK.orders, l); },
  add(o)     { const l = this.get(); l.unshift({ ...o, id:'ORD-'+uid(), createdAt:new Date().toISOString() }); this.save(l); return l[0]; },
  ytdSpend() {
    const yr = new Date().getFullYear();
    return this.get().filter(o => new Date(o.createdAt).getFullYear() === yr).reduce((s,o) => s+(o.total||0), 0);
  },
  totalUnits() { return this.get().reduce((s,o) => s+(o.units||0), 0); },
};

/* ── Order Templates ──────────────────────── */
const PortalTemplates = {
  get()      { return pGet(PK.templates) || []; },
  save(l)    { pSet(PK.templates, l); },
  add(t)     { const l = this.get(); l.push({ ...t, id:'TPL-'+uid(), createdAt:new Date().toISOString() }); this.save(l); },
  remove(id) { this.save(this.get().filter(t => t.id !== id)); },
};

/* ── Programs ─────────────────────────────── */
const PortalPrograms = {
  get()         { return pGet(PK.programs) || []; },
  save(l)       { pSet(PK.programs, l); },
  add(p)        { const l = this.get(); l.push({ ...p, id:'PRG-'+uid(), createdAt:new Date().toISOString() }); this.save(l); },
  remove(id)    { this.save(this.get().filter(p => p.id !== id)); },
  update(id, d) { this.save(this.get().map(p => p.id===id ? {...p,...d} : p)); },
};

/* ── Driver Roster ────────────────────────── */
const PortalRoster = {
  get()        { return pGet(PK.roster) || []; },
  save(l)      { pSet(PK.roster, l); },
  add(d)       { const l = this.get(); l.push({ ...d, id:'DRV-'+uid(), addedAt:new Date().toISOString() }); this.save(l); },
  remove(id)   { this.save(this.get().filter(d => d.id !== id)); },
  importCSV(rows) {
    const l = this.get();
    rows.forEach(r => l.push({ ...r, id:'DRV-'+uid(), addedAt:new Date().toISOString() }));
    this.save(l);
    return rows.length;
  },
  milestones() {
    const now = new Date();
    return this.get().filter(d => {
      if (!d.hireDate) return false;
      const hire = new Date(d.hireDate);
      const msPerDay = 86400000;
      const daysEmployed = (now - hire) / msPerDay;
      const yearsElapsed = daysEmployed / 365;
      const nextYear = Math.ceil(yearsElapsed);
      const daysToNext = (nextYear * 365) - daysEmployed;
      return daysToNext >= 0 && daysToNext <= 60;
    }).map(d => {
      const hire = new Date(d.hireDate);
      const daysEmployed = (now - hire) / 86400000;
      const nextYear = Math.ceil(daysEmployed / 365);
      const daysToNext = Math.round((nextYear * 365) - daysEmployed);
      return { ...d, nextYear, daysToNext };
    });
  },
};

/* ── Invoices ─────────────────────────────── */
const PortalInvoices = {
  get()   { return pGet(PK.invoices) || []; },
  save(l) { pSet(PK.invoices, l); },
  add(i)  { const l = this.get(); l.unshift({ ...i, id:'INV-'+uid(), createdAt:new Date().toISOString() }); this.save(l); },
};

/* ── Quotes ───────────────────────────────── */
const PortalQuotes = {
  get()   { return pGet(PK.quotes) || []; },
  save(l) { pSet(PK.quotes, l); },
  add(q)  { const l = this.get(); l.unshift({ ...q, id:'QTE-'+uid(), status:'submitted', createdAt:new Date().toISOString() }); this.save(l); return l[0]; },
};

/* ── Saved Ideas ──────────────────────────── */
const PortalIdeas = {
  get()       { return pGet(PK.ideas) || []; },
  save(l)     { pSet(PK.ideas, l); },
  toggle(idea){ const l = this.get(); const i = l.findIndex(x => x.id===idea.id); if (i>-1) { l.splice(i,1); } else { l.push({...idea,savedAt:new Date().toISOString()}); } this.save(l); return i===-1; },
  has(id)     { return this.get().some(i => i.id===id); },
};

/* ── Support Tickets ──────────────────────── */
const PortalTickets = {
  get()       { return pGet(PK.tickets) || []; },
  save(l)     { pSet(PK.tickets, l); },
  add(t)      { const l = this.get(); l.unshift({ ...t, id:'TKT-'+uid(), status:'open', createdAt:new Date().toISOString() }); this.save(l); return l[0]; },
  resolve(id) { this.save(this.get().map(t => t.id===id ? {...t,status:'resolved',resolvedAt:new Date().toISOString()} : t)); },
};

/* ── Brand Assets ─────────────────────────── */
const PortalBrand = {
  get()       { return pGet(PK.brand) || { logos:[], colors:[], msgTemplates:[] }; },
  set(d)      { pSet(PK.brand, { ...this.get(), ...d }); },
  addLogo(l)  { const b = this.get(); b.logos.push(l); this.set(b); },
  removeLogo(i){ const b = this.get(); b.logos.splice(i,1); this.set(b); },
};

/* ── Team / Users ─────────────────────────── */
const PortalTeam = {
  get()        { return pGet(PK.team) || []; },
  save(l)      { pSet(PK.team, l); },
  invite(m)    { const l = this.get(); l.push({ ...m, id:'USR-'+uid(), status:'invited', invitedAt:new Date().toISOString() }); this.save(l); },
  remove(id)   { this.save(this.get().filter(m => m.id !== id)); },
};

/* ── ROI Calculator ───────────────────────── */
const PortalROI = {
  calculate(fleetSize, ytdSpend) {
    const atRisk  = Math.round(fleetSize * 0.25);
    const retained = Math.round(atRisk * 0.20);
    const savings  = retained * 12799;
    const roi      = ytdSpend > 0 ? Math.round((savings - ytdSpend) / ytdSpend * 100) : 0;
    return { fleetSize, ytdSpend, atRisk, retained, savings, roi,
             costPerDriver: fleetSize > 0 && ytdSpend > 0 ? Math.round(ytdSpend/fleetSize) : 0 };
  },
};

/* ── Program Calendar Events ──────────────── */
const CALENDAR_EVENTS = [
  { name:'Driver Appreciation Week', month:9,  day:7,  type:'appreciation', leadDays:60, emoji:'🚛' },
  { name:'Holiday Gift Program',     month:12, day:1,  type:'holiday',      leadDays:45, emoji:'🎁' },
  { name:'Safety Month',             month:6,  day:1,  type:'safety',       leadDays:30, emoji:'🛡️' },
  { name:'New Year Recognition',     month:1,  day:10, type:'appreciation', leadDays:21, emoji:'⭐' },
];

function getUpcomingEvents(count=3) {
  const now = new Date();
  return CALENDAR_EVENTS.map(e => {
    let d = new Date(now.getFullYear(), e.month-1, e.day);
    if (d <= now) d = new Date(now.getFullYear()+1, e.month-1, e.day);
    const daysAway = Math.ceil((d - now) / 86400000);
    const orderBy  = new Date(d); orderBy.setDate(orderBy.getDate() - e.leadDays);
    return { ...e, eventDate:d, daysAway, orderBy, late: orderBy < now };
  }).sort((a,b) => a.daysAway - b.daysAway).slice(0, count);
}

/* ── Seed demo data for new accounts ─────── */
function seedDemoData() {
  if (PortalPrograms.get().length > 0) return;
  PortalPrograms.save([
    { id:'PRG-demo1', name:'Driver Appreciation Week', type:'appreciation', trigger:'annual', triggerDate:'09-07', driverCount:50, budget:50, status:'active', createdAt:'2025-01-01T00:00:00Z', lastRun:'2025-09-07T00:00:00Z' },
    { id:'PRG-demo2', name:'New Driver Welcome Kit',   type:'onboarding',   trigger:'rolling', triggerDate:null, driverCount:0,  budget:60, status:'active', createdAt:'2025-01-01T00:00:00Z', lastRun:null },
    { id:'PRG-demo3', name:'Safety Milestone Awards',  type:'safety',       trigger:'milestone', triggerDate:null, driverCount:0, budget:45, status:'active', createdAt:'2025-01-01T00:00:00Z', lastRun:null },
  ]);
}
