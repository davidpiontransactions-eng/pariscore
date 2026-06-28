#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Seed initial Knowledge Graph entities for PariScore.
    Run this once after MCP memory server is configured.
    Usage:  echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' | npx -y @modelcontextprotocol/server-memory
    OR:     .\seed-knowledge-graph.ps1
#>

$MEMORY_CMD = "npx", "-y", "@modelcontextprotocol/server-memory"

# Build JSON-RPC batch
$entities = @(
    @{
        name = "pariscore-architecture"
        entityType = "architecture"
        observations = @(
            "Monolithic backend: server.js (7578 lines), single HTTP server + SQLite + all API routes",
            "Zero-dependency Node.js except better-sqlite3 (C++ addon)",
            "Frontend: pariscore.html (8507 lines), vanilla JS, no framework",
            "Database: better-sqlite3 → pariscore.db, WAL mode, single file",
            "Deployed on Render.com via render.yaml with /app/data disk mount for persistence",
            "Server API routes: GET/POST /api/v1/...",
            "French code comments, camelCase identifiers, ES5 require()"
        )
    },
    @{
        name = "strategies"
        entityType = "feature"
        observations = @(
            "STRATEGIES object in server.js must stay in sync with STRATEGIES_UI array in pariscore.html",
            "Betting strategies are defined in the STRATEGIES const on the backend",
            "Each strategy has: id, name, description, type (value/middling/hedge/arbitrage/progressive/dutching)",
            "Strategies are computed via SQL queries on odds_history table"
        )
    },
    @{
        name = "api-football"
        entityType = "api"
        observations = @(
            "API-Football (api-football.com) provides live scores, fixtures, standings, player stats",
            "Requires API_FOOTBALL_KEY in .env",
            "Rate limited — uses local DB cache to reduce API calls",
            "Data fused with Odds API results in server.js fusion layer"
        )
    },
    @{
        name = "odds-api"
        entityType = "api"
        observations = @(
            "The Odds API (the-odds-api.com) provides betting odds from multiple bookmakers",
            "Requires ODDS_API_KEY in .env",
            "Returns odds in decimal format, converted to American/fractional in frontend",
            "Covers major sports: football, basketball, tennis, baseball, hockey, MMA"
        )
    },
    @{
        name = "bugs-known"
        entityType = "known-bugs"
        observations = @(
            "STRATEGIES vs STRATEGIES_UI desync — must verify both arrays match after any strategy change",
            "Nav links (Football, Tennis, CS2, MMA) can break if _renderMMAFight() has JS syntax errors",
            "null/undefined safety — always guard API responses before accessing nested properties"
        )
    }
)

$relations = @(
    @{ from = "pariscore-architecture"; to = "api-football"; relationType = "uses_api" }
    @{ from = "pariscore-architecture"; to = "odds-api"; relationType = "uses_api" }
    @{ from = "pariscore-architecture"; to = "strategies"; relationType = "implements" }
    @{ from = "strategies"; to = "bugs-known"; relationType = "has_known_issues" }
)

$payload = @{
    jsonrpc = "2.0"
    id = 1
    method = "tools/call"
    params = @{
        name = "create_entities"
        arguments = @{
            entities = $entities
        }
    }
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "🌱 Seeding Knowledge Graph with $($entities.Count) entities..."
Write-Host "   Relations: $($relations.Count)"

# Write to memory server
$payload + "`n" | & $MEMORY_CMD 2>&1 | ConvertFrom-Json | ConvertTo-Json -Depth 3

# Now add relations
$relPayload = @{
    jsonrpc = "2.0"
    id = 2
    method = "tools/call"
    params = @{
        name = "create_relations"
        arguments = @{
            relations = $relations
        }
    }
} | ConvertTo-Json -Depth 10 -Compress

$relPayload + "`n" | & $MEMORY_CMD 2>&1 | ConvertFrom-Json | ConvertTo-Json -Depth 3

Write-Host "✅ Knowledge Graph seeded! Run with: .\scripts\seed-knowledge-graph.ps1"
