---
slug: das-email-v2-contrast
job: 20
date: 2026-08-27
model: claude-fable-5
effort: unknown
---

# Touchdown — das-email-v2-contrast #20

## Aim
Email v2 on Jayden's inbox verdict: gray unreadable text, and the illustrations don't belong in email.

## What it was told
"The email text is gray and you can't even see it… make the text more visible. We don't even need the illustrations in the email."

## What it did
- files changed: `E:/Workspaces/das/web` lib/email-brand.js (strip removed, contrast up), api/newsletter-subscribe.js, api/contact.js
- commit: das/web "email v2 per Jayden: illustrations out, text you can actually read"
- tree: clean
- tests/build: pixel re-render, deployed, live test delivered (Resend id f5c8eb2a…)

## How it went
Grade: 4 — the shell paid for itself on its first revision: one edit, three templates fixed.

Two lessons banked. First, the contrast one: 12–13px #67718A muted gray is a WEBSITE token — on a phone inbox in daylight it reads as invisible. Email body floor is now 14–16px in near-black ink (#0B1020/#1F2937); muted grays in email are for nothing more important than the unsubscribe line. Second, the owner's eye beat the design instinct on the illustrations: in the site's fields they're texture at 5%, but printed small and solitary in an email they read as clip-art. Removed entirely — the brass rule alone is a cleaner brand signature in the inbox. The site keeps its drawings; the email keeps its type, photo, and brass.

## Correction passes
0 in-round.

## Any errors
- none
