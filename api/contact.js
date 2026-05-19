/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Contact Form — Vercel Serverless Function
   POST /api/contact
   Sends email via Resend (resend.com — free tier: 3,000/mo)
   ============================================= */

module.exports = async (req, res) => {
  const allowedOrigin = process.env.SITE_URL || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, company, fleetSize, message, program } = req.body || {};

  // Basic validation
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const RESEND_API_KEY  = process.env.RESEND_API_KEY;
  const CONTACT_TO      = process.env.CONTACT_EMAIL || 'jaydenforshee@driverappreciationsolutions.com';
  const FROM_ADDRESS    = process.env.FROM_EMAIL    || 'noreply@driverappreciationsolutions.com';

  if (!RESEND_API_KEY) {
    // Dev fallback — log and succeed so the UI works without Resend configured
    console.log('[Contact] RESEND_API_KEY not set — would send:', { name, email, company, fleetSize, program, message });
    return res.status(200).json({ ok: true, dev: true });
  }

  const html = `
    <div style="font-family:sans-serif;max-width:560px;color:#111">
      <h2 style="color:#0D1B45;margin:0 0 20px">New Contact Form Submission</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600;width:140px">Name</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5">${escHtml(name)}</td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600">Email</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5"><a href="mailto:${escHtml(email)}">${escHtml(email)}</a></td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600">Company</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5">${escHtml(company || '—')}</td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600">Fleet Size</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5">${escHtml(fleetSize || '—')}</td></tr>
        <tr><td style="padding:8px 12px;background:#F5F5F5;font-weight:600">Program</td><td style="padding:8px 12px;border-bottom:1px solid #E5E5E5">${escHtml(program || '—')}</td></tr>
      </table>
      <h3 style="color:#0D1B45;margin:24px 0 8px">Message</h3>
      <div style="background:#F5F5F5;padding:16px;border-radius:8px;white-space:pre-wrap">${escHtml(message)}</div>
      <p style="margin-top:24px;font-size:12px;color:#888">Sent from driverappreciationsolutions.com contact form</p>
    </div>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `Driver Appreciation Solutions <${FROM_ADDRESS}>`,
        to:      [CONTACT_TO],
        reply_to: email,
        subject: `Fleet inquiry from ${name}${company ? ` — ${company}` : ''}`,
        html,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('[Resend Error]', resp.status, err);
      return res.status(500).json({ error: 'Failed to send message. Please try again or email us directly.' });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[Contact] Network error:', err.message);
    return res.status(500).json({ error: 'Network error. Please try again.' });
  }
};

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
