package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Community-Access/accessibility-agents/go-cli/internal/app"
	"github.com/Community-Access/accessibility-agents/go-cli/internal/config"
	"github.com/Community-Access/accessibility-agents/go-cli/internal/hooks"
	"github.com/Community-Access/accessibility-agents/go-cli/internal/repo"
	"github.com/Community-Access/accessibility-agents/go-cli/internal/system"
)

func main() {
	role := flag.String("role", "developer", "installation role: developer, reviewer, author, full, custom")
	scope := flag.String("scope", "global", "installation scope: global or project")
	teamConfigPath := flag.String("config", "", "optional path to team configuration JSON")
	platformsFlag := flag.String("platforms", "", "comma-separated platforms: vscode, claude, codex, gemini")
	hooksFlag := flag.Bool("hooks", false, "install repository pre-commit hook when inside a git repository")
	mcpPort := flag.Int("mcp-port", 8080, "default MCP port to persist in config")
	yes := flag.Bool("yes", false, "accept defaults without prompting")
	flag.Parse()

	workingDir, err := os.Getwd()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	repoRoot, _ := repo.FindRoot(workingDir)
	selectedRole := *role
	selectedScope := *scope
	selectedPlatforms := parsePlatforms(*platformsFlag)
	installHooks := *hooksFlag

	if !*yes {
		selectedRole = promptWithDefault("Role", selectedRole)
		selectedScope = promptWithDefault("Scope", selectedScope)
		if len(selectedPlatforms) == 0 {
			selectedPlatforms = parsePlatforms(promptWithDefault("Platforms (comma-separated)", strings.Join(system.DetectPlatforms(), ",")))
		}
		installHooks = parseBool(promptWithDefault("Install git hooks? (y/n)", boolLabel(installHooks)))
	}
	if err := config.ValidateRole(selectedRole); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	if err := config.ValidateScope(selectedScope); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	if len(selectedPlatforms) == 0 {
		selectedPlatforms = system.DetectPlatforms()
	}
	if *teamConfigPath != "" {
		if _, err := os.Stat(*teamConfigPath); err != nil {
			fmt.Fprintf(os.Stderr, "team config not found: %s\n", *teamConfigPath)
			os.Exit(2)
		}
	}
	configPath, err := config.Path(selectedScope, workingDir, repoRoot)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	cfg := config.InstallConfig{
		Role:           selectedRole,
		Scope:          selectedScope,
		Platforms:      selectedPlatforms,
		TeamConfigPath: *teamConfigPath,
		GitHooks:       installHooks,
		MCPPort:        *mcpPort,
		RepoRoot:       repoRoot,
	}
	if err := config.Save(configPath, cfg); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	summary := []string{
		app.Prefix("ok", "Configuration written to "+configPath),
		app.Prefix("ok", "Role: "+selectedRole),
		app.Prefix("ok", "Scope: "+selectedScope),
		app.Prefix("ok", "Platforms: "+strings.Join(selectedPlatforms, ", ")),
	}
	if *teamConfigPath != "" {
		summary = append(summary, app.Prefix("ok", "Team config: "+filepath.Clean(*teamConfigPath)))
	}
	if installHooks {
		if repoRoot == "" {
			summary = append(summary, app.Prefix("warn", "Hooks requested but no git repository was detected"))
		} else if _, err := hooks.Install(repoRoot); err != nil {
			summary = append(summary, app.Prefix("fail", "Hook install failed: "+err.Error()))
		} else {
			summary = append(summary, app.Prefix("ok", "Repository pre-commit hook installed"))
		}
	}
	app.PrintResult(app.Result{Name: "Setup", Summary: summary})
}

func promptWithDefault(label, defaultValue string) string {
	reader := bufio.NewReader(os.Stdin)
	fmt.Printf("%s [%s]: ", label, defaultValue)
	line, err := reader.ReadString('\n')
	if err != nil {
		return defaultValue
	}
	line = strings.TrimSpace(line)
	if line == "" {
		return defaultValue
	}
	return line
}

func parsePlatforms(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		clean := strings.TrimSpace(strings.ToLower(part))
		if clean != "" {
			result = append(result, clean)
		}
	}
	return result
}

func parseBool(value string) bool {
	value = strings.ToLower(strings.TrimSpace(value))
	return value == "y" || value == "yes" || value == "true" || value == "1"
}

func boolLabel(value bool) string {
	if value {
		return "y"
	}
	return "n"
}
