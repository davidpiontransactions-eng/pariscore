package hooks

import (
	"os"
	"path/filepath"
	"testing"
)

func TestInstallCopiesSourceHook(t *testing.T) {
	repoRoot := t.TempDir()
	writeHookFile(t, filepath.Join(repoRoot, "scripts", "pre-commit"), "#!/bin/sh\nvalidate-agents\n")
	if err := os.MkdirAll(filepath.Join(repoRoot, ".git", "hooks"), 0o755); err != nil {
		t.Fatalf("MkdirAll hooks dir error = %v", err)
	}

	status, err := Install(repoRoot)
	if err != nil {
		t.Fatalf("Install() error = %v", err)
	}
	if !status.Installed || !status.Ours {
		t.Fatalf("expected installed managed hook, got %+v", status)
	}
	if err := Test(repoRoot); err != nil {
		t.Fatalf("Test() error = %v", err)
	}
}

func TestInstallBacksUpExistingForeignHook(t *testing.T) {
	repoRoot := t.TempDir()
	writeHookFile(t, filepath.Join(repoRoot, "scripts", "pre-commit"), "#!/bin/sh\nvalidate-agents\n")
	writeHookFile(t, filepath.Join(repoRoot, ".git", "hooks", "pre-commit"), "#!/bin/sh\necho foreign\n")

	status, err := Install(repoRoot)
	if err != nil {
		t.Fatalf("Install() error = %v", err)
	}
	if !status.BackupFound {
		t.Fatalf("expected backup to be created, got %+v", status)
	}
	backup, err := os.ReadFile(filepath.Join(repoRoot, ".git", "hooks", "pre-commit.backup"))
	if err != nil {
		t.Fatalf("ReadFile(backup) error = %v", err)
	}
	if string(backup) != "#!/bin/sh\necho foreign\n" {
		t.Fatalf("unexpected backup content: %q", string(backup))
	}
}

func TestUninstallRestoresBackup(t *testing.T) {
	repoRoot := t.TempDir()
	writeHookFile(t, filepath.Join(repoRoot, "scripts", "pre-commit"), "#!/bin/sh\nvalidate-agents\n")
	writeHookFile(t, filepath.Join(repoRoot, ".git", "hooks", "pre-commit"), "#!/bin/sh\necho foreign\n")
	if _, err := Install(repoRoot); err != nil {
		t.Fatalf("Install() error = %v", err)
	}

	status, err := Uninstall(repoRoot)
	if err != nil {
		t.Fatalf("Uninstall() error = %v", err)
	}
	if !status.Installed || status.Ours {
		t.Fatalf("expected restored foreign hook after uninstall, got %+v", status)
	}
	data, err := os.ReadFile(filepath.Join(repoRoot, ".git", "hooks", "pre-commit"))
	if err != nil {
		t.Fatalf("ReadFile(restored hook) error = %v", err)
	}
	if string(data) != "#!/bin/sh\necho foreign\n" {
		t.Fatalf("unexpected restored hook content: %q", string(data))
	}
}

func writeHookFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("MkdirAll(%q) error = %v", path, err)
	}
	if err := os.WriteFile(path, []byte(content), 0o755); err != nil {
		t.Fatalf("WriteFile(%q) error = %v", path, err)
	}
}
