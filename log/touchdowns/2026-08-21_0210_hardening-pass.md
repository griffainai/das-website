---
slug: hardening-pass
job: 7
date: 2026-08-21
model: claude-fable-5
effort: unknown
---

# Touchdown — hardening-pass #7

## Aim
The full hardening pass from the 27-finding audit (P0-3 through the P2 batch), plus the mid-flight email-rebrand order.

## What it was told
Jayden: "do the full DAS hardening pass" — and mid-turn: the auto-responder said "regarding general" (raw select value in customer copy) and neither brand's emails were branded; rewrite with Hormozi-grade copy.

## What it did
SECURITY/MONEY: create-checkout + create-payment-intent — unknown-SKU items now priced against das_products (client price accepted only in the legit 10–15% discount window; unknowns rejected; infra-blip fallback to the old floor, loudly logged). lib/catalog resolve() pins tier-suffixed ids to exactly their tier's price (das-001-premium can no longer check out at standard) and returns a server-derived line-item name checkout now uses. Rate ceilings (api/_rate.js helper, per-instance speed-bump doctrine) on contact, newsletter, submit-quote (+ name/email validation on the anonymous path), pricing-unlock. CORS '*' fallback replaced with the .com origin in 6 endpoints. Stripe/internal error messages no longer leak (payment-intent + 2 portal paths). XSS: 9 unescaped interpolations in account.html (templates/programs/roster incl. the onclick-confirm vector/tickets/ideas/avatar), auth.js avatar, chat quote card Number()-coerced.
STRUCTURE: api/firebase-config.js + api/supabase-config.js deleted (dead; 12/12 → 10/12 function slots), 6 dead solution-*.html deleted, webhook express-orders now recover line items from PI metadata (was items:[]), durable Stripe coupon (das-bundle-15) instead of minting one per checkout, dead das-portal-ten fallbacks removed from chat.js (quote failures now retry once then SURFACE with contact info; support@ → info@).
SEO/UX: blog canonicals vercel.app → .com (60 URLs), das-006 JSON-LD 79.95 → 99.00 (4 pages), blog css v12 → v13, cart.js versioned on 43 pages, sitemap (6 query-URL rows dropped, 4 pages added, lastmod refreshed, XML-validated), mobile drawer added to the 2 pages whose hamburger did nothing, cart line ops keyed by index (milestone kits no longer collide).
EMAILS: PROGRAM_LABELS map kills "regarding general"; contact ack + purchasing ack rebuilt — DAS navy-branded shell, follow-up-aware Hormozi copy (outcome lede, concrete next step + time window, turnover-math PS, single phone CTA), sharper subjects. ODNDR demo confirmations: subjects punched up + phone CTA becomes a button (they were already branded).

## How it went
Grade: 4 — the audit's file:line map made this an execution run, and every finding was re-verified in source before editing (all anchors matched except one). Deliberately NOT done: GA4/GTM (needs Jayden to create the property), Unsplash product-image self-hosting (needs real assets), the express-checkout re-enable decision, and full meta-description sweep — reported, not silently skipped.

## Correction passes
1 (account.html XSS batch: the roster-onclick anchor's escaped quotes didn't match byte-for-byte — assert aborted before write, redone as a regex; also the first email-rebrand heredoc died on bash quoting and moved to a scratchpad script, no file touched)

## Any errors
- bash heredoc EOF error on the email script (quote collision) — moved to scratchpad file per standing practice. status: recovered
- exact-match anchor failure on the onclick edit — caught by count==1 assert pre-write. status: recovered
