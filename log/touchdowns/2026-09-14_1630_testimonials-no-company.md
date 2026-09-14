---
slug: testimonials-no-company
job: 1
date: 2026-09-14
model: claude-opus-5
effort: unknown
---

# Touchdown — testimonials-no-company #1

## Aim
Remove company names from the homepage "Client Results / What fleet operators say" testimonials, keeping name and title.

## What it was told
"On the driver appreciation slide for the client results, what fleet operators say, you need to get rid of their company and just say their title and name."

## What it did
- files changed: index.html (the tst-mq marquee: 4 cards × 2 copies for the loop = 8 role lines)
- commit: "Testimonials: name and title only, no company" on main
- tree: other paths untouched
- tests/build: the string check shows 0 remaining company names; the UTF-8 BOM is preserved (read/write byte-aware, after the BOM-stripping incident on 09-13)

## How it went
Grade: 4 — exact-string replacement, 8 occurrences.

Before → after:
- Fleet Operations Manager · Pacific Freight Co. → Fleet Operations Manager
- Director of Driver Relations · Midwest Transport LLC → Director of Driver Relations
- HR Director · Southwest Logistics Group → HR Director
- VP of Operations · Eagle Ridge Carriers → VP of Operations

Names, initials avatars, quotes and metric chips are unchanged, as asked.

⚠️ Flag for Jayden: these quotes carry specific claims ("+18% 5-year driver retention", "120-driver fleet"). Workspace rule 21b says a quote goes up only when the client actually said it. No source for these four is recorded here; if they aren't real, removing the company doesn't make them honest. Left as instructed.

## Correction passes
0

## Any errors
none
