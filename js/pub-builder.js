/* =============================================================
   DRIVER APPRECIATION SOLUTIONS
   Publications builder controller — js/pub-builder.js

   Browser-side. Talks to Supabase DIRECTLY as the logged-in user
   (getSupabase() → authenticated CDN client). RLS + the owner-scoped
   storage policies (migration 024) are the security boundary, so no
   service-role key ever touches the client. The ONE server call is the
   optional PDF render (/api/publications-generate).

   Globals it relies on (all defined before this runs):
     getSupabase, currentUser           (js/auth.js)
     showToast                          (js/cart.js)
     PortalAccount                      (js/portal.js)
     openModal, closeModal, escapeHtmlText, navigate  (account.html inline)
     PubRender                          (js/pub-render.js)
   ============================================================= */

/* ---- data layer: runs AS THE USER (RLS enforced) ---- */
const PubStore = {
  sb() {
    const s = (typeof getSupabase === 'function') ? getSupabase() : null;
    if (!s) throw new Error('Account service unavailable — please refresh.');
    return s;
  },
  async list() {
    const { data, error } = await this.sb()
      .from('das_publications')
      .select('id,title,format,quarter,year,page_count,status,settings,drivers,pdf_url,updated_at,created_at')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message || 'Could not load publications.');
    return data || [];
  },
  async get(id) {
    const { data, error } = await this.sb()
      .from('das_publications').select('*').eq('id', id).single();
    if (error) throw new Error(error.message || 'Issue not found.');
    return data;
  },
  async create(seed) {
    const { data, error } = await this.sb()
      .from('das_publications').insert(seed).select().single();
    if (error) throw new Error(error.message || 'Could not create issue.');
    return data;
  },
  async update(id, patch) {
    const { data, error } = await this.sb()
      .from('das_publications').update(patch).eq('id', id).select().single();
    if (error) throw new Error(error.message || 'Could not save.');
    return data;
  },
  async remove(id) {
    const { error } = await this.sb().from('das_publications').delete().eq('id', id);
    if (error) throw new Error(error.message || 'Could not delete.');
  },
  async uploadPhoto(file, pubId) {
    const sb = this.sb();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Session expired — please sign in again.');
    const uid = session.user.id;
    const ext = (String(file.name).split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = uid + '/' + pubId + '/driver-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const { error } = await sb.storage.from('publication-assets')
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
    if (error) throw new Error(error.message || 'Upload failed.');
    return sb.storage.from('publication-assets').getPublicUrl(path).data.publicUrl;
  },
  async generate(id) {
    const sb = this.sb();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Session expired — please sign in again.');
    const res = await fetch('/api/publications-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ id: id }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || ('PDF failed (HTTP ' + res.status + ')'));
    return j;
  },
};

/* ---- module state ---- */
let pubCurrent     = null;
let pubEditIndex   = -1;
let pubSaveTimer   = null;
let pubPreviewTimer = null;

/* ---- helpers ---- */
function pubSetVal(id, v) { const el = document.getElementById(id); if (el) el.value = (v == null ? '' : v); }
function pubGet(id)       { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
function pubGetInt(id)    { const v = parseInt(pubGet(id), 10); return isNaN(v) ? null : v; }
function pubEsc(s)        { return (typeof escapeHtmlText === 'function') ? escapeHtmlText(s) : String(s == null ? '' : s); }
function pubCssUrl(u)     { return String(u || '').replace(/'/g, '%27'); }
function pubToast(m, t)   { if (typeof showToast === 'function') showToast(m, t); }
function pubInitials(n) {
  const a = String(n || '').trim().split(/\s+/).filter(Boolean);
  if (!a.length) return '–';
  return (a[0][0] + (a.length > 1 ? a[a.length - 1][0] : '')).toUpperCase();
}
function pubStatusBadge(s) {
  if (s === 'published')  return { cls: 'bdg-green',  label: 'Published' };
  if (s === 'generating') return { cls: 'bdg-yellow', label: 'Generating' };
  return { cls: 'bdg-gray', label: 'Draft' };
}
function pubShareUrl(id) { return window.location.origin + '/pub?id=' + encodeURIComponent(id); }

/* ====================== LIST VIEW ====================== */
/* `publications` is the section render-fn referenced by navigate()'s map */
async function publications() {
  const host = document.getElementById('pub-list');
  if (!host) return;
  host.innerHTML = '<div class="p-card"><div class="p-card-body" style="color:#6B7280;font-size:0.85rem">Loading issues…</div></div>';
  try {
    pubRenderList(await PubStore.list());
  } catch (e) {
    host.innerHTML = '<div class="p-card"><div class="p-card-body" style="color:#B91C1C;font-size:0.85rem">'
      + pubEsc(e.message || 'Could not load publications.') + '</div></div>';
  }
}

function pubRenderList(items) {
  const host = document.getElementById('pub-list');
  if (!host) return;
  if (!items.length) {
    host.innerHTML =
      '<div class="p-card"><div class="p-empty">'
      + '<div class="p-empty-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5"/></svg></div>'
      + '<div class="p-empty-title">No issues yet</div>'
      + '<div class="p-empty-msg">Create your first driver-recognition newsletter and share it with your fleet.</div>'
      + '<button class="btn-p btn-p-primary" onclick="pubNew()">+ New Issue</button>'
      + '</div></div>';
    return;
  }
  host.innerHTML = '<div class="pb-grid">' + items.map(pubCard).join('') + '</div>';
}

function pubCard(p) {
  const issue = PubRender.issueLabel(p);
  const badge = pubStatusBadge(p.status);
  const dn = Array.isArray(p.drivers) ? p.drivers.filter(function (d) { return d && d.name; }).length : 0;
  const fmt = (PubRender.PUBLICATION_FORMATS[p.format] || {}).label || p.format || '';
  const id = String(p.id);
  return '<div class="pb-card">'
    + '<div class="pb-card-top"><span class="bdg ' + badge.cls + '">' + badge.label + '</span>'
    + '<span class="pb-card-fmt">' + pubEsc(fmt) + '</span></div>'
    + '<div class="pb-card-title">' + pubEsc(p.title || 'Untitled Issue') + '</div>'
    + '<div class="pb-card-meta">' + pubEsc(issue) + ' · ' + dn + ' driver' + (dn === 1 ? '' : 's') + '</div>'
    + '<div class="pb-card-actions">'
    + '<button class="btn-p btn-p-primary btn-p-sm" onclick="pubOpen(\'' + id + '\')">Edit</button>'
    + (p.status === 'published'
        ? '<button class="btn-p btn-p-ghost btn-p-sm" onclick="pubShareById(\'' + id + '\')">Copy link</button>'
        : '')
    + '<button class="btn-p btn-p-danger btn-p-sm" onclick="pubDelete(\'' + id + '\')">Delete</button>'
    + '</div></div>';
}

function pubShareById(id) {
  navigator.clipboard.writeText(pubShareUrl(id))
    .then(function () { pubToast('Share link copied!', 'success'); })
    .catch(function () { pubToast('Copy failed — link: ' + pubShareUrl(id), 'error'); });
}

async function pubDelete(id) {
  if (!window.confirm('Delete this issue? This cannot be undone.')) return;
  try { await PubStore.remove(id); pubToast('Issue deleted', 'success'); publications(); }
  catch (e) { pubToast(e.message || 'Could not delete', 'error'); }
}

/* ====================== OPEN / CREATE ====================== */
function pubSeed() {
  const acct = (typeof PortalAccount !== 'undefined' && PortalAccount.get) ? (PortalAccount.get() || {}) : {};
  const company = acct.companyName || (typeof currentUser !== 'undefined' && currentUser && currentUser.displayName) || '';
  const now = new Date();
  return {
    title:      'Untitled Issue',
    format:     PubRender.DEFAULT_FORMAT,
    quarter:    PubRender.QUARTERS[Math.floor(now.getMonth() / 3)] || 'Q1',
    year:       now.getFullYear(),
    page_count: PubRender.MIN_PAGE_COUNT,
    status:     'draft',
    settings:   { company_name: company, letter: '', back_note: '', modules: Object.assign({}, PubRender.DEFAULT_MODULES) },
    drivers:    [],
  };
}

async function pubNew() {
  try { pubOpenWith(await PubStore.create(pubSeed())); }
  catch (e) { pubToast(e.message || 'Could not create issue', 'error'); }
}

async function pubOpen(id) {
  try { pubOpenWith(await PubStore.get(id)); }
  catch (e) { pubToast(e.message || 'Could not open issue', 'error'); }
}

function pubNormalize(row) {
  const p = Object.assign({}, row);
  p.settings = p.settings || {};
  p.settings.modules = Object.assign({}, PubRender.DEFAULT_MODULES, p.settings.modules || {});
  if (typeof p.settings.company_name !== 'string') p.settings.company_name = '';
  if (typeof p.settings.letter !== 'string')       p.settings.letter = '';
  if (typeof p.settings.back_note !== 'string')     p.settings.back_note = '';
  p.drivers = Array.isArray(p.drivers) ? p.drivers : [];
  return p;
}

function pubOpenWith(row) {
  pubCurrent = pubNormalize(row);
  pubBindForm();
  pubRenderDrivers();
  pubRenderPreviewNow();
  pubBudgetHint();
  pubSyncHeader();
  pubSetStatusText('Saved');
  const ov = document.getElementById('pub-builder');
  if (ov) ov.classList.add('open');
  const body = document.getElementById('pb-body');
  if (body) body.classList.remove('show-preview');
  document.body.style.overflow = 'hidden';
}

function pubCloseBuilder() {
  clearTimeout(pubSaveTimer);
  if (pubCurrent && pubCurrent.id) pubSaveNow();
  const ov = document.getElementById('pub-builder');
  if (ov) ov.classList.remove('open');
  document.body.style.overflow = '';
  pubCurrent = null;
  publications();
}

/* ====================== FORM BINDING ====================== */
function pubBindForm() {
  const p = pubCurrent; if (!p) return;
  pubSetVal('pb-title', p.title || '');
  pubSetVal('pb-format', p.format || 'magazine');
  pubSetVal('pb-quarter', p.quarter || '');
  pubSetVal('pb-year', p.year || '');
  pubSetVal('pb-pagecount', p.page_count || 8);
  pubSetVal('pb-company', p.settings.company_name || '');
  pubSetVal('pb-letter', p.settings.letter || '');
  pubSetVal('pb-backnote', p.settings.back_note || '');
  ['toc', 'letter', 'milestones', 'safety', 'archive'].forEach(function (m) {
    const el = document.getElementById('pb-mod-' + m);
    if (el) el.checked = p.settings.modules[m] !== false;
  });
}

function pubField(key, val) {
  if (!pubCurrent) return;
  if (key === 'year' || key === 'page_count') { const n = parseInt(val, 10); val = isNaN(n) ? null : n; }
  pubCurrent[key] = val;
  pubAfterEdit();
}
function pubSetting(key, val) {
  if (!pubCurrent) return;
  pubCurrent.settings = pubCurrent.settings || {};
  pubCurrent.settings[key] = val;
  pubAfterEdit();
}
function pubModule(key, on) {
  if (!pubCurrent) return;
  pubCurrent.settings = pubCurrent.settings || {};
  pubCurrent.settings.modules = pubCurrent.settings.modules || {};
  pubCurrent.settings.modules[key] = !!on;
  pubAfterEdit();
}
function pubAfterEdit() { pubRefreshPreview(); pubBudgetHint(); pubScheduleSave(); }

/* ====================== AUTOSAVE ====================== */
function pubSetStatusText(t) { const el = document.getElementById('pb-save-status'); if (el) el.textContent = t; }
function pubScheduleSave() {
  pubSetStatusText('Saving…');
  clearTimeout(pubSaveTimer);
  pubSaveTimer = setTimeout(pubSaveNow, 900);
}
async function pubSaveNow() {
  if (!pubCurrent || !pubCurrent.id) return;
  try {
    const row = await PubStore.update(pubCurrent.id, {
      title:      pubCurrent.title,
      format:     pubCurrent.format,
      quarter:    pubCurrent.quarter || null,
      year:       pubCurrent.year,
      page_count: pubCurrent.page_count || 8,
      settings:   pubCurrent.settings,
      drivers:    pubCurrent.drivers,
    });
    pubCurrent.updated_at = row.updated_at;
    pubSetStatusText('Saved');
  } catch (e) {
    pubSetStatusText('Save failed');
    pubToast(e.message || 'Could not save', 'error');
  }
}

/* ====================== PREVIEW ====================== */
function pubRefreshPreview() {
  clearTimeout(pubPreviewTimer);
  pubPreviewTimer = setTimeout(pubRenderPreviewNow, 250);
}
function pubRenderPreviewNow() {
  const p = pubCurrent; if (!p) return;
  const frame = document.getElementById('pub-preview'); if (!frame) return;
  try { frame.srcdoc = PubRender.buildNewsletterHTML(p); }
  catch (e) { /* eslint-disable no-console */ console.warn('[pub] preview error', e); }
}
function pubPane(which) {
  const body = document.getElementById('pb-body');
  if (!body) return;
  const preview = which === 'preview';
  body.classList.toggle('show-preview', preview);
  if (preview) pubRenderPreviewNow();
  const tabs = document.querySelectorAll('.pb-tab');
  if (tabs[0]) tabs[0].classList.toggle('is-active', !preview);
  if (tabs[1]) tabs[1].classList.toggle('is-active', preview);
}

/* ====================== PAGE BUDGET ====================== */
function pubBudgetHint() {
  const p = pubCurrent; if (!p) return;
  const el = document.getElementById('pb-budget'); if (!el) return;
  const fmt = PubRender.PUBLICATION_FORMATS[p.format] || PubRender.PUBLICATION_FORMATS[PubRender.DEFAULT_FORMAT];
  const filled = p.drivers.filter(PubRender.isDriverContentFilled).length;
  const m = p.settings.modules || {};
  const b = PubRender.estimatePageBudget({
    pageCount: p.page_count, filledDrivers: filled, perPage: fmt.per_page,
    includeToC: m.toc !== false,
    includeMsg: m.letter !== false && !!String(p.settings.letter || '').trim(),
    includeMilestones: m.milestones !== false && p.drivers.some(function (d) { return d.milestone || d.years_of_service; }),
    includeSafety: m.safety !== false && p.drivers.some(function (d) { return d.accident_free_years || d.safe_miles; }),
  });
  el.textContent = b.message;
  el.className = 'pb-budget pb-budget--' + b.status;
}

/* ====================== HEADER / STATUS ACTIONS ====================== */
function pubSyncHeader() {
  const p = pubCurrent; if (!p) return;
  const b = pubStatusBadge(p.status);
  const badge = document.getElementById('pb-status');
  if (badge) { badge.className = 'bdg ' + b.cls; badge.textContent = b.label; }
  const pubBtn = document.getElementById('pb-publish-btn');
  if (pubBtn) pubBtn.textContent = (p.status === 'published') ? 'Unpublish' : 'Publish';
  const isPub = p.status === 'published';
  const share = document.getElementById('pb-share-btn');   if (share)  share.style.display  = isPub ? '' : 'none';
  const openP = document.getElementById('pb-openpub-btn'); if (openP)  openP.style.display  = isPub ? '' : 'none';
  const dl = document.getElementById('pb-download');
  if (dl) { if (p.pdf_url) { dl.style.display = ''; dl.href = p.pdf_url; } else dl.style.display = 'none'; }
}

async function pubPublishToggle() {
  if (!pubCurrent || !pubCurrent.id) return;
  const publishing = pubCurrent.status !== 'published';
  if (publishing && !String(pubCurrent.title || '').trim()) { pubToast('Give the issue a title first.', 'error'); return; }
  try {
    await pubSaveNow();
    const row = await PubStore.update(pubCurrent.id, { status: publishing ? 'published' : 'draft' });
    pubCurrent.status = row.status;
    pubSyncHeader();
    pubToast(publishing ? 'Published — share link is live.' : 'Unpublished.', 'success');
  } catch (e) { pubToast(e.message || 'Could not update status', 'error'); }
}

function pubCopyShare() {
  if (!pubCurrent) return;
  if (pubCurrent.status !== 'published') { pubToast('Publish first to share.', 'error'); return; }
  pubShareById(pubCurrent.id);
}
function pubOpenPublic() {
  if (!pubCurrent || pubCurrent.status !== 'published') { pubToast('Publish first to view.', 'error'); return; }
  window.open(pubShareUrl(pubCurrent.id), '_blank', 'noopener');
}

async function pubGenerate() {
  if (!pubCurrent || !pubCurrent.id) return;
  const btn = document.getElementById('pb-gen-btn');
  if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Generating…'; }
  try {
    await pubSaveNow();
    const j = await PubStore.generate(pubCurrent.id);
    if (j && j.pdf_url) pubCurrent.pdf_url = j.pdf_url;
    pubCurrent.status = 'published';
    pubSyncHeader();
    pubToast('PDF ready — download is in the toolbar.', 'success');
  } catch (e) {
    pubToast(e.message || 'PDF generation failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Generate PDF'; }
  }
}

/* ====================== DRIVERS ====================== */
function pubRenderDrivers() {
  const host = document.getElementById('pb-drivers');
  const p = pubCurrent; if (!host || !p) return;
  if (!p.drivers.length) {
    host.innerHTML = '<div class="pb-drv-empty">No drivers yet. Add your first spotlight.</div>';
    return;
  }
  host.innerHTML = p.drivers.map(function (d, i) {
    const thumb = d.photo_url
      ? '<span class="pb-drv-thumb" style="background-image:url(\'' + pubCssUrl(d.photo_url) + '\')"></span>'
      : '<span class="pb-drv-thumb pb-drv-thumb--mono">' + pubEsc(pubInitials(d.name)) + '</span>';
    const sub = pubEsc(PubRender.driverTypeLabel(d.driver_type) || '') + (d.milestone ? ' · ' + pubEsc(d.milestone) : '');
    return '<div class="pb-drv">' + thumb
      + '<div class="pb-drv-main"><div class="pb-drv-name">' + pubEsc(d.name || 'Unnamed') + '</div>'
      + '<div class="pb-drv-sub">' + sub + '</div></div>'
      + '<div class="pb-drv-actions">'
      + '<button class="btn-p btn-p-ghost btn-p-sm" onclick="pubDriverModalOpen(' + i + ')">Edit</button>'
      + '<button class="btn-p btn-p-danger btn-p-sm" onclick="pubRemoveDriver(' + i + ')">✕</button>'
      + '</div></div>';
  }).join('');
}

function pubRemoveDriver(i) {
  if (!pubCurrent) return;
  pubCurrent.drivers.splice(i, 1);
  pubRenderDrivers();
  pubAfterEdit();
}

function pubDriverModalOpen(idx) {
  if (!pubCurrent) return;
  pubEditIndex = (typeof idx === 'number' && idx >= 0) ? idx : -1;
  const d = pubEditIndex >= 0 ? (pubCurrent.drivers[pubEditIndex] || {}) : {};
  pubSetVal('pd-name', d.name || '');
  pubSetVal('pd-type', d.driver_type || '');
  pubSetVal('pd-milestone', d.milestone || '');
  pubSetVal('pd-years', d.years_of_service != null ? d.years_of_service : '');
  pubSetVal('pd-miles', d.safe_miles != null ? d.safe_miles : '');
  pubSetVal('pd-accfree', d.accident_free_years != null ? d.accident_free_years : '');
  pubSetVal('pd-terminal', d.home_terminal || '');
  pubSetVal('pd-route', d.favorite_route || '');
  pubSetVal('pd-quote', d.quote || '');
  pubSetVal('pd-achv', d.special_achievements || '');
  pubSetVal('pd-family', d.family_note || '');
  const vet = document.getElementById('pd-vet');    if (vet) vet.checked = !!d.is_veteran;
  const men = document.getElementById('pd-mentor'); if (men) men.checked = !!d.is_mentor;
  pubSetVal('pd-photo-url', d.photo_url || '');
  pubDriverPhotoPrev(d.photo_url || '');
  const status = document.getElementById('pd-photo-status'); if (status) status.textContent = '';
  const title = document.getElementById('pd-modal-title'); if (title) title.textContent = pubEditIndex >= 0 ? 'Edit Driver' : 'Add Driver';
  if (typeof openModal === 'function') openModal('pub-driver-modal');
}

function pubDriverPhotoPrev(url) {
  const prev = document.getElementById('pd-photo-prev');
  if (!prev) return;
  if (url) { prev.style.backgroundImage = "url('" + pubCssUrl(url) + "')"; prev.classList.add('has'); prev.textContent = ''; }
  else { prev.style.backgroundImage = ''; prev.classList.remove('has'); prev.textContent = 'No photo'; }
}

function pubDriverSave(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!pubCurrent) return;
  const name = pubGet('pd-name');
  if (!name) { pubToast('Driver name is required', 'error'); return; }
  const d = {
    name:                 name,
    driver_type:          pubGet('pd-type') || null,
    milestone:            pubGet('pd-milestone') || null,
    years_of_service:     pubGetInt('pd-years'),
    safe_miles:           pubGetInt('pd-miles'),
    accident_free_years:  pubGetInt('pd-accfree'),
    home_terminal:        pubGet('pd-terminal') || null,
    favorite_route:       pubGet('pd-route') || null,
    quote:                pubGet('pd-quote') || null,
    special_achievements: pubGet('pd-achv') || null,
    family_note:          pubGet('pd-family') || null,
    is_veteran:           !!(document.getElementById('pd-vet') && document.getElementById('pd-vet').checked),
    is_mentor:            !!(document.getElementById('pd-mentor') && document.getElementById('pd-mentor').checked),
    photo_url:            pubGet('pd-photo-url') || null,
  };
  if (pubEditIndex >= 0) pubCurrent.drivers[pubEditIndex] = d;
  else pubCurrent.drivers.push(d);
  if (typeof closeModal === 'function') closeModal('pub-driver-modal');
  pubRenderDrivers();
  pubAfterEdit();
}

async function pubUploadPhoto(input) {
  const file = input && input.files && input.files[0];
  if (!file) return;
  const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (okTypes.indexOf(file.type) === -1) { pubToast('Use a JPG, PNG, WEBP or GIF image.', 'error'); input.value = ''; return; }
  if (file.size > 5 * 1024 * 1024) { pubToast('Image must be under 5 MB.', 'error'); input.value = ''; return; }
  if (!pubCurrent || !pubCurrent.id) { pubToast('Save the issue first.', 'error'); input.value = ''; return; }
  const status = document.getElementById('pd-photo-status');
  if (status) status.textContent = 'Uploading…';
  try {
    const url = await PubStore.uploadPhoto(file, pubCurrent.id);
    pubSetVal('pd-photo-url', url);
    pubDriverPhotoPrev(url);
    if (status) status.textContent = 'Uploaded';
  } catch (e) {
    if (status) status.textContent = '';
    pubToast(e.message || 'Upload failed', 'error');
  } finally {
    input.value = '';
  }
}
