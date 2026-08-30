/* ============================================================================
   Dev server with outbound email and DB writes DISABLED.
     node scripts/dev-server-nomail.js [port]      (default 8097)

   Why this exists: .env.local holds a LIVE Resend key, and the survey handler
   emails four real people (Shaq included). Testing the browser → /api/contact →
   _survey.js seam against the normal dev server would send them a test.

   dev-server.js loads .env.local with `if (!(key in process.env))`, so setting
   these to an EMPTY STRING here — before the require — claims the keys without
   giving them a value. The handler's `if (!RESEND_API_KEY)` branch then takes
   its documented dev path: log the payload, return 200, send nothing.

   Setting them from a cmd shell does NOT work: `set VAR=` deletes the variable
   (so .env.local repopulates it) and `set VAR= &&` assigns a single SPACE, which
   is truthy and produced a real 401 from Resend on 2026-08-30.

   In scripts/, never api/ — see .vercelignore. Not for production, ever.
   ========================================================================== */
'use strict';

process.env.RESEND_API_KEY = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
process.env.PORT = process.argv[2] || '8097';

console.log('⚠  NO-MAIL DEV SERVER — Resend and Supabase writes are disabled.');
require('../dev-server.js');
