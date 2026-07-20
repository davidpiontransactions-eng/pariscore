#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
GO_CLI_ROOT="$REPO_ROOT/go-cli"
OUTPUT_ROOT="$GO_CLI_ROOT/bin"

if ! command -v go >/dev/null 2>&1; then
  echo "Go is not installed or not on PATH. Install Go 1.23+ and rerun this script." >&2
  exit 1
fi

mkdir -p "$OUTPUT_ROOT"

build_target() {
  local name="$1"
  local output="$2"
  local package="$3"
  echo "Building ${name} -> ${output}"
  go build -o "$output" "$package"
}

cd "$GO_CLI_ROOT"

build_target setup  "$OUTPUT_ROOT/a11y-agents-setup"  ./cmd/setup
build_target health "$OUTPUT_ROOT/a11y-agents-health" ./cmd/health
build_target repair "$OUTPUT_ROOT/a11y-agents-repair" ./cmd/repair
build_target hooks  "$OUTPUT_ROOT/a11y-agents-hooks"  ./cmd/hooks

echo "Build complete. Binaries are in $OUTPUT_ROOT"