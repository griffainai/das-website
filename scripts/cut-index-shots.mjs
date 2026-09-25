/* ============================================================================
   CUT THE COLLECTION-INDEX SHOTS
   ----------------------------------------------------------------------------
   The index band on the store home is a split: the six programmes listed on the
   left, one photograph on the right that swaps as you move down the list
   (#st-index in js/das-store.js). Until now that photograph was the programme's
   PRODUCT shot — a 4:5 portrait — dropped into a landscape slot.

   MEASURED ON THE LIVE SITE, and this is the whole bug:

     viewport 1920   slot 953x464   ratio 2.05
     viewport 1440   slot 713x464   ratio 1.54
     viewport 1024   slot 505x348   ratio 1.45
     phone <=860     full width, aspect-ratio:3/2   ratio 1.50

   Every slot is LANDSCAPE. Every photograph was 0.80 PORTRAIT. object-fit:cover
   therefore kept only the middle 39% of the picture's height at 1920 — which is
   why the home page showed a sliced desk instead of a photograph. No amount of
   re-picking product shots would have fixed it; the shape was wrong.

   So these are their own shoot: 16:9 masters, cut to the two shapes that matter.

     desktop  2100 x 1024  (2.05)  the widest case; narrower desktops crop sides
     mobile   1500 x 1000  (1.50)  exactly the phone slot, no crop at all

   The master is 1.778, so the desktop cut trims 13% of height and the mobile cut
   trims 16% of width. The shoot brief keeps every subject inside the middle 70%
   of width and 80% of height, which is what makes both cuts safe — and what
   makes the 1.45 laptop slot safe too, since it crops the 2.05 file back toward
   the middle.

   Run:  node scripts/cut-index-shots.mjs
   Lives in scripts/, which .vercelignore excludes — it never deploys.
   ========================================================================== */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const require = createRequire(import.meta.url)
let sharp
try { sharp = require('E:/Workspaces/odndr-web/node_modules/sharp') }
catch { console.error('sharp not found.'); process.exit(1) }

const ROOT = process.cwd()
const SRC = join(ROOT, 'images', 'shoot', 'index')
const OUT = join(ROOT, 'images', 'store')

const DESKTOP = { w: 2100, h: 1024 }
const MOBILE = { w: 1500, h: 1000 }

/* band: vertical centre of the desktop cut, as a fraction of master height
   pan:  horizontal centre of the mobile cut, as a fraction of master width */
const SHOTS = [
  { slug: 'appreciation', band: 0.50, pan: 0.50 },
  { slug: 'milepacks',    band: 0.50, pan: 0.50 },
  { slug: 'onboarding',   band: 0.50, pan: 0.50 },
  { slug: 'safety',       band: 0.50, pan: 0.52 },
  { slug: 'milestone',    band: 0.50, pan: 0.48 },
  { slug: 'holiday',      band: 0.50, pan: 0.50 },
]

const hash8 = (b) => createHash('sha1').update(b).digest('hex').slice(0, 8)

const manifest = {}
const keep = new Set()
let cut = 0

for (const s of SHOTS) {
  const src = ['.webp', '.png'].map((e) => join(SRC, s.slug + e)).find(existsSync)
  if (!src) { console.log(s.slug.padEnd(14) + 'SKIP — no master'); continue }

  const m = await sharp(src).metadata()
  const W = m.width, H = m.height

  /* DESKTOP — a 2.05 band through the master */
  const dh = Math.round(W * DESKTOP.h / DESKTOP.w)
  const top = Math.max(0, Math.min(H - dh, Math.round(H * s.band - dh / 2)))
  const dBuf = await sharp(src).extract({ left: 0, top, width: W, height: Math.min(dh, H) })
    .resize(DESKTOP.w, DESKTOP.h).webp({ quality: 86, effort: 6 }).toBuffer()
  const dHalf = await sharp(dBuf).resize(1050, 512).webp({ quality: 84, effort: 6 }).toBuffer()

  /* MOBILE — a 1.50 cut, placed by `pan` */
  const mw = Math.round(H * MOBILE.w / MOBILE.h)
  const left = Math.max(0, Math.min(W - mw, Math.round(W * s.pan - mw / 2)))
  const mBuf = await sharp(src).extract({ left, top: 0, width: Math.min(mw, W), height: H })
    .resize(MOBILE.w, MOBILE.h).webp({ quality: 86, effort: 6 }).toBuffer()

  const h8 = hash8(Buffer.concat([dBuf, mBuf]))
  for (const f of ['.webp', '-1050.webp', '-mobile.webp']) keep.add('ix-' + s.slug + '-' + h8 + f)
  writeFileSync(join(OUT, 'ix-' + s.slug + '-' + h8 + '.webp'), dBuf)
  writeFileSync(join(OUT, 'ix-' + s.slug + '-' + h8 + '-1050.webp'), dHalf)
  writeFileSync(join(OUT, 'ix-' + s.slug + '-' + h8 + '-mobile.webp'), mBuf)

  manifest[s.slug] = {
    src: '/images/store/ix-' + s.slug + '-' + h8 + '-1050.webp',
    srcset: '/images/store/ix-' + s.slug + '-' + h8 + '-1050.webp 1050w, ' +
            '/images/store/ix-' + s.slug + '-' + h8 + '.webp 2100w',
    mobile: '/images/store/ix-' + s.slug + '-' + h8 + '-mobile.webp',
    mobileW: MOBILE.w, mobileH: MOBILE.h,
    w: DESKTOP.w, h: DESKTOP.h,
  }
  cut++
  console.log(
    s.slug.padEnd(14) + 'band ' + s.band + ' pan ' + s.pan + '  ' +
    'desktop ' + (dBuf.length / 1024).toFixed(0) + 'KB  mobile ' + (mBuf.length / 1024).toFixed(0) + 'KB'
  )
}

writeFileSync(join(OUT, 'index-shots.json'),
  JSON.stringify({ desktop: DESKTOP, mobile: MOBILE, shots: manifest }, null, 1))

/* EVERY PATH THE MANIFEST NAMES MUST EXIST, and the sweep only runs once that
   holds — the lesson from banner-manifest.json shipping four dead paths. */
const missing = []
for (const [slug, b] of Object.entries(manifest)) {
  const paths = [b.src, b.mobile].concat(b.srcset.split(', ').map((x) => x.split(' ')[0]))
  for (const p of paths) if (!existsSync(join(ROOT, p.replace(/^\//, '')))) missing.push(slug + ' -> ' + p)
}
if (missing.length) {
  console.error('\nMANIFEST NAMES FILES THAT DO NOT EXIST:')
  for (const x of missing) console.error('  ' + x)
  process.exitCode = 1
} else {
  let swept = 0
  for (const f of readdirSync(OUT)) {
    if (f.indexOf('ix-') === 0 && !keep.has(f)) { rmSync(join(OUT, f)); swept++ }
  }
  console.log('\n' + cut + ' index shots cut, ' + swept + ' superseded files swept. All manifest paths resolve.')
}
