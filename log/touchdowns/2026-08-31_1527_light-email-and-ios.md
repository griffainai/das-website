---
slug: light-email-and-ios
job: 13
date: 2026-08-31
model: claude-opus-5
effort: high
---

# Touchdown — light-email-and-ios #13

## Aim
Stop the email hero reading grey — for real this time — and make the survey behave like a native
iOS app rather than a web page.

## What it was told
"still gray and you need to deploy all the changes to the survey to make it more native ios"

## What it did
- `lib/email-brand.js` — **the hero and footer are now light-scheme**: white/#F7F9FD hero, navy
  Anton title, dark lockup (`images/logo.png`), brass kept as the engraved rule, light #F4F6FB footer
- `css/survey.css` — safe-area insets, tap-highlight removal, `touch-action: manipulation`,
  hover gated behind `@media (hover: hover)` with real `:active` press states, `overscroll-behavior: none`
- `surveys.html` — iOS meta, `-webkit-text-size-adjust: 100%`, notch-safe lockup and top bar, assets → `?v=4`
- `js/survey-app.js` — per-field `autocorrect` / `autocapitalize` / `inputmode` / `autocomplete`
- commit: "email: stop fighting dark mode and go light"
- tests 93/93 · CSS braces balanced · shell assertions green

## How it went
Grade: 4 — the right answer, arrived at two attempts late.

**Third time on the same complaint, and the first fix that is not a CSS trick.** Attempt one added
`color-scheme: light dark`, which was an opt-in and made it worse. Attempt two corrected that to
`light`. Still grey. At that point the evidence was conclusive: Gmail honours no declaration and
transforms regardless, so **no amount of CSS was going to win**. White text on a navy hero is the
exact case every dark-mode client mangles.

The fix is structural — make the email light and there is nothing left to invert. Navy title on
white is **16.3:1**, better contrast than the white-on-navy it replaces, and it is *more* on-brand,
not less: BRAND-KIT.md says "Light ground by default. No dark full-bleed section treatments unless
explicitly asked." The identity is intact — navy type, the brass engraved rule under the hero,
Anton headline. Only the side carrying the ink changed. The revert is one commit and the comment
in the file says exactly how.

I also took the footer light. A half-light email still hands a dark client a dark region to mangle,
and it would have produced the same greys in the small print.

On iOS: the four things that give a web flow away are the tap flash, sticky `:hover` after a tap,
the missing safe-area inset (the Continue button sitting under the home indicator), and the wrong
keyboard. All four are now handled, plus press states so touch has feedback that hover used to
provide.

## Correction passes
4

## Any errors
- **A CSS anchor assertion failed silently in the middle of a two-part script.** The HTML half ran
  and bumped assets to `?v=4` while the CSS half did not insert — so for a moment the page
  advertised a version of a stylesheet that did not contain the new rules. Caught because the
  script printed the failure, but the ordering was wrong: **the risky match should run first, or
  both should be one transaction.** status: recovered
- **A rule I wrote was dead on arrival.** The safe-area padding on `.svq-top` in `survey.css` was
  overridden by later, more specific rules in `surveys.html`'s inline `<style>` (62px / 80px), so
  the notch inset never applied. Found by reading the COMPUTED value (`80px`, no inset) rather than
  trusting that the declaration existed. Moved into the inline block where it wins. status: recovered
- `env(safe-area-inset-*)` resolves to 0 in the emulator, so the emulated result cannot prove the
  notch handling — only a real device can. Stated rather than claimed. status: open

## Still open
- Jayden confirms the light hero in his own client. If it now reads navy-on-white and stays that
  way in dark mode, this is closed.
- The safe-area insets are unverifiable here; they need a real notched iPhone.
