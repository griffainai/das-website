/* ============================================================================
   STORE IMAGE NORMALISER
   ----------------------------------------------------------------------------
   Jayden 2026-09-21: "i want the photos to be fully sized and not cropped i
   dont like the white border at all resize all the photos".

   THE MEASUREMENT THAT DECIDED THE FRAME. Every product photo on this site was
   measured (51 unique files):

       1.25   x15      4:5 landscape   <- modal ratio
       1.5    x10      3:2
       1.0    x10      square
       1.333  x8       4:3
       1.778  x2       16:9
       0.806  x4       4:5 PORTRAIT

   So DAS photography is LANDSCAPE. The 0.806 portrait frame the other two
   stores use is right for them because Off Duty and the merch line are shot as
   4:5 apparel — forcing DAS's landscape kit shots into it is precisely what
   produced the bars. The frame was wrong, not the photos.

   THE TRADE-OFF, STATED HONESTLY. With mixed source ratios you can have "no
   border" or "no crop", not both. "No border" was the stronger instruction, so
   every derivative is COVER-fitted to one frame and the frame is the modal
   ratio (1.25) so the crop is as small as it can be:

       1.25  -> exact, no crop at all          (15 files)
       1.263 -> ~1% off the sides              (1)
       1.333 -> ~6% off the sides              (8)
       1.5   -> ~17% off the sides             (10)
       1.0   -> ~20% off top and bottom        (10)
       1.778 -> ~30% off the sides             (2)
       0.806 -> ~35% off top and bottom        (4)

   The real fix for the last three rows is a reshoot at one ratio. Until then
   the crop is centred, which suits these shots — they are centred product
   arrangements with background at the edges.

   Output: images/store/<name>@2x.webp (1400x1120) and <name>.webp (700x560).
   Re-runnable and idempotent; skips a derivative that is newer than its source.
   Lives in scripts/, which .vercelignore excludes, so this file never deploys —
   only the images it writes do.

   Run:  node scripts/build-store-images.mjs
   ========================================================================== */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import vm from 'node:vm'

// sharp is not a dependency of this static site; borrow the one already installed
// next door rather than adding a build dependency to a site that has no build.
const require = createRequire(import.meta.url)
let sharp
try {
  sharp = require('E:/Workspaces/odndr-web/node_modules/sharp')
} catch {
  console.error('sharp not found. Install it, or point this at another checkout that has it.')
  process.exit(1)
}

const ROOT = process.cwd()
const SRC = join(ROOT, 'images')
const OUT = join(ROOT, 'images', 'store')

/** The frame. 5:4 — the modal ratio of this catalogue's photography. */
export const FRAME = { w: 1400, h: 1120 }
const HALF = { w: 700, h: 560 }

/** THE PDP DERIVATIVE — NO CROP AT ALL.
 *  A grid needs one ratio so the cards line up; a product page shows ONE
 *  product and needs no such thing. Jayden 2026-09-23: "on desktop this pdp
 *  photo is way to big and isnt sized properly where it fits on one page" —
 *  and the shot he was looking at (pak-professional-driver-kit-heroA, 1122x1402)
 *  is PORTRAIT, so the 5:4 grid frame was cutting 36% of the kit away before
 *  it ever got too tall.
 *  So the PDP gets its own derivative: fitted INSIDE a box, never cropped,
 *  keeping the photograph's own ratio. The manifest records the resulting
 *  pixel size so the page can set aspect-ratio per image and reserve the
 *  correct box — no letterbox bars, because the frame takes the image's shape
 *  rather than the reverse. Height is then capped in CSS against the viewport. */
const PDP = { w: 1600, h: 1600 }
const PDP_HALF = { w: 800, h: 800 }

mkdirSync(OUT, { recursive: true })

