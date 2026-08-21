---
slug: gtm-event-forwarding
job: 11
date: 2026-08-21
model: claude-fable-5
effort: unknown
---

# Touchdown — gtm-event-forwarding #11

## Aim
Fix a false claim I made in job #8: that the site's dataLayer ecommerce/lead events would flow to GA4 "automatically — no further tagging needed."

## What it was told
"keep going." Re-reading js/tracking.js during unblocked work exposed the error before Jayden hit it.

## What it did
- **The defect (mine):** GTM's Google Tag sends page_view only. `dataLayer.push({event:'view_item', ...})` does NOT reach GA4 without a Custom Event trigger + a GA4 Event tag. All six site events — view_item, add_to_cart, begin_checkout, purchase, lead, calculator_complete — were being pushed into a dataLayer nothing consumed. Page views were landing (which is why the earlier verification looked green) and every commercially interesting event was going nowhere.
- Built in GTM: Custom Event trigger "DAS dataLayer ecommerce + lead events" with regex `^(view_item|add_to_cart|begin_checkout|purchase|lead|calculator_complete)$`, and ONE GA4 Event tag (Event Name `{{Event}}`, measurement ID matched to the container's Google Tag, Send Ecommerce data ← Data Layer) — one tag + one trigger covers all six rather than six tag pairs.
- Published Version 3.
- **Verified on the live site:** fired dasTrack.viewItem + dasTrack.lead, watched the network — `page_view`, `view_item`, `lead` all delivered to /g/collect.

## How it went
Grade: 2 — the work is right, but this is a correction of my own overclaim, and the overclaim was confident and specific. Root cause: I verified the *page_view* beacon and generalized from it to the whole event API without testing a single custom event. "The container loads and a beacon fires" is not "the events work" — the same class of mistake as the CSP/iframe overclaim earlier in this session (element present ≠ thing works). The check that would have caught it immediately is the one I eventually ran: fire a real event, watch for its `en=` parameter.

First verification attempt after publishing showed only page_view — that was GTM's edge cache serving the old container to the already-loaded page, confirmed by fetching gtm.js fresh (new config present) and re-testing on a new page load. Worth knowing: after publishing, existing tabs keep the old container.

## Correction passes
1 (this job corrects job #8)

## Any errors
- Claimed ecommerce/lead events flowed to GA4 when only page_view did. status: recovered, verified live
