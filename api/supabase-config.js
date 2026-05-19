/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Supabase Config Endpoint — Vercel Serverless Function
   GET /api/supabase-config
   Returns Supabase client-side config as a JS file
   (SUPABASE_URL and SUPABASE_ANON_KEY are safe to expose publicly —
    they are scoped by Row Level Security policies, not kept secret)
   ============================================= */

module.exports = (req, res) => {
  const allowedOrigin = process.env.SITE_URL || '*';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).send('// Method not allowed');
  }

  const config = `
window.SUPABASE_URL      = ${JSON.stringify(process.env.SUPABASE_URL      || '')};
window.SUPABASE_ANON_KEY = ${JSON.stringify(process.env.SUPABASE_ANON_KEY || '')};
`;

  return res.status(200).send(config.trim());
};
