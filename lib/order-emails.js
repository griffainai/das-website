/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Transactional Order Emails — plain helper module (NOT a serverless fn)
   ---------------------------------------------
   Called from api/portal.js handleConfirmOrder() right after an order is
   successfully flipped to 'confirmed'. Sends two responsive HTML emails:

     1) Customer receipt  → the purchaser's email
     2) Internal order notification → DAS ops inbox(es)

   Resend is the provider (same pattern as api/contact.js / api/admin-orders.js):
   env var RESEND_API_KEY, verified FROM noreply@driverappreciationsolutions.com.

   Dedup: we DON'T assume a DB migration. Send-status is persisted as a small
   machine-readable marker inside the existing das_orders.notes (text) column —
   see EMAIL_TAG_RE / buildEmailTag / parseEmailFlags below. The caller reads
   the flags, skips already-sent emails, and writes the updated marker back.

   Nothing here throws into the request path: every send is wrapped in try/catch
   and returns a status object. A Resend failure must never break confirm-order.
   ============================================= */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Catalog is the source of truth for which products are custom-branded (customization:true).
let Catalog = null;
try { Catalog = require('./catalog'); } catch (e) { /* fall back to id/name detection below */ }

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@driverappreciationsolutions.com';
const FROM = `Driver Appreciation Solutions <${FROM_EMAIL}>`;

// Internal order notifications send FROM the branded orders@ address (the DAS domain
// is Resend-verified, so any @driverappreciationsolutions.com From is valid outbound).
const ORDERS_FROM = `Driver Appreciation Solutions <orders@driverappreciationsolutions.com>`;

// Reply-To for the internal notification → a monitored inbox (override via env).
// info@ is the shared ops/support address used across the site; once Porkbun
// forwarding is configured it lands in Gmail.
const ORDER_REPLY_TO = process.env.ORDER_REPLY_TO || 'info@driverappreciationsolutions.com';

// Internal notification recipients (per spec — explicit, not env-driven).
// The direct Gmail is listed FIRST as the reliability backstop: order alerts must
// never depend solely on @driverappreciationsolutions.com inbound forwarding. The
// two branded addresses still receive once Porkbun forwarding rules are in place.
const INTERNAL_RECIPIENTS = [
  'shaqisvictory@gmail.com',                      // direct Gmail — reliability backstop (always lands)
  'orders@driverappreciationsolutions.com',       // Porkbun-forwarded → Gmail
  'info@driverappreciationsolutions.com',         // Porkbun-forwarded → Gmail (ssshafeek@ was NOT forwarded, so dropped to avoid bounces)
];

const NAVY = '#1A2E6E';

/* ---------------------------------------------------------------------------
   Welcome Driver Appreciation Kit detection + canned copy
   --------------------------------------------------------------------------- */
const WELCOME_KIT_ID   = 'das-007';
const WELCOME_KIT_NAME = 'Welcome Driver Appreciation Kit';

const CUSTOMER_KIT_MESSAGE =
  'Thank you for your order. A Driver Appreciation Solutions representative will ' +
  'contact you to collect your company logo, brand colors, artwork, and customization ' +
  'requirements. If you already have artwork available, please send it to ' +
  'info@driverappreciationsolutions.com and reference your order number.';

// True for ANY custom-branded product that needs post-purchase artwork follow-up —
// driven by the catalog `customization:true` flag (das-007 Welcome Kit, das-008 Backpack,
// and any future customization SKU), with id/name fallbacks if the id doesn't resolve.
function isWelcomeKitItem(item) {
  if (!item) return false;
  const rawId = String(item.id || item.product_id || item.sku || '');
  const id    = rawId.toLowerCase();
  const name  = String(item.name || item.description || '').toLowerCase();
  const known = (Catalog && Catalog.lookup) ? Catalog.lookup(rawId) : null;
  if (known && known.customization) return true;
  return id === 'das-007' || id === 'das-008'
      || name.includes('welcome driver appreciation kit')
      || name.includes('road warrior backpack');
}

