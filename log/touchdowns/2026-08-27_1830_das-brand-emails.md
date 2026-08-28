---
slug: das-brand-emails
job: 19
date: 2026-08-27
model: claude-fable-5
effort: unknown
---

# Touchdown — das-brand-emails #19

## Aim
Brand-grade emails: one visual system across every customer email.

## What it was told
"We need better branding emails" — after the test send proved the plumbing but exposed generic design.

## What it did
- files changed: `E:/Workspaces/das/web` lib/email-brand.js (new shared shell), api/newsletter-subscribe.js, api/contact.js (both acks), lib/order-emails.js (shell swap), images/email/ (wordmark PNG + 3 hero JPEGs)
- commit: das/web "brand-grade emails: one shell, three templates, the whole identity in the inbox"
- tree: clean
- tests/build: pixel-rendered the welcome before shipping; live test sent to griffainai@gmail.com via Resend (id 60615acf…), delivery status polled

## How it went
Grade: 4.5 — a design-system move, not a template edit, and the inbox constraint was treated as a first-class rendering target.

The insight that shaped it: email is a rendering environment where the brand's two pillars (Anton, the sprite drawings) both need to become PIXELS — the wordmark ships as a rendered PNG because webfonts are untrustworthy in clients, and the illustrations were already PNGs from the last round. Everything else maps 1:1 from the site: navy hero gradient (with bgcolor fallback), brass eyebrow, the engraved brass rule as a gradient td, catalog photos cut to dedicated 1200px email JPEGs, navy block CTAs. One brandShell() with two content modes (bodyRows for div-flow templates, tableRows for the receipt's row-based builder) means the next email is a 10-line call, not a 100-line handcraft.

Two scope catches during the refactor: the contact acks' battle-tested COPY (firstName/ackLede/ackNext per-intent variants) was preserved inside the new frame — better branding must not cost conversion copy that already works; and my template guessed variable names twice (contactName vs firstName) — caught by grep-the-scope before any send, the cheap discipline that beats a runtime ReferenceError in a serverless function.

## Correction passes
2 — the two variable-scope fixes, both pre-send.

## Any errors
- Template referenced out-of-scope variable names in both contact acks (guessed instead of read): status: recovered
