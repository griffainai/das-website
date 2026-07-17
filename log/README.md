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
  touchdowns/            one file per job    — <YYYY-MM-DD>_<HHMM>_<slug>.md
  journals/              one file per chat   — <YYYY-MM-DD>_<HHMM>_<slug>_chat.md
  handovers/             anything handed from one session to the next
```

## Naming — timestamps, not a counter

Every entry is named `<YYYY-MM-DD>_<HHMM>_<slug>.md`, using local time at the moment you
write it. `2026-07-16_1907_logbook-install.md`. Zero-padded, 24-hour, so plain lexicographic
sort is chronological sort across touchdowns and journals alike.

**Do not use an incrementing counter.** An earlier version of this logbook did, and it broke
on day one: two concurrent sessions each read the highest number, each added one, and both
wrote `0001`. A counter needs a coordination point to be safe, and there isn't one — you run
sessions in parallel, and this repo is cloned on more than one machine that sync through git.
Two writers with no lock always risk picking the same number. A timestamp needs no
coordination and cannot collide the same way.

Timestamps do collide if two entries share a slug *and* a minute. If that happens, add a
letter: `..._1907a_...`. It has not happened yet and is not worth designing around.

## Writing an entry

- **Finishing a Claude Code job that changed files?** Copy `TOUCHDOWN_TEMPLATE.md`, fill it
  in, save to `log/touchdowns/`, commit it with the work. A `Stop` hook enforces this — a
  session that commits without one is blocked from finishing until it writes the record.
  If the work landed in a **nested repo** (a gitlink like `05_acquisition/lead-crm`), the
  touchdown still goes in *this* repo's `log/`, and it therefore cannot share a commit with
  the work. Say so in the record rather than pretending the rule held.
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
