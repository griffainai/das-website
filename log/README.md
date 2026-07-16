# Logbook

The black box for this repo. Every job that changes something writes a short record
before it finishes. Nothing is deleted. The record builds on its own, in the repo, and
commits alongside the work it describes — which is what makes it evidence rather than
recollection.

## The folders

```
log/
  README.md              this file
  TOUCHDOWN_TEMPLATE.md  the template a Claude Code job fills in when it finishes
  JOURNAL_TEMPLATE.md    the template a design chat fills in when it is done drafting
  touchdowns/            one file per job    — NNNN_<slug>_<YYYY-MM-DD>.md
  journals/              one file per chat   — NNNN_<slug>_<YYYY-MM-DD>_chat.md
  handovers/             anything handed from one session to the next
```

## Sequence numbers

`NNNN` is a zero-padded four-digit number, per repo, ever-incrementing, never reset per
day. Touchdowns and journals share one sequence, so the numbers alone put the whole repo's
history in order regardless of type.

Before writing, list `log/touchdowns/` and `log/journals/` and take the highest number
present across both. Use the next one. If both are empty, start at `0001`.

## Writing an entry

- **Finishing a Claude Code job that changed files?** Copy `TOUCHDOWN_TEMPLATE.md`, fill it
  in, save to `log/touchdowns/`, commit it with the work.
- **Closing a design or planning chat?** Copy `JOURNAL_TEMPLATE.md`, fill it in, save to
  `log/journals/`.
- **Handing state to a future session?** Drop it in `log/handovers/`.

Read-only jobs — questions answered, code explained, nothing changed — do not need a
touchdown. The log records what happened to the repo, not every conversation about it.

## Reading it back

Run `/logbook-review` in this repo. It reads every entry and reports what ran slow, what
failed, which errors are still `status: open`, and which prompt patterns keep needing
correction passes. Point it at the log any time you have spare usage.

You can also just ask in plain language — "what did we change in the auth flow in June and
why" — because the whole record is text in the repo.
