---
slug: surveys-terminal-design
job: 3
date: 2026-08-30
model: claude-opus-5
effort: high
---

# Touchdown — surveys-terminal-design #3

## Aim
Run the design-lab gate I skipped in job #1, then implement the direction Jayden actually chose.

## What it was told
Jayden, on the live funnel: the font is "too bold and bulky… hard to read", the ghosted VOICE
word is weak and wants "a better branded background", the logo "needs to be a lot bigger", and —
the part that matters — *"we need to do a whole design style to actually design it. You just
designed it without me."*

## What it did
- Ran `design-lab` properly: interview → five directions rendered at true phone width → his pick
  → synthesis → implement. Lab lived in scratch, not `_sandbox/` (already 6 topic dirs against a
  cap of 5), and is deleted.
- `css/survey.css` — Anton de-shouted (clamp 30–62px → 23–34px, tracking .006em → .07em, 92%
  white); ghost word replaced by the illustration field; role cards from 10% glass to a navy
  card at 55% with a 30% white border; role titles Chivo 700 solid white, not Anton.
- `surveys.html` — lockup 30px → 60px on opening screens / 42px in the funnel; static
  three-mark illustration field behind every screen.
- `js/survey-app.js` — role labels to Title Case; ghost-word logic retired for an intro/funnel
  lockup flag.
- Vercel env: `AI_DAILY_BUDGET_USD` 2 → 15, `AI_HARD_CAP_USD` 10 → 50 (for the Awareness Check).
- Spec for the AI analysis written agency-side: `deliverables/AWARENESS-CHECK-SPEC.md`. Not built.
- commit: "surveys: the design he picked, not the one I picked" on main, parent c60897f
- tree: clean · tests/build: green — 47/47, plus a full 27-question driven walk

## How it went
Grade: 4 — the right process this time, and the design is better for it. Marked down only
because the process should have run in job #1 and this is partly rework.

The correction was the valuable part. In job #1 I reasoned that a survey inside an existing site
was an *extension*, not a new design, and so the `design-lab` gate did not apply. That was
motivated reasoning: the funnel has its own type scale, ground, colour system and interaction
model, which is a design system by any honest definition. The rule exists precisely to stop what
happened — shipping my taste and calling it a default.

Running it properly took one interview and one round of variants, and produced two things I would
not have arrived at alone. First, Jayden picked **Terminal** (illustration field) after saying he
liked **Prism**, which only became separable because both were rendered side by side — described
in prose they sound like the same idea. Second, my own recommendation (drop Anton entirely, use
photography) was **wrong**: he wanted Anton kept and the drawings as the ground. Had I "just
designed it" a second time I would have shipped the photo direction with confidence.

The synthesis call was mine to make and worth recording: he said "A or F, your choice." A is
Terminal but carries Anton at 38px — the exact weight he had called too bulky. So the build takes
A's ground and F's de-shouted type. Choosing A literally would have re-imported the complaint.

The interview for the Awareness Check paid for itself before a line was written: the 2027
Commitment Guide already contains its own pass/fail rubric on page 4 (owner, eligible population,
budget, data source, launch date). The analysis is a readiness verdict against a standard DAS
published, not an AI opinion about someone's business — which is what makes it both undeniable
and safe to send. That reframing came out of reading the source PDF again while writing questions.

## Correction passes
5

## Any errors
- **Illustration marks scaled with page height, not the viewport.** Sized in percentages against
  `.svq`, which grows with content, so a "30% height" mark rendered **388px tall and 326px wide on
  a 375px phone** — wider than the answer tiles it was supposed to sit behind. Caught by measuring
  bounding boxes, not by looking. Fixed with px caps (`max-height: 210px` / `max-width: 420px`):
  percentage for placement, pixels for scale. status: recovered
- **Chased a logo bug that did not exist.** After the class toggle the lockup still computed 60px
  where the CSS said 42px, and the matched-rule dump confirmed the correct rule was winning. Cause:
  `document.hidden === true` — the Browser pane was hidden, and a hidden tab **pauses CSS
  transitions**, so `getComputedStyle` returned the frozen start value. Proved it by setting
  `transition: none` and re-reading (42px). Recording it because it is a general trap: computed
  styles measured in a hidden pane are not trustworthy for anything mid-transition. status: recovered
- **Removed the height transition anyway.** The false alarm made me look at it properly: animating
  `height` triggers layout on every screen change, which is jank on a low-end Android. The lockup
  now steps between its two sizes instantly. Not a bug — a fix the bug hunt found. status: recovered
- **Two corrupt values written into the design-lab CSS** (`#216architecture`, and a Devanagari
  digit inside `#4E9E६B`). Same failure mode as job #2's stylesheet. Caught by a regex asserting
  every `#…` matches a valid 3/6-digit hex. That check is now reflex on any generated stylesheet.
  status: recovered

## Still open
- **Awareness Check is specced, not built.** See `AWARENESS-CHECK-SPEC.md`. Blocked in part on
  migration 026 — without the response store the driver batch trigger cannot count to 5.
- **Porkbun forwarding still broken** for `@driverappreciationsolutions.com`. `SURVEY_TO` is
  pointed at working Gmail addresses as a bypass; the DAS addresses go back on the list once
  Jayden adds the forwards.
