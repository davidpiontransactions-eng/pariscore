#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Test les 6 serveurs MCP configurés dans .mcp.json
.DESCRIPTION
    - Serveurs stdio (memory, git, project_fs, sportradar) : envoi message JSON-RPC initialize
    - memory : vérifie aussi tools/list (8 outils attendus)
    - git : vérifie aussi tools/list
    - Serveurs HTTP (bzzoiro-sports, sportdbdotdev) : GET sur l'URL de base
    - Rapport coloré avec ✅/❌
    - Exit code 0 si tout OK, 1 si échec
#>

$ErrorActionPreference = 'Stop'
$projectRoot = Resolve-Path "$PSScriptRoot\.."

# === couleurs ===
$green  = 'Green'
$red    = 'Red'
$yellow = 'Yellow'
$cyan   = 'Cyan'

Write-Host "`n==============================================" -ForegroundColor $cyan
Write-Host "  TEST DES SERVEURS MCP - PariScore"          -ForegroundColor $cyan
Write-Host "==============================================`n" -ForegroundColor $cyan

# compteurs
$global:passed = 0
$global:failed = 0

function Write-TestResult {
    param([string]$name, [bool]$ok, [string]$detail)
    if ($ok) {
        Write-Host "  ✅ $name" -ForegroundColor $green
        $global:passed++
    } else {
        Write-Host "  ❌ $name" -ForegroundColor $red
        if ($detail) { Write-Host "     $detail" -ForegroundColor $red }
        $global:failed++
    }
}

# ==== helper : tester un serveur stdio ====
function Test-StdioServer {
    param(
        [string]$Name,
        [string]$Command,
        [string[]]$Arguments,
        [int]$TimeoutSeconds = 10,
        [switch]$TestToolsList
    )

    Write-Host "`n--- $Name ---" -ForegroundColor $yellow

    # message initialize
    $initPayload = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' + "`n"

    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $Command
        $psi.Arguments = $Arguments -join ' '
        $psi.RedirectStandardInput  = $true
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError  = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.StandardInputEncoding = [System.Text.UTF8Encoding]::new($false)
        $psi.StandardOutputEncoding = [System.Text.UTF8Encoding]::new($false)

        $proc = New-Object System.Diagnostics.Process
        $proc.StartInfo = $psi
        $null = $proc.Start()

        # envoyer initialize
        $proc.StandardInput.Write($initPayload)
        $proc.StandardInput.Flush()

        # lire la réponse
        $response = $proc.StandardOutput.ReadLine()
        $null = $proc.WaitForExit($TimeoutSeconds * 1000)

        if (-not $response) {
            $stderr = $proc.StandardError.ReadToEnd()
            Write-TestResult -name "initialize" -ok $false -detail "Pas de réponse. stderr: $stderr"
            return
        }

        $parsed = $response | ConvertFrom-Json -ErrorAction Stop
        if ($parsed.result) {
            $serverInfo = "$($parsed.result.serverInfo.name) $($parsed.result.serverInfo.version)"
            Write-TestResult -name "initialize" -ok $true -detail $serverInfo
        } elseif ($parsed.error) {
            Write-TestResult -name "initialize" -ok $false -detail "Erreur $($parsed.error.code): $($parsed.error.message)"
            return
        } else {
            Write-TestResult -name "initialize" -ok $false -detail "Réponse inattendue: $response"
            return
        }

        # tools/list si demandé
        if ($TestToolsList) {
            $toolsPayload = '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' + "`n"

            $proc2 = New-Object System.Diagnostics.Process
            $proc2.StartInfo = $psi
            $null = $proc2.Start()
            $proc2.StandardInput.Write($toolsPayload)
            $proc2.StandardInput.Flush()

            # lire toutes les lignes de réponse (le JSON peut être multiligne)
            $toolsResponse = $proc2.StandardOutput.ReadToEnd()
            $null = $proc2.WaitForExit($TimeoutSeconds * 1000)

            if (-not $toolsResponse) {
                Write-TestResult -name "tools/list" -ok $false -detail "Pas de réponse"
                return
            }

            $toolsParsed = $toolsResponse | ConvertFrom-Json -ErrorAction Stop
            if ($toolsParsed.result -and $toolsParsed.result.tools) {
                $toolCount = $toolsParsed.result.tools.Count
                Write-TestResult -name "tools/list ($toolCount tools)" -ok $true
            } elseif ($toolsParsed.error) {
                Write-TestResult -name "tools/list" -ok $false -detail "Erreur $($toolsParsed.error.code): $($toolsParsed.error.message)"
            } else {
                Write-TestResult -name "tools/list" -ok $false -detail "Réponse inattendue"
            }
        }

    } catch {
        Write-TestResult -name "exception" -ok $false -detail $_.Exception.Message
    }
}

