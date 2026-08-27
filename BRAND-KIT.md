# DAS Brand Kit — TYPE LAW

**Status: LOCKED by Jayden, 2026-08-22.** This is the single source of truth for
Driver Appreciation Solutions typography and header treatment. Any build touching
driverappreciationsolutions.com — or any DAS artifact — follows it without asking.

Sister law: ODNDR is **Oswald + Roboto** (`odndr-workspace/site-redesign/TYPE-TREATMENTS.md`).
The two brands are deliberately different. Do not cross them.

---

## The fonts

| Role | Face | Weights | Notes |
|---|---|---|---|
| **Display / all headers** | **Anton** | 400 (only weight) | Uppercase, `letter-spacing: 0.005em`, `line-height: 0.92–0.96` |
| **Body / UI / eyebrows** | **Chivo** | 300 · 400 · 600 · 700 · 900 | Eyebrows at 700, `letter-spacing: .22–.24em`, uppercase |

```html
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Chivo:wght@300;400;600;700;900&display=swap" rel="stylesheet">
```

**Banned as display faces on DAS:** Inter, Roboto, Plus Jakarta Sans, Poppins,
Montserrat, Oswald (Oswald belongs to ODNDR), Space Grotesk, Geist, Fraunces.
Legacy Inter/Plus Jakarta still load for body text on unconverted pages — that is
migration debt, not license to add more.

## The header treatment (page heroes AND section headers)

Both use the **same** treatment so a page header and a section header read as one system.

```css
font-family: 'Anton', sans-serif;
font-weight: 400;
text-transform: uppercase;
letter-spacing: 0.005em;
line-height: 0.96;
background: linear-gradient(180deg, #16264F 0%, #1A2E6E 46%, #3A5FC0 100%);
-webkit-background-clip: text; background-clip: text;
color: transparent;
```

The gradient runs **vertically** (180deg), navy → brighter navy. It is not
decoration — it is the header signature.

**On dark grounds the gradient inverts** (`.on-dark`), otherwise navy-on-navy
disappears:
`linear-gradient(180deg,#FFFFFF 0%,#CFE0F8 52%,#7FB0FF 100%)`

Live implementation: `das/web/css/styles.css` → "PAGE HEADER SYSTEM" and
"SECTION HEADER FONT — OFFICIAL".

## Colour — navy only, brass is earned

Navy family (the ONLY gradient colours):
`#060E24 · #0C1840 · #16264F · #1A2E6E · #2E4FA8 · #3A5FC0 · #4E8BE8 · #9CC4F5`

**Brass `#C8A14B` / `#E8C766` is DAS's real accent and was already live** (the
"Our Standard" eyebrow, flagship CTA, loading bar). Rule: brass is an *earned
metal* — engraving, medals, milestones, awards. Never a flat fill, never a
background, never in a header gradient. Jayden's note "the yellow looks off"
was about brass used flat in the Order 10-or-10,000 panel: right pigment, wrong
application.

**Do not invent new colorways.** Depth comes from the prism, not new hues.

## The DAS prism

Layered radial gradients + a conic refraction sweep + film grain, in dark and
light. Reference implementation: `_sandbox/das-10x/_prism.css`. It exists to kill
dead white space without adding colours.

## Page-hero ghost word

Every page hero carries a giant ghosted Anton word behind the block, set per page
via `data-hero-word="…"` and rendered with `content: attr(data-hero-word)`.
One CSS rule drives all 18 pages; adding a page means adding the attribute.

Live words: FLEET (contact) · KITS (shop) · STORY (about) · CART · SUPPORT ·
PRESS · PROCURE · IDEAS · PREMIUM · GIFTS · WEEK · PRIVACY · TERMS · LEGAL ·
REFUNDS · RETURNS · CHANGES · SMS

## Illustration system (LOCKED 2026-08-23)

DAS has its own drawings. **Do not substitute an icon pack** — that is the
"no stupid-ass icons" rule, and a bought set is exactly what it forbids.

**The asset:** `09_reference/das-illustrations/` — sprite, stylesheet, preview,
and the generator that produces them. Deployed copies live at
`das/web/images/das-illustrations.svg` and `das/web/css/das-illustrations.css`.

```html
<link rel="stylesheet" href="/css/das-illustrations.css">
<svg class="das-ill das-ill-semi"><use href="/images/das-illustrations.svg#das-semi"/></svg>
```

**16 drawings:** semi · road · medal · kit · sign · driver · clipboard · mug ·
wrench · calendar · pin · wheel · clock · paper · badge · headset.

### The rules that make it a system

- **Every viewBox is height 100, stroke-width 2.4.** Stroke therefore stays a
  constant 2.4% of drawn height at any size. Mixed viewBox heights are the usual
  reason a set stops looking like a set the moment one member is scaled.
- **One sprite, referenced by `use`.** One request, cached site-wide, and no
  duplicate path data to drift out of sync. Never paste a drawing inline.
- **Stroke is `currentColor`.** A drawing inherits `color` from its context:
  navy by default, `.das-ill-on-navy` (#9CC4F5) on dark grounds,
  `.das-ill-brass` for earned-metal contexts only.
- **Set a HEIGHT, never a width.** Width comes from the per-drawing
  `aspect-ratio` in the stylesheet. A host `svg` wrapping a `use` has no
  intrinsic ratio of its own — without those rules every drawing collapses into
  an identically-shaped box and the wide ones letterbox. *(Caught in
  verification 2026-08-23: all 16 were reporting the same three ratios. Now
  measured correct at three sizes each.)*
- **Minimum 44px tall.** At 34px the stroke computes to 0.8px and renders faint
  on a 1x screen. Below 44px reach for a UI icon, not an illustration.
- **`.das-ill-quiet` (opacity .42) for supporting marks.** Illustration frames
  type; it must never compete with it.

### Where it belongs

Section ledes, empty states, process steps, category headers, 404 and thank-you
pages, email headers. **Not** over photography, and **never as a product image**
— real product photography still governs anything a fleet is actually buying.

## Layout rules Jayden has ruled on

- **Sections stay horizontal.** Do not convert a horizontal three-up into a
  vertical scroll sequence — "everything is just right there" (2026-08-22).
- **Light ground by default.** No dark full-bleed section treatments unless
  explicitly asked; the site ground is white / `#F7F9FD`.
- **No stock icons. No basic cards.** Real product photography instead.
- **Photos run at native aspect ratio** — measure the file, never force a box.
  Known: kit shots `1122×1402` (0.80), lifestyle `1200×896` (1.34), cases
  `1254×1254` (1.00), medal `1100×880` (1.25), cooler `1536×1024` (1.50).
- Every design variant must be a **different aesthetic decision**, not a
  rearrangement of the same look.
