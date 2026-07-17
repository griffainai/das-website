---
slug: logbook-install
job: 1
date: 2026-07-16
model: claude-opus-4-8
effort: high
---

# Touchdown — logbook-install #1

## Aim
Install the logbook (black-box job record) into every git workspace on this laptop, then
pressure-test that it actually fires.

## What it was told
Install a logbook into the folder architecture of every git repo Jayden uses, adapted from
his LOG_PROMPT.md and CC_TOUCHDOWN.md. Then run 20 pressure tests to verify every workspace
writes a touchdown automatically, and keep deep logs of the testing.

## What it did
- files changed: `log/` (README + 2 templates + touchdowns/journals/handovers),
  `.claude/commands/logbook-review.md`, `CLAUDE.md` (+`log/handovers/2026-07-16_logbook_install_pressure_test.md` in griffain-agency-workspace only)
- commit: "Fix touchdown template commit field; add logbook-install touchdown" on main, parent 9b1cfb1
- tree: clean
- tests/build: n/a (no test harness — verified by 20 pressure tests, see handover report)
- note: the job spans two commits per repo. The install landed first; this record ships with
  the template fix that testing forced. Full test evidence:
  `griffain-agency-workspace/log/handovers/2026-07-16_logbook_install_pressure_test.md`

## How it went
Grade: 3 — the deliverable is correct and tested, but the build corrupted 10 of Jayden's files
en route and shipped a template with a logically unfillable field.

Not one pass. The install itself was mechanical and went in cleanly, but two real failures
landed inside it, both mine, both caught only because something external forced a look.

The encoding corruption (error 1) is the one that should not have happened. The prompt did not
ask for PowerShell; I reached for it to batch a 10-repo edit, and PowerShell 5.1's `Get-Content
-Raw` silently read UTF-8 as Windows-1252. It fails without an error and the files still open.
What caught it was `git diff --numstat` showing 38 deletions on what should have been a pure
append — a check I ran by habit, not because I suspected anything. Without that habit I would
have pushed mojibake to 10 repos and reported success. The lesson generalises past encoding:
after any scripted multi-file edit, the diff is the verification, not the script's exit code.

The template defect (error 2) is more interesting because the logbook caught it. The first
sandbox job that used `log/TOUCHDOWN_TEMPLATE.md` hit a field that cannot be filled — the
record must ship in the same commit as the work, so it cannot contain that commit's sha. The
agent fabricated a plausible sha, noticed, amended, and the amend invalidated the correction.
It then diagnosed the structural cause in its own `## Any errors` and tagged it `status: open`
against whoever owns the template. That is precisely the behaviour the black box is for, and it
found a flaw in the black box on its first real job. Fixed and rolled out.

On scope: the source material is another operator's ICM system (bees, Queen, Mastermind, five
MAPs, `loop_harvest.py`). Porting it verbatim would have installed vocabulary with no consumer
on this machine, and dead fields get filled with noise. Cut it, kept what has a reader. That
call was checked with Jayden rather than assumed.

What the prompt would say differently next time, specifically: it asked to "install into every
workspace", which left the enforcement question implicit. The install can be perfect and still
not deliver "automatically", because CLAUDE.md is advisory by design — a fact I recommended
against a hook without checking first. A prompt that said "make sure it fires automatically"
up front would have forced the enforcement question to the top, where it belonged, instead of
surfacing it after the install was already pushed. It should also have named a verification
bar ("prove it fires, don't assert it"), which is what the follow-up prompt actually supplied.

## Correction passes
2 — the encoding repair, and the template fix that testing forced.

## Any errors
1. **Encoding corruption across 10 CLAUDE.md files.** `Get-Content -Raw` (PowerShell 5.1) read
   UTF-8 as Windows-1252; writing back double-encoded every em-dash, arrow, and box-drawing
   character, and converted LF to CRLF. Symptom: `git diff --numstat` reported 38 deletions on
   a pure append. Caught by that check, not by any error message — the corruption is silent and
   the files still render. Reversed with `UTF8.GetString(Windows1252.GetBytes(text))`, verified
   byte-identical against HEAD before re-applying. Chose reversal over `git checkout --`
   specifically because two repos held uncommitted work that checkout would have destroyed.
   status: recovered

2. **Template shipped with an unfillable `commit: <sha>` field.** A touchdown committed with its
   own work cannot contain its own sha; any value written is invented or stale after an amend,
   and it does not converge. Surfaced by a sandbox job, which fabricated sha `9c99e28` (never
   existed), committed as `194a740`, then amended to `d2b957c`. Fixed: the field now records
   message + branch + parent sha, all knowable pre-commit; `git log -- <file>` recovers the real
   sha at read time. Added a "never pre-fill a field with invented data" rule generalising the
   fabrication.
   status: recovered

3. **Jayden's uncommitted work swept into my commit.** The first griffain-agency-workspace commit
   staged `CLAUDE.md`, which already held his in-progress seo-traffic-officer rule, filing it
   under a message about the logbook. Caught by diffing dirty counts before and after (14 → 13).
   Split into two honest commits before pushing; nothing lost.
   status: recovered

4. **Conclusion drawn from a mid-flight artifact.** I read a sandbox touchdown while its agent was
   still running and nearly reported "fabricated SHA" as a finding from a file still being
   revised. Caught only because the content changed between two reads. The finding was real, but
   the reasoning was unsound when formed — I asserted from a snapshot I had no reason to believe
   was final.
   status: recovered

5. **Subagent killed by API 401** (OAuth access token revoked) mid-revision, invalidating the
   baseline behavioural trial (T17) as a clean result. Not diagnosed; may affect later runs.
   status: open

6. **Sequence number hardcoded instead of computed — caused a real collision.** I wrote `0001`
   as a literal across all 10 repos rather than recomputing max+1 at write time, which is what
   the rule I was installing requires. In griffain-agency-workspace it collided: a concurrent
   session had already committed `0001_lead-crm-retired-pink-sweep` (231368e) minutes earlier —
   in fact the very commit I recorded as my parent. Two files numbered 0001, one already pushed.
   Caught by an unexpected file count (2 touchdowns where I wrote 1), not by any check of mine.
   Mine renumbered to 0002; the earlier entry keeps 0001. The other 9 repos were correct only by
   luck, because their logbooks were empty. Installing a rule while violating it is the failure
   mode worth remembering here.
   status: recovered

7. **The sequence rule has a race condition.** Two sessions that compute max+1 concurrently get
   the same number; nothing serialises it. This is a real design gap in the rule as written, not
   just my mistake — my collision was one instance of it. Jayden runs concurrent sessions (this
   is how it surfaced), so it will recur. Needs a tiebreak: a timestamp or session suffix in the
   filename, or accept collisions and dedupe at review time.
   status: open

8. **`commit it with the work` cannot hold across a nested-repo boundary.** Surfaced by the
   concurrent session, not by me: `05_acquisition/lead-crm` is a gitlink (`160000`), so work done
   inside it cannot share a commit with a touchdown in the parent repo. That session logged the
   deviation rather than faking compliance. The rule as written has no answer for nested repos,
   and this workspace has several.
   status: open

9. **"Automatically" is not guaranteed.** CLAUDE.md is documented as advisory context, not
   enforced configuration. 3 of 3 valid behavioural trials fired, including with the rule buried
   at 96% of a 28k-char file — but that is evidence, not a guarantee. The documented enforcement
   layer is a `Stop` hook, which can block completion and feed context back. Pending Jayden's
   decision.
   status: open
