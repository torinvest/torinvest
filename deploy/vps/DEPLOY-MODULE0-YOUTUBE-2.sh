#!/usr/bin/env bash
# DEPRECATED : ne plus utiliser d'iframe YouTube (téléchargeable).
# Redirige vers le déploiement PROTÉGÉ (MP4 derrière /course/videos/).
set -euo pipefail
REF="${REF:-main}"
echo "⚠ Les embeds YouTube ne sont plus utilisés pour la formation (protection anti-téléchargement)."
echo "→ Lancement du déploiement protégé Module 0 vidéo 2…"
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/DEPLOY-MODULE0-VIDEO2-PROTECTED.sh" | bash
