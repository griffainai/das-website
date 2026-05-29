/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Admin — Orders Review Queue
   GET   /api/admin-orders          → list orders needing review
   PATCH /api/admin-orders          → set status / shipping_cost on an order
                                       (fires fulfillment email on approval)

   Auth: Firebase ID token (Authorization: Bearer <token>) + ADMIN_EMAILS.
   Ported from das-portal src/app/api/admin/orders/review/route.ts.
   ============================================= */

const { requireAdmin, sb } = require('../lib/admin-auth');

const REVIEW_STATUSES = ['in_review', 'shipping_quote_required', 'issue', 'net_terms_pending', 'net_terms_more_info'];

const VALID_STATUSES = [
  'payment_pending', 'pending', 'in_review', 'shipping_quote_required',
  'confirmed', 'in_production', 'shipped', 'delivered', 'completed',
  'cancelled', 'issue',
  'net_terms_pending', 'net_terms_more_info', 'net_terms_rejected', 'net_terms_approved',
];

function fmtMoney(n) {
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch
  ));
}

// ── Fulfillment email (Resend) — env recipient + response inspection + logging ──
async function sendFulfillmentEmail(order) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[admin-orders] RESEND_API_KEY missing — no fulfillment email for ${order.order_number}`);
    return;
  }
  const to = (process.env.FULFILLMENT_EMAIL || 'fulfillment@driverappreciationsolutions.com')
    .split(',').map(s => s.trim()).filter(Boolean);

  const itemRows = (order.items || []).map(i => `
      <tr>
        <td style="padding:6px 0;color:#111;font-size:13px">${escHtml(i.name)}</td>
        <td style="padding:6px 0;text-align:center;color:#374151;font-size:13px">${escHtml(i.qty)}</td>
        <td style="padding:6px 0;text-align:right;color:#374151;font-size:13px">${fmtMoney(i.unit_price)}</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;color:#111;font-size:13px">${fmtMoney(i.unit_price * i.qty)}</td>
      </tr>`).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:620px;margin:0 auto">
      <div style="background:#1A2E6E;padding:20px 24px;border-radius:12px 12px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">✅ PO Approved — Ready for Fulfillment</h2>
        <p style="color:rgba(255,255,255,.6);margin:4px 0 0;font-size:13px">Order ${escHtml(order.order_number)} has been approved by DAS admin.</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 12px 12px">
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
          <tr><td style="padding:6px 0;color:#6B7280;width:140px">Company</td>
              <td style="padding:6px 0;font-weight:600;color:#111">${escHtml(order.company_name || '—')}</td></tr>
          <tr><td style="padding:6px 0;color:#6B7280">Order #</td>
              <td style="padding:6px 0;font-weight:600;color:#111">${escHtml(order.order_number)}</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <thead><tr style="border-bottom:2px solid #E5E7EB">
            <th style="text-align:left;padding:6px 0;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase">Item</th>
            <th style="text-align:center;padding:6px 0;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase">Qty</th>
            <th style="text-align:right;padding:6px 0;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase">Unit</th>
            <th style="text-align:right;padding:6px 0;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase">Total</th>
          </tr></thead>
          <tbody style="border-bottom:1px solid #E5E7EB">${itemRows}</tbody>
        </table>
        <div style="background:#F9FAFB;border-radius:8px;padding:12px 16px;margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;font-size:13px;color:#374151;margin-bottom:4px"><span>Subtotal</span><span>${order.subtotal != null ? fmtMoney(order.subtotal) : '—'}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:13px;color:#374151;margin-bottom:4px"><span>Shipping</span><span>${order.shipping_cost != null ? fmtMoney(order.shipping_cost) : 'TBD'}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;color:#111;border-top:1px solid #E5E7EB;padding-top:8px;margin-top:8px"><span>Total</span><span>${order.total != null ? fmtMoney(order.total) : 'TBD'}</span></div>
        </div>
        ${order.notes ? `<p style="font-size:12px;color:#6B7280"><strong>Notes:</strong> ${escHtml(order.notes)}</p>` : ''}
        <div style="margin-top:20px;padding:12px 16px;background:#F0FFF4;border-radius:8px;border-left:3px solid #22C55E;font-size:13px;color:#166534">
          <strong>Ready to fulfill.</strong> This order has been approved by DAS admin and is ready for production.
        </div>
      </div>
    </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from:    'DAS Orders <orders@driverappreciationsolutions.com>',
        to,
        subject: `✅ Ready to Fulfill — ${order.order_number} · ${order.company_name || 'Customer'}`,
        html,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[admin-orders] fulfillment email FAILED for ${order.order_number} → ${to.join(', ')} (HTTP ${res.status}): ${errBody}`);
    } else {
      const data = await res.json().catch(() => null);
      console.log(`[admin-orders] fulfillment email sent for ${order.order_number} → ${to.join(', ')} (resend id: ${(data && data.id) || 'unknown'})`);
    }
  } catch (err) {
    console.error(`[admin-orders] fulfillment email threw for ${order.order_number}:`, err);
  }
}

