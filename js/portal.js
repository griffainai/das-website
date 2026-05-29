/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Portal Data Layer — Supabase-backed

   Real business data (orders, programs, roster,
   quotes, support tickets, cart templates) lives
   in the shared Supabase project and is read/written
   directly from the browser client, scoped by RLS to
   the signed-in user's company. No new serverless
   functions are introduced.

   Architecture:
     • PortalData.hydrate()  — async; pulls every table
       into an in-memory cache once, after auth.
     • Portal*.get()         — SYNC reads off the cache,
       so the existing render functions are unchanged.
     • Portal*.add/update/remove — optimistically mutate
       the cache (so the immediate re-render is correct)
       then persist async; on failure they re-hydrate to
       revert and surface a toast.

   Account onboarding prefs, saved product ideas, brand
   assets and team invites stay in localStorage — they're
   per-user UI personalization, not shared business data.
   ============================================= */

/* ── localStorage helpers (account / ideas / brand / team) ── */
const PK = {
  account:   'das_portal_account_v1',
  templates: 'das_portal_templates_v1',
  ideas:     'das_portal_ideas_v1',
  brand:     'das_portal_brand_v1',
  team:      'das_portal_team_v1',
};

function pGet(key)      { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function pSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function uid()          { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function fmtDate(iso)   { return iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
function fmtMoney(n)    { return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

/* Best-effort toast that degrades to console if the page helper isn't loaded. */
function _toast(msg, type) { try { (typeof showToast === 'function' ? showToast : console.log)(msg, type); } catch { /* noop */ } }
/* Re-render a section if its global renderer exists. */
function _rerender(section) { try { if (typeof window[section] === 'function') window[section](); } catch { /* noop */ } }

/* ════════════════════════════════════════════
   PortalData — Supabase cache + hydration
════════════════════════════════════════════ */
const PortalData = {
  ready:     false,
  companyId: null,
  userId:    null,
  cache: { orders: [], programs: [], roster: [], quotes: [], tickets: [], templates: [] },

  sb() { try { return (typeof getSupabase === 'function') ? getSupabase() : null; } catch { return null; } },

  /* Pull every table into the cache. Safe to call more than once. */
  async hydrate() {
    const sb = this.sb();
    if (!sb) { this.ready = true; return false; }
    try {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { this.ready = true; return false; }
      this.userId = user.id;

      const { data: profile } = await sb.from('users').select('company_id').eq('id', user.id).single();
      this.companyId = (profile && profile.company_id) || null;
      if (!this.companyId) { this.ready = true; return true; }

      const cid = this.companyId;
      // allSettled (not all): one failing or slow table must not wipe the rest.
      const [orders, programs, drivers, quotes, tickets, templates] = await Promise.allSettled([
        sb.from('das_orders').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
        sb.from('recognition_programs').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
        sb.from('drivers').select('*').eq('company_id', cid).eq('active', true).order('last_name'),
        sb.from('quotes').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
        sb.from('support_tickets').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
        sb.from('cart_templates').select('*').eq('company_id', cid).order('created_at', { ascending: false }),
      ]);
      const rows = r => (r && r.status === 'fulfilled' && r.value && r.value.data) ? r.value.data : [];

      this.cache.orders    = rows(orders).map(mapOrder);
      this.cache.programs  = rows(programs).map(mapProgram);
      this.cache.roster    = rows(drivers).map(mapDriver);
      this.cache.quotes    = rows(quotes).map(mapQuote);
      this.cache.tickets   = rows(tickets).map(mapTicket);
      this.cache.templates = rows(templates).map(mapTemplate);

      this.ready = true;
      return true;
    } catch (err) {
      console.error('[PortalData] hydrate failed', err);
      this.ready = true;
      return false;
    }
  },

  /* Re-pull a single table and re-render its section (used to revert a failed write). */
  async refresh(table, mapFn, cacheKey, section) {
    const sb = this.sb();
    if (!sb || !this.companyId) return;
    const { data } = await sb.from(table).select('*').eq('company_id', this.companyId).order('created_at', { ascending: false });
    this.cache[cacheKey] = (data || []).map(mapFn);
    _rerender(section);
  },
};

/* ── DB row → UI shape mappers ───────────────── */
function mapOrder(r) {
  const arr = Array.isArray(r.items) ? r.items : [];
  const units = arr.reduce((s, it) => s + (Number(it.qty || it.quantity || it.units) || 0), 0);
  return {
    id:        r.order_number || r.id,
    dbId:      r.id,
    createdAt: r.created_at,
    items:     arr.length ? (arr.length + ' item' + (arr.length === 1 ? '' : 's')) : '—',
    units:     units,
    total:     Number(r.total) || 0,
    status:    r.status,
  };
}
function mapProgram(r) {
  return {
    id:          r.id,
    name:        r.name,
    type:        r.type,
    trigger:     r.trigger_type,
    triggerDate: r.trigger_date,
    driverCount: r.driver_count || 0,
    budget:      r.budget_per_driver || 0,
    status:      r.status,
    lastRun:     r.last_run || null,
    createdAt:   r.created_at,
  };
}
function mapDriver(r) {
  return {
    id:       r.id,
    name:     [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || '—',
    email:    r.email || '',
    dept:     r.department || '',
    hireDate: r.hire_date || null,
  };
}
function mapQuote(r) {
  return {
    id:          r.id,
    createdAt:   r.created_at,
    productType: r.type || 'General',
    status:      r.status || 'submitted',
  };
}
function mapTicket(r) {
  return {
    id:        r.id,
    createdAt: r.created_at,
    subject:   r.subject,
    priority:  r.priority || 'normal',
    status:    r.status || 'open',
  };
}
function mapTemplate(r) {
  return { id: r.id, name: r.name, items: r.items || [], createdAt: r.created_at };
}

/* ════════════════════════════════════════════
   Account / Onboarding (localStorage — UI prefs)
════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════
   Orders (das_orders — read-only here; created at checkout)
════════════════════════════════════════════ */
const PortalOrders = {
  get()      { return PortalData.cache.orders; },
  ytdSpend() {
    const yr = new Date().getFullYear();
    return this.get().filter(o => new Date(o.createdAt).getFullYear() === yr).reduce((s,o) => s + (o.total || 0), 0);
  },
  totalUnits() { return this.get().reduce((s,o) => s + (o.units || 0), 0); },
};

/* ════════════════════════════════════════════
   Order / Cart Templates (cart_templates)
════════════════════════════════════════════ */
const PortalTemplates = {
  get() { return PortalData.cache.templates; },
  async add(t) {
    const sb = PortalData.sb();
    const optimistic = { id: 'tmp-' + uid(), name: t.name, items: t.items || [], createdAt: new Date().toISOString() };
    PortalData.cache.templates.unshift(optimistic);
    _rerender('orders');
    if (!sb || !PortalData.companyId) return optimistic;
    const { data, error } = await sb.from('cart_templates').insert({
      company_id: PortalData.companyId, created_by: PortalData.userId,
      name: t.name, notes: t.notes || null, items: t.items || [],
    }).select().single();
    if (error) { _toast('Could not save template.', 'error'); await PortalData.refresh('cart_templates', mapTemplate, 'templates', 'orders'); return null; }
    optimistic.id = data.id;
    _rerender('orders');
    return optimistic;
  },
  async remove(id) {
    PortalData.cache.templates = PortalData.cache.templates.filter(t => t.id !== id);
    const sb = PortalData.sb();
    if (!sb) return;
    const { error } = await sb.from('cart_templates').delete().eq('id', id);
    if (error) { _toast('Could not remove template.', 'error'); await PortalData.refresh('cart_templates', mapTemplate, 'templates', 'orders'); }
  },
};

/* ════════════════════════════════════════════
   Programs (recognition_programs)
════════════════════════════════════════════ */
const PortalPrograms = {
  get() { return PortalData.cache.programs; },
  async add(p) {
    const sb = PortalData.sb();
    const optimistic = {
      id: 'tmp-' + uid(), name: p.name, type: p.type, trigger: p.trigger,
      triggerDate: p.triggerDate || null, driverCount: p.driverCount || 0,
      budget: p.budget || 0, status: p.status || 'active', lastRun: null,
      createdAt: new Date().toISOString(),
    };
    PortalData.cache.programs.unshift(optimistic);
    _rerender('programs');
    if (!sb || !PortalData.companyId) { _toast('Not linked to a company yet — program saved locally only.', 'error'); return optimistic; }
    const { data, error } = await sb.from('recognition_programs').insert({
      company_id:        PortalData.companyId,
      name:              p.name,
      type:              p.type,
      trigger_type:      p.trigger,
      trigger_date:      p.triggerDate || null,
      driver_count:      p.driverCount || 0,
      budget_per_driver: p.budget || 0,
      status:            p.status || 'active',
    }).select().single();
    if (error) { _toast('Could not save program.', 'error'); await PortalData.refresh('recognition_programs', mapProgram, 'programs', 'programs'); return null; }
    optimistic.id = data.id;
    _rerender('programs');
    return optimistic;
  },
  async update(id, d) {
    PortalData.cache.programs = PortalData.cache.programs.map(p => p.id === id ? { ...p, ...d } : p);
    const sb = PortalData.sb();
    if (!sb) return;
    const patch = {};
    if (d.status      !== undefined) patch.status            = d.status;
    if (d.name        !== undefined) patch.name              = d.name;
    if (d.driverCount !== undefined) patch.driver_count      = d.driverCount;
    if (d.budget      !== undefined) patch.budget_per_driver = d.budget;
    const { error } = await sb.from('recognition_programs').update(patch).eq('id', id);
    if (error) { _toast('Could not update program.', 'error'); await PortalData.refresh('recognition_programs', mapProgram, 'programs', 'programs'); }
  },
  async remove(id) {
    PortalData.cache.programs = PortalData.cache.programs.filter(p => p.id !== id);
    const sb = PortalData.sb();
    if (!sb) return;
    const { error } = await sb.from('recognition_programs').delete().eq('id', id);
    if (error) { _toast('Could not remove program.', 'error'); await PortalData.refresh('recognition_programs', mapProgram, 'programs', 'programs'); }
  },
};

/* ════════════════════════════════════════════
   Driver Roster (drivers)
════════════════════════════════════════════ */
function _splitName(full) {
  const parts = String(full || '').trim().split(/\s+/);
  const first = parts.shift() || '';
  const last  = parts.join(' ') || '';
  return { first, last };
}

const PortalRoster = {
  get() { return PortalData.cache.roster; },
  async add(d) {
    const sb = PortalData.sb();
    const { first, last } = _splitName(d.name);
    const optimistic = { id: 'tmp-' + uid(), name: d.name, email: d.email || '', dept: d.dept || '', hireDate: d.hireDate || null };
    PortalData.cache.roster.push(optimistic);
    PortalData.cache.roster.sort((a, b) => a.name.localeCompare(b.name));
    _rerender('roster');
    if (!sb || !PortalData.companyId) { _toast('Not linked to a company yet — driver saved locally only.', 'error'); return optimistic; }
    const { data, error } = await sb.from('drivers').insert({
      company_id: PortalData.companyId,
      first_name: first, last_name: last,
      department: d.dept || null, hire_date: d.hireDate || null,
      email: d.email || null,
    }).select().single();
    if (error) { _toast('Could not add driver.', 'error'); await PortalData.refresh('drivers', mapDriver, 'roster', 'roster'); return null; }
    optimistic.id = data.id;
    _rerender('roster');
    return optimistic;
  },
  async remove(id) {
    PortalData.cache.roster = PortalData.cache.roster.filter(d => d.id !== id);
    const sb = PortalData.sb();
    if (!sb) return;
    // Soft delete: deactivate so it drops out of the active roster but is recoverable.
    const { error } = await sb.from('drivers').update({ active: false }).eq('id', id);
    if (error) { _toast('Could not remove driver.', 'error'); await PortalData.refresh('drivers', mapDriver, 'roster', 'roster'); }
  },
  async importCSV(rows) {
    const sb = PortalData.sb();
    if (!sb || !PortalData.companyId) {
      // Local-only fallback.
      rows.forEach(r => PortalData.cache.roster.push({ id: 'tmp-' + uid(), name: r.name, email: r.email || '', dept: r.dept || '', hireDate: r.hireDate || null }));
      PortalData.cache.roster.sort((a, b) => a.name.localeCompare(b.name));
      return rows.length;
    }
    const inserts = rows.map(r => {
      const { first, last } = _splitName(r.name);
      return { company_id: PortalData.companyId, first_name: first, last_name: last, department: r.dept || null, hire_date: r.hireDate || null, email: r.email || null };
    }).filter(r => r.first_name);
    let imported = 0;
    for (let i = 0; i < inserts.length; i += 50) {
      const batch = inserts.slice(i, i + 50);
      const { error } = await sb.from('drivers').insert(batch);
      if (!error) imported += batch.length;
    }
    await PortalData.refresh('drivers', mapDriver, 'roster', 'roster');
    return imported;
  },
  milestones() {
    const now = new Date();
    return this.get().filter(d => {
      if (!d.hireDate) return false;
      const hire = new Date(d.hireDate);
      const daysEmployed = (now - hire) / 86400000;
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

/* ════════════════════════════════════════════
   Invoices (no table yet — derived later from Stripe/orders)
════════════════════════════════════════════ */
const PortalInvoices = {
  get() { return []; },
};

/* ════════════════════════════════════════════
   Quotes (quotes)
════════════════════════════════════════════ */
const PortalQuotes = {
  get() { return PortalData.cache.quotes; },
  async add(q) {
    const sb = PortalData.sb();
    const optimistic = { id: 'tmp-' + uid(), createdAt: new Date().toISOString(), productType: q.productType || 'General', status: 'submitted' };
    PortalData.cache.quotes.unshift(optimistic);
    _rerender('quotes');
    if (!sb || !PortalData.companyId) { _toast('Not linked to a company yet — quote saved locally only.', 'error'); return optimistic; }
    const notes = [q.notes, q.fleetSize ? ('Fleet size: ' + q.fleetSize) : '']
      .map(s => (s || '').toString().trim()).filter(Boolean).join(' — ') || null;
    const { data, error } = await sb.from('quotes').insert({
      company_id:        PortalData.companyId,
      user_id:           PortalData.userId,
      type:              q.productType || 'General',
      driver_count:      parseInt(q.quantity, 10) || null,
      budget_per_driver: parseInt(q.budget, 10) || null,
      timeline:          q.timing || null,
      notes:             notes,
      status:            'submitted',
    }).select().single();
    if (error) { _toast('Could not submit quote.', 'error'); await PortalData.refresh('quotes', mapQuote, 'quotes', 'quotes'); return null; }
    optimistic.id = data.id;
    _rerender('quotes');
    return optimistic;
  },
};

/* ════════════════════════════════════════════
   Support Tickets (support_tickets)
════════════════════════════════════════════ */
const PortalTickets = {
  get() { return PortalData.cache.tickets; },
  async add(t) {
    const sb = PortalData.sb();
    const optimistic = { id: 'tmp-' + uid(), createdAt: new Date().toISOString(), subject: t.subject, priority: t.priority || 'normal', status: 'open' };
    PortalData.cache.tickets.unshift(optimistic);
    _rerender('support');
    if (!sb || !PortalData.companyId) { _toast('Not linked to a company yet — ticket saved locally only.', 'error'); return optimistic; }
    const message = [t.message, t.orderId ? ('Related order: ' + t.orderId) : '']
      .map(s => (s || '').toString().trim()).filter(Boolean).join('\n\n');
    const { data, error } = await sb.from('support_tickets').insert({
      company_id: PortalData.companyId,
      user_id:    PortalData.userId,
      subject:    t.subject,
      message:    message,
      category:   'general',
      priority:   t.priority || 'normal',
      status:     'open',
    }).select().single();
    if (error) { _toast('Could not submit ticket.', 'error'); await PortalData.refresh('support_tickets', mapTicket, 'tickets', 'support'); return null; }
    optimistic.id = data.id;
    _rerender('support');
    return optimistic;
  },
};

/* ════════════════════════════════════════════
   Saved Ideas (localStorage — product wishlist)
════════════════════════════════════════════ */
const PortalIdeas = {
  get()       { return pGet(PK.ideas) || []; },
  save(l)     { pSet(PK.ideas, l); },
  toggle(idea){ const l = this.get(); const i = l.findIndex(x => x.id===idea.id); if (i>-1) { l.splice(i,1); } else { l.push({...idea,savedAt:new Date().toISOString()}); } this.save(l); return i===-1; },
  has(id)     { return this.get().some(i => i.id===id); },
};

/* ════════════════════════════════════════════
   Brand Assets (localStorage)
════════════════════════════════════════════ */
const PortalBrand = {
  get()       { return pGet(PK.brand) || { logos:[], colors:[], msgTemplates:[] }; },
  set(d)      { pSet(PK.brand, { ...this.get(), ...d }); },
  addLogo(l)  { const b = this.get(); b.logos.push(l); this.set(b); },
  removeLogo(i){ const b = this.get(); b.logos.splice(i,1); this.set(b); },
};

/* ════════════════════════════════════════════
   Team / Users (localStorage — invites placeholder)
════════════════════════════════════════════ */
const PortalTeam = {
  get()        { return pGet(PK.team) || []; },
  save(l)      { pSet(PK.team, l); },
  invite(m)    { const l = this.get(); l.push({ ...m, id:'USR-'+uid(), status:'invited', invitedAt:new Date().toISOString() }); this.save(l); },
  remove(id)   { this.save(this.get().filter(m => m.id !== id)); },
};

/* ════════════════════════════════════════════
   ROI Calculator
════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════
   Program Calendar Events (static reference data)
════════════════════════════════════════════ */
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

/* Legacy no-op: demo seeding is gone now that data is real. */
function seedDemoData() { /* intentionally empty — real data comes from Supabase */ }
