/* ============================================================================
   THE SHOP-BY-PROGRAM PARALLAX — placeholder panels + the shot list
   ----------------------------------------------------------------------------
   Jayden 2026-09-24: "Scan the bottom section where it has header photos and
   scrolls down with this kind of text and then has the CTA. Do this one to one,
   exactly, but use photo placement holders so whenever we're ready, we can
   generate photos."

   MEASURED OFF shop.griffain.io (section id="shopify-section-parallax"):
     · one full-viewport panel per collection, h:100vh, object-fit:cover
     · desktop source  1920 x 1080   (media min-width:1024px)
     · mobile source   1920 x 2364   (the <img> itself)
     · content sticky at top:40vh, margin-top:40vh, py:79px, gap:44px
     · eyebrow 11/15 medium · titles 30px (lg 32) bold, tracking -1.5px,
       active opacity 1, resting opacity .3, hover .5, 300ms
     · CTA: 12x9 arrow then "Shop the <name> Kit", 11/15

   Every panel here is a PLACEHOLDER, deliberately. There is no DAS photograph
   shaped 16:9 or 1:1.23 — the catalogue is packshots on white and a handful of
   landscape road shots. A cover-crop of a packshot into a full-bleed panel is
   a picture of a corner of a box. A panel that names the programme and states
   the shot that is missing is honest, reads as deliberate, and swaps out for a
   photograph without touching a line of markup.

   Writes:
     images/store/px-<slug>-<hash>-desktop.webp   1920x1080
     images/store/px-<slug>-<hash>-mobile.webp    1920x2364
     images/store/parallax-manifest.json
     PHOTO-SHOT-LIST-PARALLAX.md

   Run:  node scripts/build-parallax-placeholders.mjs
   Lives in scripts/, which .vercelignore excludes — it never deploys.
   ========================================================================== */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
let sharp
try { sharp = require('E:/Workspaces/odndr-web/node_modules/sharp') }
catch { console.error('sharp not found.'); process.exit(1) }

const ROOT = process.cwd()
const OUT = join(ROOT, 'images', 'store')

const DESKTOP = { w: 1920, h: 1080 }
const MOBILE = { w: 1920, h: 2364 }

/* one declaration, several consumers — run the module rather than parse it */
const ctx = {
  window: {}, console,
  document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
}
ctx.self = ctx.window
vm.createContext(ctx)
vm.runInContext(readFileSync(join(ROOT, 'js/store-heroes.js'), 'utf8'), ctx, { filename: 'js/store-heroes.js' })
const SUBS = ctx.window.DAS_STORE_SUBS || {}

const CAT = JSON.parse(readFileSync(join(ROOT, 'store-catalog.json'), 'utf8'))
const PROGRAMS = CAT.programs || []

const hash8 = (b) => createHash('sha1').update(b).digest('hex').slice(0, 8)
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))

