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


---

# THE HEADERS — decided 2026-09-25

Two treatments, chosen by Jayden after comparing real frames rather than
descriptions.

| Slot | Treatment | Why |
|---|---|---|
| **Collection banners + campaign headers** | **Bold ultra-wide** — product small and far right, one hard key, a long hard-edged shadow raking left, vast empty dark ground | It is arresting, and the empty left two thirds is where the type goes |
| **PDP and product photography** | **Elevated product hero** — whole object, three-quarter, bone seamless into navy, controlled light | Somebody deciding to buy needs the object to read completely |

## Products are PHOTOGRAPHED, never invented

Jayden: *"use references of our real products... take the photo, copy it, put it
in OpenArt, say use this exact product, one by one, pixel by pixel. Nothing
should change. Use the same logos. We've done this before for ODNDR."*

Every product frame is **image2image** with the real packshot passed by live URL
from production, so the model sees what customers see. The prompt changes only
the **light**, the **surface** and the **angle**, and forbids restyling,
cleaning up, substituting or adding a single detail.

This is not a stylistic preference. Scenery can be generated from nothing; a
product cannot. A generated case is a case that does not exist, on a page where
somebody is buying — the same class of problem as Scout naming a SKU we do not
sell.

**Verified on the Professional Driver Kit:** the case, the lid foam pattern, the
tray cut-outs, the torch with its gold band, the latches, the handle and the
navy "YOUR LOGO HERE" badge all carried through. Honest limit: it is a faithful
RESTAGE, not a pixel-identical copy — small accessories can shift position. Fine
where the product sits small in a banner; check it frame by frame anywhere the
product is examined closely.

## The ground must be DARK

Measured on the first bold banner, generated on pale concrete:

| | left third, where white type sits |
|---|---|
| pale concrete | mean luminance **176**, 10.7% blown — white type illegible |
| dark charcoal-navy | mean luminance **22**, 0.0% blown — white type reads |

So the bold banner is staged on a deep charcoal-navy ground, not the pale
concrete of the first comparison. Same composition, same drama, legible type.

## The reference photo per program

| Program | Real packshot used as the reference |
|---|---|
| appreciation | The Professional Driver Kit |
| milepacks | Hydration & Hustle Kit |
| onboarding | The Road Ready Kit |
| safety | Safe Service Miles Lapel Pin |
| milestone | 250,000 Service Miles |
| holiday | Professional Driver Seat Back Organizer |


---

# THE SIX COLLECTION BANNERS — shot 2026-09-25

Jayden: *"I really like this one. You should do this photo shoot for each
collection, but do the different products, etc."*

Six image2image restages, one per programme, each against that programme's own
real packshot passed by live production URL. One prompt template; only the
light, the surface and the angle move.

| Programme | Product photographed | Reference |
|---|---|---|
| appreciation | The Professional Driver Kit | `pak-professional-driver-kit-heroA-pdp` |
| milepacks | Hydration & Hustle Kit | `mp-02-1-pdp` |
| onboarding | The Road Ready Kit | `pak-road-ready-kit-case-2026-pdp` |
| safety | **1 Million SAFE Service Miles Medal** | `medal-s-1m-v1-pdp` |
| milestone | **6 Million Service Miles Medal** | `medal-c-6m-v1-pdp` |
| holiday | Professional Driver Seat Back Organizer | `seat-back-organizer-1-pdp` |

## Three frames were wrong, and the reference was the reason every time

Worth writing down, because the failure was never the model.

1. **safety** was shot against `milestone-kit-lapel-hat-pdp`, which is not a
   packshot at all — it is a finished marketing layout with a driver's face,
   body copy and a lapel pin in the corner. The model did the only sensible
   thing and photographed the pin, and invented "1 MILLION MILES" on its face.
   That put **career-mile language on the safety path**, which the Career /
   Safety separation forbids outright.
