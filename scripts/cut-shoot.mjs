/* ============================================================================
   CUT THE PLACEMENTS OUT OF THE SHOOT MASTERS
   ----------------------------------------------------------------------------
   One photograph per program, every placement cut from it — the rule in
   IMAGE-GEN-BUDGET.md that took this shoot from 18 generations to 6.

   Masters are 3712x4608 (4:5) from nano-banana-pro at 4K, in images/shoot/masters/.

     parallax mobile    1920 x 2364  (0.8122)  a 0.812 trim of the master
     parallax desktop   1920 x 1080  (1.7778)  a 16:9 band through the master

   Both come from the SAME photograph, so the desktop and mobile panels of a
   program show the same driver, the same truck and the same light. Generating
   them separately would have produced two different people for one program —
   the panel would change identity when the window resized.

   WHY THE OFFSETS ARE PER-IMAGE. The 16:9 band only covers 30% of the master's
   height, so where it sits decides the picture. `band` is the vertical centre of
   that cut as a fraction of the master height; `pan` is the horizontal centre of
   the mobile trim. They are art direction, not arithmetic: the job is to keep
   faces and hard highlights out of the middle of the frame, where the parallax
   type sits.

   Run:  node scripts/cut-shoot.mjs
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
const MASTERS = join(ROOT, 'images', 'shoot', 'masters')
const OUT = join(ROOT, 'images', 'store')

const DESKTOP = { w: 1920, h: 1080 }
const MOBILE = { w: 1920, h: 2364 }

/* band: vertical centre of the 16:9 desktop cut, as a fraction of master height
   pan:  horizontal centre of the mobile trim, as a fraction of master width */
const SHOTS = [
  { slug: 'appreciation', label: 'Driver Appreciation Kits', sub: 'Driver Appreciation Week', band: 0.56, pan: 0.52 },
  { slug: 'milepacks',    label: 'Safe Miles Programs',      sub: 'Quarterly recognition',    band: 0.58, pan: 0.50 },
  { slug: 'onboarding',   label: 'Onboarding Solutions',     sub: 'Day one, done right',      band: 0.52, pan: 0.46 },
  { slug: 'safety',       label: 'Safety Recognition',       sub: 'Safe miles, earned',       band: 0.60, pan: 0.50 },
  { slug: 'milestone',    label: 'Service Milestone Awards', sub: '250K to 6 million',        band: 0.54, pan: 0.46 },
  { slug: 'holiday',      label: 'Holiday & Seasonal',       sub: 'The family sees this one', band: 0.50, pan: 0.50 },
]

const hash8 = (b) => createHash('sha1').update(b).digest('hex').slice(0, 8)

