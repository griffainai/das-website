---
slug: p0-money-exposure
job: 5
date: 2026-08-20
model: claude-fable-5
effort: unknown
---

# Touchdown — p0-money-exposure #5

## Aim
Kill the two P0s from the full-site audit before tonight's hardening pass: the $1 live-payment test still purchasable in production, and internal files publicly downloadable.

## What it was told
Jayden's standing order for the audit: "You should be looking for bugs, and once you find it, fix it, then move on." The audit agent found the Holiday Gift Set live at $1.00/unit (a forgotten live-payment test with inline REVERT instructions) and the repo's log/, supabase/ migrations, internal/, and ops docs all fetchable from the production domain (outputDirectory "." serves everything).

## What it did
- `lib/catalog.js`: das-004 basePrice 1.00 → 54.99 + `unavailable: true` restored (the file's own REVERT comment executed)
- `product.html`: PDP price 54.99 + seasonal `availability: 'coming_soon', availableDate: 'September 21'` restored
- `shop.html`: card data-price + visible $1.00 → $54.99; JSON-LD price corrected on shop + 3 SEO landing pages (Google was being fed the $1 offer)
- `.vercelignore`: + log/, supabase/, internal/, *.md, SEO brief, package files
- commit + `vercel deploy --prod`

## How it went
Grade: 4 — the inline REVERT comments made the price restore mechanical rather than judgment-laden; the audit's file:line pointers were all accurate. The deeper price-authority hole (unknown-SKU $0.50 pass-through in create-checkout/create-payment-intent) is NOT fixed here — it needs DB-priced verification against das_products and belongs in tonight's pass, not a rushed patch on live payment code.

## Correction passes
0

## Any errors
none at commit time; live verification (shop shows 54.99 / internal files 404) post-deploy. status: open
