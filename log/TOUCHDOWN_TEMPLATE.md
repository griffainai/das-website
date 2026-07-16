# Touchdown template

One record per Claude Code job. This is the fine-grained build log — the thing you mine
later when you need to know what actually happened.

**Where it goes.** `log/touchdowns/<NNNN>_<slug>_<YYYY-MM-DD>.md`, committed by the job that
wrote it. For `<NNNN>`, see the sequence-number rule in `log/README.md` — highest number
across `log/touchdowns/` and `log/journals/`, plus one, starting at `0001`.

**Depth rule.** Go deep where it pays. `## How it went` and `## Any errors` are the build map
and the error log you will actually mine, so they earn detail. Stay terse on `## Aim` and
`## What it was told` — depth there just restates the prompt and the diff, which the commit
already holds. The job writes a lot only about the part that is worth a lot.

**Model/effort rule.** Stamp what actually ran the job, not what was requested — the two
diverge on escalation, retry, or availability, and only the actual value makes the tier
recoverable later. Models with no effort parameter get `effort: n/a`. If a job genuinely
cannot tell what ran, write `unknown` rather than guessing.

**Error status.** Tag every error `status: open` (left unresolved, action needed) or
`status: recovered` (fixed inside this same job). `/logbook-review` keys off those exact
tokens, so keep them literal.

---

```markdown
---
slug: <task-slug>
job: <n>                     # which job in the piece of work, if it spans several
date: 2026-07-16
model: <model-id>            # what actually ran — see Model/effort rule
effort: <effort | n/a>
---

# Touchdown — <slug> #<n>

## Aim                        [terse — one line]
<what this job was for>

## What it was told           [terse — 2-3 sentences]
<short paraphrase of the prompt, so this record stands alone. Not the whole prompt.>

## What it did                [terse — the facts]
- files changed: <paths>
- commit: <sha> — <message>
- tree: clean | dirty
- tests/build: green | red | n/a

## How it went                [DEEP]
Grade: <1-5> — <one-line reason>

<The verdict on the prompt, in real detail. One pass or corrective follow-ups, and how
many. Did it stay in scope. Did it need subagents, and were they asked for. Where the
prompt was clear and where it was ambiguous. What the prompt would say differently next
time, specifically. This is the data that makes future prompts better — do not be terse.>

## Correction passes
<n>

## Any errors                 [DEEP]
<Every error, factually. What broke, the message or symptom, how it was caught, whether it
was fixed here or left open. Include errors the job recovered from, not just fatal ones —
the recovered ones are where the build map teaches the most. If none, write "none".>

- <error>: status: open | recovered
```
