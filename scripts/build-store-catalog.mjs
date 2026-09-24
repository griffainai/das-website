/* ============================================================================
   STORE CATALOGUE BUILDER
   ----------------------------------------------------------------------------
   Writes /store-catalog.json — the data the new store renders from.

   WHY A BUILD STEP AND NOT A FETCH. This site is static HTML with no CMS, and
   the catalogue lives in three different places:
     shop.html          26 hand-written cards
     js/milestones.js   26 medals across three tracks (career / safe / exec)
     js/mile-packs.js   23 mile packs
   The first store pass read only shop.html and therefore showed fewer than half
   the range. This reads all three, exactly as the browser would, so the number
   on the page is the number in the catalogue.

   ⚠ CAREER AND SAFETY NEVER MIX. milestones.js stamps
   data-filter-cat="milestone" on all three tracks it renders, including the
   Safe Service Miles medals and the Executive Collection, which sit in the
   SAFETY section. Filtering on that attribute lists Safety products under
   Service Milestone Awards — the one thing the catalogue rules forbid outright.
   `track` is authoritative here: career -> milestone, safe/exec -> safety.

   PRICE IS NOT AUTHORITATIVE. These numbers exist so the grid can sort and
   band; api/create-checkout.js re-prices every line from lib/catalog.js and
   rejects anything that does not match a real tier. Nothing here can set a
   price the server will honour.

   Run:  node scripts/build-store-catalog.mjs   (after build-store-images.mjs)
   Lives in scripts/, which .vercelignore excludes — it never deploys.
   ========================================================================== */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import vm from 'node:vm'

const ROOT = process.cwd()
const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'images/store/manifest.json'), 'utf8'))

/** Source path -> normalised derivative. A photo with no derivative is dropped:
 *  the live shop does not render the 16 archived mile packs either, and a grid
 *  of empty frames reads as broken rather than as sparse. */
function shot(src) {
  if (!src) return null
  const key = basename(src, extname(src))
  return MANIFEST.images[key] || null
}

/** A hard .slice(180) cut mid-WORD, and the PDP printed the stump: "Reaching
 *  250,000 consecutive safe miles without a". Cut at the last sentence that
 *  fits; failing that the last word, with an ellipsis so the truncation reads
 *  as deliberate rather than as a bug. */
function trim(text, max = 180) {
  const t = String(text || '').trim()
  if (t.length <= max) return t
  const head = t.slice(0, max)
  const stop = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '))
  if (stop > max * 0.55) return head.slice(0, stop + 1)
  const space = head.lastIndexOf(' ')
  return (space > 0 ? head.slice(0, space) : head).replace(/[,;:]$/, '') + '…'
}

const PROGRAMS = {
  appreciation: 'Driver Appreciation Kits',
  milepacks:    'Safe Miles Programs',
  onboarding:   'Onboarding Solutions',
  safety:       'Safety Recognition',
  milestone:    'Service Milestone Awards',
  holiday:      'Holiday & Seasonal',
}