/** The scrim the page lays over every panel, so the measurement matches reality. */
function scrim(w, h) {
  return Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="r" cx="50%" cy="56%" rx="62.5%" ry="39%">
        <stop offset="0%" stop-color="#050A1C" stop-opacity=".62"/>
        <stop offset="38%" stop-color="#050A1C" stop-opacity=".40"/>
        <stop offset="66%" stop-color="#050A1C" stop-opacity=".16"/>
        <stop offset="86%" stop-color="#050A1C" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="l" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#050A1C" stop-opacity=".30"/>
        <stop offset="26%" stop-color="#050A1C" stop-opacity="0"/>
        <stop offset="74%" stop-color="#050A1C" stop-opacity="0"/>
        <stop offset="100%" stop-color="#050A1C" stop-opacity=".34"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#l)"/>
    <rect width="${w}" height="${h}" fill="url(#r)"/>
  </svg>`)
}

/** Mean luminance and blown-pixel share where the white type actually sits. */
async function typeBand(buf, w, h) {
  const withScrim = await sharp(buf).composite([{ input: scrim(w, h) }]).png().toBuffer()
  const x = Math.round(w * 0.20), bw = Math.round(w * 0.60)
  const y = Math.round(h * 0.40), bh = Math.round(h * 0.35)
  const px = await sharp(withScrim).extract({ left: x, top: y, width: bw, height: bh })
    .greyscale().raw().toBuffer()
  let sum = 0, hot = 0
  for (const v of px) { sum += v; if (v > 200) hot++ }
  return { mean: sum / px.length, hot: (100 * hot) / px.length }
}

const manifest = {}
let worst = 0

for (const s of SHOTS) {
  const src = join(MASTERS, `${s.slug}.webp`)
  if (!existsSync(src)) { console.log(`${s.slug.padEnd(14)} SKIP — no master`); continue }

  /* TRIM ANY BAKED-IN WHITE BORDER FIRST.
     The model sometimes renders the photograph inside a white print frame. It
     did on three of the first six: Safe Miles came back with 379px of white
     down the left and 375px down the right, Holiday ~50px all round. Cropping
     a placement out of that leaves white edges on a full-bleed panel, which is
     what Jayden saw. Walking in from each edge while the line is near-white
     removes it whatever size it is, so this cannot ship again. */
  const probe = await sharp(src).greyscale().raw().toBuffer({ resolveWithObject: true })
  const PW = probe.info.width, PH = probe.info.height, PD = probe.data
  const rowLum = (y) => { let t = 0; for (let x = 0; x < PW; x++) t += PD[y * PW + x]; return t / PW }
  const colLum = (x) => { let t = 0; for (let y = 0; y < PH; y++) t += PD[y * PW + x]; return t / PH }
  let bt = 0, bb = 0, bl = 0, br = 0
  while (bt < PH * 0.2 && rowLum(bt) > 235) bt++
  while (bb < PH * 0.2 && rowLum(PH - 1 - bb) > 235) bb++
  while (bl < PW * 0.2 && colLum(bl) > 235) bl++
  while (br < PW * 0.2 && colLum(PW - 1 - br) > 235) br++
  /* two extra pixels, because the border's own edge is antialiased */
  if (bt || bb || bl || br) { bt += 2; bb += 2; bl += 2; br += 2 }

  const trimmed = (bt || bb || bl || br)
    ? await sharp(src).extract({ left: bl, top: bt, width: PW - bl - br, height: PH - bt - bb }).png().toBuffer()
    : src

  const m = await sharp(trimmed).metadata()
  const W = m.width, H = m.height
  if (bt || bb || bl || br) console.log(`${' '.repeat(15)}trimmed white border t${bt} b${bb} l${bl} r${br} -> ${W}x${H}`)

  /* DESKTOP — a 16:9 band, placed by `band` */
  const dh = Math.round(W * DESKTOP.h / DESKTOP.w)
  let top = Math.round(H * s.band - dh / 2)
  top = Math.max(0, Math.min(H - dh, top))
  const dBuf = await sharp(trimmed).extract({ left: 0, top, width: W, height: dh })
    .resize(DESKTOP.w, DESKTOP.h).webp({ quality: 88, effort: 6 }).toBuffer()

  /* MOBILE — a 0.812 trim, placed by `pan` */
  const mw = Math.round(H * MOBILE.w / MOBILE.h)
  let left = Math.round(W * s.pan - mw / 2)
  left = Math.max(0, Math.min(W - mw, left))
  const mBuf = await sharp(trimmed).extract({ left, top: 0, width: Math.min(mw, W), height: H })
    .resize(MOBILE.w, MOBILE.h).webp({ quality: 88, effort: 6 }).toBuffer()

  const dT = await typeBand(dBuf, DESKTOP.w, DESKTOP.h)
  const mT = await typeBand(mBuf, MOBILE.w, MOBILE.h)
  worst = Math.max(worst, dT.hot, mT.hot)

  const h8 = hash8(Buffer.concat([dBuf, mBuf]))
  for (const f of readdirSync(OUT)) {
    if (f.startsWith(`px-${s.slug}-`) && !f.includes(`-${h8}-`)) rmSync(join(OUT, f))
  }
  writeFileSync(join(OUT, `px-${s.slug}-${h8}-desktop.webp`), dBuf)
  writeFileSync(join(OUT, `px-${s.slug}-${h8}-mobile.webp`), mBuf)

  manifest[s.slug] = {
    label: s.label,
    sub: s.sub,
    desktop: `/images/store/px-${s.slug}-${h8}-desktop.webp`,
    mobile: `/images/store/px-${s.slug}-${h8}-mobile.webp`,
    placeholder: false,
  }

  console.log(
    `${s.slug.padEnd(14)} band ${s.band} pan ${s.pan}  ` +
    `desktop ${(dBuf.length / 1024).toFixed(0)}KB type-band ${dT.mean.toFixed(0)}/${dT.hot.toFixed(1)}%  ` +
    `mobile ${(mBuf.length / 1024).toFixed(0)}KB ${mT.mean.toFixed(0)}/${mT.hot.toFixed(1)}%` +
    (dT.hot > 3 || mT.hot > 3 ? '   <-- CHECK' : '')
  )
}

writeFileSync(join(OUT, 'parallax-manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`\n${Object.keys(manifest).length} programs cut. Worst blown share in any type band: ${worst.toFixed(2)}%`)
