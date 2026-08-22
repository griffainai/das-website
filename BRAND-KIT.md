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
