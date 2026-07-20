package system

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

type CommandStatus struct {
	Name      string
	Available bool
	Path      string
	Version   string
	Required  bool
	Details   string
}

func CheckCommand(name string, required bool, versionArgs ...string) CommandStatus {
	status := CommandStatus{Name: name, Required: required}
	path, err := exec.LookPath(name)
	if err != nil {
		return status
	}
	status.Available = true
	status.Path = path
	args := versionArgs
	if len(args) == 0 {
		args = []string{"--version"}
	}
	out, err := exec.Command(path, args...).CombinedOutput()
	if err == nil {
		status.Version = strings.TrimSpace(string(out))
	} else {
		status.Details = strings.TrimSpace(string(out))
	}
	return status
}

func FileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func CountFiles(root string, predicate func(string) bool) (int, error) {
	count := 0
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if predicate(path) {
			count++
		}
		return nil
	})
	return count, err
}

func DetectPlatforms() []string {
	platforms := []string{}
	appendIf := func(name string, condition bool) {
		if condition {
			platforms = append(platforms, name)
		}
	}
	home, _ := os.UserHomeDir()
	appendIf("vscode", hasVSCodeProfile())
	appendIf("claude", FileExists(filepath.Join(home, ".claude")) || FileExists(filepath.Join(home, ".claude", "settings.json")))
	appendIf("codex", FileExists(filepath.Join(home, ".codex")))
	appendIf("gemini", FileExists(filepath.Join(home, ".gemini")))
	if len(platforms) == 0 {
		platforms = append(platforms, "vscode")
	}
	return platforms
}

func hasVSCodeProfile() bool {
	paths := []string{}
	home, _ := os.UserHomeDir()
	switch runtime.GOOS {
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData != "" {
			paths = append(paths, filepath.Join(appData, "Code", "User"), filepath.Join(appData, "Code - Insiders", "User"))
		}
	case "darwin":
		paths = append(paths,
			filepath.Join(home, "Library", "Application Support", "Code", "User"),
			filepath.Join(home, "Library", "Application Support", "Code - Insiders", "User"),
		)
	default:
		paths = append(paths,
			filepath.Join(home, ".config", "Code", "User"),
			filepath.Join(home, ".config", "Code - Insiders", "User"),
		)
	}
	for _, path := range paths {
		if FileExists(path) {
			return true
		}
	}
	return false
}

func VSCodeProfiles() []string {
	home, _ := os.UserHomeDir()
	profiles := []string{}
	switch runtime.GOOS {
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData != "" {
			profiles = append(profiles, filepath.Join(appData, "Code", "User"), filepath.Join(appData, "Code - Insiders", "User"))
		}
	case "darwin":
		profiles = append(profiles,
			filepath.Join(home, "Library", "Application Support", "Code", "User"),
			filepath.Join(home, "Library", "Application Support", "Code - Insiders", "User"),
		)
	default:
		profiles = append(profiles,
			filepath.Join(home, ".config", "Code", "User"),
			filepath.Join(home, ".config", "Code - Insiders", "User"),
		)
	}
	return profiles
}

func RunCommand(dir, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func TrimFirstLine(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	parts := strings.Split(text, "\n")
	return strings.TrimSpace(parts[0])
}

func DescribeCommand(status CommandStatus) string {
	if !status.Available {
		if status.Required {
			return fmt.Sprintf("FAIL %s not found", status.Name)
		}
		return fmt.Sprintf("WARN %s not found", status.Name)
	}
	line := fmt.Sprintf("OK %s found at %s", status.Name, status.Path)
	if status.Version != "" {
		line += fmt.Sprintf(" (%s)", TrimFirstLine(status.Version))
	}
	return line
}
