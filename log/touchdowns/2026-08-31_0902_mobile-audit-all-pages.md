---
slug: mobile-audit-all-pages
job: 11
date: 2026-08-31
model: claude-opus-5
effort: high
---

# Touchdown — mobile-audit-all-pages #11

## Aim
Check every page of the DAS site is genuinely mobile-correct, after the survey shipped broken.

## What it was told
Two more iPhone screenshots — the written-feedback question with its text rendering ON TOP of the
textarea, and the review screen showing a full-screen pale-yellow rectangle. Then: *"even these
pages, so you need to check every single page to make sure it's mobile-optimized properly."*

## What it did
- confirmed both new screenshots were the **same `.svq-field` collision** already fixed minutes
  earlier: the textarea and the email input were `position:absolute; inset:0`, so the question text
  drew over the textarea and the autofilled email became a full-viewport yellow block
- built a **45-page audit** run in a same-origin 390x844 iframe measuring real layout
- fixed the one real defect it found: `cart.html` `#promo-entry input` was `font-size:11px
  !important` — iOS zooms the page on focus, mid-checkout. Now 16px, both controls to 44px.
- saved it as `scripts/mobile-audit.js` so it is repeatable, not a one-off
- commit: "cart: an 11px promo field zoomed the page mid-checkout" on main
- tests 93/93 · **45/45 pages clean on the re-run**

## How it went
Grade: 4 — the audit was the right instrument, and it also proved the site was in better shape
than the survey I had just broken.

Result across 45 pages, before fixes: **0 horizontal overflow, 0 missing viewport meta, 2 pages
with sub-16px inputs.** The catastrophe was confined to the survey — the thing I built — and the
rest of the site was fine. Worth saying plainly rather than implying the whole site was bad.

The one genuine find is a good one: the cart's promo-code field at **11px**, which makes iOS zoom
the entire page the instant a customer taps it, on the page that takes money. It is not a survey
bug, it predates this session, and only a geometric sweep would ever surface it.

That fix took two passes, and the second is the instructive one. I first set `font-size:16px` as an
inline style — inline beats everything short of `!important`, so I expected it to hold. The height
changed and the font-size did not. The page's own stylesheet carried
`#promo-entry input { font-size:11px !important }`. My inline `min-height:44px` had won over its
`height:36px` because those are different properties, which made the element *look* fixed while the
actual defect survived. **A partial visual improvement is the most dangerous kind of wrong** — it
reads as success. Re-measuring the computed value is what caught it; fixed at source instead.

Also caught myself measuring after `frame.remove()`, which returns empty computed styles from a
detached document. It reported `fontSize: ""` and I nearly logged that as "no longer set."

## Correction passes
3

## Any errors
- **Read computed styles from a detached iframe** and got `""` back. Measure before you tear down.
  status: recovered
- **Trusted an inline style to beat a page rule.** It does — unless that rule is `!important`, and
  this one was. status: recovered
- The audit's first version reported `div.mobile-drawer` extending to x=730 on every page as
  "wide". That is the off-canvas drawer parked off-screen **by design**, and overflow was 0
  throughout, so it was noise. Left in the tool as informational rather than a failure, because
  suppressing it entirely would hide a real drawer bug later. status: recovered

## Still open
- Tap targets under 44px exist on most pages (13 on cart), almost all inline footer/nav text links.
  Reported by the tool, deliberately **not** auto-changed: inline links in prose legitimately sit
  under 44px, and bulk-resizing them is a site-wide design decision, not a defect fix. Jayden's call.
- Jayden has still not seen the fixed survey on his own phone. Emulation is not an iPhone.
