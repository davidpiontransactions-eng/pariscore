# PROMPT — Date des matchs dans les Top 5 sidebar (foot & tennis)

| | |
|---|---|
| **Rôle traité** | Lead Frontend Engineer (Next.js 16, React 19, Tailwind CSS v4) |
| **Repo** | `C:\Users\David\ZCodeProject\pariscore` |
| **Statut** | En cours |
| **Déploiement** | `deploy.bat "msg"` (VPS) → validation sur https://pariscore.fr |

---

## 0. CONTEXTE VALIDÉ (recherche déjà effectuée)

**Demande utilisateur** : dans la sidebar (19rem), sections « Top 5 matchs » (foot) et « Top 5 matchs tennis », afficher **la date en plus de l'heure**. Design choisi : **deux lignes empilées** — `jj/mm` au-dessus de `hh:mm`.

| Widget | Fichier | État actuel |
|---|---|---|
| Foot | `src/components/football/football-strategy-top5-widget.tsx` | `<span class="w-11">` heure seule, `formatKickoff()` local TZ navigateur |
| Tennis | `src/components/tennis/tennis-strategy-top5-widget.tsx` | `<span class="w-10">` heure seule, idem |

**Helper existant à réutiliser** : `src/lib/football-time.ts` — `parisKickoff()` (HH:MM Europe/Paris). Ajouter `parisDateShort()` (jj/mm Europe/Paris, même pattern `Intl.DateTimeFormat`). **Ne pas réinventer** — consulter COMPONENTS.md si doute composant.

---

## 1. ENGINEERING LOOP (boucle à exécuter jusqu'à 100% passant)

```
[1. Bead] ➔ [2. Graphify Read] ➔ [3. Implémentation] ➔ [4. Qualité]
   ➔ [5. QA visuelle] ➔ [6. Graphify Update] ➔ [7. Commit]
   ➔ [8. Deploy VPS] ➔ [9. Validation site] ➔ [10. Close bead]
```

| # | Action | Gate de passage |
|---|--------|-----------------|
| 1 | `bd create` + `bd update <id> --claim` | Bead claimed |
| 2 | `graphify query "football-time formatters top5 widgets"` | Zone comprise, pas de redécouverte |
| 3a | Ajouter `parisDateShort(iso)` dans `src/lib/football-time.ts` | Compile |
| 3b | Widget foot : supprimer `formatKickoff` local, importer `parisKickoff`+`parisDateShort`, pile 2 lignes `w-9` (`text-[8px]` date / `text-[9px]` heure, `leading-tight`, centrées) | Rendu conforme spec §2 |
| 3c | Widget tennis : mêmes changements (`MatchRow`, colonne `w-10`→`w-9`) | Symétrie foot/tennis |
| 4 | `bun run lint` && `bun run typecheck` | **Zéro erreur** |
| 5 | QA visuelle dev server (`bun run dev`) : les 2 widgets affichent `jj/mm / hh:mm`, noms non tronqués, aucun débordement horizontal sidebar | Tous checks passent |
| 6 | `graphify update .` | Graphe à jour |
| 7 | Commit unique : `feat(sidebar): date des matchs dans les Top 5 foot et tennis` | Push OK |
| 8 | `deploy.bat "feat(sidebar): date des matchs dans les Top 5 foot et tennis"` | Build complet (~3 min car `src/` modifié) + health check `/api/v1/status` OK |
| 9 | Validation prod : ouvrir https://pariscore.fr, vérifier sidebar foot puis tennis | Dates visibles en prod |
| 10 | `bd close <id>` + `bd dolt push` | Bead closed |

**Debugging** : toute anomalie aux étapes 4-9 → `systematic-debugging` (reproduire → cause racine → corriger → re-vérifier), puis re-boucler depuis l'étape concernée. Skill `verification-before-completion` : preuve > assertion, jamais déclarer done sans preuve. **Ne jamais déployer avec une erreur connue.**

---

## 2. SPÉCIFICATION D'IMPLÉMENTATION

### 2.1 Nouveau helper (`src/lib/football-time.ts`)

```typescript
const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: PARIS_TZ,
  day: "2-digit",
  month: "2-digit",
});

/** JJ/MM — date de Paris (jamais le fuseau du navigateur). */
export function parisDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return shortDateFormatter.format(d);
}
```

### 2.2 Colonne kickoff (pattern commun aux deux widgets)

Remplacer le span heure seule par une pile verticale :

```tsx
<span className="flex w-9 shrink-0 flex-col items-center font-mono tabular-nums text-slate-500">
  <span className="text-[8px] leading-tight">{parisDateShort(iso)}</span>
  <span className="text-[9px] leading-tight">{parisKickoff(iso)}</span>
</span>
```

- Foot : passer l'ISO brut (`entry.kickoff`) à `MatchRow`, formater dedans (supprimer le pré-formatage au niveau parent).
- Tennis : idem avec `entry.scheduledAt`.
- Supprimer les deux `formatKickoff()` locaux (code mort après migration).
- Padding gauche des sous-lignes existantes (`pl-[52px]`, `pl-[46px]`) : réajuster si nécessaire après QA visuelle.

### 2.3 Effets inclus / exclus

- ✅ Inclus : fix TZ navigateur → Europe/Paris (cohérence app entière).
- ❌ Exclus : API/libs (`entry.kickoff`, `entry.scheduledAt` déjà fournis), legacy `pariscore.html`, tout refactoring adjacent (**surgical changes**).

---

## 3. CRITÈRES DE CLÔTURE

- ✅ Les deux Top 5 affichent `jj/mm` au-dessus de `hh:mm` (fuseau Paris).
- ✅ Zéro erreur TypeScript + lint OK.
- ✅ QA visuelle dev + validation prod https://pariscore.fr.
- ✅ `graphify update .` effectué.
- ✅ 1 commit conventionnel, déployé VPS, health check OK.
- ✅ Bead closed + `bd dolt push` + rapport fin de session `.context/`.
