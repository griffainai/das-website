/* ============================================================================
   WRAP THE EXISTING CONTACT / QUOTE FIELDS INTO RO-STYLE STEPS
   ----------------------------------------------------------------------------
   Jayden 2026-09-25: the contact and quote pages "need to be redesigned very
   deeply and they should have the retention opportunity design." He chose RO's
   INTAKE surface and a stepped flow with a progress bar.

   THIS SCRIPT INSERTS WRAPPERS ONLY. It never moves, renames, reorders or
   rewrites a field. Both pages post to /api/contact through handlers that read
   every value by [name="..."], and a redesign that quietly stopped capturing
   leads would be far worse than an ugly form — so the change is made in the one
   way that cannot do that.

   Each step is `.ix-step[data-step-title]`, hidden with the `hidden` attribute
   so its fields stay in the DOM and still submit. js/das-intake.js runs them.

   Run once:  node scripts/build-intake-steps.mjs
   Lives in scripts/, which .vercelignore excludes — it never deploys.
   ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs'

/** Each page: the form id, and where each step opens. A step runs until the
 *  next one opens, or until `end` for the last. Anchors are unique strings
 *  already in the file, so a moved line fails loudly instead of silently
 *  wrapping the wrong block. */
const PAGES = [
  {
    file: 'contact.html',
    formId: 'contact-form',
    steps: [
      { at: '        <!-- Row 1: Company + Fleet size -->',
        title: 'Your fleet',
        head: 'Who are we building this for?',
        sub: 'Two answers and we can size a program for you.' },
      { at: '        <!-- Row 2: First + Last name -->',
        title: 'Your details',
        head: 'Who should we reply to?',
        sub: 'A real person answers every enquiry — this is where it goes.' },
      { at: '        <!-- Full row: Program Interest -->',
        title: 'What you need',
        head: 'What are you trying to solve?',
        sub: 'The more specific you are, the more useful our first reply will be.' },
    ],
    end: '      </form>',
  },
  {
    file: 'company-purchasing.html',
    formId: 'company-form',
    steps: [
      { at: '        <!-- STEP: ABOUT YOU -->',
        title: 'About you',
        head: 'Who is asking?',
        sub: 'Purchasing, safety, HR — whoever owns this, we reply to you directly.' },
      { at: '        <!-- STEP: WHAT YOU ARE BUYING -->',
        title: 'What you are buying',
        head: 'What should the quote cover?',
        sub: 'Rough numbers are fine. We will confirm exact pricing before anything is produced.' },
      { at: '        <!-- STEP: TIMING AND BILLING -->',
        title: 'Timing and billing',
        head: 'When do you need it, and how do you buy?',
        sub: 'Purchase orders, net-30 and vendor setup are all normal here — tell us which you need.' },
      { at: '        <!-- STEP: ANYTHING ELSE -->',
        title: 'Anything else',
        head: 'Anything we should know?',
        sub: 'Artwork, deadlines, a programme you are replacing — this is the useful box.' },
    ],
    end: '      </form>',
  },
]

/* The progress header, injected right after the opening <form>. */
const HEADER = (n) => `
        <div class="ix-progress">
          <div class="ix-progress-head">
            <span class="ix-progress-label"></span>
            <span class="ix-of">Step 1 of ${n}</span>
          </div>
          <div class="ix-bar"><i></i></div>
        </div>
`

const NAV = `
        <div class="ix-nav">
          <button type="button" class="ix-btn ix-btn-ghost" data-ix-back hidden>&larr;&nbsp; Back</button>
          <span class="ix-spacer"></span>
          <button type="button" class="ix-btn ix-btn-primary" data-ix-next>Continue &nbsp;&rarr;</button>
        </div>
`

for (const page of PAGES) {
  let html = readFileSync(page.file, 'utf8')

  /* Idempotency first: a second run must be a no-op, not an error. */
  if (html.includes('class="ix-step"')) { console.log(`${page.file.padEnd(26)}already stepped — no change`); continue }
  const formOpen = `<form id="${page.formId}" novalidate>`
  if (!html.includes(formOpen)) { console.error(`${page.file}: <form id="${page.formId}"> not found`); process.exitCode = 1; continue }

  /* Anchors must each appear exactly once, or we would wrap the wrong block. */
  let ok = true
  for (const s of page.steps) {
    const n = html.split(s.at).length - 1
    if (n !== 1) { console.error(`${page.file}: anchor appears ${n}x — ${s.at.trim()}`); ok = false }
  }
  const endN = html.split(page.end).length - 1
  if (endN !== 1) { console.error(`${page.file}: end anchor appears ${endN}x`); ok = false }
  if (!ok) { process.exitCode = 1; continue }

  /* Order matters: the anchors must appear in the order declared, otherwise a
     step would swallow another step's fields. */
  const idx = page.steps.map((s) => html.indexOf(s.at))
  for (let i = 1; i < idx.length; i++) {
    if (idx[i] < idx[i - 1]) { console.error(`${page.file}: step ${i + 1} anchor appears before step ${i}`); ok = false }
  }
  if (!ok) { process.exitCode = 1; continue }

  /* Close each step where the next one opens, working bottom-up so earlier
     offsets stay valid. */
  const CLOSE = '        </div><!-- /ix-step -->\n'
  const endAt = html.indexOf(page.end)
  html = html.slice(0, endAt) + CLOSE + NAV + html.slice(endAt)

  for (let i = page.steps.length - 1; i >= 0; i--) {
    const s = page.steps[i]
    const open =
      `        <div class="ix-step" data-step-title="${s.title}"${i ? ' hidden' : ''}>\n` +
      `          <h2 class="ix-steptitle">${s.head}</h2>\n` +
      `          <p class="ix-stepsub">${s.sub}</p>\n` +
      (i === page.steps.length - 1 ? `          <div class="ix-review"></div>\n` : '')
    const pos = html.indexOf(s.at)
    html = html.slice(0, pos) + (i ? CLOSE : '') + open + html.slice(pos)
  }

  /* The form itself carries the surface and tells the stepper to run it. */
  html = html.replace(formOpen, `<form id="${page.formId}" class="ix" data-intake novalidate>` + HEADER(page.steps.length))

  /* Assets. Both go in before </head> so nothing flashes unstyled. */
  if (!html.includes('das-intake.css')) {
    html = html.replace('</head>', '  <link rel="stylesheet" href="/css/das-intake.css?v=1">\n</head>')
  }
  if (!html.includes('das-intake.js')) {
    html = html.replace('</body>', '  <script src="/js/das-intake.js?v=1"></script>\n</body>')
  }

  const opens = (html.match(/class="ix-step"/g) || []).length
  const closes = (html.match(/<!-- \/ix-step -->/g) || []).length
  if (opens !== closes || opens !== page.steps.length) {
    console.error(`${page.file}: ${opens} step opens vs ${closes} closes, expected ${page.steps.length}`)
    process.exitCode = 1
    continue
  }

  writeFileSync(page.file, html)
  console.log(`${page.file.padEnd(26)}${opens} steps wrapped, no field touched`)
}