function orderHasWelcomeKit(items) {
  return Array.isArray(items) && items.some(isWelcomeKitItem);
}

/* ---------------------------------------------------------------------------
   Small utilities
   --------------------------------------------------------------------------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch
  ));
}

function money(n) {
  if (n == null || isNaN(Number(n))) return '—';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  try {
    return new Date(d || Date.now()).toLocaleString('en-US', {
      timeZone: 'America/Chicago',
      year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
  } catch (_) {
    return new Date(d || Date.now()).toISOString();
  }
}

// Compose a single-line postal address from a Stripe-style {name, address:{...}} object.
function formatAddress(name, address) {
  if (!address) return name ? esc(name) : '';
  const lines = [];
  if (name) lines.push(esc(name));
  if (address.line1) lines.push(esc(address.line1));
  if (address.line2) lines.push(esc(address.line2));
  const cityLine = [address.city, address.state, address.postal_code].filter(Boolean).join(', ');
  if (cityLine) lines.push(esc(cityLine));
  if (address.country) lines.push(esc(address.country));
  return lines.join('<br>') || (name ? esc(name) : '—');
}

/* ---------------------------------------------------------------------------
   Dedup marker living inside das_orders.notes
   Format:  [das-emails customer=ok@2026-06-05T... internal=failed]
   - "ok@<iso>"  = sent, with timestamp
   - "failed"    = last attempt failed (eligible for retry on a later call)
   --------------------------------------------------------------------------- */
const EMAIL_TAG_RE = /\s*\[das-emails[^\]]*\]/;

function parseEmailFlags(notes) {
  const flags = { customer: null, internal: null };
  const m = EMAIL_TAG_RE.exec(String(notes || ''));
  if (!m) return flags;
  const body = m[0];
  const cm = /customer=([^\s\]]+)/.exec(body);
  const im = /internal=([^\s\]]+)/.exec(body);
  if (cm) flags.customer = cm[1];
  if (im) flags.internal = im[1];
  return flags;
}

function emailFlagSent(flagValue) {
  return typeof flagValue === 'string' && flagValue.indexOf('ok@') === 0;
}

// Return notes with the email tag stripped (so we can re-append a fresh one).
// Also collapses any dangling ` | ` separator the strip leaves behind.
function stripEmailTag(notes) {
  return String(notes || '')
    .replace(EMAIL_TAG_RE, '')
    .replace(/\s*\|\s*$/, '')   // trailing separator
    .replace(/\|\s*\|/g, '|')   // doubled separator
    .trim();
}

// Build the updated notes string carrying the latest send status.
function buildNotesWithFlags(notes, flags) {
  const base = stripEmailTag(notes);
  const cust = flags.customer || 'pending';
  const intl = flags.internal || 'pending';
  const tag = `[das-emails customer=${cust} internal=${intl}]`;
  return base ? `${base} | ${tag}` : tag;
}

/* ---------------------------------------------------------------------------
   Low-level Resend send (single best-effort retry on transient failure)
   Returns { ok, id, status, error } — never throws.
   --------------------------------------------------------------------------- */
