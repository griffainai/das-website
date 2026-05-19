/* =============================================
   DRIVER APPRECIATION SOLUTIONS
   Firebase Config Endpoint — Vercel Serverless Function
   GET /api/firebase-config
   Returns Firebase client-side config as a JS file
   (These are all public-safe client keys — NOT secret keys)
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

  // All of these are CLIENT-SIDE safe values (Firebase client keys are designed to be public)
  // They are scoped to your Firebase project and protected by Authorized Domains + Security Rules
  const config = `
window.FIREBASE_API_KEY             = ${JSON.stringify(process.env.FIREBASE_API_KEY             || '')};
window.FIREBASE_AUTH_DOMAIN         = ${JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN         || '')};
window.FIREBASE_PROJECT_ID          = ${JSON.stringify(process.env.FIREBASE_PROJECT_ID          || '')};
window.FIREBASE_STORAGE_BUCKET      = ${JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET      || '')};
window.FIREBASE_MESSAGING_SENDER_ID = ${JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID || '')};
window.FIREBASE_APP_ID              = ${JSON.stringify(process.env.FIREBASE_APP_ID              || '')};
`;

  return res.status(200).send(config.trim());
};