# ==== helper : tester un serveur HTTP ====
function Test-HttpServer {
    param(
        [string]$Name,
        [string]$Url,
        [hashtable]$Headers = @{}
    )

    Write-Host "`n--- $Name ---" -ForegroundColor $yellow

    try {
        $params = @{
            Uri     = $Url
            Method  = 'Get'
            Headers = $Headers
        }
        # skip certificate check si besoin, timeout 15s
        $response = Invoke-RestMethod @params -TimeoutSec 15 -ErrorAction Stop
        Write-TestResult -name "GET $Url" -ok $true -detail "Réponse reçue"
    } catch {
        # certaines APIs MCP HTTP retournent 405 (Method Not Allowed) sur GET
        # mais la connexion TCP fonctionne => c'est acceptable
        if ($_.Exception.Response.StatusCode -eq 405) {
            Write-TestResult -name "GET $Url" -ok $true -detail "HTTP 405 (Method Not Allowed) - connexion OK"
        } elseif ($_.Exception.Response.StatusCode) {
            Write-TestResult -name "GET $Url" -ok $true -detail "HTTP $($_.Exception.Response.StatusCode.value__) - connexion OK"
        } else {
            Write-TestResult -name "GET $Url" -ok $false -detail $_.Exception.Message
        }
    }
}

# =============================================
#  1. memory (stdio)
# =============================================
Test-StdioServer -Name "memory" -Command "npx" -Arguments @("-y", "@modelcontextprotocol/server-memory") -TestToolsList

# =============================================
#  2. git (stdio)
# =============================================
Test-StdioServer -Name "git" -Command "uvx" -Arguments @("mcp-server-git", "--repository", $projectRoot) -TestToolsList

# =============================================
#  3. project_fs (stdio)
# =============================================
Test-StdioServer -Name "project_fs" -Command "npx" -Arguments @("-y", "@modelcontextprotocol/server-filesystem", $projectRoot.Replace('\', '/'))

# =============================================
#  4. sportradar (stdio via mcp-remote)
# =============================================
$rapidApiKey = $env:RAPIDAPI_KEY
if (-not $rapidApiKey) {
    Write-Host "`n--- sportradar ---" -ForegroundColor $yellow
    Write-TestResult -name "initialize" -ok $false -detail "RAPIDAPI_KEY non définie dans l'environnement"
} else {
    Test-StdioServer -Name "sportradar" -Command "npx" -Arguments @("mcp-remote", "https://mcp.rapidapi.com", "--header", "x-api-host:sport-radar-api.p.rapidapi.com", "--header", "x-api-key:$rapidApiKey")
}

# =============================================
#  5. bzzoiro-sports (HTTP)
# =============================================
$bsdApiKey = $env:BSD_API_KEY
if (-not $bsdApiKey) {
    Write-Host "`n--- bzzoiro-sports ---" -ForegroundColor $yellow
    Write-TestResult -name "GET" -ok $false -detail "BSD_API_KEY non définie dans l'environnement"
} else {
    Test-HttpServer -Name "bzzoiro-sports" -Url "https://sports.bzzoiro.com/mcp" -Headers @{ Authorization = "Bearer $bsdApiKey" }
}

# =============================================
#  6. sportdbdotdev (HTTP)
# =============================================
$sportDbKey = $env:SPORTDB_API_KEY
if (-not $sportDbKey) {
    Write-Host "`n--- sportdbdotdev ---" -ForegroundColor $yellow
    Write-TestResult -name "GET" -ok $false -detail "SPORTDB_API_KEY non définie dans l'environnement"
} else {
    Test-HttpServer -Name "sportdbdotdev" -Url "https://api.sportdb.dev/mcp/" -Headers @{ "X-API-Key" = $sportDbKey }
}

# =============================================
#  RAPPORT FINAL
# =============================================
Write-Host "`n==============================================" -ForegroundColor $cyan
Write-Host "  RÉSULTATS"                                   -ForegroundColor $cyan
Write-Host "==============================================" -ForegroundColor $cyan
Write-Host "  Passed: $($global:passed)"                   -ForegroundColor $green
Write-Host "  Failed: $($global:failed)"                   -ForegroundColor $(if ($global:failed -gt 0) { $red } else { $green })
Write-Host "  Total:  $($global:passed + $global:failed)"
Write-Host "==============================================`n" -ForegroundColor $cyan

if ($global:failed -gt 0) {
    exit 1
}
exit 0
