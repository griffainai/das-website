# Image generation — credit budget and rules

Jayden 2026-09-24: *"please be wary of how many points we are using, be careful
and strategic to last all month."*

This file governs every OpenArt spend on DAS. Read it before generating.

---

## The balance

| | |
|---|---|
| Account | griffainai@gmail.com, **Pro** |
| Balance at 2026-09-24 | 24,000 |
| **Balance MEASURED 2026-09-25 (after the PDP shoot)** | **21,120** |
| Spent to date | **2,880** |
| Left for the rest of the month | **21,120** |

The whole DAS store shoot cost **6.7% of the month**.

> ⚠️ **The measured balance is the ground truth, not this table's arithmetic.**
> On 2026-09-25 the ledger said 23,520 and `openart_account_get` said 22,400 —
> a 1,120 gap. The cause is rule 3b below: **image2image is priced at 2× the
> text2image rate**, and every frame in this shoot was logged at the cheaper
> one. That accounts for most of the gap, not all of it; roughly 440 credits
> are unattributed and are NOT being invented into a line item here. Check the
> live balance before any batch — the doc drifts, the API does not.

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

## Rule 3b — image2image costs DOUBLE. Price it before you fire it.

`nano-banana-pro` **text2image** is 40 credits flat at 1K/2K/4K.
`nano-banana-pro` **image2image** at 4K 21:9 is **80**.

Rule 1b makes every product frame image2image, so the whole product programme
is priced at 2×. Twelve product frames is 960 credits, not 480. Call
`openart_model_cost` with the exact config before a batch — the price moves
with resolution, aspect and reference count, and the number in a doc is a guess
about the past.

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
| 2026-09-25 | image2image fidelity test — real Professional Driver Kit | nano-banana-pro i2i 4K 21:9 | 1 | 80 | 23,480 |
| 2026-09-25 | 5 collection banners — milepacks, onboarding, safety, milestone, holiday | nano-banana-pro i2i 4K 21:9 | 5 | 400 | 23,080 |
| 2026-09-25 | Reshoot — safety and milestone had bad references (a marketing layout and a "coming soon" card) | nano-banana-pro i2i 4K 21:9 | 2 | 160 | 22,920 |
| 2026-09-25 | Reshoot — milestone medal came back bronze, the real one is gunmetal | nano-banana-pro i2i 4K 21:9 | 1 | 80 | 22,840 |
| 2026-09-25 | **Reconciliation** — measured balance was 22,400, so ~440 credits are unattributed | — | — | 440 | **22,400** |
| 2026-09-25 | Badge fix — blank plate on appreciation; milepacks closed box | nano-banana-pro i2i 4K 21:9 | 2 | 160 | 22,240 |
| 2026-09-25 | **PDP elevated product heroes** — 2 treatment tests, 9 batch, 2 reshoots | nano-banana-pro i2i 4K 4:5 | 13 | 1,040 | 21,200 |
| 2026-09-25 | Appreciation blank-plate reshoot (the gibberish badge) | nano-banana-pro i2i 4K 21:9 | 1 | 80 | **21,120** |

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

**What it actually cost.** Twelve frames were budgeted at 480. The shoot
delivered six parallax masters and six collection banners in **fifteen** frames
for **1,600** — three reshoots (two wrong references, one wrong metal finish)
and the 2× image2image rate that rule 3b now states.

Measured balance **22,400**: roughly 280 more image2image frames at 4K, 560
text2image, 1,490 on Wan 2.7 Image, or about 50 short videos.

### The PDP shoot, costed against its estimate

Quoted at ~10 frames / 800 credits. Delivered 10 heroes for **1,040** across 13
frames: two treatment tests (the first framed the product too small and
carried a misspelled badge), nine in the batch, and two reshoots — one that
carried a DAS logo watermark through from its reference, one that kept the
reference's amber spotlight instead of the studio sweep.

Two further frames FAILED and appear not to have been charged; neither is in
the ledger because the balance does not show them:

- a reference URL whose content hash I guessed rather than read from the
  catalogue — `URL_ERROR-ERROR_NOT_FOUND`. Read the path out of
  `store-catalog.json`; never construct one.
- `Content Policy Violation` on a prompt that said a watermark "must NOT
  appear" — asking a model to remove a watermark reads as exactly that. Say what
  the scene DOES contain instead: "all four corners are plain empty sweep."

### Still unshot, and what it would cost

| Job | Frames | Credits |
|---|---|---|
| Store hero + PDP closing band — one forest photo is currently doing three jobs | 2 | 160 |
| The remaining 44 PDPs still padded into 4:5 | ~30 | 2,400 |

⛔ The **Executive Collection is deliberately NOT on this list.** Its six
products are YETI gear, and a generated YETI wordmark is a garbled third-party
trademark on the most expensive pages in the store ($799–999). Its current PDP
heroes are finished ads — headline, body copy, feature icons and a **SHOP NOW
button** — so they do need replacing, but by CROPPING the product out of those
layouts, which costs nothing and keeps the real product exactly as photographed.

Neither is authorised. Ask before firing.