/** The panel a photograph will replace. Same navy family as the banners. */
function panelSVG(label, sub, w, h, need) {
  const cx = w / 2
  const portrait = h > w
  const titleSize = portrait ? 132 : 104
  const subSize = portrait ? 44 : 34
  const noteSize = portrait ? 38 : 30
  const y = portrait ? h * 0.36 : h * 0.42
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.65" y2="1">
      <stop offset="0" stop-color="#101F4C"/><stop offset="0.55" stop-color="#0A1334"/><stop offset="1" stop-color="#050A1C"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect x="0" y="0" width="${w}" height="4" fill="#2E4FA8"/>
  <text x="${cx}" y="${y}" text-anchor="middle" fill="#9CC4F5" font-family="Chivo, Helvetica, Arial, sans-serif"
        font-size="${subSize}" letter-spacing="5" font-weight="500">${esc(sub.toUpperCase())}</text>
  <text x="${cx}" y="${y + titleSize * 1.15}" text-anchor="middle" fill="#FFFFFF"
        font-family="Chivo, Helvetica, Arial, sans-serif" font-size="${titleSize}" font-weight="600"
        letter-spacing="-2">${esc(label.toUpperCase())}</text>
  <text x="${cx}" y="${y + titleSize * 1.15 + noteSize * 2.2}" text-anchor="middle" fill="rgba(255,255,255,0.42)"
        font-family="Chivo, Helvetica, Arial, sans-serif" font-size="${noteSize}">Photography in progress &#183; ${esc(need)}</text>
</svg>`)
}

const manifest = {}
const shots = []

for (const g of PROGRAMS) {
  const label = g.label
  const sub = SUBS[g.slug] || 'Driver recognition'

  const dBuf = await sharp(panelSVG(label, sub, DESKTOP.w, DESKTOP.h, `${DESKTOP.w} x ${DESKTOP.h}px needed`))
    .webp({ quality: 88, effort: 6 }).toBuffer()
  const mBuf = await sharp(panelSVG(label, sub, MOBILE.w, MOBILE.h, `${MOBILE.w} x ${MOBILE.h}px needed`))
    .webp({ quality: 88, effort: 6 }).toBuffer()

  const h = hash8(Buffer.concat([dBuf, mBuf]))
  for (const f of readdirSync(OUT)) {
    if (f.startsWith(`px-${g.slug}-`) && !f.includes(`-${h}-`)) rmSync(join(OUT, f))
  }
  writeFileSync(join(OUT, `px-${g.slug}-${h}-desktop.webp`), dBuf)
  writeFileSync(join(OUT, `px-${g.slug}-${h}-mobile.webp`), mBuf)

  manifest[g.slug] = {
    label,
    sub,
    desktop: `/images/store/px-${g.slug}-${h}-desktop.webp`,
    mobile: `/images/store/px-${g.slug}-${h}-mobile.webp`,
    placeholder: true,
  }
  shots.push({ slug: g.slug, label, sub })
  console.log(`px ${g.slug.padEnd(14)} placeholder  ${(dBuf.length / 1024).toFixed(0)}KB + ${(mBuf.length / 1024).toFixed(0)}KB`)
}

writeFileSync(join(OUT, 'parallax-manifest.json'), JSON.stringify(manifest, null, 2))

const md = `# PHOTO SHOT LIST — the shop-by-program parallax

Generated by \`scripts/build-parallax-placeholders.mjs\`. Every panel below is a
placeholder today. Drop a real photograph in and re-run the script; nothing in
the markup changes.

This is the full-bleed section at the bottom of the shop home, copied from
shop.griffain.io. The photograph fills the entire viewport behind sticky white
type, so it is a **scene**, not a packshot: the product is in it, but the frame
is mostly environment.

## What each panel needs

| # | Program | Desktop | Mobile | The shot |
|---|---------|---------|--------|----------|
${shots.map((s, i) => `| ${i + 1} | **${s.label}** | 1920 x 1080 | 1920 x 2364 | ${s.sub} — the piece in use, room around it |`).join('\n')}

## The rules that make these work

1. **Two crops per program, not one.** 1920x1080 for desktop and 1920x2364 for
   a phone. A single landscape frame cover-cropped to a tall phone panel keeps
   only its middle 28% — which is exactly the failure this list exists to stop.
2. **Shoot for white type over the middle.** The section's eyebrow, the six
   program names and the CTA sit centred, from roughly 40% to 75% of the frame
   height. Keep that band quiet: no faces, no hard highlights, no text.
3. **Expose about a stop under.** The type is white with no scrim behind it. A
   bright frame eats it. The reference's panels are all darker than neutral.
4. **The scene carries the program, not a label.** Safe Miles is a driver and a
   truck at dawn; Onboarding is a new hire opening the kit on day one; Service
   Milestones is the medal in a hand, not on a table.
5. **Leave the edges boring.** The frame is cropped differently at every
   viewport width. Anything that must be seen belongs in the middle 60%.

## Delivery

sRGB, no watermark, largest crop available. Name them \`px-<slug>-desktop.jpg\`
and \`px-<slug>-mobile.jpg\` and drop them in \`images/\`, then run:

\`\`\`bash
node scripts/build-parallax-placeholders.mjs
\`\`\`
`
writeFileSync(join(ROOT, 'PHOTO-SHOT-LIST-PARALLAX.md'), md)
console.log(`\n${shots.length} panels, all placeholders. Shot list -> PHOTO-SHOT-LIST-PARALLAX.md`)
