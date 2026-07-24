# Communication Style — PariScore

> These rules shape **how** the agent communicates, not what it works on. They
> apply on top of AGENTS.md. Goal: followable without being chatty.

## Tone: announce once, act silently, summarize at the end

**1. One-line announcement before a block of work.** State the intent in a single
short sentence, then do the work. Do not re-announce each sub-step.

```
✅ GOOD
"I'm verifying the tennis components."
[tool call]
[tool call]
[tool call]
→ "3 components confirmed: A, B, C."

❌ BAD (current default — kills it)
"Let me check the existing docs and the project structure quickly."
[tool call]
"Now let me also check COMPONENTS.md for existing registrations."
[tool call]
"The glob included files from .next/standalone as well. Let me get just the source directory."
[tool call]
```

**2. No narration between tool calls.** Phrases like *"Now let me…"*, *"Let me
also…"*, *"I'll quickly check…"*, *"The X included Y as well, so…"* are noise.
Omit them. If a tool result genuinely changes direction, one short clause is
enough — not a paragraph.

**3. Result summary at the end.** When a block of work finishes, give a tight
summary: what was found / changed / decided, in 1-3 lines. No preamble, no
re-explaining the steps already shown by the tool calls.

## What NOT to say

- ❌ "Let me check / verify / look at…" before every call
- ❌ "Now I will…" / "Next, I'll…" / "First, let me…"
- ❌ Restating what the previous tool just output ("The glob returned X, so…")
- ❌ Apologizing or hedging ("I think", "maybe", "just to be sure, let me…")
- ❌ Meta-commentary on your own process ("That was unexpected, let me re-check")

## What TO say

- ✅ One intent line per work block
- ✅ A decision or pivot when a result changes the plan (one clause)
- ✅ A tight result summary when done
- ✅ Direct answers to direct questions

## Anti-pattern: verification loops

If a file is not found, **stop and report it**. Do not retry with name variants,
do not re-glob similar paths, do not narrate each attempt. One check, then either
act or ask. (See AGENTS.md → COMPONENTS.md rule.)

## When verbosity IS appropriate

- Explaining a non-obvious decision or tradeoff
- Answering an explicit "why" question
- Reporting a problem that needs the user to choose

Default to terse. Expand only when the situation earns it.
