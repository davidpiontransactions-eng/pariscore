package manifest

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestGenerateIncludesExpectedEntries(t *testing.T) {
	repoRoot := t.TempDir()
	writeTestFile(t, filepath.Join(repoRoot, ".claude", "agents", "alpha.md"), "alpha")
	writeTestFile(t, filepath.Join(repoRoot, ".github", "agents", "lead.agent.md"), "lead")
	writeTestFile(t, filepath.Join(repoRoot, ".github", "copilot-instructions.md"), "instructions")
	writeTestFile(t, filepath.Join(repoRoot, ".github", "instructions", "web", "baseline.instructions.md"), "baseline")
	writeTestFile(t, filepath.Join(repoRoot, ".github", "skills", "sample", "SKILL.md"), "skill")
	writeTestFile(t, filepath.Join(repoRoot, ".github", "prompts", "audit.prompt.md"), "prompt")
	writeTestFile(t, filepath.Join(repoRoot, ".codex", "AGENTS.md"), "agents")
	writeTestFile(t, filepath.Join(repoRoot, ".codex", "config.toml"), "config")
	writeTestFile(t, filepath.Join(repoRoot, ".codex", "roles", "lead.toml"), "role")
	writeTestFile(t, filepath.Join(repoRoot, ".codex", "agents", "aria-specialist.toml"), "agent")
	writeTestFile(t, filepath.Join(repoRoot, "codex-plugin", ".codex-plugin", "plugin.json"), "{}")
	writeTestFile(t, filepath.Join(repoRoot, ".a11y-agents", "extensions", "core", "extension.json"), "{}")
	writeTestFile(t, filepath.Join(repoRoot, ".gemini", "extensions", "a11y-agents", "gemini-extension.json"), "{}")

	entries, err := Generate(repoRoot)
	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}

	expected := []string{
		"agents/alpha.md",
		"copilot-agents/lead.agent.md",
		"copilot-config/copilot-instructions.md",
		"copilot-instructions/web/baseline.instructions.md",
		"copilot-prompts/audit.prompt.md",
		"copilot-skills/sample/SKILL.md",
		"codex/AGENTS.md",
		"a11y-extensions/core/extension.json",
		"codex-plugin/.codex-plugin/plugin.json",
		"codex/agents/aria-specialist.toml",
		"codex/config.toml",
		"codex/roles/lead.toml",
		"gemini/gemini-extension.json",
	}
	for _, item := range expected {
		if !slices.Contains(entries, item) {
			t.Fatalf("expected manifest to contain %q; got %#v", item, entries)
		}
	}
}

func TestWriteCreatesSortedManifestFile(t *testing.T) {
	repoRoot := t.TempDir()
	writeTestFile(t, filepath.Join(repoRoot, ".github", "prompts", "zeta.prompt.md"), "zeta")
	writeTestFile(t, filepath.Join(repoRoot, ".github", "prompts", "alpha.prompt.md"), "alpha")

	manifestPath, count, err := Write(repoRoot)
	if err != nil {
		t.Fatalf("Write() error = %v", err)
	}
	if count != 2 {
		t.Fatalf("Write() count = %d, want 2", count)
	}
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatalf("ReadFile(%q) error = %v", manifestPath, err)
	}
	content := string(data)
	if !strings.Contains(content, "copilot-prompts/alpha.prompt.md\n") || !strings.Contains(content, "copilot-prompts/zeta.prompt.md\n") {
		t.Fatalf("unexpected manifest content: %q", content)
	}
	if strings.Index(content, "alpha") > strings.Index(content, "zeta") {
		t.Fatalf("manifest entries are not sorted: %q", content)
	}
}

func writeTestFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll(%q) error = %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("WriteFile(%q) error = %v", path, err)
	}
}
