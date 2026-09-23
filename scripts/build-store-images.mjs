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
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, readdirSync, rmSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import vm from 'node:vm'
import { createHash } from 'node:crypto'

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
/* 2026-09-23, second pass. The "inside a box" version left the gallery 754px
   tall against a 1244px buy column — 490px of blank white under the photograph,
   which is the white space Jayden was still looking at. The reference's gallery
   is 950x1188 at the same viewport: TALLER than its buy column, so nothing is
   ever blank. Its frame is 4:5 because Represent shoots 4:5.

   DAS does not — 50 of 54 primaries are landscape or square — so a straight
   cover-crop into 4:5 would throw away 47% of a landscape kit photo. Instead
   each PDP derivative is COMPOSED onto a 4:5 canvas:
       backdrop  the same photograph, cover-filled, heavily blurred and dimmed
       subject   the same photograph, fitted INSIDE, nothing cropped, centred
   The frame is filled edge to edge, the product is whole, and there are no flat
   bars — the fill is the photograph's own colour, so it reads as depth rather
   than as padding. A portrait source fills it exactly and never sees the
   backdrop at all. */
/* ── PDP FRAME: 4:5, FILLED, AND ACTUALLY SHARP ──────────────────────────
   Jayden 2026-09-23: "the photos dont render correctly at all you need to make
   sure every photo is still very quality and clean with the new sizing."

   Two separate faults, both mine, both measured:

   1. THE DEFAULT FILE WAS A THIRD OF THE DISPLAY SIZE. The pair shipped as
      560x700 (src) and 1120x1400 (@2x) while the gallery renders at 943 CSS px
      wide. A 1x screen therefore took the 560px file and stretched it 1.68x.
      That is the blur. A 1x/2x pair only works when the 1x file IS the display
      size; this one was picked before the frame went full-height.

   2. THE PRODUCT ITSELF WAS BEING UPSCALED. fit:'inside' ran with
      withoutEnlargement:FALSE, so a 1122x1402 source was blown up to fill a
      larger canvas — resampled detail presented as product photography.

   The fix for both is to let the SOURCE decide the ceiling. For a 4:5 canvas of
   width W the subject is limited by width on a landscape source and by height
   on a portrait one, so the largest honest canvas is:
        cap = ratio > 0.8 ? sourceWidth : 0.8 * sourceHeight
   Everything at or below that is real detail; anything above is invention. Each
   photograph then gets a proper responsive ladder up to its own cap and the
   browser picks by `sizes`, instead of one guessed pair.

   The BACKDROP may be upscaled freely — it is blurred to 36px, so resampling it
   is invisible. Only the subject is held to the cap. */
const PDP_RATIO = 0.8
const LADDER = [560, 840, 1120, 1400, 1680, 2100]

/** The widest 4:5 canvas this source can fill without enlarging the product. */
async function pdpCap(src) {
  const m = await sharp(src).metadata()
  const r = m.width / m.height
  return Math.max(320, Math.floor(r > PDP_RATIO ? m.width : PDP_RATIO * m.height))
}

/** The ladder for one photograph: every rung it can serve honestly, plus its
 *  own cap as the top rung when that sits between rungs. */
function pdpWidths(cap) {
  const top = Math.min(LADDER[LADDER.length - 1], cap)
  const w = LADDER.filter((x) => x <= top)
  if (!w.length) w.push(top)
  else if (w[w.length - 1] < top - 40) w.push(top)
  return w
}

async function pdpFrame(src, W, quality) {
  const H = Math.round(W / PDP_RATIO)
  const backdrop = await sharp(src)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .blur(36).modulate({ brightness: 0.78, saturation: 0.9 })
    .toBuffer()
  // withoutEnlargement: the product is never resampled up past its own pixels.
  const subject = await sharp(src)
    .resize(W, H, { fit: 'inside', withoutEnlargement: true })
    .toBuffer()
  return sharp(backdrop)
    .composite([{ input: subject, gravity: 'centre' }])
    .webp({ quality, effort: 6 }).toBuffer()
}