// ── Support tickets resource ──────────────────────────────────────────
const TICKET_STATUSES = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];

async function handleTickets(req, res) {
  if (req.method === 'GET') {
    const sel = 'id,subject,message,category,priority,status,company_id,user_id,created_at';
    let { ok, data } = await sb(`support_tickets?order=created_at.desc&select=${encodeURIComponent(sel + ',companies:company_id(name)')}`);
    if (!ok) ({ ok, data } = await sb(`support_tickets?order=created_at.desc&select=${encodeURIComponent(sel)}`)); // tolerate missing FK embed
    if (!ok) return res.status(500).json({ error: 'Query failed', detail: data });
    const tickets = (data || []).map(t => {
      const company_name = t.companies && t.companies.name ? t.companies.name : null;
      const { companies, ...rest } = t;
      return { ...rest, company_name };
    });
    return res.status(200).json({ tickets });
  }
  if (req.method === 'PATCH') {
    const { ticketId, status } = req.body || {};
    if (!ticketId) return res.status(400).json({ error: 'Missing ticketId' });
    if (status && !TICKET_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const update = { updated_at: new Date().toISOString() };
    if (status) update.status = status;
    const upd = await sb(`support_tickets?id=eq.${ticketId}`, { method: 'PATCH', body: update });
    if (!upd.ok) return res.status(500).json({ error: 'Update failed', detail: upd.data });
    return res.status(200).json({ ticket: (Array.isArray(upd.data) && upd.data[0]) || null });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

// ── Quote requests resource ───────────────────────────────────────────
const QUOTE_STATUSES = ['submitted', 'in_review', 'quoted', 'accepted', 'declined', 'closed'];

async function handleQuotes(req, res) {
  if (req.method === 'GET') {
    const sel = 'id,type,driver_count,budget_per_driver,timeline,notes,status,company_id,user_id,created_at';
    let { ok, data } = await sb(`quotes?order=created_at.desc&select=${encodeURIComponent(sel + ',companies:company_id(name)')}`);
    if (!ok) ({ ok, data } = await sb(`quotes?order=created_at.desc&select=${encodeURIComponent(sel)}`)); // tolerate missing FK embed
    if (!ok) return res.status(500).json({ error: 'Query failed', detail: data });
    const quotes = (data || []).map(q => {
      const company_name = q.companies && q.companies.name ? q.companies.name : null;
      const { companies, ...rest } = q;
      return { ...rest, company_name };
    });
    return res.status(200).json({ quotes });
  }
  if (req.method === 'PATCH') {
    const { quoteId, status, notes } = req.body || {};
    if (!quoteId) return res.status(400).json({ error: 'Missing quoteId' });
    if (status && !QUOTE_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const update = { updated_at: new Date().toISOString() };
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;
    const upd = await sb(`quotes?id=eq.${quoteId}`, { method: 'PATCH', body: update });
    if (!upd.ok) return res.status(500).json({ error: 'Update failed', detail: upd.data });
    return res.status(200).json({ quote: (Array.isArray(upd.data) && upd.data[0]) || null });
  }
  return res.status(405).json({ error: 'Method not allowed' });
}

// ── Products resource (das_products) — store catalog management ───────
const PRODUCT_FIELDS = [
  'sku', 'name', 'price', 'description', 'image_url', 'category', 'active',
  'min_qty', 'requires_manual_shipping_quote', 'ships_individually', 'package_weight_oz',
];

// Upload a base64 image to the public `product-images` bucket via the
// Storage REST API (service role). Returns the public URL or throws.
async function uploadProductImage(base64, filename) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('Storage not configured');

  const m = /^data:([^;]+);base64,(.*)$/.exec(String(base64));
  const contentType = m ? m[1] : 'image/png';
  const b64data     = m ? m[2] : String(base64);
  const buffer      = Buffer.from(b64data, 'base64');

  const safe = String(filename || 'image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${Date.now()}-${safe}`;

  const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${path}`, {
    method:  'POST',
    headers: {
      apikey:          SERVICE_KEY,
      Authorization:   `Bearer ${SERVICE_KEY}`,
      'Content-Type':  contentType,
      'x-upsert':      'true',
    },
    body: buffer,
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Image upload failed (HTTP ${resp.status}): ${t}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

function pickProductFields(body) {
  const out = {};
  for (const f of PRODUCT_FIELDS) if (body[f] !== undefined) out[f] = body[f];
  if (out.price != null) out.price = Number(out.price);
  if (out.min_qty != null) out.min_qty = parseInt(out.min_qty, 10) || null;
  return out;
}

async function handleProducts(req, res) {
  // GET — full catalog (active + inactive) for the admin manager.
  if (req.method === 'GET') {
    const { ok, data } = await sb('das_products?order=name.asc&select=*');
    if (!ok) return res.status(500).json({ error: 'Query failed', detail: data });
    return res.status(200).json({ products: data || [] });
  }

  // POST — create a product (optional inline base64 image upload).
  if (req.method === 'POST') {
    const body = req.body || {};
    try {
      if (body.image_base64) body.image_url = await uploadProductImage(body.image_base64, body.image_filename);
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Image upload failed' });
    }
    const row = pickProductFields(body);
    if (!row.name) return res.status(400).json({ error: 'Product name is required' });
    if (row.active === undefined) row.active = true;
    const ins = await sb('das_products', { method: 'POST', body: row });
    if (!ins.ok) return res.status(500).json({ error: 'Create failed', detail: ins.data });
    return res.status(200).json({ product: (Array.isArray(ins.data) && ins.data[0]) || null });
  }

  // PATCH — update a product (optional inline base64 image upload).
  if (req.method === 'PATCH') {
    const body = req.body || {};
    const productId = body.productId || body.id;
    if (!productId) return res.status(400).json({ error: 'Missing productId' });
    try {
      if (body.image_base64) body.image_url = await uploadProductImage(body.image_base64, body.image_filename);
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Image upload failed' });
    }
    const row = pickProductFields(body);
    if (Object.keys(row).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    const upd = await sb(`das_products?id=eq.${productId}`, { method: 'PATCH', body: row });
    if (!upd.ok) return res.status(500).json({ error: 'Update failed', detail: upd.data });
    return res.status(200).json({ product: (Array.isArray(upd.data) && upd.data[0]) || null });
  }

  // DELETE — soft-delete (deactivate) so the catalog/history stays intact.
  if (req.method === 'DELETE') {
    const productId = (req.query && req.query.id) || (req.body && req.body.productId);
    if (!productId) return res.status(400).json({ error: 'Missing product id' });
    const upd = await sb(`das_products?id=eq.${productId}`, { method: 'PATCH', body: { active: false } });
    if (!upd.ok) return res.status(500).json({ error: 'Deactivate failed', detail: upd.data });
    return res.status(200).json({ product: (Array.isArray(upd.data) && upd.data[0]) || null, deactivated: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

module.exports = async (req, res) => {
  const allowedOrigin = process.env.SITE_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  // Auth gate — DAS staff only.
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  // Resource dispatch — keep everything in one serverless function (12-fn cap).
  const resource = (req.query && req.query.resource) || 'orders';
  if (resource === 'tickets')  return handleTickets(req, res);
  if (resource === 'quotes')   return handleQuotes(req, res);
  if (resource === 'products') return handleProducts(req, res);

  // ── GET: list review-queue orders, newest first, with company name ──
  if (req.method === 'GET') {
    const select = [
      'id', 'order_number', 'status', 'company_id', 'fulfillment_type', 'delivery_count',
      'shipping_quote_required', 'shipping_quote_reason',
      'items', 'subtotal', 'shipping_cost', 'total', 'notes', 'created_at',
      'companies:company_id(name)',
    ].join(',');
    const query = `das_orders?status=in.(${REVIEW_STATUSES.join(',')})&order=created_at.desc&select=${encodeURIComponent(select)}`;
    const { ok, data } = await sb(query);
    if (!ok) return res.status(500).json({ error: 'Query failed', detail: data });
    const orders = (data || []).map(o => {
      const company_name = o.companies && o.companies.name ? o.companies.name : null;
      const { companies, ...rest } = o;
      return { ...rest, company_name };
    });
    return res.status(200).json({ orders });
  }

  // ── PATCH: set status and/or shipping_cost; fulfillment email on approval ──
  if (req.method === 'PATCH') {
    const body = req.body || {};
    const { orderId, status, shipping_cost } = body;
    if (!orderId) return res.status(400).json({ error: 'Missing orderId' });
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const exSelect = encodeURIComponent('subtotal,shipping_cost,order_number,notes,items,total,companies:company_id(name)');
    const ex = await sb(`das_orders?id=eq.${orderId}&select=${exSelect}&limit=1`);
    if (!ex.ok) return res.status(500).json({ error: 'Lookup failed', detail: ex.data });
    const existing = Array.isArray(ex.data) ? ex.data[0] : null;
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    const update = { updated_at: new Date().toISOString() };
    if (status) {
      update.status = status;
      if (['confirmed', 'cancelled', 'net_terms_approved', 'net_terms_rejected'].includes(status)) {
        update.shipping_quote_required = false;
      }
    }
    if (shipping_cost !== undefined) {
      update.shipping_cost = shipping_cost;
      const sub = existing.subtotal;
      if (sub != null && shipping_cost != null) update.total = Number((sub + shipping_cost).toFixed(2));
    }

    const upd = await sb(`das_orders?id=eq.${orderId}`, { method: 'PATCH', body: update });
    if (!upd.ok) return res.status(500).json({ error: 'Update failed', detail: upd.data });

    if (status === 'net_terms_approved') {
      const finalShipping = shipping_cost !== undefined ? shipping_cost : existing.shipping_cost;
      const sub = existing.subtotal;
      const finalTotal = (sub != null && finalShipping != null) ? Number((sub + finalShipping).toFixed(2)) : existing.total;
      // Fire-and-forget — don't block the admin's response on the email.
      sendFulfillmentEmail({
        order_number:  existing.order_number || orderId,
        company_name:  (existing.companies && existing.companies.name) || '',
        items:         existing.items || [],
        subtotal:      sub,
        shipping_cost: finalShipping != null ? finalShipping : null,
        total:         finalTotal,
        notes:         existing.notes,
      });
    }

    return res.status(200).json({ order: (Array.isArray(upd.data) && upd.data[0]) || null });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
