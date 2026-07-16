# Journal template

One record per design or planning chat, written when the chat is done drafting. The
touchdowns are the build record; the journal is the narrative — why the work took the shape
it did, which a diff can never tell you.

**Where it goes.** `log/journals/<NNNN>_<slug>_<YYYY-MM-DD>_chat.md`. Same sequence as the
touchdowns — see `log/README.md`.

**How to use it in a chat that has no repo access.** Paste the fenced block below into the
chat at handover and ask for the result as a downloadable file. Save the file into
`log/journals/` yourself and give it its sequence number then — the chat cannot see the
folder, so it cannot know the next number.

Two parts, one file. Part 1 is the work. Part 2 is how the operator reasoned. Do not split
them.

---

```
You are closing this chat. Produce a single combined markdown file as a downloadable
artefact — a real file attachment, not inline prose and not a code block in the chat.

Name it: <slug>_chat.md — lowercase, underscores, ending in _chat.md.
Example: intake_builder_design_chat.md
Do not include a sequence number; that is assigned when the file is filed.

---

# Log Source — [short chat name / workstream]

## Dates
Start: YYYY-MM-DD
End: YYYY-MM-DD

---

# PART 1 — Journal

## Chat scope
One paragraph: what this chat was tasked to do.

## What was built or changed
Subsections per major deliverable. Be specific: file paths, version numbers, commit
messages where known, function names. Short subsections are fine if the work was narrow.
Do not pad.

## Decisions locked
Numbered list. Only decisions genuinely settled here — not explored and deferred. If none,
write "None."

## Problems encountered
For each problem worth capturing:
- **Problem:** what broke (one sentence)
- **Diagnosis:** how it was identified
- **Resolution:** what fixed it
- **Time to resolution:** rough estimate
- **Lesson:** one generalizable sentence, or skip if one-off

Aim for 3-6. Include coordination failures, not just technical ones.

## Defining moments
2-4 entries. Specific moments — the first time something worked, a pushback, a number that
landed hard, a realisation. Capture as a short scene, not a summary. Quote the operator
directly where he said something memorable.

## Open threads
Things started but not finished, or handed to a future chat. Specific enough to pick up
cold. If none, write "None."

## Gaps in this journal
What did this chat do that you could not reconstruct from the above? What would a future
reader misunderstand?

---

# PART 2 — Operator Profile

READ THIS BEFORE WRITING: this is the PERSON layer — how the operator reasoned, decided,
and communicated in this chat. Not what was built (Part 1's job). Not domain knowledge. If
an observation is really about the project or the domain, leave it out.

Evidence, not flattery. Every entry points to a real moment in THIS chat. No general
praise, no adjectives standing in for examples. The goal is a profile accurate enough to
behave like him — a flattering version will not achieve that. Include rough edges honestly.
Quote him directly wherever he revealed how he thinks. If a section had nothing real in
this chat, write "Nothing observed this chat." Do not fill sections to look complete.

## Principles observed
Which operating principles showed up, each with the moment that evidences it. Candidates:
anti-overbuild, decisions-before-mechanisms, stable-from-volatile, legibility-first,
single-source-of-truth, cheap-and-reversible-before-blast-radius, stable stopping points,
externalise-state. Quote him where it lands.

## Trade-offs observed
Moments he resolved a conflict BETWEEN principles, and how. This is the most valuable
section — judgement lives in the trade-offs, not the principles alone. If none surfaced,
say so explicitly.

## Decision triggers observed
Moments he decided rather than offered options, delegated to execution, deferred and
parked, stopped at a stable point, or escalated. What triggered each move.

## Cognitive moves observed
Reasoning moves: finding the axis a tangle splits on, a structural reframe, sequencing for
risk, taking a rough intuition to its clean form, diagnostic-first. Each as a short scene.

## Communication patterns observed
How he ran the conversation: terseness, decisions-not-options, one-question discipline,
pushback demanded or given, bluntness when frustrated, what he skimmed or cut short.
Anything that would change how a clone talks to him.

## New or surprising patterns
Anything that does NOT fit the patterns above — candidate additions to his profile. Flag
clearly as candidates. If nothing new, say so.

## Worked examples
2-4 real calls from this chat:
- **Situation:** what was on the table
- **Decision:** the call he made
- **Reasoning:** why, in his terms (quote him if possible)
- **Move:** which cognitive move it illustrates

## Durable vs contingent
Flag which observations look DURABLE (how he always reasons, safe to generalise) versus
CONTINGENT (specific to this chat's context, must NOT become a standing rule). When unsure,
mark contingent — a false rule costs more than a missed one.

## Gaps
What about his thinking did this chat surface that you could not capture above, or that
might be misread by someone who was not present.
```
