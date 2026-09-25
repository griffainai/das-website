# DAS store photography — art direction

Locked with Jayden 2026-09-24. Every decision below is his, from the interview.
This is the brief the eighteen generated frames are shot against, and the recipe
for reshooting any of them.

Brief: *"make sure this DAS photoshoot looks like a 10 million dollar photoshoot
from a top ecom brand."*

---

## The two registers

Half cinematic documentary, half clean premium ecom, **split by slot type** —
so each register does the job its slot actually needs.

| | CINEMATIC DOCUMENTARY | CLEAN PREMIUM ECOM |
|---|---|---|
| Slots | 6 parallax panels (12 frames) | 6 collection banners (6 frames) |
| Sizes | 1920×1080 + 1920×2364 | 2400×820 |
| Why | Fills a whole screen with white type over it — needs scale, sky, air | Sits tighter with type to the left — needs calm and control |
| Figure | Mid-to-small in frame, environment around them | One figure, close, generous negative space |
| Feel | Ram / Ford Super Duty crossed with Carhartt crew films | Everlane / Arc'teryx portraiture — premium, restrained, still human |

**The tension, resolved.** "Clean premium ecom" normally means no people. Jayden
also chose drivers as the hero. So the banners are clean-premium *with a single
figure* and large negative space — not empty product still-lifes.

One shared grade across both registers so eighteen frames read as one shoot.

---

## Light — split by program

| Blue hour → dawn | Golden hour |
|---|---|
| Safe Miles Programs | Driver Appreciation Kits |
| Onboarding Solutions | Service Milestone Awards |
| Safety Recognition | Holiday & Seasonal |

