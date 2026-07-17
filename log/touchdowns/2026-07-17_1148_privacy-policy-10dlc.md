---
slug: privacy-policy-10dlc
job: 1
date: 2026-07-17
model: claude-opus-4-8
effort: n/a
---

# Touchdown — privacy-policy-10dlc #1

## Aim
Give the DAS site a real privacy policy so the 10DLC SMS campaign can pass carrier review (both DAS campaigns had failed; missing privacy policy was a root cause).

## What it was told
Fix the DAS privacy policy and SMS opt-in so 10DLC can be re-filed and pass this time.

## What it did
- files changed: NEW `privacy.html`; repointed "Privacy Policy" links `legal.html`→`privacy.html` in 5 files (index, contact, company-purchasing, signup, sms-terms); added a Privacy Policy footer link across 45 pages.
- commit: "feat(legal): real privacy policy at /privacy for 10DLC + repoint links" on main, parent 4bb5277
- tree: clean after commit
- tests/build: n/a (static HTML). Verify /privacy=200 live after Vercel auto-deploy.

## How it went
Grade: 4 — the real value was correcting my own earlier false diagnosis before building on it.

Two of my prior curl-based findings (recorded in the agency repo's 10DLC-COMPLIANCE-GATE.md) were imprecise and I corrected them here against the source, not the doc: (1) I claimed the mandatory "never sold/shared" clause was absent — it was actually present on sms-terms.html §8; my regex searched for "sold/shared" while the copy says "sell, rent, or share." (2) I claimed no privacy policy existed anywhere — closer to true than the clause point, but the nuance is that a page LABELED "Privacy Policy" does exist and is linked 6×… it just points to `legal.html`, which is an Export-Restrictions page with zero privacy content. So the true defect was narrow and exact: no real privacy policy + every "Privacy Policy" link misrouted to the export page + `/privacy` 404.

The opt-in CTA turned out already compliant (contact.html: unchecked box, purpose, "not marketing", frequency, rates, STOP/HELP, consent-not-a-condition) — its only flaw was the same misrouted privacy link. So the fix was: build a genuine privacy.html (cloned the sms-terms.html template exactly, so the color-system landmine — `--black`=#FFF, `--gold`=#1A2E6E navy, inverted on purpose — is handled the same proven way), repoint the "Privacy Policy" labeled links only (leaving the legitimate footer "Legal / Export" → legal.html untouched), and add a footer privacy link sitewide.

Biggest remaining lever is NOT a site fix: the campaign was filed MIXED/MARKETING but the site (and now the privacy policy) consistently says CUSTOMER_CARE. Re-file as CUSTOMER_CARE to match. That's a filing decision for Jayden at re-file time; flagged in the agency STATE + compliance gate.

Scope: stayed in the DAS web repo. Did not touch the Telnyx campaign (portal login-walled; and re-filing is gated on this deploy going live + the exact portal failure strings, per the compliance gate).

## Correction passes
2 — (a) an earlier verification command with a per-file grep loop timed out; re-ran with simpler targeted greps. (b) corrected my own two imprecise findings from the prior turn, above.

## Any errors
- Self-inflicted false diagnosis (clause "absent"; "no privacy policy anywhere") from imprecise curl greps in the prior turn — caught by reading the actual source files this turn, corrected before building. status: recovered
- Verification bash loop over *.html hung/timed out twice (per-file grep in a loop). Switched to `grep -rc … | awk`. status: recovered
- Telnyx portal still login-walled + tab wedged earlier — exact per-campaign failure-reason strings still not pulled; the re-file is gated on getting them + this deploy verifying live. status: open