2. **milestone** was shot against `milestone-c-250k-pdp`, which is the
   *"Placeholder image — final coming soon"* caption card. The banner came back
   as a beautifully lit photograph of a placeholder. `PHOTO-SHOT-LIST.md` §3
   says exactly this about that file; it was in the repo the whole time.
3. **milestone again** came back **bronze**. The real 6 Million medal is dark
   gunmetal. The prompt said "do not change the metal finish" and the model
   changed it anyway — a negative instruction is weaker than a positive one, so
   the fix was to *name the finish*: "dark gunmetal, near-black antiqued
   nickel… NOT bronze, NOT copper, NOT gold."

**The rule that falls out: look at the reference before you spend on it.** Open
the packshot. Confirm it is a photograph of the product and not a layout, a
caption card or a lifestyle scene. And check the result against the packshot
side by side — the bronze medal passed every other test.

## Three placements, three ratios, one photograph

The slot's ratio changes with the viewport, and it is not one family:

| Placement | Size | Slot | Ratio |
|---|---|---|---|
| desktop banner | 2400 x 820 | `.st-banner` at 1900px | 2.93 |
| phone banner | 1080 x 830 | `.st-banner` at 375px | 1.30 |
| phone collection hero | 1100 x 530 | `.cl-hero` at 375px | 2.08 |

A single file cannot serve those. `srcset` cannot fix it either — w-descriptors
choose by resolved width, and what has to change here is the **crop**. So the
page uses `<picture>` with a media source, and `scripts/cut-banners.mjs` cuts
all three out of the same master. Same object, same light, framed for the slot.

Left as a wide file on a phone, every banner would have shown its middle 44% —
in this art direction, empty concrete with the product cropped off the edge.

## Measured, not asserted

The caption sits bottom-left over its own gradient. Cut with that gradient
composited, the bottom-left corner of all eighteen placements measures **mean
luminance 17–33 and 0.0% of pixels above 200**. White type reads on every one.


---

# NEVER ASK THE MODEL TO RENDER TEXT — 2026-09-25

The hardest-won rule in this file, because I broke it myself within an hour of
writing the reasoning for it.

## What happened

Jayden flagged two things on the banners and asked me to decide them.