**Blue hour:** cold blue ambient (#0A1334 family), warm 3200K practicals — cab
lights, headlamps, terminal sodium. High contrast, protected mids.

**Golden hour:** low amber key, soft blue fill, rim light on shoulders and
chrome. Medium contrast, glowing edges.

**Shared:** same contrast curve, navy in the shadows, filmic falloff, no blown
highlights, no crushed blacks.

---

## Casting — a range that mirrors a real fleet

Not a stock library. 30s through 60s, men and women, mixed ethnicity, real
builds. Weathered hands, real workwear, nobody model-pretty. **Nobody smiles at
camera. No thumbs-up.** Milestone skews older because a 3-million-mile driver is.

## Equipment — mixed fleet types

Authenticity check: a driver spots wrong equipment instantly.

**Always:** unbranded. No carrier livery, no readable DOT numbers, no company
names. A visible logo either implies a client that doesn't exist or shows a
competitor's fleet.

---

## Product — suggested, never detailed

A closed case under an arm. A medal catching light, too tight to read. A branded
box on a seat, back turned. **Present but never legible**, so a scene can never
contradict what actually ships, and stays true when the catalogue changes.

The 54 real packshots do the specifics. Nothing generated depicts merchandise.

---

## The six programs

| Program | Light | Equipment | The shot |
|---|---|---|---|
| **Driver Appreciation Kits** | Golden | Dry van | 40s man, beard, flannel over hi-vis, walking back along the trailer, closed case under his arm |
| **Safe Miles Programs** | Blue hour | Reefer | 30s woman, ponytail, safety glasses, dawn pre-trip, breath visible, clipboard |
| **Onboarding Solutions** | Blue hour | Day cab | 20s new hire and 50s trainer shaking hands at the gate |
| **Safety Recognition** | Blue hour | Flatbed | Hands only, 50s, scarred knuckles, straps and chains, a pin being received |
| **Service Milestone Awards** | Golden | Sleeper | 60s man, grey, quiet pride, a medal, long-haul |
| **Holiday & Seasonal** | Golden | Dry van | 40s woman, coat, porch light, box in hand, home |

---

## The rules every frame obeys

1. **Keep the middle quiet.** Parallax type sits centred from roughly 40% to 75%
   of frame height. No faces, no hard highlights, no busy detail in that band.
   Banner type sits on the **left third** — keep that side clean.
2. **Expose about a stop under.** The type is white with no scrim. A bright frame
   eats it. Every reference panel is darker than neutral.
3. **Two crops per program, composed for both.** 1920×1080 and 1920×2364. A
   landscape frame cropped to a phone panel keeps only its middle 28% — so the
   subject must survive a tall centre crop.
4. **Nothing legible, anywhere.** No text, no logos, no watermarks, no numbers.
5. **Leave the edges boring.** The frame is cropped differently at every viewport
   width. What must be seen lives in the middle 60%.

---

## Production — one photograph, every placement

**The mobile problem, and why it is not a sizing problem.**

The obvious plan was to generate a landscape frame for desktop and a tall frame
for mobile. That is wrong twice over.

1. **Two generations are two different photographs.** The same program's desktop
   and mobile panels would show a *different driver and a different truck*. The
   panel would visibly change identity when you rotate the phone or resize the
   window. No amount of sizing fixes that.
2. **A landscape master cannot yield a phone crop.** 1920x2364 is 0.812; cutting
   that out of a 16:9 frame keeps only **45% of the width**. The test frame
   proved it: the crop is technically fine but the trailer the driver is walking
   along — the entire story — is gone. On the onboarding handshake it would cut
   one of the two people out of frame.

**So the master is PORTRAIT, and every placement is cut out of it.**

```
        4:5 MASTER  (nano-banana-pro, 4K)
   +---------------------------------+  <- sky. mobile keeps this
   |                                 |
   |   ...........................   |  <- 16:9 desktop band
   |   .                         .   |     cut through the middle
   |   .    THE STORY LIVES      .   |
   |   .    IN THIS BAND         .   |  <- 21:9 / banner band
   |   .                         .   |     sits inside it
   |   ...........................   |
   |                                 |
   +---------------------------------+  <- ground. mobile keeps this
```

| Placement | Size | Cut |
|---|---|---|
| Parallax mobile | 1920 x 2364 | nearly the whole master, trimmed to 0.812 |
| Parallax desktop | 1920 x 1080 | a 16:9 band through the middle |

Same photograph, same driver, same light at every breakpoint — because it *is*
the same photograph. This is how campaigns are actually shot: loose, then cropped
per placement.

**Composition rule this creates:** the story must read inside the central
horizontal band, with sky above and ground below that exist only to extend the
frame for the tall crop. Nothing essential in the top or bottom fifth.

The six collection banners stay separate generations at 21:9 — they are the
*clean premium* register, a different photograph by design, not a crop of the
cinematic one.

---

## Exposure — settled by measurement, then made irrelevant

The first test frame measured **17.7% of its type band above 200 luminance**.
White type would have dropped out over the bright sky.

Two fixes, both applied:

1. **Direct darker frames.** Deep dusk sky, not bright haze. Sun low and raking,
   horizon high so the type band falls on asphalt and vehicle rather than sky.
2. **A scrim in the CSS** (`.px-panel::after`) — a soft ellipse through the
   middle plus a touch at the top and bottom edges. Measured on the test frame:
   mean luminance 116 to 73, and pixels above 200 **from 17.7% to 0.0%**.

The scrim is the one that matters, because it protects the *next* photograph
too. Directing exposure fixes one frame; the scrim fixes the slot.

---

## Cost

**Model:** `nano-banana-pro` at **4K**, text2image. Native 4K, realistic people,
and the only model offering 21:9 for the banners. 40 credits a frame, flat at
any resolution — so always ask for 4K.

| Batch | Frames | Credits |
|---|---|---|
| 6 cinematic portrait masters (serve desktop + mobile) | 6 | 240 |
| 6 clean-premium 21:9 banner masters | 6 | 240 |
| Contingency | 4 | 160 |
| **Total** | **16** | **640** of 24,000 |

Full budget rules and the spend ledger: `IMAGE-GEN-BUDGET.md`.
