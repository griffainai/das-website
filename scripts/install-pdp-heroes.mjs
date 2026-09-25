/* ============================================================================
   INSTALL THE ELEVATED PRODUCT HEROES INTO THE CATALOGUE
   ----------------------------------------------------------------------------
   The shoot masters live in images/shoot/pdp/ (4K, 3712x4608, never deployed).
   This drops a web-sized copy of each into images/ under a name the existing
   pipeline already knows how to prefer, then the normal builders take over.

   WHY THE NAME DOES THE WORK. build-store-catalog.mjs picks a product's photo
   with bestShaped(), which scores every file sharing the product's stem by
   `cap * share` — resolution times how much of the 4:5 PDP frame the photo
   actually fills. A landscape source fills 0.53 of the frame and is padded with
   sampled edge colour; those tan, white, green and grey bands are what a buyer
   sees today. A native 4:5 source scores share = 1.0, so it wins outright with
   no catalogue edit and no special case anywhere in the build.

   So the only requirement is that the new file's basename starts with the
   product's stem — stemOf() strips a trailing -heroX / -N / -vN / -alt / -back
   / -front. `-heroS` (S for studio) satisfies both ends of that.

   Masters go in at 2100x2625: exactly the top rung of the PDP ladder in
   build-store-images.mjs, so nothing is upscaled and nothing over-ships.

   Run:  node scripts/install-pdp-heroes.mjs
         node scripts/build-store-images.mjs
         node scripts/build-store-catalog.mjs
   Lives in scripts/, which .vercelignore excludes — it never deploys.
   ========================================================================== */
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'

const require = createRequire(import.meta.url)
let sharp
try { sharp = require('E:/Workspaces/odndr-web/node_modules/sharp') }
catch { console.error('sharp not found.'); process.exit(1) }

const ROOT = process.cwd()
const SRC = join(ROOT, 'images', 'shoot', 'pdp')
const OUT = join(ROOT, 'images')
const TOP = { w: 2100, h: 2625 }

/** master basename -> the product slug it is the hero for */
const SHOT = {
  'dot-ready-kit': 'dot-ready-kit',
  'road-ready-kit': 'road-ready-kit',
  'safety-first-kit': 'safety-first-kit',
  'recharge-kit': 'recharge-kit',
  'working-hands-kit': 'working-hands-kit',
  'highway-guardian-kit': 'highway-guardian-kit',
  'pride-in-your-ride-kit': 'pride-in-your-ride-kit',
  'medal-c-1m': 'msm-c-1m',
  'seat-back-organizer': 'das-011',
  'travel-kit': 'das-009',
}

const stemOf = (b) => b.replace(/-(hero[A-Z]?|[0-9]+|v[0-9]+|alt|back|front)$/i, '')
const catalog = JSON.parse(readFileSync(join(ROOT, 'store-catalog.json'), 'utf8'))

let done = 0, skipped = 0
for (const [master, slug] of Object.entries(SHOT)) {
  const src = ['.webp', '.png'].map((e) => join(SRC, master + e)).find(existsSync)
  if (!src) { console.log(`${master.padEnd(24)} SKIP — no master`); skipped++; continue }

  const p = catalog.products.find((x) => x.slug === slug)
  if (!p) { console.log(`${master.padEnd(24)} SKIP — no product "${slug}" in the catalogue`); skipped++; continue }

  /* The stem the pipeline will match on comes from the product's CURRENT image,
     not from the master's filename — those differ (das-011 -> seat-back-organizer-hero). */
  const stem = stemOf(basename(p.img, extname(p.img)))
  const name = `${stem}-heroS.webp`

  const m = await sharp(src).metadata()
  const r = m.width / m.height
  if (Math.abs(r - 0.8) > 0.02) {
    console.log(`${master.padEnd(24)} SKIP — master is ${m.width}x${m.height} (r${r.toFixed(3)}), expected 4:5`)
    skipped++; continue
  }

  const buf = await sharp(src).resize(TOP.w, TOP.h).webp({ quality: 90, effort: 6 }).toBuffer()
  await sharp(buf).toFile(join(OUT, name))
  console.log(`${master.padEnd(24)} -> images/${name.padEnd(38)} ${(buf.length / 1024).toFixed(0)}KB   (${slug}, was ${basename(p.img)})`)
  done++
}

console.log(`\n${done} installed, ${skipped} skipped.`)
console.log('Now run:  node scripts/build-store-images.mjs && node scripts/build-store-catalog.mjs')
