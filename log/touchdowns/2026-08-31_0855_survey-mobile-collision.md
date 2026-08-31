---
slug: survey-mobile-collision
job: 10
date: 2026-08-31
model: claude-opus-5
effort: high
---

# Touchdown — survey-mobile-collision #10

## Aim
Fix the identity screen, which was unusable on a real iPhone.

## What it was told
Jayden sent an iPhone screenshot: *"The survey isn't even mobile-optimized at all… the colors and
the visuals… you have things merging together. The layout is not designed properly."* Then:
*"you can't even fill in the information correctly or see where you're filling it in."*

## What it did
- `css/survey.css` — renamed the illustration container `.svq-field` → **`.svq-ill`** (the bug);
  inputs given an opaque ground, a 42%-white border, 17px type, 54px min-height, `-webkit-appearance:none`,
  a visible placeholder colour; drawings dropped to 5–7% under 560px
- `surveys.html` — container class renamed; **all four assets bumped `?v=2` → `?v=3`**
- commit: "surveys: one class name broke the whole identity screen" on main
- tests 93/93; class-collision audit added and run

## How it went
Grade: 2 — I shipped a screen that could not be filled in, and every check I ran said it was fine.

**The bug.** When I added the illustration field I named its container `.svq-field`. That class
already belonged to the text inputs. So every input inherited `position:absolute; inset:0` and
collapsed into a single invisible box — measured live: all three fields at exactly `256,19
353x345`, stacked — while the container inherited the input's translucent background and border and
rendered as a washed-out card over the content. One duplicated class name produced every symptom he
described: no visible fields, placeholder colliding with its label, drawings merging with text.

**Why my testing missed it, which is the part worth keeping.** I verified the identity screen
functionally — `getElementById(...).value = x`, then assert the flow advances. It passed, because
setting `.value` on an invisible absolutely-positioned input works perfectly. **I never measured its
geometry.** Every other screen I *did* measure (tile sizes, tap targets, scale wrap, overflow) and
those were all correct. The one screen I only exercised programmatically is the one that shipped
broken. A form that a script can fill is not a form a thumb can fill, and I had proof of the first
and called it proof of the second.

Second contributing failure: **I never bumped `?v=` on css/js.** DAS memory says it explicitly —
*"never `immutable` on /js,/css; bump `?v=`"* — and `vercel.json` serves those with
`stale-while-revalidate=86400`, so a phone can hold a day-old stylesheet against fresh markup. I
edited both files repeatedly across four commits at a static `?v=2`. Now `?v=3`.

Added a **class-collision audit** to close the class of bug rather than the instance: it extracts
every `.svq-*` selector from the CSS and every class applied in the HTML/JS, and flags any class
landing on both an input and a container. It reports one benign case (`svq-label` on `label` and
`span`) and zero hard collisions now.

## Correction passes
1

## Any errors
- **The collision itself.** Found by measuring the live page at 390px rather than reading the CSS —
  the CSS looks correct in isolation; only the computed geometry showed three inputs at one box.
  status: recovered
- **Stale cache-busting** across four commits. status: recovered
- Nearly misread the cause as a styling problem. The tell was `inputTags: ["DIV","INPUT","INPUT","INPUT"]`
  from a `querySelectorAll('.svq-field')` — a DIV had no business matching an input selector, and that
  single line was the whole diagnosis. status: recovered

## Still open
- Jayden must **hard-refresh** (or the `?v=3` bump will do it for him on next load).
- The wider "design the mobile view properly" ask is now *correct* rather than *finished* — the
  screen works and reads cleanly, but he has not seen this pass yet and his judgement is the gate.