/* CONTENT-HASHED FILENAMES, and why they are not optional.
   vercel.json serves /images/(.*) as `public, max-age=31536000, immutable`.
   The first PDP derivatives shipped as <name>-pdp.webp; this pass changed what
   those files CONTAIN while keeping the same names, so every visitor who had
   opened a product page already would have kept the old image for a YEAR and
   never seen the fix. `immutable` is a promise that a URL's bytes never change
   — so the URL has to change when the bytes do. The hash makes that true by
   construction rather than by remembering to bump something. */
const pdpOut = {}
function hash8(buf) { return createHash('sha1').update(buf).digest('hex').slice(0, 8) }

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
  const coverFresh = existsSync(big) && existsSync(small) && statSync(big).mtimeMs > statSync(src).mtimeMs

  try {
    // The PDP pair is always recomposed — it is cheap, and its filename depends
    // on the bytes, so there is nothing to compare a timestamp against.
    const cap = await pdpCap(src)
    const widths = pdpWidths(cap)
    const built = []
    for (const W of widths) built.push({ W, buf: await pdpFrame(src, W, W <= 1120 ? 90 : 86) })
    const h = hash8(built[built.length - 1].buf)
    for (const f of readdirSync(OUT)) {
      if (f.startsWith(`${name}-pdp`) && !f.includes(`-pdp-${h}-`)) rmSync(join(OUT, f))
    }
    for (const b of built) writeFileSync(join(OUT, `${name}-pdp-${h}-${b.W}.webp`), b.buf)
    // The default src is the rung closest to the real desktop display width, so
    // a 1x screen is never handed a file it has to stretch.
    const top = built[built.length - 1].W
    const def = built.reduce((a, b) => (Math.abs(b.W - 1120) < Math.abs(a.W - 1120) ? b : a)).W
    pdpOut[name] = {
      src: `/images/store/${name}-pdp-${h}-${def}.webp`,
      srcset: built.map((b) => `/images/store/${name}-pdp-${h}-${b.W}.webp ${b.W}w`).join(', '),
      sizes: '(min-width:1024px) 50vw, 100vw',
      w: top, h: Math.round(top / PDP_RATIO), cap,
    }
    if (coverFresh) { skipped++; continue }

    // `cover` + centre. position:'attention' was tried and rejected: it chases the
    // highest-entropy region, which on a kit photo is the printed logo, and it
    // slid several crops off the product entirely.
    await sharp(src).resize(FRAME.w, FRAME.h, { fit: 'cover', position: 'centre' })
      .webp({ quality: 86, effort: 5 }).toFile(big)
    await sharp(src).resize(HALF.w, HALF.h, { fit: 'cover', position: 'centre' })
      .webp({ quality: 84, effort: 5 }).toFile(small)
    made++
  } catch (e) { failed.push(`${rel} (${e.message.slice(0, 50)})`) }
}

console.log(`built ${made}, skipped ${skipped} (up to date)`)
if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  ' + f)) }

// A manifest so the store can resolve a source path to its derivative without
// guessing, and so a missing derivative is a visible error rather than a broken img.
const manifest = {}
for (const f of readdirSync(OUT)) {
  /* `includes('-pdp')`, not `endsWith('-pdp.webp')` — the PDP derivatives now
     carry a content hash (<name>-pdp-<h>.webp), so the old suffix test stopped
     matching them and they were being registered as 59 extra BASE products.
     The manifest reported 118 entries for a 59-photograph catalogue, which is
     the tell. */
  if (!f.endsWith('.webp') || f.includes('@2x') || f.includes('-pdp')) continue
  const name = basename(f, '.webp')
  const entry = { src: `/images/store/${f}`, srcset: `/images/store/${name}@2x.webp 2x` }
  if (pdpOut[name]) entry.pdp = pdpOut[name]
  manifest[name] = entry
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ frame: FRAME, pdpRatio: PDP_RATIO, pdpLadder: LADDER, images: manifest }, null, 1))
console.log(`manifest: ${Object.keys(manifest).length} entries -> images/store/manifest.json`)
