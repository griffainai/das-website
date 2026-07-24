---
slug: quote-form-speed-to-lead-context
job: 2
date: 2026-07-24
model: claude-opus-4-8
effort: unknown
---

# Touchdown — quote-form-speed-to-lead-context #2

## Aim
Make the request-a-quote form (company-purchasing) forward the FULL quote context to the SMS
concierge, so the speed-to-lead first touch is specific to what the buyer requested — not the same
generic opener the plain contact form gets.

## What it was told
"The contact page and the request-pricing/quote form are different, so speed-to-lead needs to be on
the quote forms too — and when they request a quote the AI should know exactly what they want based
on what they put, and be more direct."

## What it did
- `api/contact.js`, `handleCompanyPurchasing` SMS-forward block: it was passing only
  phone/firstName/company/fleetSize to lead-ingest, discarding productInterest, estQuantity,
  numDrivers, needs, targetDeliveryDate, category, notes. Now builds and forwards a `quote` object
  with all of it, plus `interest` = the product and `fleetSize` = driver count.
- Contact-form path: now also forwards the picked `program` as `interest`, so a contact lead who
  named a program gets a warmer opener too.
- (The concierge-side personalization — composeFirstTouch + agent context + the empty-reply retry/
  non-repeating fallback — lives in the das/sms-service repo; recorded there. This repo only owns
  the payload the form sends.)

Verified via a direct POST of the exact company-purchasing payload to the live /api/contact → 200,
and the personalized first-touch landed in the sms-service Supabase referencing the product, driver
count, and Net-30. Consent-required gate on the quote form confirmed (unchecked → blocked). Deployed
to the `website` prod project.

## How it went
Grade: 4 — small, correct plumbing change with live proof; the leverage is high because a quote lead
is the hottest lead on the site and was getting a cold generic text. Docked one only because the two
repos have to move together for the feature to work end-to-end (payload here, personalization there),
so neither touchdown tells the whole story alone — noted the split explicitly.

The gotcha worth recording: company-purchasing is a SEPARATE form from contact, posting a different
field set (productInterest/estQuantity/numDrivers/needs), and it routes through the SAME /api/contact
via `formType: 'company-purchasing'`. The SMS forward already existed but silently dropped the rich
fields — easy to miss because it "worked" (a text sent), just generically. The fix is to carry the
context the buyer already gave.

## Correction passes
0 (single change; the personalization-logic corrections are in the sms-service record)

## Any errors
- Browser-driven submit of the quote form didn't fire (query-string data guard on the JS read +
  late network tracking). Fell back to a direct live POST, which cleanly proved the endpoint +
  forward + personalized SMS. status: recovered
