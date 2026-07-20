package app

import (
	"fmt"
	"strings"
)

type Result struct {
	Name    string
	Summary []string
}

func PrintHeader(name string) {
	fmt.Printf("Accessibility Agents %s\n", name)
	fmt.Println(strings.Repeat("=", len(name)+22))
}

func PrintResult(result Result) {
	PrintHeader(result.Name)
	for _, line := range result.Summary {
		fmt.Printf("- %s\n", line)
	}
}

func Prefix(level, message string) string {
	return fmt.Sprintf("[%s] %s", strings.ToUpper(level), message)
}