async function resendSend({ to, subject, html, replyTo, from }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[order-emails] RESEND_API_KEY missing — skipping send:', subject);
    return { ok: false, error: 'no_api_key', skipped: true };
  }

  const recipients = Array.isArray(to) ? to : [to];
  const body = { from: from || FROM, to: recipients, subject, html };
  if (replyTo) body.reply_to = replyTo;

  const attempt = async () => {
    const resp = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      return { ok: false, status: resp.status, error: errBody || `HTTP ${resp.status}` };
    }
    const data = await resp.json().catch(() => null);
    return { ok: true, id: (data && data.id) || null, status: resp.status };
  };

  try {
    let result = await attempt();
    // One inline retry on a transient (5xx / network) failure.
    if (!result.ok && (!result.status || result.status >= 500)) {
      console.warn(`[order-emails] transient failure (${result.status || 'network'}) — retrying once: ${subject}`);
      result = await attempt();
    }
    if (result.ok) {
      console.log(`[order-emails] sent via resend → ${recipients.join(', ')} | id=${result.id || 'unknown'} | "${subject}"`);
    } else {
      console.error(`[order-emails] FAILED via resend → ${recipients.join(', ')} (status ${result.status || 'network'}): ${result.error} | "${subject}"`);
    }
    return result;
  } catch (err) {
    console.error(`[order-emails] threw sending "${subject}":`, err && err.message);
    return { ok: false, error: (err && err.message) || 'send_threw' };
  }
}

/* ---------------------------------------------------------------------------
   Email body builders
   --------------------------------------------------------------------------- */
function lineItemsTableRows(items) {
  return (Array.isArray(items) ? items : []).map((it) => {
    const qty   = Number(it.qty) || 1;
    const unit  = Number(it.unit_price) || 0;
    const lineT = unit * qty;
    const desc  = it.description ? `<div style="color:#6B7280;font-size:12px;margin-top:2px">${esc(it.description)}</div>` : '';
    return `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #EEF1F6;vertical-align:top">
          <div style="color:#111;font-size:14px;font-weight:600">${esc(it.name || '—')}</div>
          ${desc}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #EEF1F6;text-align:center;color:#374151;font-size:14px;vertical-align:top">${esc(qty)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #EEF1F6;text-align:right;color:#374151;font-size:14px;vertical-align:top">${money(unit)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #EEF1F6;text-align:right;color:#111;font-size:14px;font-weight:600;vertical-align:top">${money(lineT)}</td>
      </tr>`;
  }).join('');
}

function financialsRows({ subtotal, shipping, tax, discount, total }) {
  const row = (label, val, bold) => `
    <tr>
      <td style="padding:4px 8px;color:${bold ? '#111' : '#6B7280'};font-size:${bold ? '15px' : '13px'};${bold ? 'font-weight:700;border-top:2px solid #E5E7EB;padding-top:10px' : ''}">${esc(label)}</td>
      <td style="padding:4px 8px;text-align:right;color:#111;font-size:${bold ? '15px' : '13px'};${bold ? 'font-weight:700;border-top:2px solid #E5E7EB;padding-top:10px' : ''}">${val}</td>
    </tr>`;
  let html = row('Subtotal', money(subtotal));
  if (shipping != null) html += row('Shipping', money(shipping));
  if (tax != null && Number(tax) > 0) html += row('Tax', money(tax));
  if (discount != null && Number(discount) > 0) html += row('Discount', '-' + money(discount));
  html += row('Total', money(total), true);
  return html;
}

function shell(innerHtml) {
  return `
  <div style="background:#F4F6FB;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB">
      ${innerHtml}
    </table>
  </div>`;
}

