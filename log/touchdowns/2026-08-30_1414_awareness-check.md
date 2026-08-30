---
slug: awareness-check
job: 4
date: 2026-08-30
model: claude-opus-5
effort: high
---

# Touchdown — awareness-check #4

## Aim
Build the AI analysis Jayden specced: a readiness verdict on each survey submission, in two
registers, using the site's existing model key.

## What it was told
"build it now, driver gets their answers back plus the neutral piece" — after an interview that
settled: the guide's own rubric as the basis, no product recommendations, nothing auto-sent to a
client, company instruments analysed per submission, drivers batched at 5.

## What it did
- new: `api/_analysis.js` — computed readiness + the two-register prompt
- `api/_survey.js` — driver digest (opt-in), `handleAnalysis()`, `driverRowsFor()`
- `api/contact.js` — `formType: 'survey-analysis'` dispatch, own rate ceiling (6/min, 40/hr)
- `js/survey-app.js` — driver opt-in checkbox on the review screen, silent phase-two trigger
- `css/survey.css` — opt-in styling
- `scripts/test-surveys.mjs` — 38 new assertions (47 → 85)
- commit: "surveys: the awareness check" on main, parent 63d1592
- tree: clean · tests: green, 85/85
- **still zero new serverless functions** — 10 of 12

## How it went
Grade: 4 — the architecture is right and the tests are real; marked down because the live model
call is still unverified at time of writing (no local key; see errors).

The decision that shapes everything: **the findings are computed in code, not asked of the
model.** `commitmentReadiness()` walks the answers and emits hard facts — "6 initiatives marked
Commit, 5 of 6 workstreams have no named owner, retroactive census empty" — and only then does a
model turn those into prose. Three things fall out of that ordering, and they are why it is worth
the extra code:

1. A computed gap cannot be hallucinated, so nothing false can reach a client.
2. The rubric is DAS's own, published on page 4 of the guide, so the verdict is the client's
   standard rather than our opinion.
3. It satisfies "without destroying their company" **structurally**. Facts drawn from someone's
   own answers do not insult them. No amount of tone instruction achieves that on its own.

Second decision worth recording: **the driver's copy makes no model call at all.** Jayden asked
for "their answers back plus the neutral piece" — the answers already exist and the neutral piece
is fixed editorial. Generating it would cost money on every submission, vary run to run, and
introduce a hallucination surface pointed at the people we have least ability to correct. Static
copy is free, identical every time, and cannot invent a claim about someone's employer.

Phase two is a **separate request from the done screen**, not work appended to the submission.
The answers are emailed and stored before a model is contacted, so a slow, refused, or failed
analysis cannot cost us the thing we genuinely cannot recreate. It is also silent in the UI:
telling a respondent "preparing your summary" would promise something they never receive, since
the analysis goes to the DAS team.

## Correction passes
2

## Any errors
- **The live model call is UNVERIFIED.** `ANTHROPIC_API_KEY` exists only in Vercel; it is in no
  local env file, and `vercel env pull` returned it as **0 characters** — confirming the standing
  memory that pull masks values. So the only way to exercise a real call is production. Handled by
  pointing `SURVEY_TO` at Jayden alone for the first run, so a bad first output lands with him
  rather than the client. status: open until that run completes
- **A bash heredoc silently failed to append the new tests.** `cat >> file <<'EOF'` with a large
  JS block died on quote matching and wrote nothing — the file stayed at 159 lines and, had I not
  checked, I would have reported passing tests that did not exist. Rewrote via the Edit tool.
  The lesson is the check, not the heredoc: after any append, verify the file actually changed.
  status: recovered
- **Guarded against a failure mode rather than hitting it:** if the model's output does not carry
  both `===SHAQ===` and `===CLIENT===`, `splitRegisters()` returns null and the whole analysis is
  discarded. Half-parsed output must never be presented as a client-ready document, and guessing
  which half is which is worse than sending nothing. Tested both malformed shapes. status: recovered

## Still open
- First live run, then restore `SURVEY_TO` to the working Gmail pair.
- **Migration 026 still unapplied**, so `survey_responses` does not exist, so `driverRowsFor()`
  returns empty and the driver batch can never reach 5. The company instruments work without it;
  the driver half does not.
- Porkbun forwards for `@driverappreciationsolutions.com` — still Jayden's.
