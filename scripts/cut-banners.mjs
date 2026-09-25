/* ============================================================================
   CUT THE COLLECTION BANNERS OUT OF THE CAMPAIGN MASTERS
   ----------------------------------------------------------------------------
   Six 21:9 masters in images/shoot/banners/, one per programme, each an
   image2image RESTAGE of that programme's real packshot — the rule in
   PHOTO-ART-DIRECTION.md: scenery can be generated, a product cannot.

   Two placements come out of each master, and the second one is not optional:

     desktop  2400 x 820   (2.927)  the slot .st-banner renders at 1900px
     mobile   1080 x 830   (1.301)  the slot .st-banner renders at 390px

   WHY A SEPARATE MOBILE CUT. .st-banner is height:clamp(300px,34vw,650px) with
   object-fit:cover. At 1900px wide that is 646px tall — ratio 2.94, which the
   desktop cut matches. At 390px wide it is 300px tall — ratio 1.30. Covering a
   1.30 box with a 2.93 image keeps only its middle 44% of width, and in this
   art direction the product sits FAR RIGHT. So the phone would have shown six
   banners of empty concrete with the product cropped off the edge entirely.
   The mobile cut is anchored right so the product survives, with its shadow
   running left under where the caption sits.

   Both come from the SAME photograph, so the phone and the desktop show the
   same object under the same light.

   TYPE SAFETY. On a real photograph the caption is bottom-left with its own
   gradient (.st-banner .cap, .cl-hero .cl-copy). So the band measured here is
   the bottom-left corner WITH that gradient composited — the same test the
   parallax panels get in cut-shoot.mjs, against the scrim that actually ships.

   Run:  node scripts/cut-banners.mjs
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
const SRC = join(ROOT, 'images', 'shoot', 'banners')
const OUT = join(ROOT, 'images', 'store')

const DESKTOP = { w: 2400, h: 820 }
const MOBILE = { w: 1080, h: 830 }
/* A collection page's hero is a THIRD slot, not a copy of either. .cl-hero is
   375x180 on a phone — 2.08 — where .st-banner is 1.25. Feeding it the phone
   crop puts the product under the title; feeding it the wide crop cuts 29% of
   the width off, and in this art direction that is the product. 2.08 is only a
   12% trim off the 2.357 master, so it gets its own cut and loses almost
   nothing. */
const HERO = { w: 1100, h: 530 }

/* band: vertical centre of the desktop cut, as a fraction of master height
   pan:  horizontal centre of the mobile cut, as a fraction of master width
   Both are art direction, not arithmetic: keep the product whole and keep the
   bottom-left corner — where the caption lands — empty. */
const SHOTS = [
  { slug: 'appreciation', band: 0.52, pan: 0.76 },
  { slug: 'milepacks',    band: 0.52, pan: 0.76 },
  { slug: 'onboarding',   band: 0.52, pan: 0.76 },
  { slug: 'safety',       band: 0.54, pan: 0.76 },
  { slug: 'milestone',    band: 0.52, pan: 0.76 },
  { slug: 'holiday',      band: 0.52, pan: 0.76 },
]

const hash8 = (b) => createHash('sha1').update(b).digest('hex').slice(0, 8)

/** The caption gradient the page lays over a photo banner, so the measurement
    matches what a reader actually sees. Bottom-anchored, .86 at the floor. */
function capGradient(w, h) {
  const band = Math.round(h * 0.42)
  return Buffer.from('<svg width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><linearGradient id="c" x1="0" y1="1" x2="0" y2="0">' +
    '<stop offset="0%" stop-color="#060E24" stop-opacity=".86"/>' +
    '<stop offset="100%" stop-color="#060E24" stop-opacity="0"/>' +
    '</linearGradient></defs>' +
    '<rect x="0" y="' + (h - band) + '" width="' + w + '" height="' + band + '" fill="url(#c)"/></svg>')
}

/** Mean luminance and blown share in the bottom-left corner, where type sits. */
async function capBand(buf, w, h) {
  const withCap = await sharp(buf).composite([{ input: capGradient(w, h) }]).png().toBuffer()
  const bw = Math.round(w * 0.52)
  const y = Math.round(h * 0.72), bh = h - y
  const px = await sharp(withCap).extract({ left: 0, top: y, width: bw, height: bh })
    .greyscale().raw().toBuffer()
  let sum = 0, hot = 0
  for (const v of px) { sum += v; if (v > 200) hot++ }
  return { mean: sum / px.length, hot: (100 * hot) / px.length }
}

