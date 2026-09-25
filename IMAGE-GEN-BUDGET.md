# Image generation — credit budget and rules

Jayden 2026-09-24: *"please be wary of how many points we are using, be careful
and strategic to last all month."*

This file governs every OpenArt spend on DAS. Read it before generating.

---

## The balance

| | |
|---|---|
| Account | griffainai@gmail.com, **Pro** |
| Balance at 2026-09-24 | **24,000** |
| Spent so far | **480** |
| This shoot, budgeted | **480** production + 160 contingency = **640** |
| Left for the rest of the month | **23,520** |

The whole DAS store shoot costs **2.7% of the month**. That is only true because
of rule 1.

---

## Rule 1 — one photograph, many placements. Never regenerate a crop.

**This is the rule that saves the money.** The naive plan was 18 generations:
six programs × (desktop panel + mobile panel + banner). That is 720 credits and
it is also *wrong*, not just expensive — see the mobile section below.

Instead: generate a **portrait master** per program and cut every placement out
of it with `sharp`, which costs nothing.

| Placement | Size | Cut from the master |
|---|---|---|
| Parallax mobile | 1920 × 2364 | almost the whole frame |
| Parallax desktop | 1920 × 1080 | a wide band through the middle |
| Collection banner | 2400 × 820 | (separate master — different register) |

**12 generations instead of 18. 480 credits instead of 720.**

## Rule 1b — for PRODUCTS, use image2image against the real photograph

Jayden 2026-09-25: *"use references of our real products... take the photo, copy
it, put it in OpenArt, say use this exact product, one by one, pixel by pixel.
Nothing should change. Use the same logos. We've done this before for ODNDR."*

Scenery can be generated from nothing. **A product cannot.** A generated case is
a case that does not exist, on a page where somebody is buying — the same class
of problem as Scout naming a SKU we do not sell. So every product frame is
image2image with the real packshot as a visual reference, and the prompt changes
only the LIGHT, the SURFACE and the ANGLE.

The reference is passed by live URL from the production site, so the model sees
exactly what customers see.

## Rule 2 — always test one frame before a batch

40 credits to find a problem, versus 480 to find it twelve times. This is the
lesson from the Pinch shoot: *run one test frame on the hardest art first.*

The very first DAS test frame earned its cost immediately — it proved the sky
was too bright for white type (17.7% of the type band above 200 luminance) and
that a 16:9 master cannot yield a usable phone crop.

## Rule 3 — always ask for 4K on flat-priced models

Nano Banana Pro bills **40 credits at 1K, 2K or 4K — the same**. Wan 2.7 Image
bills flat too. Asking for less than 4K costs the same and throws away the
pixels that make rule 1 possible. A bigger master is more placements per credit.

## Rule 4 — pick the model for the job, not by habit

| Model | Credits | Use it for |
|---|---|---|
| Kling 3 Omni | **10** | bulk, backgrounds, texture, anything not hero |
| Wan 2.7 Image | **15** | 4K flat-priced, strong text — the budget workhorse |
| Seedream 4.5 / 5 Lite | 15 | illustration, anime, stylised — not photoreal |
| Nano Banana 2 | 20 | realistic people, 4K, cheaper than Pro |
| Seedream 5 Pro | 30 | stylised premium |
| **Nano Banana Pro** | **40** | **hero photoreal people + the only 21:9. This shoot.** |
| GPT Image 2 / 2.5 | 40–42 | luxury product hero, precise in-image text |

Nano Banana Pro is 2.7× the price of Wan 2.7 Image at the same 4K. It is worth
it for the eighteen frames a customer actually looks at. It is not worth it for
a background texture.

## Rule 5 — video is 5–11× the price of an image. Treat it as a separate decision.

The cheapest video on the account is 50 credits (PixVerse V6); the good ones are
250–450. **One Seedance 2.0 clip costs more than this entire photoshoot.** Never
generate video without asking Jayden first.

## Rule 6 — log every spend below

---

## Ledger

| Date | What | Model | Frames | Credits | Balance after |
|---|---|---|---|---|---|
| 2026-09-24 | Test frame — appreciation, 16:9 golden hour | nano-banana-pro 4K | 1 | 40 | 23,960 |
| 2026-09-24 | **6 portrait masters** — the parallax shoot, one per program | nano-banana-pro 4K 4:5 | 6 | 240 | **23,720** |
| 2026-09-24 | Banner attempt, off-brief (fired before Jayden finished) | nano-banana-pro 4K 21:9 | 1 | 40 | 23,680 |
| 2026-09-25 | Treatment comparison — bold / legible / bold-at-banner | nano-banana-pro 4K | 3 | 120 | 23,560 |
| 2026-09-25 | image2image fidelity test — real Professional Driver Kit | nano-banana-pro 4K 21:9 | 1 | 40 | **23,520** |

The six masters produced **twelve** live placements (desktop + mobile per
program) at no extra credit cost, and are archived as q95 webp in
`images/shoot/masters/` so any re-crop is free forever. Re-cutting is
`node scripts/cut-shoot.mjs` — adjust `band` and `pan` per program and run it.

---

## Costed plan for the rest of this shoot

| Batch | Frames | Credits |
|---|---|---|
| 6 cinematic portrait masters (parallax — serves both desktop and mobile) | 6 | 240 |
| 6 clean-premium 21:9 masters (collection banners) | 6 | 240 |
| Contingency — reshoots at ~4 frames | 4 | 160 |
| **Total** | **16** | **640** |

Against 24,000, that leaves **~23,320 for the rest of the month.** If nothing
else is planned, that is roughly 580 more Nano Banana Pro frames, or 1,550 on
Wan 2.7 Image, or about 50 short videos.
