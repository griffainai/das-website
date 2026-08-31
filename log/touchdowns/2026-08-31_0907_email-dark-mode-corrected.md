---
slug: email-dark-mode-corrected
job: 12
date: 2026-08-31
model: claude-opus-5
effort: high
---

# Touchdown — email-dark-mode-corrected #12

## Aim
The hero was still grey in Jayden's inbox after I "fixed" it. Find out why, and check the company
survey flow he had not seen.

## What it was told
"the 'Thank you for answering' email still has the gray 'Thank you for answering' header. Same
with the description… look at all the emails and fix it." Plus: check the company flow and hand
over the access code.

## What it did
- pulled the ACTUALLY DELIVERED html back from Resend: the fix was present, the inline colour was
  `#ffffff`, and it still rendered grey — so the fix was wrong, not missing
- `lib/email-brand.js` — reversed `color-scheme: light dark` to **light only**
- `lib/order-emails.js` (13) + `api/admin-orders.js` (4) — `#9CA3AF` labels, **2.54:1 on white,
  failing WCAG AA**, raised to `#5A6478` at 5.95:1
- company flow verified end to end at 390x844
- commit: "email: I opted INTO the dark mode I was trying to prevent"
- tests 93/93 · all email builders parse · a rendered email asserted clean

## How it went
Grade: 3 — I shipped a fix that plausibly made the thing worse, and only reading the delivered
bytes showed it.

**The diagnosis I got wrong.** My first pass declared `color-scheme: light dark`. I wrote a
confident comment saying this "tells the client the email handles its own colours, which stops the
blunt auto-inversion." That is backwards. `light dark` is an **opt-in**: it advertises that the
email ships a dark palette. It does not ship one. So a client that would otherwise have left the
email alone was invited to apply its own dark treatment, and dimmed white hero text to grey. The
correct claim is `light` — *this email is light-scheme, do not transform it.*

The only reason I found it: pulling the sent HTML out of Resend and confirming the markup was
already `color:#ffffff`. Correct source plus wrong output means the fix is wrong, not absent. Had I
re-read my own CSS I would have found nothing, because the CSS was doing exactly what I told it to.

**A near-miss that would have taken every email down.** The explanatory comment I added sits inside
a JS **template literal**, and I wrote `` `light dark` `` in backticks. That terminates the string.
`node --check` caught it — `SyntaxError: Unexpected identifier 'light'` — before it ever ran. Had I
skipped that check, `lib/email-brand.js` would have failed to load and **every email the site sends**
— orders, contact, portal, surveys — would have thrown. A prose comment took out the module that
sends the money emails.

**The genuine second finding.** He said "look at all the emails", so I measured rather than
skimmed: `#9CA3AF` is used for the "Billing / Shipping / Item / Qty" labels in real order
confirmations at **2.54:1 contrast on white — failing AA outright**. That is not a dark-mode issue
at all; those labels have been hard to read in every client, in every mode, since they were
written. 17 of them, now 5.95:1.

Company flow checked at 390x844: code screen, five identity fields (no overlap), decision tiles,
and both matrices — the workstream grid and the 7-row census — all stack to a single column with
319x53 inputs and no horizontal overflow.

## Correction passes
3

## Any errors
- **The original dark-mode fix was backwards** (`light dark` opt-in). status: recovered
- **Backticks inside a template literal** would have broken every email. Caught by `node --check`.
  status: recovered
- Ran `getComputedStyle` on a detached iframe earlier and got `""` back, nearly logging it as
  "unset". status: recovered

## Honest limit
Gmail ignores `color-scheme` entirely and transforms anyway; `[data-ogsc]`/`[data-ogsb]` are the
only handle and they are not guaranteed. **If the hero still reads grey after this, CSS is not
going to fix it** — the reliable move is structural: a LIGHT hero, navy text on white, which every
dark-mode client inverts cleanly. White-on-navy is the exact case they all mangle. That is a brand
change to every DAS email and it is Jayden's call, not mine.