// ── 1) Customer receipt ─────────────────────────────────────────────────────
function buildCustomerReceiptHtml(o) {
  const hasKit = orderHasWelcomeKit(o.items);
  const inner = `
    <tr><td style="background:${NAVY};padding:28px 32px">
      <div style="color:#fff;font-size:20px;font-weight:700;letter-spacing:.3px">Driver Appreciation Solutions</div>
      <div style="color:rgba(255,255,255,.7);font-size:13px;margin-top:4px">Order Confirmation &amp; Receipt</div>
    </td></tr>

    <tr><td style="padding:28px 32px 8px">
      <p style="margin:0 0 4px;color:#111;font-size:16px">Thank you${o.customerName ? `, ${esc(o.customerName)}` : ''}!</p>
      <p style="margin:0;color:#6B7280;font-size:14px">Your payment has been received and your order is confirmed.</p>
    </td></tr>

    <tr><td style="padding:8px 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border-radius:8px">
        <tr>
          <td style="padding:14px 16px;font-size:13px;color:#6B7280;width:50%">Order Number<br><span style="color:#111;font-size:15px;font-weight:700">${esc(o.orderNumber || '—')}</span></td>
          <td style="padding:14px 16px;font-size:13px;color:#6B7280;width:50%">Order Date<br><span style="color:#111;font-size:14px;font-weight:600">${esc(o.orderDate)}</span></td>
        </tr>
        ${o.companyName ? `<tr><td colspan="2" style="padding:0 16px 14px;font-size:13px;color:#6B7280">Company<br><span style="color:#111;font-size:14px;font-weight:600">${esc(o.companyName)}</span></td></tr>` : ''}
      </table>
    </td></tr>

    <tr><td style="padding:16px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:top;width:50%;padding-right:8px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#9CA3AF;font-weight:700;margin-bottom:6px">Billing</div>
            <div style="font-size:13px;color:#374151;line-height:1.5">${o.billingHtml || '—'}</div>
          </td>
          <td style="vertical-align:top;width:50%;padding-left:8px">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#9CA3AF;font-weight:700;margin-bottom:6px">Shipping</div>
            <div style="font-size:13px;color:#374151;line-height:1.5">${o.shippingHtml || '—'}</div>
          </td>
        </tr>
      </table>
    </td></tr>

    <tr><td style="padding:24px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:0 8px 8px;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #E5E7EB">Item</th>
          <th style="text-align:center;padding:0 8px 8px;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #E5E7EB">Qty</th>
          <th style="text-align:right;padding:0 8px 8px;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #E5E7EB">Unit</th>
          <th style="text-align:right;padding:0 8px 8px;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #E5E7EB">Total</th>
        </tr></thead>
        <tbody>${lineItemsTableRows(o.items)}</tbody>
      </table>
    </td></tr>

    <tr><td style="padding:16px 32px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${financialsRows({ subtotal: o.subtotal, shipping: o.shipping, tax: o.tax, discount: o.discount, total: o.total })}
      </table>
    </td></tr>

    <tr><td style="padding:20px 32px 0">
      <div style="background:#F0FFF4;border-left:3px solid #22C55E;border-radius:6px;padding:12px 16px;font-size:13px;color:#166534">
        <strong>Payment confirmed.</strong> ${o.transactionId ? `Transaction reference: ${esc(o.transactionId)}.` : 'Your payment was processed successfully.'}
      </div>
    </td></tr>

    ${hasKit ? `
    <tr><td style="padding:16px 32px 0">
      <div style="background:#F0F4FF;border-left:3px solid ${NAVY};border-radius:6px;padding:14px 16px;font-size:13px;color:#1F2937;line-height:1.6">
        ${esc(CUSTOMER_KIT_MESSAGE)}
      </div>
    </td></tr>` : ''}

    <tr><td style="padding:28px 32px 32px">
      <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6">
        Questions about your order? Email <a href="mailto:info@driverappreciationsolutions.com" style="color:${NAVY}">info@driverappreciationsolutions.com</a> and reference order ${esc(o.orderNumber || '')}.<br>
        Driver Appreciation Solutions · driverappreciationsolutions.com
      </p>
    </td></tr>`;
  return shell(inner);
}

