---
name: ps-changelog
description: Update CHANGELOG.md and CLAUDE.md after a PariScore feature is completed — formats the entry correctly, bumps the version reference, and marks the roadmap item as done.
---

# PariScore — Mise à Jour du Changelog

## Déclencheur
Après avoir livré une feature, un bugfix ou une amélioration. L'utilisateur dit "met à jour le changelog" ou "documente ce qu'on vient de faire".

## Procédure

### 1. Lire l'état actuel
- Lire `CHANGELOG.md` pour connaître le format existant et la dernière version
- Lire `CLAUDE.md` section 1.3 (Origine) et pied de page pour la version actuelle
- Lire les dernières modifications des fichiers concernés (git diff ou grep si git absent)

### 2. Déterminer la version
Règles de versioning PariScore :
- **Patch** (x.x.**Y**) : bugfix, UI tweak, correction documentation
- **Minor** (x.**Y**.0) : nouvelle feature dans une page existante, nouvelle stratégie, nouvelle route API
- **Major** (**Y**.0.0) : refonte architecture, nouvelle page entière, migration DB

Version actuelle dans le pied de CLAUDE.md :
```
*PariScore — Cahier des charges vX.Y — [date]*
```

### 3. Écrire l'entrée CHANGELOG.md

Format strict :
```markdown
## [vX.Y.Z] — YYYY-MM-DD

### Ajouté
- **Nom de la feature** : description courte
  - Détail technique 1
  - Détail technique 2

### Modifié
- **Fichier** : ce qui a changé

### Corrigé
- **Bug** : description du fix
```

Règles de style :
- Première ligne = résumé en 1 phrase impérative ("Ajoute", "Corrige", "Refactorise")
- Toujours mentionner les fichiers modifiés (`server.js`, `pariscore.html`, `CLAUDE.md`)
- Si quota ou performance impacté → le noter explicitement
- Pas de jargon interne — doit être lisible par un nouvel arrivant

### 4. Mettre à jour CLAUDE.md

a) Dans `## 15. TODOLIST`, marquer l'item comme fait :
```
- [x] **Nom Feature** ✅ FAIT (JJ mois AAAA)
  - Résumé technique en 2-3 bullet points
```

b) Mettre à jour le pied de page (dernière ligne du fichier) :
```
*PariScore — Cahier des charges vX.Y — JJ mois AAAA*
*[résumé 1 ligne de l'état actuel]. Prochaine étape : [next item P1].*
```

### 5. Vérification finale
- `CHANGELOG.md` : entrée bien formatée, date correcte
- `CLAUDE.md` : item `[x]` + pied de page mis à jour
- Aucune modification de `server.js` ou `pariscore.html` dans cette tâche

## Format CHANGELOG.md existant (référence)
Le projet suit un format inspiré de Keep a Changelog (https://keepachangelog.com).
Sections autorisées : `Ajouté`, `Modifié`, `Corrigé`, `Supprimé`, `Sécurité`.
Toujours ordre chronologique inverse (plus récent en haut).
