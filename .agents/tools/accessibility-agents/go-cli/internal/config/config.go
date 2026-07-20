package config

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Community-Access/accessibility-agents/go-cli/internal/repo"
)

type InstallConfig struct {
	Role           string   `json:"role"`
	Scope          string   `json:"scope"`
	Platforms      []string `json:"platforms"`
	TeamConfigPath string   `json:"teamConfigPath,omitempty"`
	GitHooks       bool     `json:"gitHooks"`
	MCPPort        int      `json:"mcpPort,omitempty"`
	RepoRoot       string   `json:"repoRoot,omitempty"`
	CreatedAt      string   `json:"createdAtUtc"`
	UpdatedAt      string   `json:"updatedAtUtc"`
}

func ValidateRole(role string) error {
	switch role {
	case "developer", "reviewer", "author", "full", "custom":
		return nil
	default:
		return errors.New("role must be one of developer, reviewer, author, full, custom")
	}
}

func ValidateScope(scope string) error {
	switch scope {
	case "global", "project":
		return nil
	default:
		return errors.New("scope must be global or project")
	}
}

func normalizePlatforms(platforms []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(platforms))
	for _, platform := range platforms {
		clean := strings.TrimSpace(strings.ToLower(platform))
		if clean == "" || seen[clean] {
			continue
		}
		seen[clean] = true
		result = append(result, clean)
	}
	return result
}

func Path(scope, workingDir, repoRoot string) (string, error) {
	if err := ValidateScope(scope); err != nil {
		return "", err
	}
	if scope == "global" {
		home, err := repo.HomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, ".accessibility-agents", "config.json"), nil
	}
	base := repoRoot
	if base == "" {
		base = workingDir
	}
	return filepath.Join(base, ".accessibility-agents", "config.json"), nil
}

func Save(path string, cfg InstallConfig) error {
	now := time.Now().UTC().Format(time.RFC3339)
	if cfg.CreatedAt == "" {
		cfg.CreatedAt = now
	}
	cfg.UpdatedAt = now
	cfg.Platforms = normalizePlatforms(cfg.Platforms)
	if err := repo.EnsureDir(filepath.Dir(path)); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}

func Load(path string) (InstallConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return InstallConfig{}, err
	}
	var cfg InstallConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return InstallConfig{}, err
	}
	cfg.Platforms = normalizePlatforms(cfg.Platforms)
	return cfg, nil
}

func ExistingConfigPaths(workingDir, repoRoot string) []string {
	paths := []string{}
	globalPath, err := Path("global", workingDir, repoRoot)
	if err == nil {
		paths = append(paths, globalPath)
	}
	projectPath, err := Path("project", workingDir, repoRoot)
	if err == nil {
		paths = append(paths, projectPath)
	}
	return paths
}
