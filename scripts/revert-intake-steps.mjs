/* ============================================================================
   UNDO THE STEPPING — DAS FOLLOWS ODNDR'S CONTACT PAGE, NOT RO'S INTAKE
   ----------------------------------------------------------------------------
   Jayden 2026-09-25, correcting an earlier brief: the DAS contact and quote
   pages should copy https://offdutynotdrivingrewards.com/contact exactly, and
   "lets keep them the same across website just diff info and diff booking link".

   I had built them on Retention Opportunity's intake surface with a stepped
   flow. That was the wrong target. ODNDR's contact form is measured
   single-page: all twelve controls visible at once, one button, and the only
   thing named "step" on it is a CSS-module class (stripe-demo-module__step),
   not a stepper.

   Worse, DAS's contact page was ALREADY a near-clone of ODNDR's — same
   two-column layout, same eyebrow-and-headline card, same copy shape. The
   stepping is what made it diverge from the rest of the site.

   So this removes every wrapper the stepper added and puts the fields back
   exactly as they were. Same discipline as adding them: no field is moved,
   renamed or rewritten, and the submit path to /api/contact is untouched.

   Run once:  node scripts/revert-intake-steps.mjs
   ========================================================================== */
import { readFileSync, writeFileSync } from 'node:fs'

const FILES = ['contact.html', 'company-purchasing.html']

for (const FILE of FILES) {
  let html
  try { html = readFileSync(FILE, 'utf8') } catch { console.log(`${FILE.padEnd(26)}skip — not present`); continue }
  if (!html.includes('class="ix-step"')) { console.log(`${FILE.padEnd(26)}not stepped — no change`); continue }

  const before = [...html.matchAll(/name="([a-z_]+)"/g)].map((m) => m[1]).sort().join(',')

  /* The progress header, whole. */
  html = html.replace(/\n? *<div class="ix-progress">[\s\S]*?<\/div>\n *<\/div>\n/, '\n')

  /* Each step's opening div plus the heading, sub and review line it carries. */
  html = html.replace(/ *<div class="ix-step"[^>]*>\n/g, '')
  html = html.replace(/ *<h2 class="ix-steptitle">[^<]*<\/h2>\n/g, '')
  html = html.replace(/ *<p class="ix-stepsub">[^<]*<\/p>\n/g, '')
  html = html.replace(/ *<div class="ix-review"><\/div>\n/g, '')
  html = html.replace(/ *<\/div><!-- \/ix-step -->\n/g, '')

  /* The Back / Continue bar. */
  html = html.replace(/\n? *<div class="ix-nav">[\s\S]*?<\/div>\n/, '\n')

  /* The form keeps its id and novalidate; it loses the stepper hooks. The
     `ix` class stays: the ODNDR skin hangs off it. */
  html = html.replace(/<form id="([a-z-]+)" class="ix" data-intake novalidate>/, '<form id="$1" class="ix" novalidate>')

  /* The stepper script is no longer loaded anywhere. */
  html = html.replace(/ *<script src="\/js\/das-intake\.js\?v=\d+"><\/script>\n/, '')

  const after = [...html.matchAll(/name="([a-z_]+)"/g)].map((m) => m[1]).sort().join(',')
  const leftovers = ['ix-step', 'ix-progress', 'ix-nav', 'data-intake', 'ix-steptitle', 'das-intake.js']
    .filter((s) => html.includes(s))

  if (before !== after) { console.error(`${FILE}: FIELD NAMES CHANGED — not written`); process.exitCode = 1; continue }
  if (leftovers.length) { console.error(`${FILE}: leftovers — ${leftovers.join(', ')}`); process.exitCode = 1; continue }

  writeFileSync(FILE, html)
  console.log(`${FILE.padEnd(26)}stepping removed, ${after.split(',').length} field names unchanged`)
}
