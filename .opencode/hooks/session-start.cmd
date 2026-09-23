@echo off
REM SessionStart hook for PariScore Superpowers + Caveman (mode obligatoire)
REM Reads using-superpowers + caveman SKILL.md and injects bootstrap context

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PLUGIN_ROOT=%SCRIPT_DIR%.."
set "SKILL_PATH=%PLUGIN_ROOT%\skills\using-superpowers\SKILL.md"
set "CAVEMAN_PATH=%PLUGIN_ROOT%\skills\caveman\SKILL.md"

if not exist "%SKILL_PATH%" (
    echo {"additionalContext": "PariScore Superpowers loaded (skill file not found)"}
    exit /b 0
)

REM Read the skill file content
set "SKILL_CONTENT="
for /f "usebackq delims=" %%a in ("%SKILL_PATH%") do (
    if defined SKILL_CONTENT (
        set "SKILL_CONTENT=!SKILL_CONTENT!\n%%a"
    ) else (
        set "SKILL_CONTENT=%%a"
    )
)

REM Read caveman skill (mode communication obligatoire)
set "CAVEMAN_CONTENT="
if exist "%CAVEMAN_PATH%" (
    for /f "usebackq delims=" %%a in ("%CAVEMAN_PATH%") do (
        if defined CAVEMAN_CONTENT (
            set "CAVEMAN_CONTENT=!CAVEMAN_CONTENT!\n%%a"
        ) else (
            set "CAVEMAN_CONTENT=%%a"
        )
    )
)

REM Build the bootstrap message
set "BOOTSTRAP=<EXTREMELY_IMPORTANT>\nYou have PariScore Superpowers.\n\nBelow is the full content of your 'using-superpowers' skill - your introduction to using skills. For all other skills, use the 'skill' tool:\n\n!SKILL_CONTENT!\n\n**Tool Mapping for OpenCode (PariScore):**\n- Create or update todos: todowrite\n- Invoke a skill: skill tool\n- Read files: read\n- Create/edit/delete files: write/edit\n- Run shell commands: oc_bash (CMD, NOT bash)\n- Search files: grep, oc_glob\n- Fetch a URL: webfetch\n\nCRITICAL: Always use CMD syntax, never bash (Windows).\n\n## CAVEMAN MODE - OBLIGATOIRE (lance au demarrage)\nApplique le skill caveman ci-dessous a CHAQUE réponse (telegraphique, tokens minimaux). Actif jusqu'a \"normal mode\".\n\n!CAVEMAN_CONTENT!\n</EXTREMELY_IMPORTANT>"

REM Output as JSON
echo {"additionalContext": "%BOOTSTRAP%"}

endlocal
exit /b 0
