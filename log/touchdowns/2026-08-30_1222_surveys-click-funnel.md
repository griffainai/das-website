---
slug: surveys-click-funnel
job: 2
date: 2026-08-30
model: claude-opus-5
effort: high
---

# Touchdown — surveys-click-funnel #2

## Aim
Jayden's revision of job #1: drop the homepage band, put Surveys in the nav, and rebuild the
survey as a Kahoot-style click funnel with real colour.

## What it was told
Three corrections, verbatim in substance: (1) "I don't like how you have it on the home page
and added the section above Our Solutions. I never told you to do anything like that. You just
need to have it on the navigation bar… top nav or the hamburger." (2) Make it a click funnel —
multi-choice, not typing out 27 answers. (3) "The aesthetics need to be very aesthetic, with no
white space, branding, and very interactive, like a Kahoot quiz. Add other colors on there.
Don't just use the same basic colors."

## What it did
- `index.html` — the survey band removed entirely (3,527 chars); index is back to hero → solutions
- 38 pages gain `Surveys` in the top nav, 29 in the hamburger drawer; `publications.html` needed a
  separate pass (its hrefs are space-padded, so the generic anchor missed it); `success.html`
  correctly skipped — its nav is a bare order-confirmation bar with no links
- `css/survey.css` — rewritten. Nine section colour worlds, six-tile answer deck, prism + grain
- `js/survey-app.js` — rewritten as a screen machine: one question per screen, auto-advance
- `surveys.html` — rebuilt as a full-viewport stage; `styles.css` deliberately not loaded
- `js/survey-defs.js` and `api/_survey.js` unchanged — the data and the server were already right
- commit: "surveys: one question, one screen, one colour world per section" on main, parent 9e72033
- tree: clean
- tests/build: green — 47/47 unchanged, plus a driven pass through all 27 driver questions

## How it went
Grade: 3 — the work is right now, but a chunk of job #1 was thrown away because I invented a
homepage placement nobody asked for, and the funnel is what should have been built first.

The homepage band was my call, not Jayden's, and he was right to cut it. Re-reading the original
transcript, Shaq said "they can just go to our main site, and then they can click onto a button" —
I turned "a button" into a full marketing section above an existing one, which is a different and
larger claim on the homepage than anyone made. The nav is the smaller, more correct reading, and
it is also the one that survives the hero being ~2000px tall. Lesson with teeth: when the brief
says *a link*, build a link. A section is a decision the client did not make.

The funnel is a genuine improvement over what I shipped first, and the reason is worth recording.
24 of the driver survey's 27 questions are single-select — they were always clicks. Rendering them
as a scrolling page of form controls made a 4-minute instrument *look* like a 20-minute one, and
that is a conversion problem, not a taste problem. One question per coloured screen with
auto-advance is the same data in a shape people finish.

On colour, BRAND-KIT.md is LOCKED to navy with brass as an earned metal, and the ask was for more
colour. Resolved by not touching the brand: Anton/Chivo unchanged, and brass appears in exactly one
place in the whole stylesheet — the Commit state on the 2027 decision list, which is an earned mark
by definition. The added colour is a per-section GROUND (nine worlds) plus a six-colour answer deck
with no gold in it, so brass keeps meaning something. Flagged the tension to Jayden before building
rather than after.

What the prompt would say differently next time: nothing — the correction was specific and
actionable, which is why it took one pass.

## Correction passes
4

## Any errors
- **Two corrupt CSS values written into `survey.css` on the first pass.** A colour literal came out
  as `#216architecture` and another as `#4E9E६B` (a Devanagari digit inside a hex colour), plus a
  duplicated `:root` block. Caught by reading the file back before running it, then confirmed clean
  by a script asserting every `#…` matches `^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$`. Both would have
  silently dropped their declarations rather than erroring, which is exactly why the check is a
  regex over every colour and not a glance. status: recovered
- **Every illustration rendered as an empty box — and it was the iOS bug in disguise.** Two separate
  causes, stacked. First, I referenced the sprite as `href="/images/das-illustrations.svg#das-medal"`.
  `js/das-sprite.js` exists *specifically* because iOS Safari has never supported external SVG
  `<use>`; its header says so in full. My markup would have rendered nothing on every iPhone —
  the primary device for this audience — while looking fine on my Chrome. Fixed by loading
  `das-sprite.js` and switching to local `#das-medal` fragments. Second, even inlined it still did
  not paint: `stroke: currentColor; stroke-width: 2.4` lives in `css/styles.css:5480`, which this
  page deliberately does not load, so stroke computed to the SVG initial `none`. Those three
  declarations are now in `survey.css`, with a comment saying where they came from and why.
  Diagnosed by measuring computed stroke on a KNOWN-GOOD page (`index.html` reported
  `stroke: rgb(26,46,110)`) and comparing — not by guessing at the sprite. status: recovered
- **The scale ramp was invisible.** `calc(.06 + var(--i) * .07)` spread five steps across 7% opacity,
  so the "ramp" rendered as five identical boxes — which is the exact paper defect this whole build
  exists to fix. Caught by reading the computed backgrounds, not by looking at it. Widened to
  10%→44% with borders climbing 26%→76%. status: recovered
- **Screenshot showed dim, washed-out text on the done screen.** Not a bug: computed styles showed
  `#fff` at opacity 1, and a second capture rendered correctly — the first landed mid-transition
  during the 620ms ground change. Worth recording because it nearly sent me chasing a z-index
  problem in the ghost word that did not exist. Measure before you fix. status: recovered
- **`.svq` uses `overflow: hidden`** for the prism washes. Screens taller than the viewport (the
  matrix, identity) grow `.svq` and scroll the page rather than clipping — verified, not assumed.
  status: recovered

## Still open for Jayden
- `SURVEY_ACCESS_CODE` / `SURVEY_TO` remain unset in Vercel; defaults (`DAS2027`, the 4
  company-purchasing addresses) are live.
- Migration `026_survey_responses.sql` still not applied — email works, nothing archives.
- No live Resend send exercised. One real submission after deploy confirms it, in four inboxes.
