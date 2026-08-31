---
slug: survey-back-in-sidebar-and-desktop
job: 14
date: 2026-08-31
model: claude-opus-5
effort: high
---

# Touchdown — survey-back-in-sidebar-and-desktop #14

## Aim
Put Surveys back in the homepage sidebar, and fix the survey's laptop/desktop layout.

## What it was told
"why'd you get rid of the survey from the sidebar? … Bring back the survey page on the sidebar,
but make it mobile-optimized, because on desktop it's not optimized properly. They're kind of
banging into each other, or for laptop view, for sure."

## What it did
- `index.html` — Surveys restored to the hamburger drawer with a matching clipboard icon
- `css/survey.css` — a real `min-width: 760px` layer: content capped to a 720px column, fields
  capped at 640px, drawings pushed outside the reading column, second breakpoint at 1200px
- assets → `?v=5`
- commit: "surveys: the homepage drawer lost it, and the laptop layout never had one"
- tests 93/93 · verified 1440 / 1280 / 1024 / 900 / 390

## How it went
Grade: 4 — he was right on both counts and I had evidence for neither until I measured.

**The sidebar.** He thought I had deleted it. I had not — Surveys was in the top nav on all 38
pages and in 29 of 30 drawers. The one missing was `index.html`, the single page he would most
likely open the drawer from. Cause: the homepage's drawer links each carry an inline SVG icon, so
the anchor I matched on for the other pages (`<a href="contact.html" class="mobile-nav-link">Contact</a>`)
simply did not exist there. A bulk edit that silently skips one file is worse than one that fails,
because the count looked right — "29 pages" — and nobody checks which 29.

**The desktop layout, which was the real complaint.** Two defects, both invisible on a phone
because I only ever measured at 375-390px:
  - the organisation input rendered **847px wide**. `.svq-fields` is a two-column grid and the
    full-width row spanned both, inheriting the entire 940px stage. A text field the width of a
    runway.
  - the drawings sat **inside** the centred content column between roughly 1000 and 1300px. They
    are positioned against the full-width stage while content is capped and centred, so as the
    viewport grows the column pulls away from the edges and the marks end up under the text. That
    is exactly "banging into each other", and it is a class of bug that only appears at widths
    between the phone and a wide desktop — which is why 1440 looked fine.

Now: a 597px column, the widest input 597 instead of 847, and **zero marks intruding at any width
from 900 to 1440**. Phone is untouched — the rules start at 760px.

## Correction passes
2

## Any errors
- **My first laptop measurement was worthless and I nearly reported it.** A width sweep of the NAV
  returned an identical 32px gap at every width from 900 to 1440, which is not physically
  plausible. Rather than write it up I validated the harness — `iframe.contentWindow.innerWidth`
  against the requested width — and it was actually fine; the nav genuinely does not collide.
  Implausible-but-clean numbers deserve the same suspicion as obviously broken ones. status: recovered
- **I audited the wrong thing first.** "Desktop is not optimized… banging into each other" read to
  me as the site nav, because I had just added a 7th item to it. It was the survey. Cost one round
  trip; re-reading his sentence in full ("bring back the survey page … because on desktop") is what
  corrected it. status: recovered
- `sed` died mid-command with **"No space left on device"**. Not our code: **C: is down to 3.53 GB
  free**. Claude's own temp is 0.57 GB and all of `%TEMP%` is 0.86 GB, so there is nothing here to
  reclaim — it is something else on his machine. Reported, not investigated further; digging
  through his drive uninvited is not mine to do. status: open, Jayden's

## Still open
- C: at 3.5 GB free will keep breaking commands, git operations and deploys.
- The email hero is still grey for him; an image hero is the remaining option and he paused me
  mid-sentence before I built it.
