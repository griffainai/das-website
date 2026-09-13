---
slug: daw-ticker-ab-test
job: 1
date: 2026-09-13
model: claude-opus-5
effort: unknown
---

# Touchdown — daw-ticker-ab-test #1

## Aim
Put the Driver Appreciation Week announcement bar into an A/B test on the live site: design 1 (Red Alert) vs design 4 (Stars & Stripes), and fix the countdown that read 00:00:00:00 all week.

## What it was told
Jayden picked designs 4 and 1 from the five-direction lab (E:/Workspaces/das/design-drafts/daw-ticker) and asked to A/B test them.

## What it did
- files changed:
  - new: css/daw-ticker.css (both variants scoped `.daw-tk--a` / `.daw-tk--b`, explicit hex per the inverted-variable rule), js/daw-ticker.js (assignment, three-state countdown, dataLayer events)
  - edited: index.html, contact.html, company-purchasing.html (old `.announcement-bar-enterprise` block → `<div data-daw-ticker>` + synchronous script; stylesheet link added before `</head>`)
- commit: "DAW ticker A/B test: Red Alert vs Stars & Stripes, countdown to the week's end" on main, parent: see git log
- tree: only the files above staged by path
- tests/build: no build step (static site). Local verification on a static server (localhost:8334) via headless Edge CDP. For index ?daw_ticker=a, index ?daw_ticker=b and contact ?daw_ticker=b, each at 1440 and 390:
  - the right variant rendered, state "live"
  - the countdown ticks down to Sept 20 00:00 local
  - `daw_ticker_view` and `daw_ticker_click` land in dataLayer with the variant and state
  - the CTA points to /shop.html
  - zero JS exceptions, zero horizontal overflow
  - bar height 62px desktop, 78/87px phone
  - screenshots reviewed

## How it went
Grade: 4 — shipped as asked with measured behaviour. The results only become readable once GTM forwards the events (Jayden's step).

- **Assignment:** `?daw_ticker=a|b` forces and remembers a variant (for QA and screenshots). Otherwise each browser keeps its first assignment (localStorage `das_daw_ticker_v1`), otherwise 50/50. The script runs synchronously right after the placeholder, so the assigned variant paints with no flash of the other one.
- **Countdown bug fixed on the way:** js/countdown.js targets the start of the week (2026-09-13 00:00) with "DAW begins in", so the old bar sat at zero for the entire week. The new bar counts to the end during Sept 13–19 and drops the timer after with year-round copy linking to /driver-recognition-programs.html. countdown.js is untouched; it still drives the homepage countdown section, which already shows "Happening Now".
- The stale "Guarantee on-time delivery — order before Aug 7" promise was removed with the old bar rather than replaced with a new delivery claim.
- Only 3 pages carried the bar (index, contact, company-purchasing), so those are the pages in the test.

## Correction passes
1 (the page rewrite stripped the UTF-8 BOM from all three files; restored so the diff touches only the ticker)

## Any errors
- First BOM-check script was blocked by the harness ("Remove-Item on system path '/c'") because of a sloppy temp-file expression. Rewritten with explicit scratchpad paths, and the BOMs were restored: status: recovered
- **GA4 will not show the test yet.** Events go to dataLayer, but GTM container GTM-523F9QFC needs a Custom Event trigger (`daw_ticker_view|daw_ticker_click`, regex) and a GA4 event tag passing `daw_ticker_variant` / `daw_ticker_state` before results are recordable. This needs Jayden's GTM access: status: open
- The "after the week" state was not exercised on the live code (it needs the clock past Sept 20). The same three-state logic was verified in the design lab via ?state=after: status: open
