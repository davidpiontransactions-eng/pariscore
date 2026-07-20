package main

import (
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
	check := flag.String("check", "all", "health area to inspect: all, runtimes, agents, hooks, mcp")
	flag.Parse()

	workingDir, err := os.Getwd()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	repoRoot, _ := repo.FindRoot(workingDir)
	requested := strings.ToLower(strings.TrimSpace(*check))
	summary := []string{app.Prefix("ok", "Requested check: "+requested)}
	failed := false
	warned := false
	include := func(name string) bool {
		return requested == "all" || requested == name
	}

	if include("runtimes") {
		for _, status := range []system.CommandStatus{
			system.CheckCommand("gh", true, "--version"),
			system.CheckCommand("git", true, "--version"),
			system.CheckCommand("java", false, "-version"),
			system.CheckCommand("node", false, "--version"),
		} {
			line := system.DescribeCommand(status)
			summary = append(summary, line)
			if !status.Available && status.Required {
				failed = true
			}
			if !status.Available && !status.Required {
				warned = true
			}
		}
	}

	if include("agents") {
		if repoRoot == "" {
			summary = append(summary, app.Prefix("warn", "Repository root not detected; skipping agent inventory"))
			warned = true
		} else {
			copilotAgents, errA := system.CountFiles(filepath.Join(repoRoot, ".github", "agents"), func(path string) bool { return strings.HasSuffix(path, ".agent.md") })
			skills, errS := system.CountFiles(filepath.Join(repoRoot, ".github", "skills"), func(path string) bool { return filepath.Base(path) == "SKILL.md" })
			claudeAgents, errC := system.CountFiles(filepath.Join(repoRoot, ".claude", "agents"), func(path string) bool { return strings.HasSuffix(path, ".md") })
			if errA != nil || errS != nil || errC != nil {
				summary = append(summary, app.Prefix("fail", "Failed to inventory agent or skill files"))
				failed = true
			} else {
				summary = append(summary, app.Prefix("ok", fmt.Sprintf("Copilot agents: %d", copilotAgents)))
				summary = append(summary, app.Prefix("ok", fmt.Sprintf("Copilot skills: %d", skills)))
				summary = append(summary, app.Prefix("ok", fmt.Sprintf("Claude agents: %d", claudeAgents)))
				if copilotAgents == 0 || skills == 0 {
					failed = true
				}
			}
		}
	}

	if include("hooks") {
		if repoRoot == "" {
			summary = append(summary, app.Prefix("warn", "Repository root not detected; skipping hook status"))
			warned = true
		} else {
			status, err := hooks.Inspect(repoRoot)
			if err != nil {
				summary = append(summary, app.Prefix("fail", err.Error()))
				failed = true
			} else if status.Installed && status.Ours {
				summary = append(summary, app.Prefix("ok", "Pre-commit hook is installed and managed by Accessibility Agents"))
			} else if status.Installed {
				summary = append(summary, app.Prefix("warn", "A pre-commit hook exists but is not managed by Accessibility Agents"))
				warned = true
			} else {
				summary = append(summary, app.Prefix("warn", "Pre-commit hook is not installed"))
				warned = true
			}
		}
	}

	if include("mcp") {
		if repoRoot == "" {
			summary = append(summary, app.Prefix("warn", "Repository root not detected; skipping MCP checks"))
			warned = true
		} else {
			mcpDir := filepath.Join(repoRoot, "mcp-server")
			if !system.FileExists(filepath.Join(mcpDir, "package.json")) {
				summary = append(summary, app.Prefix("warn", "mcp-server/package.json not found"))
				warned = true
			} else {
				summary = append(summary, app.Prefix("ok", "MCP server package.json detected"))
				if system.FileExists(filepath.Join(mcpDir, "node_modules", "@modelcontextprotocol", "sdk", "package.json")) && system.FileExists(filepath.Join(mcpDir, "node_modules", "zod", "package.json")) {
					summary = append(summary, app.Prefix("ok", "MCP base dependencies installed"))
				} else {
					summary = append(summary, app.Prefix("warn", "MCP base dependencies not installed"))
					warned = true
				}
			}
		}
	}

	configFound := false
	for _, path := range config.ExistingConfigPaths(workingDir, repoRoot) {
		if _, err := os.Stat(path); err == nil {
			configFound = true
			if cfg, err := config.Load(path); err == nil {
				summary = append(summary, app.Prefix("ok", fmt.Sprintf("Config found at %s (role=%s, scope=%s)", path, cfg.Role, cfg.Scope)))
			} else {
				summary = append(summary, app.Prefix("warn", "Config exists but could not be parsed: "+path))
				warned = true
			}
		}
	}
	if !configFound {
		summary = append(summary, app.Prefix("warn", "No Accessibility Agents config file found yet"))
		warned = true
	}
	profiles := 0
	for _, profile := range system.VSCodeProfiles() {
		if system.FileExists(profile) {
			profiles++
		}
	}
	if profiles > 0 {
		summary = append(summary, app.Prefix("ok", fmt.Sprintf("VS Code profiles detected: %d", profiles)))
	} else {
		summary = append(summary, app.Prefix("warn", "No VS Code profiles detected"))
		warned = true
	}

	app.PrintResult(app.Result{Name: "Health", Summary: summary})
	if failed {
		os.Exit(1)
	}
	if warned {
		os.Exit(0)
	}
}
