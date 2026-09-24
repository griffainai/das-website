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

/** The widest 4:5 canvas this source can fill without enlarging anything.
 *  NOTE THE INVERSION vs the previous pass. When the frame was filled by
 *  fitting the photo INSIDE it, a landscape source was limited by its WIDTH.
 *  Now the frame is filled by COVER, so a landscape source is cropped on the
 *  width and limited by its HEIGHT, and a portrait source is the other way
 *  round. Leaving the old formula in place would have quietly reintroduced the
 *  upscaling this file fixed one pass ago. */
async function pdpCap(src) {
  const img = sharp(src)
  const m = await img.metadata()
  const r = m.width / m.height
  if (r <= PDP_RATIO) return Math.max(320, m.width)          // portrait: width limits
  // A landscape source that will be PADDED keeps its full width; one that will
  // be CROPPED is limited by its height. Ask the same question pdpFrame asks,
  // so the ladder never promises pixels the frame will not contain.
  const strip = Math.max(2, Math.round(m.height * 0.03))
  const top = await edgeColour(img, { left: 0, top: 0, width: m.width, height: strip })
  const bot = await edgeColour(img, { left: 0, top: m.height - strip, width: m.width, height: strip })
  /* THE SAME TEST pdpFrame USES, including the severe-crop clause. These two
     drifted apart for one pass: pdpFrame padded whenever the crop exceeded 28%,
     but pdpCap decided on flat edges alone, so a padded photograph — which
     keeps its FULL width — was handed a ladder computed as if it had been
     cropped. 22 of 54 products ended up with a top rung below the 943px display
     width and would have been stretched up to 1.39x on the product page. Two
     functions answering the same question must ask it the same way. */
  const padded = (top.flat && bot.flat) || (1 - PDP_RATIO / r) > 0.28
  return Math.max(320, Math.floor(padded ? m.width : PDP_RATIO * m.height))
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

/* 2026-09-23, third pass. THE BLURRED BACKDROP IS GONE.
   Jayden, looking at a live row of five: "get rid of all of these preview
   photos that are cropped ... every photo needs to be sized like this."

   The two he pointed at as correctly sized were the only two in that row with a
   NATIVE 4:5 source, so they filled edge to edge. The other three were
   landscape and showed the composed backdrop as blurred bands over 36-47% of
   the frame height — a visible letterbox, and an inconsistent one, because it
   only appeared on some cards. The backdrop was my way of avoiding a crop; in a
   row of five it reads as a defect.

   So every derivative is a plain cover crop now: every card fills, every card
   matches. The cost is real and is printed by this build. The catalogue builder
   first re-picks each product's photo to whichever of ITS OWN variants sits
   closest to 4:5, so the crop is the smallest the existing photography allows. */
/* ── CROP, OR PAD WITH THE PHOTO'S OWN EDGE COLOUR ────────────────────────
   Found by building a contact sheet of the heaviest crops and LOOKING at it,
   which no measurement would have surfaced: several of these files are not
   photographs at all. They are composed marketing graphics with baked-in
   headlines on a flat ground, and a centre crop cuts the words in half —
   "ED BY / MITMENT." where the graphic reads BACKED BY COMMITMENT, and
   "FOR / ONG HAUL." for BUILT FOR THE LONG HAUL. Shipping that would have put
   mutilated typography on eight product cards.

   The rule that separates the two cases is the EDGE. A studio graphic sits on
   a flat ground, so its outer strips are near-uniform and the canvas can simply
   be EXTENDED in that exact colour — invisible, and nothing is lost. A
   photograph has busy edges, where padding would read as a band, but cropping
   costs only background. So:

       uniform edges  ->  extend to 4:5 in the sampled edge colour, no crop
       busy edges     ->  cover-crop to 4:5, fills the frame

   Either way the frame is filled edge to edge, which is what was asked for.
   Top and bottom are sampled and extended independently, so a graphic with a
   dark top and a lighter base keeps its gradient. */
const EDGE_UNIFORM = 16          // per-channel stdev, 0-255, below which a strip is "flat"

async function edgeColour(img, region) {
  const st = await sharp(await img.clone().extract(region).toBuffer()).stats()
  const ch = st.channels.slice(0, 3)
  return {
    rgb: { r: Math.round(ch[0].mean), g: Math.round(ch[1].mean), b: Math.round(ch[2].mean) },
    flat: Math.max(...ch.map((c) => c.stdev)) < EDGE_UNIFORM,
  }
}

async function pdpFrame(src, W, quality) {
  const H = Math.round(W / PDP_RATIO)
  const img = sharp(src)
  const m = await img.metadata()
  const r = m.width / m.height

  if (r > PDP_RATIO) {
    // Landscape: filling 4:5 means either cropping the sides or adding height.
    const strip = Math.max(2, Math.round(m.height * 0.03))
    const top = await edgeColour(img, { left: 0, top: 0, width: m.width, height: strip })
    const bot = await edgeColour(img, { left: 0, top: m.height - strip, width: m.width, height: strip })
    /* PAD when the edges are flat (lossless), and ALSO when a crop would be
       severe. Measured on the contact sheet: the flat-edge test alone still
       cropped the YETI graphics, because their lower strip carries a SHOP NOW
       button and fails flatness — so their headlines shipped as "UELED BY /
       OMMITMENT." and "UILT FOR / HE LONG HAUL.". A slightly imperfect pad is
       far better than severed typography, and at this ratio a crop removes a
       third of the image. 28% is the line: below it a crop takes background,
       above it a crop takes content. */
    const cropShare = 1 - PDP_RATIO / r
    if ((top.flat && bot.flat) || cropShare > 0.28) {
      const need = Math.round(m.width / PDP_RATIO) - m.height      // total height to add
      const half = Math.round(need / 2)
      /* TWO SEPARATE PASSES, not two chained .extend() calls. Chaining them on
         one pipeline silently applies only the LAST: the top padding was
         dropped, the image came out 1536x1462 (ratio 1.05) instead of 4:5, and
         the cover resize then cropped 24% off its LEFT — which is why
         "FUELED BY COMMITMENT." shipped as "UELED BY OMMITMENT." while the
         source file was perfectly intact. The bottom band looked like proof the
         padding had worked, which is what made it convincing. */
      let buf = await img.clone().extend({ top: half, bottom: 0, background: top.rgb }).toBuffer()
      buf = await sharp(buf).extend({ top: 0, bottom: need - half, background: bot.rgb }).toBuffer()
      const chk = await sharp(buf).metadata()
      if (Math.abs(chk.width / chk.height - PDP_RATIO) > 0.01) {
        throw new Error(`pad produced ${chk.width}x${chk.height} (r${(chk.width / chk.height).toFixed(3)}), expected ${PDP_RATIO}`)
      }
      return sharp(buf).resize(W, H, { fit: 'cover', position: 'centre' })
        .webp({ quality, effort: 6 }).toBuffer()
    }
  }
  return img.resize(W, H, { fit: 'cover', position: 'centre' })
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
  /* THE COLLECTION HEROES, read from the one file that declares them.
     A hero named there but never referenced by a product gets no derivative,
     resolves to nothing, and the tile falls back to "the first product in the
     programme" — which is the 250,000 placeholder for Service Milestone
     Awards, the exact outcome the hero map exists to prevent. This happened to
     wk-group-lifestyle. Run rather than parsed, as milestones.js is. */
  const hctx = { window: {}, document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }, console }
  hctx.self = hctx.window
  vm.createContext(hctx)
  vm.runInContext(readFileSync(join(ROOT, 'js/store-heroes.js'), 'utf8'), hctx, { filename: 'js/store-heroes.js' })
  const heroes = hctx.window.DAS_STORE_HEROES || {}
  for (const base of Object.values(heroes)) {
    const hit = readdirSync(SRC).find((f) => basename(f, extname(f)) === base && /\.(jpg|jpeg|png|webp)$/i.test(f))
    if (hit) out.add(hit)
    else console.warn(`  ! collection hero "${base}" has no source file in images/`)
  }

  return [...out]
}

