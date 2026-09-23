#!/usr/bin/env bash
# SessionStart hook for PariScore Superpowers + Caveman (mode obligatoire)
# Reads using-superpowers + caveman SKILL.md and injects bootstrap context

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKILL_PATH="${PLUGIN_ROOT}/skills/using-superpowers/SKILL.md"
CAVEMAN_PATH="${PLUGIN_ROOT}/skills/caveman/SKILL.md"

if [ ! -f "$SKILL_PATH" ]; then
    echo '{"additionalContext": "PariScore Superpowers loaded (skill file not found)"}'
    exit 0
fi

# Read the skill file
SKILL_CONTENT=$(cat "$SKILL_PATH")
CAVEMAN_CONTENT=""
if [ -f "$CAVEMAN_PATH" ]; then
    CAVEMAN_CONTENT=$(cat "$CAVEMAN_PATH")
fi

# Escape for JSON
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

SKILL_ESCAPED=$(escape_for_json "$SKILL_CONTENT")
CAVEMAN_ESCAPED=$(escape_for_json "$CAVEMAN_CONTENT")

BOOTSTRAP="<EXTREMELY_IMPORTANT>\\nYou have PariScore Superpowers.\\n\\nSUPERPOWERS = SYSTEMATIQUES (injecte au demarrage de CHAQUE session).\\nApplique using-superpowers a CHAQUE tache meme sans demande explicite :\\n- tache creative -> brainstorming d'abord\\n- bug -> systematic-debugging avant fix\\n- edition code -> research (Grep/Glob/Read) avant d'ecrire\\n- avant de dire \\\\\"fait\\\\\" -> verification-before-completion (gates executed)\\n- >=2 taches independantes -> dispatching-parallel-agents (task tool)\\nSkills dans le skill tool + .agents/tools-active/.\\n\\nBelow is the full content of your 'using-superpowers' skill - your introduction to using skills. For all other skills, use the 'skill' tool:\\n\\n${SKILL_ESCAPED}\\n\\n**Tool Mapping for OpenCode (PariScore):**\\n- Create or update todos: todowrite\\n- Invoke a skill: skill tool\\n- Read files: read\\n- Create/edit/delete files: write/edit\\n- Run shell commands: oc_bash (CMD, NOT bash)\\n- Search files: grep, oc_glob\\n- Fetch a URL: webfetch\\n\\nCRITICAL: Always use CMD syntax, never bash (Windows).\\n\\n## CAVEMAN MODE - OBLIGATOIRE (lance au demarrage)\\nApplique le skill caveman ci-dessous a CHAQUE reponse (telegraphique, tokens minimaux). Actif jusqu'a \\\"normal mode\\\".\\n\\n${CAVEMAN_ESCAPED}\\n</EXTREMELY_IMPORTANT>"

printf '{"additionalContext": "%s"}\n' "$BOOTSTRAP"

exit 0
