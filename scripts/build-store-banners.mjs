/* ============================================================================
   STORE BANNERS + THE SHOT LIST
   ----------------------------------------------------------------------------
   The store home is being rebuilt to shop.griffain.io's rhythm: a full-bleed
   BANNER, then a horizontal product row, repeated per programme. Measured off
   the reference at 1900px, the banner is 1900x650 — ratio 2.92.

   DAS has nothing shaped like that. The six collection heroes run 0.80 to 1.50,
   so cover-cropping them into 2.92 throws away 46% to 73% of the frame height,
   which on a product photograph means the product.

   Jayden 2026-09-24: "if we dont have the right pictures we need use a
   placeholder and create a list of photos i need to make with the right sizing
   to match the spot."

   So this script does exactly that, per hero:

     source ratio >= 2.2   ->  real banner, cover-cropped, minimal loss
     anything narrower     ->  a BRANDED PLACEHOLDER that names the programme
                               and states the shot that is missing

   The placeholder is deliberately not a blurred crop or a stretched photo.
   Those read as a broken image and quietly become permanent. A panel that says
   what is missing is honest, looks deliberate, and is impossible to forget.

   Writes:
     images/store/banner-<slug>-<hash>.webp        2400 and 1200 wide
     images/store/banner-manifest.json             what the page renders from
     PHOTO-SHOT-LIST.md                            what Jayden needs to shoot

   Run:  node scripts/build-store-banners.mjs
   Lives in scripts/, which .vercelignore excludes — it never deploys.
   ========================================================================== */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { createHash } from 'node:crypto'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
let sharp
try { sharp = require('E:/Workspaces/odndr-web/node_modules/sharp') }
catch { console.error('sharp not found.'); process.exit(1) }

const ROOT = process.cwd()
const SRC = join(ROOT, 'images')
const OUT = join(ROOT, 'images', 'store')

/** Measured off shop.griffain.io at a 1900px viewport. */
const BANNER = { w: 2400, h: 820 }          // 2.93, the reference's 1900x650
const RATIO = BANNER.w / BANNER.h
/** Below this, a cover crop takes product rather than background. */
const MIN_SOURCE_RATIO = 2.2

/* the hero + subtitle maps, run rather than parsed — one declaration, three
   consumers now (the page, the image builder, and this) */
const ctx = { window: {}, document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }, console }
ctx.self = ctx.window
vm.createContext(ctx)
vm.runInContext(readFileSync(join(ROOT, 'js/store-heroes.js'), 'utf8'), ctx, { filename: 'js/store-heroes.js' })
const HEROES = ctx.window.DAS_STORE_HEROES || {}
const SUBS = ctx.window.DAS_STORE_SUBS || {}

const CAT = JSON.parse(readFileSync(join(ROOT, 'store-catalog.json'), 'utf8'))
const LABEL = Object.fromEntries(CAT.programs.map((p) => [p.slug, p.label]))
const COUNT = Object.fromEntries(CAT.programs.map((p) => [p.slug, p.count]))