// ── 2) Internal order notification ──────────────────────────────────────────
function buildInternalNotificationHtml(o) {
  const hasKit = orderHasWelcomeKit(o.items);

  const itemRows = (Array.isArray(o.items) ? o.items : []).map((it) => {
    const qty  = Number(it.qty) || 1;
    const unit = Number(it.unit_price) || 0;
    const sku  = it.sku || it.id || it.product_id;
    return `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #EEF1F6;vertical-align:top">
          <div style="color:#111;font-size:14px;font-weight:600">${esc(it.name || '—')}</div>
          ${it.description ? `<div style="color:#6B7280;font-size:12px;margin-top:2px">${esc(it.description)}</div>` : ''}
          ${sku ? `<div style="color:#9CA3AF;font-size:11px;margin-top:2px">SKU: ${esc(sku)}</div>` : ''}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #EEF1F6;text-align:center;color:#374151;font-size:14px;vertical-align:top">${esc(qty)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #EEF1F6;text-align:right;color:#374151;font-size:14px;vertical-align:top">${money(unit)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #EEF1F6;text-align:right;color:#111;font-size:14px;font-weight:600;vertical-align:top">${money(unit * qty)}</td>
      </tr>`;
  }).join('');

  const section = (title, rowsHtml) => `
    <tr><td style="padding:20px 32px 0">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:${NAVY};font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #E5E7EB">${esc(title)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rowsHtml}</table>
    </td></tr>`;

  const kv = (label, val) => `
    <tr>
      <td style="padding:4px 0;color:#6B7280;width:160px;vertical-align:top;font-size:13px">${esc(label)}</td>
      <td style="padding:4px 0;color:#111;font-weight:600;font-size:13px">${val}</td>
    </tr>`;

  const inner = `
    <tr><td style="background:${NAVY};padding:24px 32px">
      <div style="color:#fff;font-size:18px;font-weight:700">NEW ORDER RECEIVED</div>
      <div style="color:rgba(255,255,255,.7);font-size:13px;margin-top:4px">Order ${esc(o.orderNumber || '—')} · ${esc(o.customerName || 'Customer')}</div>
    </td></tr>

    ${hasKit ? `
    <tr><td style="padding:20px 32px 0">
      <div style="background:#FEF3C7;border-left:4px solid #D97706;border-radius:6px;padding:14px 16px;font-size:13px;color:#92400E;line-height:1.6">
        <strong style="display:block;margin-bottom:6px;font-size:14px">CUSTOMIZATION REQUIRED</strong>
        This order contains a custom-branded product and requires follow-up from a DAS representative
        before fulfillment. Contact the customer to collect: company logo, brand colors, preferred
        messaging, and any artwork or per-item customization details.
      </div>
    </td></tr>` : ''}

    ${section('Order Summary', `
      ${kv('Order #', esc(o.orderNumber || '—'))}
      ${kv('Date &amp; Time', esc(o.orderDate))}
      ${kv('Payment Status', esc(o.paymentStatus || 'Paid'))}
      ${o.transactionId ? kv('Transaction ID', esc(o.transactionId)) : ''}
    `)}

    ${section('Customer Information', `
      ${kv('Name', esc(o.customerName || '—'))}
      ${kv('Company', esc(o.companyName || '—'))}
      ${kv('Email', o.customerEmail ? `<a href="mailto:${esc(o.customerEmail)}" style="color:${NAVY}">${esc(o.customerEmail)}</a>` : '—')}
      ${kv('Phone', esc(o.customerPhone || '—'))}
    `)}

    ${section('Billing Information', `<tr><td style="padding:4px 0;color:#374151;font-size:13px;line-height:1.6">${o.billingHtml || '—'}</td></tr>`)}

    ${section('Shipping Information', `<tr><td style="padding:4px 0;color:#374151;font-size:13px;line-height:1.6">${o.shippingHtml || '—'}</td></tr>`)}

    <tr><td style="padding:20px 32px 0">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:${NAVY};font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #E5E7EB">Product Details</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;padding:0 8px 8px;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:2px solid #E5E7EB">Item</th>
          <th style="text-align:center;padding:0 8px 8px;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:2px solid #E5E7EB">Qty</th>
          <th style="text-align:right;padding:0 8px 8px;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:2px solid #E5E7EB">Unit</th>
          <th style="text-align:right;padding:0 8px 8px;font-size:11px;color:#9CA3AF;font-weight:700;text-transform:uppercase;border-bottom:2px solid #E5E7EB">Total</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
    </td></tr>

    <tr><td style="padding:16px 32px 0">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:${NAVY};font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #E5E7EB">Order Financials</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${financialsRows({ subtotal: o.subtotal, shipping: o.shipping, tax: o.tax, discount: o.discount, total: o.total })}
      </table>
    </td></tr>

    ${o.customerNotes ? `
    <tr><td style="padding:20px 32px 0">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:${NAVY};font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #E5E7EB">Customer Notes</div>
      <div style="background:#F9FAFB;border-radius:6px;padding:12px 16px;font-size:13px;color:#374151;white-space:pre-wrap;line-height:1.6">${esc(o.customerNotes)}</div>
    </td></tr>` : ''}

    <tr><td style="padding:28px 32px 32px">
      <p style="margin:0;font-size:12px;color:#9CA3AF">Internal notification · Driver Appreciation Solutions order system.</p>
    </td></tr>`;
  return shell(inner);
}

