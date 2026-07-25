---
slug: lead-email-passthrough
job: 3
date: 2026-07-25
model: claude-opus-4-8
effort: unknown
---

# Touchdown — lead-email-passthrough #3

## Aim
Include the lead's email in both SMS-forward payloads so the GRIFFAIN OS portal lead record is complete.

## What it was told
Part of "onboard DAS fully into GRIFFAIN with a client portal" — the portal lead row needs the email the visitor already gave the form.

## What it did
`api/contact.js`: contact path forwards `email`, company-purchasing path forwards `workEmail` as `email`, to sms-service lead-ingest (which mirrors into griffain.app client_leads). Deployed to the `website` prod project.

## How it went
Grade: 5 — two-line change on a proven seam; verified via the sms-service E2E (mirrored OS row carried the email).

## Correction passes
0

## Any errors
None.
