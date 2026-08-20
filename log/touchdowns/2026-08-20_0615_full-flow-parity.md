---
slug: full-flow-parity
job: 3
date: 2026-08-20
model: claude-fable-5
effort: unknown
---

# Touchdown — full-flow-parity #3

## Aim
Complete ODNDR-parity across every DAS lead surface: contact page top-to-bottom, and company-purchasing (which IS the "Request a Price" / "Learn More" destination — the pricing gate funnels there).

## What it was told
"The confirmation needs to be the same, everything… completely redo: the contact form, the contacts page, the Request-a-Price page, the Learn-More request pricing, the corporate purchasing. Same thing for both. Use the correct CTA and copywriting, and actually use capitalization."

## What it did
- contact.html: ODNDR input skin (slate fill → white on navy-ring focus), placeholders carry field names (labels sr-only, follow-up label visible), hero title Oswald uppercase, success states get eyebrow + Oswald uppercase titles ("It's with the team."), under-submit trust line ("Never sold, never shared. · Call 302.681.0995"), submit hover glow → neutral slate elevation
- company-purchasing.html: same grammar end-to-end — Oswald fonts, hero + form head ("Your drivers earn it. / Let's get it approved."), slate input skin, visible Oswald labels (procurement form keeps labels), follow-up selector ("How should we deliver your answer?" — walk-me-through-live ★ / call / email), submit label per path ("Submit & Pick My Time"), success branching: book → calendar container (DAS_ICLOSED_URL, honest fallback while empty) / call → "Your phone's going to ring." / email → "It's with the team."
- api/contact.js: company-purchasing handler gains followUp → subject tags (· WANTS TO BOOK A CALL / · WANTS A CALLBACK) + "Requested Follow-up" as the FIRST row of the team email
- commit: "contact + purchasing: full ODNDR flow parity — grammar, skin, selector, confirmations" on main; deploy `vercel deploy --prod`
- tests/build: node --check green on backend + both pages' inline scripts; live probes post-deploy

## How it went
Grade: 4 — the scope insight kept this from tripling: grep proved the pricing gate's "Request Pricing" and "Learn More" CTAs all route to company-purchasing.html, so "five surfaces" is really two pages plus the gate's unchanged links. Placeholder-led inputs were applied to the contact form only; the procurement form keeps visible labels deliberately (15 fields incl. dates and billing contacts — placeholder-only would be hostile there), which is "same flow" not "same markup". The long-flagged dark-glow finding (navy hover halo) died properly in the redesign — neutral elevation shadow on both pages, no waiver.

One anchor assert fired on the first cp-redesign run (2-space vs 4-space indent guess); assert-before-write meant the file was untouched — fixed the anchor, all 16 edits applied atomically.

## Correction passes
1 (anchor indent, no file damage)

## Any errors
- cp-redesign.py anchor mismatch on `var ctxEl` indentation — caught by the count==1 assert BEFORE any write. status: recovered
