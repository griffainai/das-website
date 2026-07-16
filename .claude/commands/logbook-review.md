---
description: Read this repo's whole logbook and report what failed, what ran slow, and what to fix
---

Read the entire logbook in `log/` for this repo and report on it. This is the analysis pass
over the black box — the point is to find real problems in how this repo gets built, not to
summarise the entries back.

Read `log/touchdowns/*.md` and `log/journals/*.md`. If both are empty, say so and stop.

Report, in this order:

1. **Open errors.** Every error still tagged `status: open`, oldest first, with its
   touchdown file and date. These are unresolved and action-needed. If an open error was
   later fixed in a subsequent touchdown but never re-tagged, say so — a stale `open` is
   itself a finding.

2. **Repeat failures.** Errors or correction passes that recur across jobs. Group them by
   root cause, not by symptom — three touchdowns that all failed on the same missing env var
   are one finding, not three.

3. **Prompt quality.** Where grades are low and where correction passes cluster. Quote the
   specific "what the prompt would say differently next time" lines and turn them into
   concrete prompt changes worth making.

4. **Slow or expensive.** Jobs that took multiple correction passes or escalated model tier.
   Cross-reference `model:` and `effort:` against grade — if a cheap tier keeps needing
   correction on a class of work, that is a routing finding.

5. **Improvements worth making.** Ranked, most valuable first. Each one concrete enough to
   act on: what to change, where, and which entries evidence it.

Rules:
- Ground every claim in a specific entry. Cite `log/touchdowns/<file>` for each finding.
- Do not invent findings to fill a section. If a section has nothing, say it has nothing.
- Do not fix anything in this pass. Report first — the operator decides what gets acted on.

$ARGUMENTS
