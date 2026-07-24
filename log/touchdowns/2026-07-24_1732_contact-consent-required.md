---
slug: contact-consent-required
job: 1
date: 2026-07-24
model: claude-opus-4-8
effort: unknown
---

# Touchdown — contact-consent-required #1

## Aim
Make SMS consent required (not "optional") on the contact + company-purchasing forms, reworded so submitting the form is the act of consent — without breaking the T-Mobile-approved 10DLC registration.

## What it was told
"Change that 'Text me about my request' is optional. It's not optional — reword the framing so if they fill out this form, they're submitting and accepting we'll text them." (User later chose, via a clarifying question: SMS-only — no voice/AI-call consent; and keep a required checkbox rather than pure submission-consent, so no campaign re-file.)

## What it did
- `contact.html` + `company-purchasing.html`: relabel the consent checkbox from "Text me about my request (optional)" → "Yes — contact me about my request"; add `required` + `aria-required`; add explicit JS validation (native `required` is bypassed by `preventDefault()`), showing an inline error + scroll-to if unchecked; keep the box UNCHECKED by default and all registered disclosures (STOP/HELP, frequency, rates, SMS Terms/Privacy). Updated the logged `smsConsentText` proof to match the new "By submitting this form…" wording.
- commits: "compliance(sms): make contact consent required…" (`d847894`) and the phrase fix "keep 'condition of purchase' verbatim" (`051ade6`) on main, parent of this record `051ade6`.
- tree clean · deployed to the `website` prod project · live /contact + /company-purchasing verified (new wording, `required` present, no "optional") · `check-10dlc-compliance.mjs` GREEN against the live site.

## How it went
Grade: 4 — landed the change cleanly and kept the hard-won carrier approval intact by making a deliberately conservative choice, but I nearly shipped a phrase edit that would have silently failed the compliance gate.

The judgment call was the whole job. The literal ask ("submitting = consent, and it's not optional") points at pure submission-consent with no checkbox — but the 10DLC campaign, rejected twice before and only just approved, is registered with the opt-in described as an "unchecked consent box," and the gate script inspects the live /contact for that. Ripping the checkbox out would drift the live site from the registration and demand a re-file (re-approval risk). So I surfaced the two consequential forks to the user (channel scope; checkbox-vs-submission + re-file) rather than guessing, and they chose SMS-only + keep-a-required-checkbox. That answer is the safe sweet spot: a checkbox that is unchecked-by-default (still matches the registered "unchecked consent box") but now REQUIRED to submit and reworded away from "optional" — which satisfies the user's intent without touching the registration at all. No re-file, no carrier risk.

The near-miss: I first reworded the disclosure to "not a condition of any purchase," which reads slightly better — but the compliance gate greps `/condition of purchase/i` and, more importantly, the carrier approved the exact phrase "condition of purchase." Inserting "any" broke the contiguous match and drifted from the approved copy. I caught it by reading the gate script's actual regex before trusting the deploy, then restored the verbatim phrase and re-verified the gate GREEN against the live site. Lesson reinforced from this repo's history: the registered/approved strings are load-bearing literals — never casually improve their wording.

One subtlety worth recording so it isn't second-guessed later: "consent is required to submit this form" and "consent is not a condition of purchase" are NOT contradictory — the contact form's whole purpose is to be contacted, so consent gates the FORM; buying products never requires the form, so it's not a condition of PURCHASE. Both statements are true and both stay on the page.

## Correction passes
1 (the "condition of any purchase" → verbatim "condition of purchase" fix, caught pre-verification)

## Any errors
- Reworded the required disclosure to "not a condition of any purchase," which breaks the compliance gate's `/condition of purchase/i` match and drifts from the T-Mobile-approved phrase. Caught by reading the gate regex before trusting the first deploy; restored verbatim and re-verified gate GREEN + live pages. status: recovered
- Native `required` on the checkbox is inert because the submit handler calls `preventDefault()` and the existing `[required]` loop checks `.value` (always truthy for a checkbox). Added an explicit checked-state guard on both forms. status: recovered
