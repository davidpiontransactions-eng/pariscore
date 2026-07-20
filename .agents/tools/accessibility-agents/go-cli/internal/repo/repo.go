package repo

import (
	"errors"
	"os"
	"path/filepath"
)

func FindRoot(start string) (string, error) {
	current := start
	for {
		if current == "" {
			return "", errors.New("empty start path")
		}
		if info, err := os.Stat(filepath.Join(current, ".git")); err == nil && info.IsDir() {
			return current, nil
		}
		parent := filepath.Dir(current)
		if parent == current {
			return "", errors.New("git repository root not found")
		}
		current = parent
	}
}

func HomeDir() (string, error) {
	return os.UserHomeDir()
}

func EnsureDir(path string) error {
	return os.MkdirAll(path, 0o755)
}
