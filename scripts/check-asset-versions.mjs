/* ============================================================================
   A VERSIONED ASSET THAT CHANGED MUST HAVE ITS ?v= BUMPED
   ----------------------------------------------------------------------------
   2026-09-25. The store hero was fixed, deployed, and verified: the CSS file on
   the production domain contained the new rules. Jayden still saw the old hero.

   The pages link their assets as `/css/das-store.css?v=41`. The FILE changed;
   the URL did not. Vercel serves these with `max-age=600,
   stale-while-revalidate=86400`, so every returning visitor keeps the old copy
   for up to a day. Checking that the file is right on the server is not the
   same as checking that a browser will FETCH it, and four files shipped that
   way in one session -- including the one carrying the Save Later fix, which
   means the bug was still live for anyone who had visited before.

   So the check is mechanical now. This records a hash of every asset that is
   referenced with a ?v= and fails when one of them changes without its version
   moving. Run it before deploying.

     node scripts/check-asset-versions.mjs          # verify
     node scripts/check-asset-versions.mjs --accept # record the current state

   Lives in scripts/, which .vercelignore excludes -- it never deploys.
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const ROOT = process.cwd()
const LOCK = join(ROOT, 'scripts', 'asset-versions.json')
const accept = process.argv.includes('--accept')

/* Every `name.ext?v=N` any page references, with the version it asks for. */
const refs = new Map()
for (const f of readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(join(ROOT, f), 'utf8')
  for (const m of html.matchAll(/["'(]\/?((?:js|css)\/[A-Za-z0-9._-]+\.(?:js|css))\?v=(\d+)/g)) {
    const [, path, v] = m
    if (!refs.has(path)) refs.set(path, new Set())
    refs.get(path).add(v)
  }
}

const prev = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, 'utf8')) : {}
const now = {}
const stale = []
const split = []

for (const [path, versions] of [...refs].sort()) {
  if (!existsSync(join(ROOT, path))) continue
  const hash = createHash('sha1').update(readFileSync(join(ROOT, path))).digest('hex').slice(0, 12)
  const vs = [...versions]

  /* One asset asked for at two different versions means some page was missed
     on the last bump, and half the site keeps the stale copy. */
  if (vs.length > 1) split.push(`${path} is referenced as v${vs.join(' and v')}`)

  const v = vs.sort((a, b) => b - a)[0]
  now[path] = { v, hash }

  const was = prev[path]
  if (was && was.hash !== hash && was.v === v) {
    stale.push(`${path}  content changed but still ?v=${v}`)
  }
}

if (accept) {
  writeFileSync(LOCK, JSON.stringify(now, null, 1) + '\n')
  console.log(`recorded ${Object.keys(now).length} versioned assets`)
  process.exit(0)
}

for (const s of split) console.error('SPLIT   ' + s)
for (const s of stale) console.error('STALE   ' + s)

if (stale.length || split.length) {
  console.error('\nBump the ?v= on every page that references it, then re-run with --accept.')
  console.error('Shipping as-is leaves returning visitors on the old file for up to 24 hours.')
  process.exit(1)
}
console.log(`${Object.keys(now).length} versioned assets checked — every changed file has a fresh ?v=`)