const hash8 = (b) => createHash('sha1').update(b).digest('hex').slice(0, 8)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A panel that says what is missing, in DAS navy, at the exact banner size. */
function placeholderSVG(label, sub, need) {
  const { w, h } = BANNER
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0C1840"/><stop offset="1" stop-color="#060E24"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect x="0" y="0" width="${w}" height="3" fill="#2E4FA8"/>
  <text x="88" y="300" fill="#9CC4F5" font-family="Chivo, Helvetica, Arial, sans-serif"
        font-size="30" letter-spacing="3" font-weight="500">${esc(sub.toUpperCase())}</text>
  <text x="88" y="400" fill="#FFFFFF" font-family="Chivo, Helvetica, Arial, sans-serif"
        font-size="86" font-weight="600" letter-spacing="-1">${esc(label.toUpperCase())}</text>
  <text x="88" y="486" fill="rgba(255,255,255,0.46)" font-family="Chivo, Helvetica, Arial, sans-serif"
        font-size="26">Photography in progress &#183; ${esc(need)}</text>
</svg>`)
}

/* A REAL BANNER OUTRANKS THIS SCRIPT.
   Since 2026-09-25 the six banners are campaign frames cut by
   scripts/cut-banners.mjs out of images/shoot/banners/. This script predates
   them and knows nothing about them, so running it would quietly overwrite six
   photographs with six placeholders and the only symptom would be the store
   looking unfinished again. Any programme with a master keeps what it has. */
const SHOOT = join(ROOT, 'images', 'shoot', 'banners')
const prevManifest = existsSync(join(OUT, 'banner-manifest.json'))
  ? JSON.parse(readFileSync(join(OUT, 'banner-manifest.json'), 'utf8'))
  : { banners: {} }

const manifest = {}
const shotList = []

for (const [slug, key] of Object.entries(HEROES)) {
  const label = LABEL[slug] || slug
  const sub = SUBS[slug] || ''

  const hasMaster = existsSync(join(SHOOT, `${slug}.webp`)) || existsSync(join(SHOOT, `${slug}.png`))
  if (hasMaster && prevManifest.banners?.[slug]?.kind === 'photo') {
    manifest[slug] = prevManifest.banners[slug]
    console.log(`  ${slug.padEnd(14)} photo       kept — campaign master in images/shoot/banners/`)
    continue
  }
  const file = readdirSync(SRC).find((f) => basename(f, extname(f)) === key && /\.(jpg|jpeg|png|webp)$/i.test(f))

  let buf, kind, note
  if (file) {
    const m = await sharp(join(SRC, file)).metadata()
    const r = m.width / m.height
    if (r >= MIN_SOURCE_RATIO && m.width >= 1800) {
      buf = await sharp(join(SRC, file)).resize(BANNER.w, BANNER.h, { fit: 'cover', position: 'centre' })
        .webp({ quality: 86, effort: 6 }).toBuffer()
      kind = 'photo'
      note = `${file} (${m.width}x${m.height}, r${r.toFixed(2)})`
    } else {
      const lossPct = Math.round((1 - (RATIO > r ? r / RATIO : 1)) * 100)
      buf = await sharp(placeholderSVG(label, sub, `${BANNER.w} x ${BANNER.h}px needed`))
        .webp({ quality: 90, effort: 6 }).toBuffer()
      kind = 'placeholder'
      note = `${file} is ${m.width}x${m.height} (r${r.toFixed(2)}) — a 2.93 crop would lose ${lossPct}% of the frame`
      shotList.push({ slug, label, sub, need: `${BANNER.w} x ${BANNER.h}px (2.93:1 landscape)`, why: note, count: COUNT[slug] || 0 })
    }
  } else {
    buf = await sharp(placeholderSVG(label, sub, `${BANNER.w} x ${BANNER.h}px needed`))
      .webp({ quality: 90, effort: 6 }).toBuffer()
    kind = 'placeholder'
    note = `no source file named "${key}" in images/`
    shotList.push({ slug, label, sub, need: `${BANNER.w} x ${BANNER.h}px (2.93:1 landscape)`, why: note, count: COUNT[slug] || 0 })
  }

  const h = hash8(buf)
  for (const f of readdirSync(OUT)) {
    if (f.startsWith(`banner-${slug}-`) && !f.includes(`-${h}`)) rmSync(join(OUT, f))
  }
  writeFileSync(join(OUT, `banner-${slug}-${h}.webp`), buf)
  const half = await sharp(buf).resize(1200, 410, { fit: 'cover' }).webp({ quality: 84, effort: 6 }).toBuffer()
  writeFileSync(join(OUT, `banner-${slug}-${h}-1200.webp`), half)

  manifest[slug] = {
    src: `/images/store/banner-${slug}-${h}-1200.webp`,
    srcset: `/images/store/banner-${slug}-${h}-1200.webp 1200w, /images/store/banner-${slug}-${h}.webp 2400w`,
    w: BANNER.w, h: BANNER.h, kind,
  }
  console.log(`  ${slug.padEnd(14)} ${kind.padEnd(11)} ${note}`)
}

/* Spread the previous manifest rather than naming its keys. cut-banners.mjs
   owns the placement geometry and has added a key twice now (mobileBanner,
   then heroBanner); a named list silently drops whatever it has not heard of,
   and a dropped key is invisible until a layout quietly falls back. */
writeFileSync(join(OUT, 'banner-manifest.json'), JSON.stringify(
  { ...prevManifest, banner: BANNER, banners: manifest }, null, 1))
console.log(`\nbanner-manifest.json: ${Object.keys(manifest).length} banners ` +
  `(${Object.values(manifest).filter((b) => b.kind === 'photo').length} photo, ` +
  `${Object.values(manifest).filter((b) => b.kind === 'placeholder').length} placeholder)`)

/* ── THE SHOT LIST ──────────────────────────────────────────────────────── */
const lines = []
lines.push('# Photography needed — DAS store')
lines.push('')
lines.push(`Generated by \`scripts/build-store-banners.mjs\` on ${new Date().toISOString().slice(0, 10)}.`)
lines.push('Re-run it after a shoot and any slot with a real photograph stops being a placeholder automatically.')
lines.push('')
lines.push('## 1 · Programme banners')
lines.push('')
if (shotList.length === 0) {
  /* AN EMPTY TABLE UNDER "here is what is missing" READS AS "everything is
     missing" — this file said exactly that on 2026-09-25 with all six banners
     already shot. Say the opposite out loud when it is true. */
  lines.push('**Nothing outstanding — all six are photographs.**')
  lines.push('')
  lines.push('Shot 2026-09-25 as image2image restages of each programme\'s real packshot; the')
  lines.push('recipe and the per-programme references are in `PHOTO-ART-DIRECTION.md`. Masters')
  lines.push('live in `images/shoot/banners/` and every placement re-cuts for free with')
  lines.push('`node scripts/cut-banners.mjs`.')
  lines.push('')
} else {
  lines.push('The store home runs a full-bleed banner above each programme\'s product row, matching')
  lines.push('shop.griffain.io. Every banner is **2400 x 820px (2.93:1 landscape)**. The programmes')
  lines.push('below have no photograph anywhere near that shape, so they render as branded')
  lines.push('placeholders that name the programme and say a photograph is coming.')
  lines.push('')
  lines.push('| Programme | Pieces | Shot needed | Why a placeholder today |')
  lines.push('|---|---|---|---|')
  for (const s of shotList) lines.push(`| **${s.label}** | ${s.count} | ${s.need} | ${s.why} |`)
  lines.push('')
  lines.push('**Framing note:** these are wide. Shoot the kit or award in an environment — a yard, a cab,')
  lines.push('a dock, a driver holding it — with generous space left and right, because the crop is')
  lines.push('nearly 3:1. A tight product-on-white shot cannot fill this slot.')
  lines.push('')
}
lines.push('## 2 · Product cards and the product page — 4:5 portrait')
lines.push('')
lines.push('Every card and gallery frame is **4:5 portrait**. Of 54 products only 6 have a native 4:5')
lines.push('photograph; 33 are currently whole only because the build pads them with their own edge')
lines.push('colour, and 15 are cover-cropped. A reshoot at 4:5 removes the padding entirely and is')
lines.push('the single highest-value photography job outstanding.')
lines.push('')
lines.push('- **Size:** 2000 x 2500px or larger (4:5). Larger is better — the product page renders')
lines.push('  ~950px wide and only 1 of 54 photographs can currently serve a 2x retina screen.')
lines.push('- **Framing:** product centred with even margin; the frame is filled edge to edge.')
lines.push('')
lines.push('## 3 · Two career medals are captions, not photographs')
lines.push('')
lines.push('`milestone-c-250k` and `milestone-c-500k` are graphics that read "Placeholder image —')
lines.push('final coming soon". They render at full card and gallery scale. Same 4:5 spec as above.')
lines.push('')
writeFileSync(join(ROOT, 'PHOTO-SHOT-LIST.md'), lines.join('\n'))
console.log(`shot list: ${shotList.length} banners needed -> PHOTO-SHOT-LIST.md`)