/* ---------------------------------------------------------------------------
   Public API
   --------------------------------------------------------------------------- */

/**
 * Send both transactional emails for a confirmed order.
 *
 * @param {object} order      Order view-model (see normalizeOrderForEmail).
 * @param {object} existingFlags  Result of parseEmailFlags(order.notes) — used to
 *                                skip emails already sent on a prior confirm-order.
 * @returns {Promise<{flags:object, customer:object, internal:object}>}
 *          flags is the updated {customer, internal} send-status to persist.
 */
async function sendOrderEmails(order, existingFlags) {
  const flags = {
    customer: (existingFlags && existingFlags.customer) || null,
    internal: (existingFlags && existingFlags.internal) || null,
  };
  const result = { flags, customer: { skipped: true }, internal: { skipped: true } };

  // ── Customer receipt ──────────────────────────────────────────────────────
  if (emailFlagSent(flags.customer)) {
    console.log(`[order-emails] customer receipt already sent for ${order.orderNumber} — skipping`);
  } else if (!order.customerEmail) {
    console.warn(`[order-emails] no customer email on order ${order.orderNumber} — cannot send receipt`);
    result.customer = { ok: false, error: 'no_customer_email' };
    flags.customer = 'failed';
  } else {
    try {
      const html = buildCustomerReceiptHtml(order);
      const r = await resendSend({
        to: order.customerEmail,
        subject: `Order Confirmation — ${order.orderNumber} · Driver Appreciation Solutions`,
        html,
        replyTo: 'info@driverappreciationsolutions.com',
      });
      result.customer = r;
      flags.customer = r.ok ? `ok@${new Date().toISOString()}` : 'failed';
    } catch (err) {
      console.error(`[order-emails] customer receipt threw for ${order.orderNumber}:`, err && err.message);
      result.customer = { ok: false, error: (err && err.message) || 'threw' };
      flags.customer = 'failed';
    }
  }

  // ── Internal notification ─────────────────────────────────────────────────
  if (emailFlagSent(flags.internal)) {
    console.log(`[order-emails] internal notification already sent for ${order.orderNumber} — skipping`);
  } else {
    try {
      const html = buildInternalNotificationHtml(order);
      const r = await resendSend({
        to: INTERNAL_RECIPIENTS,
        subject: `NEW ORDER RECEIVED - Order #${order.orderNumber} - ${order.customerName || 'Customer'}`,
        html,
        from: ORDERS_FROM,
        replyTo: ORDER_REPLY_TO,
      });
      result.internal = r;
      flags.internal = r.ok ? `ok@${new Date().toISOString()}` : 'failed';
    } catch (err) {
      console.error(`[order-emails] internal notification threw for ${order.orderNumber}:`, err && err.message);
      result.internal = { ok: false, error: (err && err.message) || 'threw' };
      flags.internal = 'failed';
    }
  }

  return result;
}

