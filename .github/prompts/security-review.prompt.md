# Security Review (ECC, adapté PariScore)

Revue sécu systématique après chaque modif touchant entrées utilisateur, auth, API ou données sensibles.

## Checklist

1. Injection : interpolations non échappées (pattern XSS `onclick="${...}"` → `_jsStr()` côté legacy,
   JSX échappé par défaut côté React — vérifier les `dangerouslySetInnerHTML`).
2. Secrets : aucune clé/API key en dur, aucun log de `.env`, rien de committé (`.env`, `*.db`, `*.log`).
3. OWASP : auth/autorisation, validation Zod côté API routes, CORS/CSRF, rate limiting.
4. Fichiers sensibles : `.env`, `*.key`, `*.pem` jamais lus par l'onglet/complétion, jamais diffusés.
5. Dépendances : allowlist `AGENTS.md` uniquement, pas de nouveau paquet sans justification.

## Scan auto (sans install)

```cmd
npx -y ecc-agentshield@1.4.0 scan
```

ou `bun run ecc:scan`. Bloquant avant commit si findings.
