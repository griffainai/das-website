/* =============================================================
   DRIVER APPRECIATION SOLUTIONS
   Publications — server-side PDF generation
   POST /api/publications-generate   body: { id }

   Auth: the caller's OWN Supabase access token
         (Authorization: Bearer <token>). No service-role key —
         every DB/storage op runs as the user, so RLS + the
         owner-scoped storage policies (migration 024) apply.

   Flow:
     1. verify token  → uid
     2. read the issue (RLS: owner only)
     3. render HTML via the SHARED renderer (js/pub-render.js)
     4. Chromium (puppeteer-core + @sparticuz/chromium) → PDF buffer
     5. upload PDF to publication-assets/{uid}/{id}/issue-<ts>.pdf
     6. patch row: pdf_url + status='published'
     7. return { ok, pdf_url }

   NOTE: publishing itself does NOT require this endpoint — the
   builder publishes (status='published') directly and the public
   /pub page renders HTML live. This endpoint only mints the
   downloadable PDF artifact, so a Chromium hiccup never blocks
   sharing.
   ============================================================= */

const PubRender = require('../js/pub-render.js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || '';
const BUCKET       = 'publication-assets';

/* ---- tiny Supabase REST helpers that run AS THE USER ---- */
function userHeaders(token, extra) {
  return Object.assign({
    apikey:        ANON_KEY,
    Authorization: 'Bearer ' + token,
  }, extra || {});
}

async function getUser(token) {
  try {
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: userHeaders(token) });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  } catch { return null; }
}

async function getIssue(token, id) {
  const q = '/rest/v1/das_publications?id=eq.' + encodeURIComponent(id) + '&select=*&limit=1';
  const r = await fetch(SUPABASE_URL + q, { headers: userHeaders(token, { Accept: 'application/json' }) });
  if (!r.ok) return { ok: false, status: r.status, data: await r.text().catch(() => '') };
  const rows = await r.json().catch(() => []);
  return { ok: true, row: Array.isArray(rows) && rows[0] ? rows[0] : null };
}

async function uploadPdf(token, path, buffer) {
  const r = await fetch(SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + path, {
    method:  'POST',
    headers: userHeaders(token, { 'Content-Type': 'application/pdf', 'x-upsert': 'true', 'cache-control': '3600' }),
    body:    buffer,
  });
  return { ok: r.ok, status: r.status, data: await r.text().catch(() => '') };
}

async function patchIssue(token, id, patch) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/das_publications?id=eq.' + encodeURIComponent(id), {
    method:  'PATCH',
    headers: userHeaders(token, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body:    JSON.stringify(patch),
  });
  if (!r.ok) return { ok: false, status: r.status, data: await r.text().catch(() => '') };
  const rows = await r.json().catch(() => []);
  return { ok: true, row: Array.isArray(rows) && rows[0] ? rows[0] : null };
}

/* ---- Chromium render ---- */
async function htmlToPdf(html) {
  const chromium  = require('@sparticuz/chromium');
  const puppeteer = require('puppeteer-core');

  const browser = await puppeteer.launch({
    args:            chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath:  await chromium.executablePath(),
    headless:        chromium.headless,
  });
  try {
    const page = await browser.newPage();
    // networkidle0 so remote driver photos finish loading before we print
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.emulateMediaType('print');
    const pdf = await page.pdf({
      printBackground:    true,
      preferCSSPageSize:  true,   // honor the @page size set by the renderer
      margin:             { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return pdf;
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = async (req, res) => {
  const allowedOrigin = process.env.SITE_URL || '*';
  res.setHeader('Access-Control-Allow-Origin',  allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  if (!SUPABASE_URL || !ANON_KEY) {
    console.error('[publications-generate] SUPABASE_URL / SUPABASE_ANON_KEY not configured');
    return res.status(500).json({ error: 'Server not configured' });
  }

  // 1. auth
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(authHeader));
  const token = m ? m[1].trim() : null;
  if (!token) return res.status(401).json({ error: 'Sign in to generate a PDF.' });

  const user = await getUser(token);
  if (!user) return res.status(401).json({ error: 'Session expired — please sign in again.' });

  // 2. input
  const body = req.body || {};
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'Missing publication id' });

  // 3. fetch issue (RLS: owner only)
  const found = await getIssue(token, id);
  if (!found.ok)  return res.status(found.status || 500).json({ error: 'Could not load issue', detail: found.data });
  if (!found.row) return res.status(404).json({ error: 'Issue not found' });
  const pub = found.row;

  // 4. render + 5. PDF
  let pdfBuffer;
  try {
    const html = PubRender.buildNewsletterHTML(pub);
    pdfBuffer = await htmlToPdf(html);
  } catch (err) {
    console.error('[publications-generate] render/pdf failed:', err && err.message, err && err.stack);
    return res.status(500).json({ error: 'PDF generation failed', detail: String(err && err.message || err) });
  }

  // 6. upload to the caller's own folder
  const ts   = Date.now();
  const path = user.id + '/' + id + '/issue-' + ts + '.pdf';
  const up = await uploadPdf(token, path, pdfBuffer);
  if (!up.ok) {
    console.error('[publications-generate] upload failed:', up.status, up.data);
    return res.status(500).json({ error: 'Could not save the PDF', detail: up.data });
  }
  const publicUrl = SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + path;

  // 7. mark published + store url
  const patched = await patchIssue(token, id, {
    pdf_url:    publicUrl,
    status:     'published',
    updated_at: new Date().toISOString(),
  });
  if (!patched.ok) {
    // PDF is saved; just report the URL even if the row update lagged
    console.error('[publications-generate] row update failed:', patched.status, patched.data);
    return res.status(200).json({ ok: true, pdf_url: publicUrl, warning: 'PDF saved but issue record was not updated.' });
  }

  return res.status(200).json({ ok: true, pdf_url: publicUrl, pub: patched.row });
};
