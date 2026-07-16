# Spec Compliance Review

## Two-Stage Review Architecture

```
                    ┌─────────────────────┐
                    │   Implementation    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  STAGE 1: Spec      │
                    │  Compliance Review  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                  │
      ┌───────▼───────┐                ┌────────▼────────┐
      │   ✗ Issues    │                │   ✓ Compliant   │
      │     Found     │                │                 │
      └───────┬───────┘                └────────┬────────┘
              │                                  │
              │                        ┌────────▼────────┐
              │                        │  STAGE 2: Code  │
              │                        │  Quality Review │
              │                        └────────┬────────┘
              │                                  │
              │                    ┌─────────────┴─────────────┐
              │                    │                           │
              │            ┌───────▼───────┐         ┌────────▼────────┐
              │            │   ✗ Issues    │         │   ✓ Approved    │
              │            │     Found     │         │                 │
              │            └───────┬───────┘         └─────────────────┘
              │                    │
              └────────────────────┴────────────────────┐
                                                        │
                                              ┌─────────▼─────────┐
                                              │ Return to Author  │
                                              └───────────────────┘
```

**Critical:** Complete Stage 1 (spec compliance) BEFORE Stage 2 (code quality).

## Stage 1: Spec Compliance Review

### The Three Verification Categories

#### Category 1: Missing Requirements
Compare PR to original requirements line by line. Check edge cases, error scenarios, happy path.

#### Category 2: Unnecessary Additions
Check for scope creep and over-engineering. Compare to original requirements.

#### Category 3: Interpretation Gaps
Check for misunderstandings of requirements. Ask author to explain their interpretation.

## Spec Compliance Checklist

### Before You Start
- [ ] Read the original issue/ticket completely
- [ ] Identify all explicit requirements
- [ ] Identify implicit requirements from context

### During Review
- [ ] All required features present
- [ ] Edge cases covered
- [ ] Error handling as specified
- [ ] No unrequested features
- [ ] No speculative abstractions

### After Review
- [ ] Document all findings with file:line references
- [ ] Categorize as missing/unnecessary/interpretation
- [ ] Prioritize: blocking vs. non-blocking issues

*Content adapted from obra/superpowers by Jesse Vincent (@obra), MIT License.*
