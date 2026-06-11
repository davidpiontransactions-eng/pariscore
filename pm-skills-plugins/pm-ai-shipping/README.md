# pm-ai-shipping — Kit d'expédition IA

Plugin de shipping readiness et quality assurance pour projets codés par IA. Il documente une application, audite l'écart entre l'intention documentée et l'implémentation réelle, et produit un dossier d'audit prêt pour la revue humaine.

> Plugin issu du marketplace [pm-skills](https://github.com/phuryn/pm-skills) par Paweł Huryn.

## Skills (2)

- **`intended-vs-implemented`** — Méthode pour trouver l'écart entre ce qu'un système est documenté à faire et ce que le code fait réellement, avec preuves citées des deux côtés.
- **`shipping-artifacts`** — Ensemble de documentation durable qui rend une application IA révisable : architecture, flux utilisateur/permissions, variables/secrets, et carte de couverture de tests.

## Commands (5)

| Commande | Description |
|----------|-------------|
| `/derive-tests` | Transforme l'intention documentée en carte de couverture de tests |
| `/document-app` | Reverse-engineer le codebase en documentation système |
| `/performance-audit-static` | Audit statique de performance (sur-fetching, index manquants, caching) |
| `/security-audit-static` | Audit statique de sécurité avec cartographie des boundaries de confiance |
| `/ship-check` | Parcours complet : documentation → audit → test → dossier d'expédition |

## Installation

Les fichiers sont installés dans :
- `.claude/skills/intended-vs-implemented/SKILL.md`
- `.claude/skills/shipping-artifacts/SKILL.md`
- `.claude/commands/derive-tests.md`
- `.claude/commands/document-app.md`
- `.claude/commands/performance-audit-static.md`
- `.claude/commands/security-audit-static.md`
- `.claude/commands/ship-check.md`

## Auteur

Paweł Huryn — [The Product Compass Newsletter](https://www.productcompass.pm)

## Licence

MIT