/** Trim any white print frame the model baked in — three of the first six
    parallax masters came back inside one. See cut-shoot.mjs. */
async function trim(src) {
  const probe = await sharp(src).greyscale().raw().toBuffer({ resolveWithObject: true })
  const PW = probe.info.width, PH = probe.info.height, PD = probe.data
  const rowLum = (y) => { let t = 0; for (let x = 0; x < PW; x++) t += PD[y * PW + x]; return t / PW }
  const colLum = (x) => { let t = 0; for (let y = 0; y < PH; y++) t += PD[y * PW + x]; return t / PH }
  let bt = 0, bb = 0, bl = 0, br = 0
  while (bt < PH * 0.2 && rowLum(bt) > 235) bt++
  while (bb < PH * 0.2 && rowLum(PH - 1 - bb) > 235) bb++
  while (bl < PW * 0.2 && colLum(bl) > 235) bl++
  while (br < PW * 0.2 && colLum(PW - 1 - br) > 235) br++
  if (bt || bb || bl || br) {
    bt += 2; bb += 2; bl += 2; br += 2
    console.log('                trimmed white border t' + bt + ' b' + bb + ' l' + bl + ' r' + br)
    return await sharp(src).extract({ left: bl, top: bt, width: PW - bl - br, height: PH - bt - bb }).png().toBuffer()
  }
  return src
}

const prev = existsSync(join(OUT, 'banner-manifest.json'))
  ? JSON.parse(readFileSync(join(OUT, 'banner-manifest.json'), 'utf8')).banners || {}
  : {}
const manifest = { ...prev }
const keep = new Set()
let worst = 0, cut = 0

for (const s of SHOTS) {
  /* Masters are archived as q95 webp — 107MB of PNG became 9.4MB with no
     visible loss at any cut size, and they live in git forever. PNG is still
     accepted so a fresh download can be cut before it is archived. */
  const src = ['.webp', '.png'].map((e) => join(SRC, s.slug + e)).find(existsSync) || ''
  if (!src) {
    console.log(s.slug.padEnd(14) + 'SKIP — no master, keeping ' + ((prev[s.slug] && prev[s.slug].kind) || 'nothing'))
    continue
  }

  const base = await trim(src)
  const m = await sharp(base).metadata()
  const W = m.width, H = m.height

  /* DESKTOP — a 2.93 band, placed by `band` */
  const dh = Math.round(W * DESKTOP.h / DESKTOP.w)
  const top = Math.max(0, Math.min(H - dh, Math.round(H * s.band - dh / 2)))
  const dBuf = await sharp(base).extract({ left: 0, top, width: W, height: Math.min(dh, H) })
    .resize(DESKTOP.w, DESKTOP.h).webp({ quality: 86, effort: 6 }).toBuffer()
  const dHalf = await sharp(dBuf).resize(1200, 410).webp({ quality: 84, effort: 6 }).toBuffer()

  /* MOBILE — a 1.30 cut anchored right, placed by `pan` */
  const mw = Math.round(H * MOBILE.w / MOBILE.h)
  const left = Math.max(0, Math.min(W - mw, Math.round(W * s.pan - mw / 2)))
  const mBuf = await sharp(base).extract({ left, top: 0, width: Math.min(mw, W), height: H })
    .resize(MOBILE.w, MOBILE.h).webp({ quality: 86, effort: 6 }).toBuffer()

  /* HERO — a 2.08 cut anchored right, for .cl-hero on a phone */
  const hw = Math.round(H * HERO.w / HERO.h)
  const hleft = Math.max(0, Math.min(W - hw, Math.round(W * s.pan - hw / 2)))
  const hBuf = await sharp(base).extract({ left: hleft, top: 0, width: Math.min(hw, W), height: H })
    .resize(HERO.w, HERO.h).webp({ quality: 86, effort: 6 }).toBuffer()

  const dT = await capBand(dBuf, DESKTOP.w, DESKTOP.h)
  const mT = await capBand(mBuf, MOBILE.w, MOBILE.h)
  const hT = await capBand(hBuf, HERO.w, HERO.h)
  worst = Math.max(worst, dT.hot, mT.hot, hT.hot)

  const h8 = hash8(Buffer.concat([dBuf, mBuf, hBuf]))
  /* DELETING THE OLD FILES HERE IS WHAT BROKE PRODUCTION.
     The stale-file sweep used to run at this point, before the manifest was
     written at the end of the loop. On 2026-09-25 this script was piped through
     `head -3`; node took EPIPE on the fourth console.log and died mid-run,
     having already deleted the previous appreciation files and not yet written
     the manifest. The deploy then shipped a manifest pointing at four files
     that no longer existed, and the live banner 404'd.
     So the sweep now happens AFTER the manifest is written, at the bottom of
     this file. An interrupted run leaves extra files, which is harmless; it can
     no longer leave missing ones. */
  keep.add('banner-' + s.slug + '-' + h8 + '.webp')
  keep.add('banner-' + s.slug + '-' + h8 + '-1200.webp')
  keep.add('banner-' + s.slug + '-' + h8 + '-mobile.webp')
  keep.add('banner-' + s.slug + '-' + h8 + '-hero.webp')
  writeFileSync(join(OUT, 'banner-' + s.slug + '-' + h8 + '.webp'), dBuf)
  writeFileSync(join(OUT, 'banner-' + s.slug + '-' + h8 + '-1200.webp'), dHalf)
  writeFileSync(join(OUT, 'banner-' + s.slug + '-' + h8 + '-mobile.webp'), mBuf)
  writeFileSync(join(OUT, 'banner-' + s.slug + '-' + h8 + '-hero.webp'), hBuf)

  manifest[s.slug] = {
    src: '/images/store/banner-' + s.slug + '-' + h8 + '-1200.webp',
    srcset: '/images/store/banner-' + s.slug + '-' + h8 + '-1200.webp 1200w, ' +
            '/images/store/banner-' + s.slug + '-' + h8 + '.webp 2400w',
    mobile: '/images/store/banner-' + s.slug + '-' + h8 + '-mobile.webp',
    mobileW: MOBILE.w, mobileH: MOBILE.h,
    hero: '/images/store/banner-' + s.slug + '-' + h8 + '-hero.webp',
    heroW: HERO.w, heroH: HERO.h,
    w: DESKTOP.w, h: DESKTOP.h,
    kind: 'photo',
  }
  cut++
  console.log(
    s.slug.padEnd(14) + 'band ' + s.band + ' pan ' + s.pan + '  ' +
    'desktop ' + (dBuf.length / 1024).toFixed(0) + 'KB cap ' + dT.mean.toFixed(0) + '/' + dT.hot.toFixed(1) + '%  ' +
    'mobile ' + (mBuf.length / 1024).toFixed(0) + 'KB ' + mT.mean.toFixed(0) + '/' + mT.hot.toFixed(1) + '%  ' +
    'hero ' + (hBuf.length / 1024).toFixed(0) + 'KB ' + hT.mean.toFixed(0) + '/' + hT.hot.toFixed(1) + '%' +
    (dT.hot > 3 || mT.hot > 3 || hT.hot > 3 ? '   <-- CHECK' : '')
  )
}

