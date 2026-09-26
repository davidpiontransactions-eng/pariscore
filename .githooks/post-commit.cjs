#!/usr/bin/env node
// Hook git post-commit — journalise le commit vers agentmemory (REST local).
//
// Route : POST {AGENTMEMORY_URL}/agentmemory/session/commit
//   body : { sessionId?, sha, branch?, repo?, message?, author?, authoredAt?, files? }
//   — merge idempotent côté serveur (union sessionIds par SHA, cf. dist index.mjs api::session::commit).
//
// Session : best-effort — GET /agentmemory/sessions puis la session la plus
// récente (updatedAt < 6h) dont cwd normalisé == racine du repo, sessions
// "active" prioritaires. AGENTMEMORY_SESSION_ID (env) court-circuite la
// resolution.
//
// Contrat : ZERO dependance (node seul), degradation gracieuse TOTALE —
// toute erreur est avalee, exit 0 implicite, un commit n'est JAMAIS bloque.
// Timeout 1.5s max sur chaque appel reseau (pattern du hook upstream
// @agentmemory/agentmemory dist/hooks/post-commit.mjs).
//
// Installation (par machine, core.hooksPath n'est pas commite) :
//   git config core.hooksPath .githooks
// Bead : ParisScorebis-43ai — Rapport : .context/rapport-fix-path-bash-tool.md

"use strict";

var execFile = require("node:child_process").execFile;

var BASE = (process.env.AGENTMEMORY_URL || "http://127.0.0.1:3111").replace(/\/+$/, "");
var SECRET = process.env.AGENTMEMORY_SECRET || "";
var TIMEOUT_MS = 1500;
var SESSION_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6h

// Chemins de l'agent : git -C <repo> <args> (le hook tourne a la racine du repo)
function git(args, cwd) {
  return new Promise(function (resolve) {
    execFile("git", args, { cwd: cwd, timeout: 1500 }, function (err, stdout) {
      resolve(err ? null : String(stdout).trim());
    });
  });
}

// Normalisation de chemin pour comparaison cwd : minuscules, /, sans slash final
function normPath(p) {
  return String(p).toLowerCase().replace(/\\/g, "/").replace(/\/+$/, "");
}

// Resolution best-effort de la session agentmemory courante
function resolveSessionId(cwd) {
  if (process.env.AGENTMEMORY_SESSION_ID) {
    return Promise.resolve(process.env.AGENTMEMORY_SESSION_ID);
  }
  return fetch(BASE + "/agentmemory/sessions", { signal: AbortSignal.timeout(TIMEOUT_MS) })
    .then(function (res) {
      if (!res.ok) return null;
      return res.json();
    })
    .then(function (data) {
      var sessions = (data && data.sessions) || [];
      var now = Date.now();
      var cibles = cwd ? normPath(cwd) : null;
      var candidates = sessions
        .filter(function (s) {
          return s && s.id && s.cwd && (!cibles || normPath(s.cwd) === cibles);
        })
        .filter(function (s) {
          return s.updatedAt && now - Date.parse(s.updatedAt) < SESSION_MAX_AGE_MS;
        })
        .sort(function (a, b) {
          // actives d'abord, puis plus recentement mises a jour
          var actif = (b.status === "active" ? 1 : 0) - (a.status === "active" ? 1 : 0);
          if (actif !== 0) return actif;
          return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
        });
      return candidates.length ? candidates[0].id : undefined;
    })
    .catch(function () {
      return undefined;
    });
}

function main() {
  var cwd = process.cwd(); // les hooks git tournent a la racine du working tree
  return git(["rev-parse", "HEAD"], cwd).then(function (sha) {
    if (!sha) return;
    return Promise.all([
      git(["rev-parse", "--abbrev-ref", "HEAD"], cwd),
      git(["config", "--get", "remote.origin.url"], cwd),
      git(["log", "-1", "--pretty=%B", sha], cwd),
      git(["log", "-1", "--pretty=%an <%ae>", sha], cwd),
      git(["log", "-1", "--pretty=%aI", sha], cwd),
      git(["diff-tree", "--no-commit-id", "--name-only", "-r", sha], cwd),
      resolveSessionId(cwd),
    ]).then(function (results) {
      var files = results[5] ? results[5].split("\n").filter(Boolean) : undefined;
      var headers = { "Content-Type": "application/json" };
      if (SECRET) headers.Authorization = "Bearer " + SECRET;
      return fetch(BASE + "/agentmemory/session/commit", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          sessionId: results[6] || undefined,
          sha: sha,
          branch: results[0] || undefined,
          repo: results[1] || undefined,
          message: results[2] || undefined,
          author: results[3] || undefined,
          authoredAt: results[4] || undefined,
          files: files,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }).catch(function () {
        /* serveur down ou timeout : silencieux */
      });
    });
  });
}

main().catch(function () {
  /* jamais bloquant */
});
