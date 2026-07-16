# Receiving Feedback

## Core Mindset

Code review feedback is a technical discussion, not a social one. Focus on the code, not on feelings.

## The Six-Step Process

### Step 1: Read Completely
Read the entire comment before forming any response.

### Step 2: Restate Requirements
Rephrase the reviewer's feedback in your own words to confirm understanding.

### Step 3: Check Against Codebase
Verify the feedback against actual code conditions before responding.

### Step 4: Evaluate Technical Soundness
Consider whether the feedback applies to your specific stack and context.

### Step 5: Respond with Substance
Provide technical acknowledgment or reasoned objection.

### Step 6: Implement One at a Time
Address each piece of feedback individually with verification.

## Forbidden Phrases

| Phrase | Why It's Wrong |
|--------|----------------|
| "You're absolutely right!" | Sycophantic, adds no information |
| "Great point!" | Empty praise, not a response |
| "Thanks for catching this!" | Unnecessary, just fix it |

## When to Push Back

Push back with technical reasoning when feedback:
- Breaks existing functionality
- Lacks full codebase context
- Violates YAGNI
- Is technically incorrect
- Conflicts with established architecture

## Quick Reference

| Situation | Response |
|-----------|----------|
| Reviewer is correct | "Fixed. [What you changed]." |
| You need clarification | "To confirm: you're suggesting [restatement]?" |
| Reviewer is incorrect | "This works because [evidence]." |
| You disagree on approach | "This conflicts with [X]. Should we [alternative]?" |
| You can't verify | "Implemented. Unable to verify because [reason]." |

*Content adapted from obra/superpowers by Jesse Vincent (@obra), MIT License.*