writeFileSync(join(OUT, 'banner-manifest.json'),
  JSON.stringify({ banner: DESKTOP, mobileBanner: MOBILE, heroBanner: HERO, banners: manifest }, null, 1))

/* EVERY PATH THE MANIFEST NAMES MUST EXIST. This is the check that would have
   caught the 404 above, so it runs here rather than in a separate script
   somebody has to remember. A manifest that names a missing file is a broken
   page, and it is silent -- the renderer just shows an empty banner. */
const missing = []
for (const [slug, b] of Object.entries(manifest)) {
  const paths = [b.src, b.mobile, b.hero].filter(Boolean)
    .concat((b.srcset || '').split(', ').filter(Boolean).map((s) => s.split(' ')[0]))
  for (const p of paths) if (!existsSync(join(ROOT, p.replace(/^\//, '')))) missing.push(slug + ' -> ' + p)
}
if (missing.length) {
  console.error('\nMANIFEST NAMES FILES THAT DO NOT EXIST:')
  for (const m of missing) console.error('  ' + m)
  console.error('Re-run this script to completion. Do NOT deploy.')
  process.exitCode = 1
} else {
  /* Only now is it safe to drop superseded files. */
  let swept = 0
  for (const f of readdirSync(OUT)) {
    if (f.indexOf('banner-') === 0 && f !== 'banner-manifest.json' && !keep.has(f)) { rmSync(join(OUT, f)); swept++ }
  }
  const photo = Object.values(manifest).filter((b) => b.kind === 'photo').length
  console.log('\n' + cut + ' banners cut, ' + swept + ' superseded files swept. ' + photo + ' of ' +
    Object.keys(manifest).length + ' are photographs. ' +
    'All manifest paths resolve. Worst blown share in any caption band: ' + worst.toFixed(2) + '%')
}
