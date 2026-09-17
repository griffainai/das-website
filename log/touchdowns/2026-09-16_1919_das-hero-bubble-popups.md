---
slug: das-hero-bubble-popups
job: 1
date: 2026-09-16
model: claude-opus-5
effort: unknown
---

# Touchdown — das-hero-bubble-popups #1

## Aim
Remove the homepage hero eyebrow bubble, and fix "the surveys and newsletter are being an overlay on a laptop".

## What it was told
Jayden, relayed by a parent session: (1) delete the "Built for fleets committed to driver safety and retention" bubble above "Driver Appreciation Made Simple for Fleets"; (2) the surveys and newsletter "are being an overlay on a laptop". The parent read (2) as the newsletter pop-ups and asked for an investigation first. No deploy, no push, commit by path only.

## What it did
- files changed: index.html (hero eyebrow removed), css/styles.css (NAV FIT block), js/cart.js (fitNav guard), js/das-popups.js (laptop compaction, bar bottom-left, scroll gate for p4, no-stacking guard, Escape), and the ?v= bumps (styles.css 45/29 -> 46, cart.js 5/2 -> 6, das-popups.js 3 -> 4) across the 49 HTML pages that load them
- commit: "Laptop nav: Newsletter and Surveys no longer print over each other; hero bubble removed; pop-ups fit laptops" on main, parent 1a71c10
- tree: only the paths above
- tests/build: scripts/test-surveys.mjs 93/93; node --check on both JS files; headless Edge geometry sweeps (below)

## How it went
Grade: 4 — the literal bug was not the one the brief pointed at, and it was found by measuring rather than reading.

**The misread risk.** The brief framed (2) as pop-ups. The words "surveys and newsletter" are exactly the two newest top-nav labels ("Newsletter", "Surveys"). The pop-ups were measured anyway, and so was the nav.

**The actual defect (nav).** The desktop nav row was sized for six links; Surveys (2026-08-31) made it seven. `.nav-links` is flex with default shrink, `.nav-link` is `white-space:nowrap`, so flex shrank each link's box below its text and the text painted over its neighbour. Measured with a CDP sweep (text overflow per link, link-vs-link rects, links-vs-actions, logo-vs-links) at 10px steps from 861 to 1600:
- index/about/publications/contact etc.: overprint at every width 861–~1179 (1366@125% scaling = 1093 CSS px, 1280@125% = 1024 — real laptops)
- shop/product/favorites (Saved + Cart pills, ~150px more): overprint at EVERY width up to 1591, including 1280, 1366, 1440 and 1536. Screenshot before-shop-1440x900-top.png shows "Insights & IdeasNewsletterSurveys" run together.
- The earlier session's 1366/1440 check (commit 58ece0e) looked at index only, where it is clean at those widths — the shop pages were never measured.

**Fix.** `.nav-link{flex-shrink:0}`; laptop band 861–1600 tightens gaps/padding, turns the Saved+Cart pills icon-only (count badge moved to the corner), and visually hides the signed-in "My Account" words next to the avatar (kept for screen readers); 861–1139 switches to the menu button where a toggle exists. js/cart.js `fitNav` adds `.nav--burger` if the row still overflows at any width (signed-in, new link), re-checked on resize, load, fonts.ready and a ResizeObserver on the actions (auth.js resizes them after login).

**After.** Sweep 865–1605 step 20 on all 44 pages with a nav: 0 problems. Signed-in simulation on shop 1141–1600: 0 problems, desktop row kept. The 8 legal pages (terms, privacy, etc.) have no menu button or drawer, so they are guarded out of the burger and get a smaller link size at 861–979: 0 problems at 5px steps.

**Pop-ups (also real, secondary).** One per session, never stacked with each other, all dismissable by ✕/backdrop/No thanks — but: p3 was 707px tall on a 768px screen (92%), p1 571px on 720; no Escape key; p4 slim bar fired at 8s with no scroll, i.e. over the hero on a laptop, and sat on top of the Scout chat button (z 2147483000 vs dock 9999); nothing stopped a pop-up opening over the menu drawer, sign-in modal, upsell or Scout panel. After: compact layout on screens ≤920px tall (p3 551/720, 563/768, 598/900; p1 521), bar bottom-left on ≥760px, all layouts need 8s AND 40% scroll, Escape dismisses, and a busy() guard defers while another layer is open. Driven check: bar absent at 11s without scroll, present after scroll, gone on Escape with dismissedAt saved; p1 withheld while the drawer was open and shown ~4s after it closed.

**Surveys page.** /surveys is a deliberate full-screen funnel with no site nav (documented in its own <style>). Left as designed; reported.

Prompt next time: quote the user's words beside the interpretation, and name every page to measure, not just index.

## Correction passes
3 — Saved pill looked lopsided with an invisible count reserving space (badge moved to corner); signed-in shop fell back to the menu button at all laptop widths (avatar-only fix); p3 still 770px at 1440x900 (compaction threshold raised 820 -> 920px tall).

## Any errors
- First sweep's summary printer parsed the wrong field and reported no overlap at 920px while the screenshot plainly showed overprint; the detector only checked link BOXES, which never overlap — the TEXT overflows the box. Rewrote with scrollWidth > clientWidth: status: recovered
- sweep.mjs crashed on a page with no problems before its results entry existed (TypeError): status: recovered
- A background all-pages sweep was launched with the run duplicated in one command and hit the 600s tool timeout; the first pass completed (44/44 clean) and the duplicate was stopped: status: recovered
- p4 copy still says "Order by Aug 7" during Driver Appreciation Week (Sept 13–19) — stale promise, not changed here, needs Jayden's wording: status: open
- The 8 legal pages have no menu button or drawer at ≤860px (no navigation on phones) — pre-existing, not fixed here: status: open
- Not deployed; live site unchanged until Jayden decides: status: open
