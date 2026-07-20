package manifest

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func Generate(repoRoot string) ([]string, error) {
	lines := []string{}
	addMatches := func(base, pattern, prefix string) error {
		matches, err := filepath.Glob(filepath.Join(base, pattern))
		if err != nil {
			return err
		}
		for _, match := range matches {
			info, err := os.Stat(match)
			if err != nil || info.IsDir() {
				continue
			}
			rel, err := filepath.Rel(base, match)
			if err != nil {
				return err
			}
			lines = append(lines, prefix+filepath.ToSlash(rel))
		}
		return nil
	}

	_ = addMatches(filepath.Join(repoRoot, ".claude", "agents"), "*.md", "agents/")
	_ = addMatches(filepath.Join(repoRoot, ".github", "agents"), "*.agent.md", "copilot-agents/")
	_ = addMatches(filepath.Join(repoRoot, ".github"), "copilot-*.md", "copilot-config/")
	_ = filepath.Walk(filepath.Join(repoRoot, ".github", "instructions"), walker(filepath.Join(repoRoot, ".github", "instructions"), "copilot-instructions/", "*.instructions.md", &lines))
	_ = filepath.Walk(filepath.Join(repoRoot, ".github", "skills"), walker(filepath.Join(repoRoot, ".github", "skills"), "copilot-skills/", "SKILL.md", &lines))
	_ = filepath.Walk(filepath.Join(repoRoot, ".github", "prompts"), walker(filepath.Join(repoRoot, ".github", "prompts"), "copilot-prompts/", "*.prompt.md", &lines))

	if exists(filepath.Join(repoRoot, ".codex", "AGENTS.md")) {
		lines = append(lines, "codex/AGENTS.md")
	}
	if exists(filepath.Join(repoRoot, ".codex", "config.toml")) {
		lines = append(lines, "codex/config.toml")
	}
	_ = filepath.Walk(filepath.Join(repoRoot, ".codex", "roles"), walker(filepath.Join(repoRoot, ".codex", "roles"), "codex/roles/", "*.toml", &lines))
	_ = filepath.Walk(filepath.Join(repoRoot, ".codex", "agents"), walker(filepath.Join(repoRoot, ".codex", "agents"), "codex/agents/", "*.toml", &lines))
	_ = filepath.Walk(filepath.Join(repoRoot, "codex-plugin"), walker(filepath.Join(repoRoot, "codex-plugin"), "codex-plugin/", "*", &lines))
	_ = filepath.Walk(filepath.Join(repoRoot, ".a11y-agents", "extensions"), walker(filepath.Join(repoRoot, ".a11y-agents", "extensions"), "a11y-extensions/", "extension.json", &lines))
	_ = filepath.Walk(filepath.Join(repoRoot, ".gemini", "extensions", "a11y-agents"), walker(filepath.Join(repoRoot, ".gemini", "extensions", "a11y-agents"), "gemini/", "*", &lines))

	lines = unique(lines)
	sort.Strings(lines)
	return lines, nil
}

func Write(repoRoot string) (string, int, error) {
	lines, err := Generate(repoRoot)
	if err != nil {
		return "", 0, err
	}
	path := filepath.Join(repoRoot, ".a11y-agent-manifest")
	content := strings.Join(lines, "\n")
	if content != "" {
		content += "\n"
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return "", 0, err
	}
	return path, len(lines), nil
}

func walker(base, prefix, pattern string, lines *[]string) filepath.WalkFunc {
	return func(path string, info os.FileInfo, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		if info.IsDir() {
			return nil
		}
		match, err := filepath.Match(pattern, filepath.Base(path))
		if err != nil || !match {
			if pattern == "*" {
				match = true
			}
		}
		if !match {
			return nil
		}
		rel, err := filepath.Rel(base, path)
		if err != nil {
			return err
		}
		*lines = append(*lines, prefix+filepath.ToSlash(rel))
		return nil
	}
}

func unique(values []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(values))
	for _, value := range values {
		if seen[value] {
			continue
		}
		seen[value] = true
		result = append(result, value)
	}
	return result
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
