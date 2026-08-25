# Contributing to Pariscore

Thanks for your interest in contributing to Pariscore! This guide covers code contributions.

## Discuss before coding

**Please talk to us before you start writing code.** This avoids duplicate work, ensures your approach fits the project direction, and saves everyone time.

Pick whichever channel suits you:

- **bd issues** — bug reports and targeted fixes
- **GitHub Discussions** — feature proposals and design questions
- **Discord** — quick questions and real-time feedback

Describe what you want to change and why. Wait for feedback from a maintainer before opening a pull request.

## Getting started

```bash
# Clone the repo
git clone https://github.com/David/pariscore.git
cd pariscore

# Install dependencies
bun install

# Start dev server
bun run dev
```

## PR Requirements

1. **Reference the bd issue** — link to the issue you're fixing
2. **Keep PRs focused** — one feature or fix per PR
3. **Test before PR** — run quality gates
4. **Screenshot for UI changes** — include a screenshot in the PR description
5. **PR title follows Conventional Commits** — `type(scope): description`

## Quality Gates

Run these before opening a PR:

```bash
# Lint
bun run lint

# Type check
bun run typecheck

# Build (optional, for final verification)
bun run build
```

CI will run all checks on your PR. A red CI won't merge.

## Branch Model

We use **trunk-based development**: `main` is always releasable.

- **Short-lived branches**: `feat/...`, `fix/...`
- **PR against `main`**
- **Squash-merge** with Conventional Commits title

### Branch Naming

```
feat/betting-edge-detection
fix/scraping-waf-bypass
docs/update-readme
chore/deps-update
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Code style (formatting, etc.) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding missing tests |
| `chore` | Build process or auxiliary tool changes |

### Examples

```
feat(betting): add Kelly criterion calculator
fix(scraping): handle Cloudflare 403 challenge
docs(readme): update installation steps
refactor(tennis): extract match-card component
```

## UI Changes

For any UI-related changes:

1. **Test in browser** — verify the change looks correct
2. **Take a screenshot** — include before/after if applicable
3. **Check responsive** — test on mobile and desktop
4. **Check dark mode** — verify both themes work

## Skills Development

When adding or modifying skills:

1. **Follow the skill structure**:
   ```
   .opencode/skills/<skill-name>/
   ├── SKILL.md          # Documentation
   ├── index.ts          # Entry point (if needed)
   └── references/       # Reference docs
   ```

2. **Update COMPONENTS.md** if adding new components

3. **Test the skill** — verify it works with opencode and cline

## Security

**Never commit secrets**. See [SECURITY.md](./SECURITY.md) for details.

- `.env` contains live API keys — treat as confidential
- Never log or expose API keys
- Report security issues privately

## Getting Help

- **bd issues** — for bugs and feature requests
- **Discord** — for quick questions
- **GitHub Discussions** — for design discussions

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build something great.