**Decision 1, the snack brands.** The milepacks banner reproduced third-party
packaging. Zoomed to full size the marks were not merely present, they were
**garbled**: KIND read `AZTA PROTEIIIA`, Jack Link's read `JACK LNKS /
B..EE STEAK`, Grandma's carried a nonsense subtitle. A recognisable trademark
rendered *wrong* is worse than showing it correctly and worse than leaving it
out. Ruled: a generated frame never reproduces a third-party trademark. The
real packshot on the PDP does that job, and does it accurately. Milepacks was
reshot as the closed navy box.

**Decision 2, the badge.** The appreciation banner's plate read `YOUR LOGO
HERE`, which on a campaign frame beside fifty NorthStar-branded products read
as an unfinished mockup. I replaced it by **instructing the model to write**
"NorthStar / ALBANY TRANSPORTATION" on the plate.

It came back `NorthStar` over a line of **gibberish**. The PDP test frame,
given the same instruction, came back `NorthStar / ALBANY TRANEPORTATION`.

Same defect. Same hour. I had just written the rule about garbled marks and
then hand-fed the model the one input that guarantees them.

## The distinction that matters

**Reproducing text is not the same job as writing text.**

- Text that already exists *photographically in the reference* is image
  content. image2image carries it faithfully — every `NorthStar` on the other
  five banners came through correct, because the model was copying pixels, not
  spelling a word.
- Text the prompt *asks for* is generated. The model is drawing letterforms it
  has to infer, and it gets them wrong often enough that any frame containing
  requested text must be read at full resolution before it ships.

So: **never instruct a generation to add, replace or rewrite any text.** If a
surface must not say what the reference says, ask for it **blank** — a smooth
unmarked plate renders reliably, because there are no letterforms to get wrong.

On this product a blank plate is also the more truthful image: an
un-customised kit really does ship with an empty plate, and that plate is
exactly where the fleet's logo goes.

## Check it at full resolution, every time

Both failures were invisible at review size. The banner badge is ~40px on a
1440px screen; the misspelling only appeared at 1200px of crop. A frame that
contains any lettering at all gets zoomed to 100% before it ships — the
garbled snack brands were caught that way, and the two that were not caught
were the two I did not zoom.

## The PDP rule that follows

On a **PDP**, leave the reference's plate exactly as the reference has it, or
blank. `YOUR LOGO HERE` is not a defect on a product page — it is the product's
selling point, stated in the one place a buyer is deciding whether their logo
can go on it. The unfinished-mockup problem only applies to **campaign frames**,
which are brand-building and must look finished.


---

# THE PDP ELEVATED PRODUCT HEROES — shot 2026-09-25

Jayden's pick for this slot, from the treatment comparison: *"the elevated
product hero kind of looks a little bit better for the actual PDPs and actual
product photos."*

Ten products, each an image2image restage of its own real packshot onto a
seamless sweep — warm bone-white at the base falling to deep navy at the top,
one soft key upper-left, cool fill right, tight contact shadow. Native 4:5, so
nothing is padded.

## What the shoot actually fixed

Of 50 distinct product photographs in the store, **46 are landscape or square.**
The PDP frame is 4:5 portrait, and `build-store-images.mjs` fills the gap by
padding with the photo's own sampled edge colour. That is why a buyer sees tan,
white, green and grey BANDS above and below almost every product — and on the
milestone medal, a band of lawn.

| | before | after |
|---|---|---|
| frame | 4:5 by padding a 1.25–1.78 photo | native 4:5, edge to edge |
| resolution ceiling | 1,100–1,500px | **2,100px** (the top ladder rung) |
| bands | tan / white / green / grey | none |

## The install needs no catalogue edit

`bestShaped()` in `build-store-catalog.mjs` already scores every file sharing a
product's stem by `cap × share` — resolution times how much of the 4:5 frame
the photo fills. A landscape source fills 0.53 and gets padded; a native 4:5
source scores share = 1.0 and wins outright.

So the entire install is a filename. `scripts/install-pdp-heroes.mjs` writes
each master to `images/<stem>-heroS.webp` at 2100×2625, and the normal builders
pick it up. Ten for ten, first run, no special case anywhere.

## Three failures, all instructive

1. **A reference URL with a guessed content hash** — `URL_ERROR-ERROR_NOT_FOUND`.
   Read the path out of `store-catalog.json` (`p.shot.pdp.src`); never build one.
   Note that a product's `img` and its actual PDP `src` often differ, because
   `bestShaped()` may already have picked a different sibling.
2. **`Content Policy Violation`** on a prompt saying a watermark "must NOT
   appear" — asking a model to remove a watermark reads as exactly that. State
   what the scene DOES contain: *"all four corners are plain empty sweep with
   nothing in them."* Same frame, no violation.
3. **A frame that kept its reference's lighting.** The working-hands packshot is
   an amber spotlight pool on black; the restage reproduced it and broke the
   set's consistency. Naming the unwanted look and then the wanted one fixed it
   — the same positive-instruction lesson as the metal finish.

## What is NOT in this shoot, and why

⛔ **The Executive Collection.** Six SKUs at $799–999, and their PDP heroes are
finished advertisements — headline, body copy, feature icons and a **SHOP NOW
button** baked into the image. They genuinely need replacing.

But every one of those products is **YETI** gear, and a generated YETI wordmark
is a garbled third-party trademark on the most expensive pages in the store —
the snack-brand problem, at four times the price. So they are fixed by
**cropping the product out of the existing layouts**: free, removes the SHOP NOW
button, and keeps the real product exactly as it was photographed.

The general rule this settles: **where a product carries a third-party brand,
do not generate it. Crop, or shoot it for real.**