/** Every image referenced by the store catalogue, plus the collection heroes. */
function catalogImages() {
  const out = new Set()
  const add = (p) => { if (p && p.startsWith('/images/') && !p.startsWith('/images/store/')) out.add(p.slice('/images/'.length)) }

  // shop.html's static cards
  const shop = readFileSync(join(ROOT, 'shop.html'), 'utf8')
  for (const m of shop.matchAll(/data-product-image="([^"]+)"/g)) add(m[1])
  for (const m of shop.matchAll(/class="product-card-img" src="([^"]+)"/g)) add(m[1])

  // The JS-rendered ranges, RUN rather than regexed. Scanning the source text
  // missed every path built by concatenation — the career medals set their image
  // as '/images/milestone-c-' + mk + '.jpg', so msm-c-250k and msm-c-500k ended up
  // with no derivative and were dropped from the catalogue with no error anywhere.
  // Running the module reads the values the browser would actually see.
  for (const [file, globalName] of [['js/milestones.js', 'DAS_MILESTONES'], ['js/mile-packs.js', 'DAS_MILEPACKS']]) {
    const ctx = { window: {}, document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }, console }
    ctx.self = ctx.window
    vm.createContext(ctx)
    vm.runInContext(readFileSync(join(ROOT, file), 'utf8'), ctx, { filename: file })
    for (const item of ctx.window[globalName] || []) {
      add(item.image)
      for (const p of item.photos || []) add(p)
      for (const p of item.images || []) add(p)
    }
  }
  return [...out]
}

const files = catalogImages()
console.log(`${files.length} source photographs`)

let made = 0, skipped = 0, failed = []
for (const rel of files) {
  const src = join(SRC, rel)
  if (!existsSync(src)) { failed.push(`${rel} (missing)`); continue }
  const name = basename(rel, extname(rel))
  const big = join(OUT, `${name}@2x.webp`)
  const small = join(OUT, `${name}.webp`)
  const pdpBig = join(OUT, `${name}-pdp@2x.webp`)
  const pdpSmall = join(OUT, `${name}-pdp.webp`)

  if (existsSync(big) && existsSync(small) && existsSync(pdpBig) && existsSync(pdpSmall) &&
      statSync(big).mtimeMs > statSync(src).mtimeMs && statSync(pdpBig).mtimeMs > statSync(src).mtimeMs) { skipped++; continue }

  try {
    // `cover` + centre. position:'attention' was tried and rejected: it chases the
    // highest-entropy region, which on a kit photo is the printed logo, and it
    // slid several crops off the product entirely.
    await sharp(src).resize(FRAME.w, FRAME.h, { fit: 'cover', position: 'centre' })
      .webp({ quality: 86, effort: 5 }).toFile(big)
    await sharp(src).resize(HALF.w, HALF.h, { fit: 'cover', position: 'centre' })
      .webp({ quality: 84, effort: 5 }).toFile(small)
    // and the uncropped pair for the product page
    await sharp(src).resize(PDP.w, PDP.h, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, effort: 5 }).toFile(pdpBig)
    await sharp(src).resize(PDP_HALF.w, PDP_HALF.h, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86, effort: 5 }).toFile(pdpSmall)
    made++
  } catch (e) { failed.push(`${rel} (${e.message.slice(0, 50)})`) }
}

console.log(`built ${made}, skipped ${skipped} (up to date)`)
if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  ' + f)) }

// A manifest so the store can resolve a source path to its derivative without
// guessing, and so a missing derivative is a visible error rather than a broken img.
const manifest = {}
for (const f of readdirSync(OUT)) {
  if (!f.endsWith('.webp') || f.includes('@2x') || f.endsWith('-pdp.webp')) continue
  const name = basename(f, '.webp')
  const entry = { src: `/images/store/${f}`, srcset: `/images/store/${name}@2x.webp 2x` }
  // The uncropped variant, WITH its real dimensions. Measuring here rather than
  // at build time means a skipped rebuild still reports the truth.
  if (existsSync(join(OUT, `${name}-pdp.webp`))) {
    const m = await sharp(join(OUT, `${name}-pdp@2x.webp`)).metadata()
    entry.pdp = {
      src: `/images/store/${name}-pdp.webp`,
      srcset: `/images/store/${name}-pdp@2x.webp 2x`,
      w: m.width, h: m.height,
    }
  }
  manifest[name] = entry
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ frame: FRAME, pdpBox: PDP, images: manifest }, null, 1))
console.log(`manifest: ${Object.keys(manifest).length} entries -> images/store/manifest.json`)
