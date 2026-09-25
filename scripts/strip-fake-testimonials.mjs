/* ============================================================================
   REMOVE THE INVENTED TESTIMONIALS FROM THE HOME PAGE
   ----------------------------------------------------------------------------
   Jayden 2026-09-25: "get rid of the fake testimonials."

   The home page ran a marquee of four testimonials under "What fleet operators
   say", each attributed to a named person with a job title, each carrying a
   metric:

     Sarah Chen, Fleet Operations Manager   "Measurable retention improvement"
     Marcus Johnson, Director of Driver Relations
                                            "Significant 90-day turnover reduction"
     Linda Torres, HR Director              "+18% 5-year driver retention"
     Robert Walters, VP of Operations       "Drivers thank management unprompted"

   None of those people exist. The quotes claim three years of orders, a
   120-driver fleet and an 18% retention change — numbers a fleet manager will
   ask about on a call, and numbers nobody can produce. The workspace rule is
   explicit: a logo may go up when the client is real; a QUOTE only when the
   client SAID IT.

   The section is not deleted. It keeps its place, its heading slot and its
   CTA, and it now says plainly that real testimonials go up when customers
   approve them — which is exactly what premium-appreciation-kits.html already
   does on this same site ("Fleet testimonials coming soon"), so this is the
   site's own convention rather than a new one.

   Run once:  node scripts/strip-fake-testimonials.mjs
   ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs'

const FILES = ['index.html', 'hero-forest-preview.html']

/* The marquee sits between the heading block and the "Hover to pause" line. */
const OPEN = '    <div class="tst-mq">'
const CLOSE = '    <p class="tst-mq-sub">Hover to pause.</p>'

const HEAD_OLD = '<h2 class="section-title" style="margin-bottom:0" data-reveal data-reveal-delay="1">What fleet operators say.</h2>'
const HEAD_NEW = '<h2 class="section-title" style="margin-bottom:0" data-reveal data-reveal-delay="1">Proof, when it is ours to show.</h2>'
const EYE_OLD = '<span class="section-eyebrow" data-reveal>Client Results</span>'
const EYE_NEW = '<span class="section-eyebrow" data-reveal>Client Results</span>'

const PANEL = `    <div class="tst-mq-empty">
      <p>We would rather show you nothing than show you something we made up. Fleet
      testimonials go on this page when the customer has said it and approved it &mdash;
      not before.</p>
      <p>What we can show you today is the work itself: the kits, the awards and the
      medals, photographed as they ship, and a walkthrough of how a program is built
      for a fleet your size.</p>
      <div class="tst-mq-empty-ctas">
        <a class="btn btn-primary" href="/store">See the collection</a>
        <a class="btn btn-secondary" href="/contact.html">Talk to us about your fleet</a>
      </div>
    </div>
`

const STYLE = `<style>
/* The honest replacement for the invented testimonial marquee (2026-09-25).
   Same band, same rhythm, no borrowed credibility. */
.tst-mq-empty{max-width:60ch;margin:0 auto;text-align:center}
.tst-mq-empty p{font-size:16px;line-height:1.72;color:var(--text-secondary);margin:0 0 14px}
.tst-mq-empty p:last-of-type{margin-bottom:26px}
.tst-mq-empty-ctas{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
</style>
`

let changed = 0
for (const FILE of FILES) {
  let html
  try { html = readFileSync(FILE, 'utf8') } catch { console.log(`${FILE.padEnd(28)}skip — not present`); continue }

  const a = html.indexOf(OPEN)
  const b = html.indexOf(CLOSE)
  if (a === -1 || b === -1 || b < a) { console.error(`${FILE}: marquee bounds not found`); process.exitCode = 1; continue }

  let out = html.slice(0, a) + PANEL + html.slice(b)
  /* "Hover to pause" describes a marquee that no longer exists. */
  out = out.replace(CLOSE + '\n', '')
  out = out.replace(HEAD_OLD, HEAD_NEW).replace(EYE_OLD, EYE_NEW)
  out = out.replace('</head>', STYLE + '</head>')

  const BANNED = ['Sarah Chen', 'Marcus Johnson', 'Linda Torres', 'Robert Walters',
                  'tst-mq-card', '+18% 5-year driver retention', '120-driver fleet',
                  'What fleet operators say']
  const left = BANNED.filter((s) => out.includes(s))
  if (left.length) { console.error(`${FILE}: STILL PRESENT — ${left.join(', ')}`); process.exitCode = 1; continue }

  writeFileSync(FILE, out)
  console.log(`${FILE.padEnd(28)}4 invented testimonials removed`)
  changed++
}
console.log(`\n${changed} file(s) rewritten. No named person is quoted anywhere on them.`)
