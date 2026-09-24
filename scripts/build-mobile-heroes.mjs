/* ============================================================================
   MOBILE HERO CROPS
   ----------------------------------------------------------------------------
   Jayden 2026-09-24: "The header photos on the homepage aren't sized properly.
   Remember, we need to size everything properly for mobile as well."

   WHAT THE AUDIT FOUND. Six pages render a landscape photograph into a portrait
   box that is nearly the whole phone screen, with object-fit:cover. Measured at
   375x812 against each file's true pixels:

     index.html                        900x675  -> 375x698 box   2.07x upscale
     store.html (closing band)        1200x509  -> 375x569 box   2.23x
     driver-recognition-programs      1024x768  -> 375x779 box   2.03x
     driver-retention                1536x1024  -> 375x807 box   1.58x
     driver-appreciation-gifts       1402x1122  -> 375x779 box   1.39x
     driver-milestone-awards         1387x1134  -> 375x807 box   1.42x

   TWO FAULTS, NOT ONE.
   1. Resolution. A cover-cropped portrait box needs width = height x source
      ratio, which is far more than the `sizes="100vw"` the markup declared —
      so the browser dutifully picked the smallest candidate and then stretched
      it. Four of the six had no srcset at all, so there was nothing to pick.
   2. Framing. A 1.33 landscape cover-cropped into a 0.54 portrait box keeps
      about 27% of its width. Whatever the photograph was composed around is
      usually not in that column.

   No amount of `sizes` fixes the second one. This script cuts a real portrait
   crop per hero, using sharp's attention strategy so the crop follows the
   subject rather than the centre, at two widths for 1x and 2x screens.

   Writes:
     images/mobile/<name>-m760.webp   760 x 1013   (3:4)
     images/mobile/<name>-m1100.webp  1100 x 1467
     images/mobile/manifest.json

   Run:  node scripts/build-mobile-heroes.mjs
   Lives in scripts/, which .vercelignore excludes — it never deploys.
   ========================================================================== */
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
let sharp
try { sharp = require('E:/Workspaces/odndr-web/node_modules/sharp') }
catch { console.error('sharp not found.'); process.exit(1) }

const ROOT = process.cwd()
const OUT = join(ROOT, 'images', 'mobile')
mkdirSync(OUT, { recursive: true })

/* 3:4 — tall enough to fill a phone hero without becoming a letterbox slot,
   shallow enough that a landscape original still has something to give. */
const RATIO = 3 / 4
/* 1500 matters: the tall dx-hero pages run a 375x747 box, which at 2x needs
   1494 device px of HEIGHT. A 1100-wide 3:4 crop is 1467 tall and still gets
   stretched. Three candidates let `sizes` land on one that never upscales. */
const WIDTHS = [760, 1100, 1500]

/* source -> the name the page will reference. Always the LARGEST file on disk
   for that photograph, never the one the page happens to load today. */
const HEROES = [
  { src: 'home-hero-2600.webp',         name: 'home-hero' },
  { src: 'das-hero.jpg',                name: 'das-hero' },
  { src: 'first30-manager-driver.webp', name: 'first30-manager-driver' },
  { src: 'pak-collection-hero.webp',    name: 'pak-collection-hero' },
  { src: 'medals-hero.webp',            name: 'medals-hero' },
  { src: 'band-forest-2400.jpg',        name: 'band-forest' },
]

const manifest = {}

for (const h of HEROES) {
  const p = join(ROOT, 'images', h.src)
  if (!existsSync(p)) { console.log(`${h.name.padEnd(26)} SKIP — ${h.src} not found`); continue }

  const m = await sharp(p).metadata()
  const out = []

  for (const w of WIDTHS) {
    const hh = Math.round(w / RATIO)
    if (m.width < w * 0.75) { console.log(`${h.name.padEnd(26)} note: source ${m.width}px is thin for a ${w}px crop`) }
    const buf = await sharp(p)
      .resize(w, hh, { fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 84, effort: 6 })
      .toBuffer()
    const file = `${h.name}-m${w}.webp`
    writeFileSync(join(OUT, file), buf)
    out.push({ w, h: hh, file, kb: +(buf.length / 1024).toFixed(0) })
  }

  manifest[h.name] = {
    source: `${h.src} (${m.width}x${m.height}, r${(m.width / m.height).toFixed(2)})`,
    src: `/images/mobile/${out[0].file}`,
    srcset: out.map((o) => `/images/mobile/${o.file} ${o.w}w`).join(', '),
    w: out[0].w, h: out[0].h,
  }
  console.log(`${h.name.padEnd(26)} ${out.map((o) => `${o.w}w ${o.kb}KB`).join('  ')}   from ${m.width}x${m.height}`)
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`\n${Object.keys(manifest).length} mobile hero crops -> images/mobile/`)