/* ── ADD EACH PRODUCT'S BEST-SHAPED SIBLING ──────────────────────────────
   catalogImages() returns only what the catalogue currently REFERENCES. That
   is a chicken-and-egg problem for choosing a better photo: the catalogue
   builder wants to swap working-hands from heroC (1.5 landscape, a 47% crop)
   to heroA (1122x1402, no crop at all), but it may only choose a file that has
   a derivative — and heroA had none, because nothing referenced it. The swap
   silently did nothing.

   So for every referenced photograph, its siblings are measured here and the
   one closest to the 4:5 frame is added to the build. Placeholders and site
   chrome are excluded by name. */
/* ── SCORING A CANDIDATE PHOTOGRAPH ──────────────────────────────────────
   The first version of this picked whichever variant sat CLOSEST TO 4:5 and
   ignored everything else. That is the wrong objective now that padding is
   lossless: exec-lunchbag ended up on an 846x846 square (ratio 1.00, a near
   miss) whose 4:5 crop caps at 676px — below the 943px the product page
   renders at — while a 1200x896 variant of the same bag would have padded to a
   full 1200px. Optimising for shape alone cost resolution.

   The score balances the two things that actually matter:

     cap           how many real pixels the finished 4:5 frame can hold
     contentShare  how much of that frame is photograph rather than padding

   A wide 16:9 scores badly not because of its shape but because most of the
   frame would be flat colour. A small square scores badly because there are
   not enough pixels. Highest product wins. */
