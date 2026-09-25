/* ============================================================================
   RECOMPOSE THE ELEVATED PRODUCT HEROES
   ----------------------------------------------------------------------------
   The generated frames put the product whole on a bone-to-navy sweep, but small
   -- roughly 45% of the first test frame was empty sweep above the case. On a
   PDP, where somebody is deciding to buy, the object should dominate.

   Re-prompting to change that costs 80 credits a frame and is not reliable.
   Cropping is free and exact, and the masters are 3712x4608, so a tighter 4:5
   still lands well above the 1120x1400 the page renders.

   FINDING THE PRODUCT. The sweep is a smooth vertical gradient: within any row
   its value barely moves. The product does not belong to that gradient. So for
   each pixel, measure its deviation from the MEDIAN OF ITS OWN ROW -- that
   isolates the subject regardless of how light or dark the sweep is at that
   height, which a flat colour threshold cannot do (the case is darker than the
   bone base and lighter than the navy top, so no single threshold works).

   Then recompose 4:5 around that box with a fixed margin, clamped to the frame.

   Run:  node scripts/cut-pdp.mjs
   Lives in scripts/, which .vercelignore excludes -- it never deploys.
   ========================================================================== */
import { createRequire } from 'node:module'
import { readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
let sharp
try { sharp = require('E:/Workspaces/odndr-web/node_modules/sharp') }
catch { console.error('sharp not found.'); process.exit(1) }

const ROOT = process.cwd()
const SRC = join(ROOT, 'images', 'shoot', 'pdp')
const OUT = join(ROOT, 'images', 'pdp-hero')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const RATIO = 4 / 5
/** Share of the crop's shorter side left as breathing room around the product. */
const MARGIN = 0.14

async function subjectBox(file) {
  const S = 640
  const { data, info } = await sharp(file).greyscale().resize(S).raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height
  const dev = new Float32Array(W * H)
  const row = new Uint8Array(W)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) row[x] = data[y * W + x]
    const sorted = Array.from(row).sort((a, b) => a - b)
    const med = sorted[W >> 1]
    for (let x = 0; x < W; x++) dev[y * W + x] = Math.abs(data[y * W + x] - med)
  }
  const T = 18
  let l = W, r = -1, t = H, b = -1
  /* Require a RUN of deviating pixels, so film grain and the soft contact
     shadow's outer falloff cannot drag the box out to the frame edge. */
  const RUN = 6
  for (let y = 0; y < H; y++) {
    let run = 0
    for (let x = 0; x < W; x++) {
      if (dev[y * W + x] > T) { run++ } else { run = 0; continue }
      if (run >= RUN) {
        const xs = x - RUN + 1
        if (xs < l) l = xs
        if (x > r) r = x
        if (y < t) t = y
        if (y > b) b = y
      }
    }
  }
  if (r < 0) return null
  const m = await sharp(file).metadata()
  const k = m.width / W
  return { l: l * k, r: r * k, t: t * (m.height / H), b: b * (m.height / H), W: m.width, H: m.height }
}

const files = existsSync(SRC) ? readdirSync(SRC).filter((f) => /\.(png|webp)$/i.test(f)) : []
if (!files.length) { console.log('no masters in images/shoot/pdp/'); process.exit(0) }

for (const f of files) {
  const src = join(SRC, f)
  const slug = f.replace(/\.(png|webp)$/i, '')
  const box = await subjectBox(src)
  if (!box) { console.log(`${slug.padEnd(26)} SKIP - no subject found`); continue }

  const bw = box.r - box.l, bh = box.b - box.t
  const cx = (box.l + box.r) / 2, cy = (box.t + box.b) / 2
  /* Grow the subject box to 4:5, then add margin. */
  let cw = Math.max(bw, bh * RATIO)
  let ch = cw / RATIO
  cw = cw / (1 - 2 * MARGIN); ch = cw / RATIO
  /* Never exceed the frame, and never slide the product off an edge. */
  cw = Math.min(cw, box.W); ch = Math.min(cw / RATIO, box.H); cw = ch * RATIO
  let left = Math.round(Math.max(0, Math.min(box.W - cw, cx - cw / 2)))
  let top = Math.round(Math.max(0, Math.min(box.H - ch, cy - ch / 2)))

  const buf = await sharp(src).extract({ left, top, width: Math.round(cw), height: Math.round(ch) })
    .resize(1600, 2000).webp({ quality: 90, effort: 6 }).toBuffer()
  await sharp(buf).toFile(join(OUT, `${slug}.webp`))

  const fill = (bh / ch * 100)
  console.log(
    `${slug.padEnd(26)} subject ${Math.round(bw)}x${Math.round(bh)}  crop ${Math.round(cw)}x${Math.round(ch)}` +
    `  product fills ${fill.toFixed(0)}% of height  ${(buf.length / 1024).toFixed(0)}KB` +
    (fill < 45 ? '   <-- still small' : '')
  )
}
