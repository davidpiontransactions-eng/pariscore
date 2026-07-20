package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestPathForProjectAndGlobal(t *testing.T) {
	projectPath, err := Path("project", `C:\work`, `C:\repo`)
	if err != nil {
		t.Fatalf("Path(project) error = %v", err)
	}
	if want := filepath.Join(`C:\repo`, ".accessibility-agents", "config.json"); projectPath != want {
		t.Fatalf("project path = %q, want %q", projectPath, want)
	}

	home := t.TempDir()
	t.Setenv("USERPROFILE", home)
	t.Setenv("HOME", home)
	globalPath, err := Path("global", `C:\work`, `C:\repo`)
	if err != nil {
		t.Fatalf("Path(global) error = %v", err)
	}
	if want := filepath.Join(home, ".accessibility-agents", "config.json"); globalPath != want {
		t.Fatalf("global path = %q, want %q", globalPath, want)
	}
}

func TestSaveAndLoadNormalizesPlatforms(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	input := InstallConfig{
		Role:      "developer",
		Scope:     "project",
		Platforms: []string{"VSCode", "claude", "vscode", "  CLAUDE  "},
		GitHooks:  true,
		MCPPort:   8080,
	}

	if err := Save(path, input); err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	loaded, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if loaded.Role != "developer" || loaded.Scope != "project" {
		t.Fatalf("loaded config has unexpected identity fields: %+v", loaded)
	}
	if len(loaded.Platforms) != 2 || loaded.Platforms[0] != "vscode" || loaded.Platforms[1] != "claude" {
		t.Fatalf("loaded platforms = %#v, want [vscode claude]", loaded.Platforms)
	}
	if loaded.CreatedAt == "" || loaded.UpdatedAt == "" {
		t.Fatalf("expected timestamps to be populated, got %+v", loaded)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("expected config file on disk: %v", err)
	}
}

func TestExistingConfigPathsReturnsGlobalAndProject(t *testing.T) {
	home := t.TempDir()
	t.Setenv("USERPROFILE", home)
	t.Setenv("HOME", home)
	paths := ExistingConfigPaths(filepath.Join(home, "work"), filepath.Join(home, "repo"))
	if len(paths) != 2 {
		t.Fatalf("ExistingConfigPaths() len = %d, want 2", len(paths))
	}
	if paths[0] == paths[1] {
		t.Fatalf("expected distinct global/project config paths, got %#v", paths)
	}
}