/* ── 1. the hand-written cards in shop.html ─────────────────────────────── */
function fromShop() {
  const h = readFileSync(join(ROOT, 'shop.html'), 'utf8')
  const out = []
  const re = /<div class="product-card"([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g
  let m
  while ((m = re.exec(h))) {
    const b = m[0]
    const g = (r) => { const x = b.match(r); return x ? x[1].trim() : '' }
    const name = g(/class="product-card-title"[^>]*>\s*<a[^>]*>([^<]+)</) || g(/class="product-card-title"[^>]*>([^<]+)</)
    if (!name) continue
    const section = (h.slice(0, m.index).match(/data-category-section="([a-z]+)"(?![\s\S]*data-category-section=)/) || [])[1]
    out.push({
      id: g(/data-product-id="([^"]*)"/),
      slug: g(/product\.html\?id=([^"&]*)/),
      name: name.replace(/&amp;/g, '&').replace(/&#x27;|&rsquo;/g, '’'),
      price: parseFloat(g(/data-product-price="([^"]*)"/)) || 0,
      program: g(/data-filter-cat="([^"]*)"/) || section || 'appreciation',
      img: g(/class="product-card-img" src="([^"]*)"/),
      badge: g(/class="product-card-category-pill">([^<]+)</),
      blurb: g(/class="product-card-desc">([^<]+)</),
      tier: g(/class="product-tier-pill">([^<]+)</),
      minQty: parseInt(g(/data-product-min-qty="([^"]*)"/), 10) || 10,
    })
  }
  return out
}

/* ── 2 + 3. the JS-rendered ranges, run rather than parsed ─────────────── */
function runModule(file, globalName) {
  const ctx = { window: {}, document: { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] }, console }
  ctx.self = ctx.window
  vm.createContext(ctx)
  vm.runInContext(readFileSync(join(ROOT, file), 'utf8'), ctx, { filename: file })
  return ctx.window[globalName] || []
}

/** career -> Service Milestone Awards; safe AND exec -> Safety Recognition.
 *  The Executive Collection is a premium upgrade ON safety, never on career. */
const TRACK = { career: 'milestone', safe: 'safety', exec: 'safety' }

/** The Executive Collection is a premium upgrade ON a Safe Service Miles medal —
 *  never on a career one. Each exec entry names the safe medal it upgrades via
 *  executive.baseId, and the old PDP cross-linked the two in both directions.
 *  Carrying the relationship here lets the new PDP do the same without
 *  re-deriving it. */
function execLinks() {
  const out = { upgradesFor: {}, baseOf: {} }
  for (const m of runModule('js/milestones.js', 'DAS_MILESTONES')) {
    if (m.track !== 'exec' || !m.executive || !m.executive.baseId) continue
    const base = m.executive.baseId
    out.baseOf[m.id] = base
    ;(out.upgradesFor[base] = out.upgradesFor[base] || []).push({
      id: m.id,
      gift: m.executive.short || m.executive.gift || '',
      upgrade: m.executive.upgrade || null,
      comingSoon: !!m.executive.comingSoon || !!m.comingSoon,
    })
  }
  return out
}

function fromMilestones() {
  return runModule('js/milestones.js', 'DAS_MILESTONES').map((m) => ({
    id: m.id,
    slug: m.id,
    name: m.name,
    price: +m.price || 0,
    program: TRACK[m.track] || 'milestone',
    img: (m.images && m.images[0]) || m.image || (m.photos && m.photos[0]) || '',
    gallery: (m.images || m.photos || []).slice(0, 6),
    badge: m.status || '',
    blurb: trim(m.description),
    included: m.included || [],
    minQty: m.minQty || 1,
  }))
}

function fromMilePacks() {
  return runModule('js/mile-packs.js', 'DAS_MILEPACKS').map((p) => ({
    id: p.id,
    slug: p.id,
    name: p.name,
    price: +p.price || 0,
    program: 'milepacks',
    img: (p.photos && p.photos[0]) || (p.images && p.images[0]) || p.image || '',
    gallery: (p.photos || p.images || []).slice(0, 6),
    badge: p.tier || 'Mile Pack',
    blurb: p.blurb || '',
    included: p.included || [],
    minQty: p.minQty || 10,
  }))
}

/* ── assemble ───────────────────────────────────────────────────────────── */
/* ── PICK THE BEST-SHAPED PHOTO EACH PRODUCT ALREADY HAS ──────────────────
   The frame is 4:5. Several products were using a 1.5 landscape variant while a
   native 4:5 portrait of the SAME product sat unused in images/. working-hands
   was the clearest case: the catalogue used heroC (1536x1024, a 47% crop) while
   heroA (1122x1402) fills the frame with NO crop at all. Ten products improve
   this way, four of them to zero crop — which is the cheapest quality win
   available, because it costs nothing but choosing a different existing file.

   Candidates are only files that already belong to the product: its own name
   plus siblings sharing its filename stem. Placeholders and site chrome are
   excluded by name — a `-soon` file is a "coming soon" card, not photography.
   A swap only sticks if the chosen file actually has a derivative. */
const RATIOS = JSON.parse(readFileSync(join(ROOT, 'images/store/source-ratios.json'), 'utf8'))
const BAD_SOURCE = /soon|placeholder|favicon|logo|icon|band-|email|og-|hero-bg/i
const FRAME_R = 0.8
const stemOf = (b) => b.replace(/-(hero[A-Z]?|[0-9]+|v[0-9]+|alt|back|front)$/i, '')

function bestShaped(imgPath) {
  if (!imgPath) return imgPath
  const cur = basename(imgPath, extname(imgPath))
  const stem = stemOf(cur)
  let best = null
  for (const f of Object.keys(RATIOS)) {
    if (BAD_SOURCE.test(f)) continue
    const b = basename(f, extname(f))
    if (b !== cur && !b.startsWith(stem + '-') && b !== stem) continue
    if (!MANIFEST.images[b]) continue
    const d = Math.abs(RATIOS[f] - FRAME_R)
    if (!best || d < best.d) best = { f, d }
  }
  return best ? '/images/' + best.f : imgPath
}

const seen = new Set()
const all = [...fromShop(), ...fromMilestones(), ...fromMilePacks()]
  .filter((p) => p.name && p.id && !seen.has(p.id) && seen.add(p.id) !== false)
  .map((p) => {
    const s = shot(bestShaped(p.img))
    const gallery = (p.gallery || []).map(shot).filter(Boolean)
    return s ? { ...p, shot: s, gallery: gallery.length ? gallery : [s], programLabel: PROGRAMS[p.program] || p.program } : null
  })
  .filter(Boolean)

/** DAS gates anything over $110 (js/pricing-gate.js): the store shows Request
 *  Pricing rather than a number the visitor is not cleared to see. */
const GATE = 110
all.forEach((p) => { p.gated = p.price > GATE })

/* ── Flags the checkout ACTUALLY enforces ───────────────────────────────────
   api/create-checkout.js rejects a milestoneSelect product outright when
   item.milestone is missing or not in MS_LABELS:
       400 "Please select a milestone level for <name>."
   So a product carrying this flag cannot be added to a bag without a level, and
   the store has to know which ones they are. ssm-luggage-tag is one of them, it
   is UNGATED at $79.99, and the first store shipped it as a plain add — every
   such order would have failed at checkout.

   comingSoon products are deliberately absent from lib/catalog.js so
   Catalog.resolve() returns "unknown" and the server refuses them. The store
   must not present them as buyable either. */
const catalogSrc = readFileSync(join(ROOT, 'lib/catalog.js'), 'utf8')
const flagged = (flag) =>
  new Set([...catalogSrc.matchAll(new RegExp(`'([^']+)':\\s*\\{[^}]*${flag}:\\s*true`, 'g'))].map((m) => m[1]))
const MILESTONE_SELECT = flagged('milestoneSelect')
const SAFE_MILES = flagged('safeMiles')

const comingSoon = new Set(
  runModule('js/milestones.js', 'DAS_MILESTONES')
    .filter((m) => m.comingSoon || (m.executive && m.executive.comingSoon))
    .map((m) => m.id)
)

const links = execLinks()
const byId = Object.fromEntries(all.map((p) => [p.id, p]))

all.forEach((p) => {
  if (MILESTONE_SELECT.has(p.id)) { p.milestoneSelect = true; p.kitConfig = true }
  if (SAFE_MILES.has(p.id)) p.safeMiles = true
  if (comingSoon.has(p.id)) p.comingSoon = true

  /* A Safe Miles medal points UP at its Executive upgrades; an Executive piece
     points BACK at the standard medal it upgrades. Only links to products that
     actually made it into the store are kept — a cross-link to something with
     no photography would be a dead end. */
  const ups = (links.upgradesFor[p.id] || []).filter((u) => byId[u.id])
  if (ups.length) p.execUpgrades = ups
  const base = links.baseOf[p.id]
  if (base && byId[base]) p.execBase = { id: base, name: byId[base].name }
})

const counts = {}
all.forEach((p) => { counts[p.program] = (counts[p.program] || 0) + 1 })

writeFileSync(join(ROOT, 'store-catalog.json'), JSON.stringify({
  built: new Date().toISOString().slice(0, 10),
  frame: MANIFEST.frame,
  gate: GATE,
  programs: Object.entries(PROGRAMS).map(([slug, label]) => ({ slug, label, count: counts[slug] || 0 })),
  products: all,
}, null, 1))

console.log(`${all.length} products -> store-catalog.json`)
console.log(Object.entries(counts).map(([k, v]) => `  ${k}: ${v}`).join('\n'))
const gated = all.filter((p) => p.gated).length
console.log(`gated (> $${GATE}): ${gated} · open: ${all.length - gated}`)
