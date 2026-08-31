---
slug: email-dark-mode
job: 6
date: 2026-08-31
model: claude-opus-5
effort: high
---

# Touchdown — email-dark-mode #6

## Aim
Fix the "grey" hero title Jayden saw in the driver survey email, and finish proving the driver
batch analysis end to end.

## What it was told
"the driver survey text in the email, it being gray, makes it hard to see. change it to be
white." Then, correcting me: "no, man, I'm not saying the gray background. I'm saying the driver
survey header is gray."

## What it did
- `lib/email-brand.js` — `color-scheme` / `supported-color-schemes` meta, a
  `prefers-color-scheme: dark` block and Gmail `[data-ogsc]`/`[data-ogsb]` overrides; hook
  classes on the hero eyebrow/title/sub; hero sub `rgba(255,255,255,.88)` → solid `#ffffff`
- `api/_survey.js` (earlier this session) — body contrast, `orgKey()` normalisation
- commit: "email: stop dark-mode clients dimming the hero" on main
- tree: clean · tests 93/93
- **Driver batch analysis proven in production** — `analyzed:true, delivered:true`

## How it went
Grade: 4 — two guesses wrong before I stopped guessing, which is the lesson.

I assumed "grey text" meant the body copy and raised its contrast. Wrong element. Then I assumed
"make it white" was impossible because the email body is white — reasonable, but I was still
guessing at *which* thing he meant. The fix was to stop: render the actual email, serve it,
enumerate every text node in the header with its computed colour and the real background behind
it, then ask him to point at one of four concrete candidates. He picked the title in two seconds.

And the title was **already `#ffffff`**. There was nothing to change. He is reading in dark mode,
where Gmail and Apple Mail rewrite an email's colours and routinely dim pure white on a dark
ground — so "make it white" genuinely could not be solved by setting it white. Two declarations
do the real work: `color-scheme`/`supported-color-schemes` tell the client the email handles its
own colours and stops the blunt inversion, and `[data-ogsc]`/`[data-ogsb]` reach Gmail, which
rewrites the DOM and stamps those attributes on whatever it touched. Verified both ways with
emulated colour schemes: dark gives white title, white sub, brighter brass; light is byte-for-byte
unchanged.

**Blast radius, stated plainly:** `lib/email-brand.js` is the shell for EVERY DAS email — contact,
orders, portal, publications. The dark-mode rules are additive and only fire in dark contexts. The
one change that touches light mode is the hero sub going from 88% white to solid white, on every
DAS email. That is a deliberate improvement — 88% white is already grey-ish and it was the second
thing dimming — but it is a global change and should be read as one.

## Correction passes
3

## Any errors
- **My deploy check proved nothing.** I polled production for `"need":5` to confirm the
  normalisation had shipped — but that response shape existed in the OLD build too, so the probe
  passed instantly while the old code was still live. That is why the batch then reported
  `have:4`: raw `ilike` matched the four clean rows and missed the mangled one, and I nearly read
  a stale deploy as a data bug. Replaced with a real discriminator — an org string containing no
  dash at all, which only the normalising code can match. It returned `analyzed:true`, which is
  proof. **A deploy probe must test something that did not exist before.** status: recovered
- **Guessed at the user's meaning twice before measuring.** Cost two round trips. The tool that
  actually settled it — render the artifact, enumerate computed colours against real backgrounds,
  present concrete candidates — was available from the first message. status: recovered

## Still open
- Porkbun forwards for `@driverappreciationsolutions.com` — every DAS-domain address still bounces.
- Jayden to confirm the dark-mode fix in his own client; emulation is not the same as Gmail.
