package main

import (
	"flag"
	"fmt"
	"os"
	"strings"

	"github.com/Community-Access/accessibility-agents/go-cli/internal/app"
	"github.com/Community-Access/accessibility-agents/go-cli/internal/hooks"
	"github.com/Community-Access/accessibility-agents/go-cli/internal/repo"
)

func main() {
	action := flag.String("action", "status", "hook action: install, uninstall, status, test")
	flag.Parse()

	requested := *action
	if flag.NArg() > 0 {
		requested = flag.Arg(0)
	}
	requested = strings.ToLower(strings.TrimSpace(requested))
	workingDir, err := os.Getwd()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	repoRoot, err := repo.FindRoot(workingDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, "git repository root not found")
		os.Exit(1)
	}
	summary := []string{app.Prefix("ok", "Requested action: "+requested)}
	switch requested {
	case "install":
		status, err := hooks.Install(repoRoot)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		summary = append(summary, describeStatus(status)...)
	case "uninstall":
		status, err := hooks.Uninstall(repoRoot)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		summary = append(summary, describeStatus(status)...)
	case "test":
		if err := hooks.Test(repoRoot); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		summary = append(summary, app.Prefix("ok", "Hook installation matches the source hook"))
	case "status":
		status, err := hooks.Inspect(repoRoot)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		summary = append(summary, describeStatus(status)...)
	default:
		fmt.Fprintf(os.Stderr, "unsupported hook action: %s\n", requested)
		os.Exit(2)
	}
	app.PrintResult(app.Result{Name: "Hooks", Summary: summary})
}

func describeStatus(status hooks.Status) []string {
	lines := []string{}
	if status.SourceFound {
		lines = append(lines, app.Prefix("ok", "Source hook found: "+status.SourcePath))
	} else {
		lines = append(lines, app.Prefix("fail", "Source hook missing: "+status.SourcePath))
	}
	if status.Installed {
		level := "ok"
		message := "Installed hook detected at " + status.TargetPath
		if !status.Ours {
			level = "warn"
			message = "Installed hook exists but is not managed by Accessibility Agents"
		}
		lines = append(lines, app.Prefix(level, message))
	} else {
		lines = append(lines, app.Prefix("warn", "No installed pre-commit hook found at "+status.TargetPath))
	}
	if status.BackupFound {
		lines = append(lines, app.Prefix("ok", "Backup hook available at "+status.BackupPath))
	}
	return lines
}