const BAD_SOURCE = /soon|placeholder|favicon|logo|icon|band-|email|og-|hero-bg/i

function scoreCandidate(w, h) {
  const r = w / h
  if (r <= PDP_RATIO) return { r, cap: w, share: r / PDP_RATIO, score: w * (r / PDP_RATIO) }
  const padded = (1 - PDP_RATIO / r) > 0.28
  const cap = padded ? w : Math.floor(PDP_RATIO * h)
  const share = padded ? PDP_RATIO / r : 1
  return { r, cap, share, score: cap * share }
}

const stemOf = (b) => b.replace(/-(hero[A-Z]?|[0-9]+|v[0-9]+|alt|back|front)$/i, '')

/** Measured once here and written to source-ratios.json, so the catalogue
 *  builder chooses from the SAME numbers rather than recomputing them — the
 *  two halves of this decision drifted apart once already and shipped 22
 *  under-sized images. */
const SOURCE_STATS = {}

async function withBestSiblings(list) {
  const all = readdirSync(SRC).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f) && !BAD_SOURCE.test(f))
  for (const f of all) {
    try {
      const m = await sharp(join(SRC, f)).metadata()
      SOURCE_STATS[f] = { w: m.width, h: m.height, ...scoreCandidate(m.width, m.height) }
    } catch { /* unreadable */ }
  }
  const out = new Set(list)
  let added = 0
  for (const rel of list) {
    const cur = basename(rel, extname(rel))
    const stem = stemOf(cur)
    let best = null
    for (const f of all) {
      const b = basename(f, extname(f))
      if (b !== cur && !b.startsWith(stem + '-') && b !== stem) continue
      const st = SOURCE_STATS[f]
      if (!st) continue
      if (!best || st.score > best.st.score) best = { f, st }
    }
    if (best && !out.has(best.f)) { out.add(best.f); added++ }
  }
  console.log(`${added} better sibling photographs added to the build`)
  return [...out]
}

const files = await withBestSiblings(catalogImages())
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
/* Every SOURCE photograph's aspect ratio. The catalogue builder uses this to
   choose, among the variants a product already owns, the one closest to the
   4:5 frame — cheaper and more reliable than re-opening 278 files there. */
writeFileSync(join(OUT, 'source-ratios.json'), JSON.stringify(SOURCE_STATS, null, 1))
console.log(`source stats: ${Object.keys(SOURCE_STATS).length} -> images/store/source-ratios.json`)

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify({ frame: FRAME, pdpRatio: PDP_RATIO, pdpLadder: LADDER, images: manifest }, null, 1))
console.log(`manifest: ${Object.keys(manifest).length} entries -> images/store/manifest.json`)
