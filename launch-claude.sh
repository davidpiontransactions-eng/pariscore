#!/bin/bash
echo "📂 Déplacement vers le projet..."
cd "/mnt/c/Users/david/Documents/dev PariScore/ParisScorebis"
echo "✅ Lancement du pipeline..."
~/claude-agents/scripts/pipeline.sh auto