/**
 * Build the email view-model from a das_orders row + a retrieved Stripe Checkout
 * Session. Pulls customer/billing/shipping/tax/discount from Stripe where the DB
 * row doesn't carry it; line items come from the DB row (authoritative names/SKUs).
 *
 * @param {object} dbOrder   das_orders row.
 * @param {object} session   Stripe Checkout Session (may be null/partial).
 */
function normalizeOrderForEmail(dbOrder, session) {
  dbOrder = dbOrder || {};
  session = session || {};

  const cd = session.customer_details || {};
  const collected = session.collected_information || {};

  // Shipping: prefer Stripe shipping_details, fall back to newer collected_information.
  const shipFrom = session.shipping_details || collected.shipping_details || {};
  const shipName = shipFrom.name || cd.name || null;
  const shipAddr = shipFrom.address || null;

  // Billing: Stripe customer_details carry the billing address.
  const billName = cd.name || shipName || null;
  const billAddr = cd.address || null;

  // Financials — Stripe amounts are in cents.
  const td = session.total_details || {};
  const tax      = td.amount_tax      != null ? td.amount_tax      / 100 : null;
  const discount = td.amount_discount != null ? td.amount_discount / 100 : null;
  const stripeShipping = td.amount_shipping != null ? td.amount_shipping / 100 : null;
  const stripeSubtotal = session.amount_subtotal != null ? session.amount_subtotal / 100 : null;
  const stripeTotal    = session.amount_total    != null ? session.amount_total    / 100 : null;

  // Custom fields may carry customization notes.
  let customFieldNotes = null;
  if (Array.isArray(session.custom_fields)) {
    for (const f of session.custom_fields) {
      const key = String(f.key || '').toLowerCase();
      if (key.includes('customization') || key.includes('notes') || key.includes('instructions')) {
        const v = (f.text && f.text.value) || (f.dropdown && f.dropdown.value) || (f.numeric && f.numeric.value);
        if (v) customFieldNotes = customFieldNotes ? `${customFieldNotes}\n${v}` : String(v);
      }
    }
  }

  // Company name: explicit field if present, else stripped from notes "Customer: ... <email>".
  const companyName = dbOrder.company_name || (session.metadata && session.metadata.company_name) || null;

  // Transaction id: payment_intent from Stripe.
  const transactionId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent && session.payment_intent.id) || null;

  return {
    orderNumber:   dbOrder.order_number || (session.metadata && session.metadata.order_number) || '—',
    orderDate:     fmtDate(dbOrder.created_at),
    notes:         dbOrder.notes || '',

    customerName:  cd.name || shipName || null,
    customerEmail: cd.email || (session.customer_email) || null,
    customerPhone: cd.phone || null,
    companyName,

    billingHtml:   formatAddress(billName, billAddr),
    shippingHtml:  formatAddress(shipName, shipAddr),

    items:         Array.isArray(dbOrder.items) ? dbOrder.items : [],

    // Money: trust the DB row for subtotal/shipping/total (it's the charged amount),
    // fall back to Stripe where the DB is null. Tax/discount only Stripe knows.
    subtotal:      dbOrder.subtotal      != null ? dbOrder.subtotal      : stripeSubtotal,
    shipping:      dbOrder.shipping_cost != null ? dbOrder.shipping_cost : stripeShipping,
    tax,
    discount,
    total:         dbOrder.total         != null ? dbOrder.total         : stripeTotal,

    paymentStatus: session.payment_status === 'paid' ? 'Paid' : (session.payment_status || 'Paid'),
    transactionId,
    customerNotes: customFieldNotes,
  };
}

module.exports = {
  sendOrderEmails,
  normalizeOrderForEmail,
  parseEmailFlags,
  buildNotesWithFlags,
  emailFlagSent,
  orderHasWelcomeKit,
  // exported for potential reuse/testing
  buildCustomerReceiptHtml,
  buildInternalNotificationHtml,
};
