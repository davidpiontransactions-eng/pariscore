package hooks

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Status struct {
	RepoRoot    string
	SourcePath  string
	TargetPath  string
	BackupPath  string
	RepoFound   bool
	SourceFound bool
	Installed   bool
	Ours        bool
	BackupFound bool
}

func Inspect(repoRoot string) (Status, error) {
	status := Status{RepoRoot: repoRoot}
	if repoRoot == "" {
		return status, fmt.Errorf("repository root not provided")
	}
	status.RepoFound = true
	status.SourcePath = filepath.Join(repoRoot, "scripts", "pre-commit")
	status.TargetPath = filepath.Join(repoRoot, ".git", "hooks", "pre-commit")
	status.BackupPath = status.TargetPath + ".backup"
	if _, err := os.Stat(status.SourcePath); err == nil {
		status.SourceFound = true
	}
	if data, err := os.ReadFile(status.TargetPath); err == nil {
		status.Installed = true
		content := string(data)
		status.Ours = strings.Contains(content, "validate-agents")
	}
	if _, err := os.Stat(status.BackupPath); err == nil {
		status.BackupFound = true
	}
	return status, nil
}

func Install(repoRoot string) (Status, error) {
	status, err := Inspect(repoRoot)
	if err != nil {
		return status, err
	}
	if !status.SourceFound {
		return status, fmt.Errorf("hook source not found: %s", status.SourcePath)
	}
	if err := os.MkdirAll(filepath.Dir(status.TargetPath), 0o755); err != nil {
		return status, err
	}
	if status.Installed && !status.Ours {
		if err := copyFile(status.TargetPath, status.BackupPath, 0o644); err != nil {
			return status, err
		}
	}
	if err := copyFile(status.SourcePath, status.TargetPath, 0o755); err != nil {
		return status, err
	}
	return Inspect(repoRoot)
}

func Uninstall(repoRoot string) (Status, error) {
	status, err := Inspect(repoRoot)
	if err != nil {
		return status, err
	}
	if !status.Installed {
		return status, nil
	}
	if !status.Ours {
		return status, fmt.Errorf("pre-commit hook exists but is not managed by Accessibility Agents")
	}
	if status.BackupFound {
		if err := os.Rename(status.BackupPath, status.TargetPath); err != nil {
			return status, err
		}
	} else if err := os.Remove(status.TargetPath); err != nil {
		return status, err
	}
	return Inspect(repoRoot)
}

func Test(repoRoot string) error {
	status, err := Inspect(repoRoot)
	if err != nil {
		return err
	}
	if !status.SourceFound {
		return fmt.Errorf("source hook is missing")
	}
	if !status.Installed {
		return fmt.Errorf("hook is not installed")
	}
	if !status.Ours {
		return fmt.Errorf("installed hook is not managed by Accessibility Agents")
	}
	source, err := os.ReadFile(status.SourcePath)
	if err != nil {
		return err
	}
	target, err := os.ReadFile(status.TargetPath)
	if err != nil {
		return err
	}
	if string(source) != string(target) {
		return fmt.Errorf("installed hook differs from source hook")
	}
	return nil
}

func copyFile(source, destination string, mode os.FileMode) error {
	data, err := os.ReadFile(source)
	if err != nil {
		return err
	}
	if err := os.WriteFile(destination, data, mode); err != nil {
		return err
	}
	return nil
}
