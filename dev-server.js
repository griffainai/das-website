/**
 * Local dev server — serves static files + /api/* serverless functions.
 * Replaces `vercel dev` when running inside Claude Code (which blocks recursive vercel invocation).
 * Usage: node dev-server.js [port]
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const PORT = parseInt(process.argv[2] || process.env.PORT || '8888', 10);
const ROOT = __dirname;

// Load .env.local into process.env
const envFile = path.join(ROOT, '.env.local');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  });
  console.log('✓ Loaded .env.local');
}

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

function sendFile(res, filePath) {
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
}

function send404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url  = new URL(req.url, `http://localhost:${PORT}`);
  let   pathname = decodeURIComponent(url.pathname);

  // ── API routes ─────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const funcName = pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    const funcPath = path.join(ROOT, 'api', funcName + '.js');

    if (!fs.existsSync(funcPath)) { return send404(res); }

    // Parse body for POST requests
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      req.body = await parseBody(req);
    }

    // Simple mock of Vercel's req/res for serverless functions
    res.status = (code) => { res.statusCode = code; return res; };
    res.json   = (obj)  => {
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(obj));
    };
    res.send   = (str)  => { res.end(str); };

    try {
      // Clear module cache so changes are picked up on each request
      delete require.cache[require.resolve(funcPath)];
      const handler = require(funcPath);
      await handler(req, res);
    } catch (err) {
      console.error(`[API error] ${funcPath}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
    return;
  }

  // ── Static files ────────────────────────────────────────────────────────────
  // Clean URL: /product → product.html
  let filePath = path.join(ROOT, pathname);

  // Prevent path traversal
  if (!filePath.startsWith(ROOT)) { return send404(res); }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    // Try adding .html extension
    const withHtml = filePath + '.html';
    if (fs.existsSync(withHtml)) {
      filePath = withHtml;
    } else {
      return send404(res);
    }
  }

  sendFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`\n🚀  Dev server running at http://localhost:${PORT}`);
  console.log(`    Static files + API routes active`);
  console.log(`    Press Ctrl+C to stop\n`);
});
