#!/usr/bin/env bash
# Sauvegarde privée du contenu course sur le VPS (hors repo public).
# Le contenu reste sur le serveur pour protéger les leçons — ce script ne publie rien sur GitHub.
#
# Usage (sur le VPS) :
#   bash /home/ubuntu/torinvest-formation/deploy/vps/backup-course-private.sh
#   bash backup-course-private.sh /home/ubuntu/torinvest-formation /home/ubuntu/backups/torinvest

set -euo pipefail

APP_DIR="${1:-/home/ubuntu/torinvest-formation}"
BACKUP_ROOT="${2:-/home/ubuntu/backups/torinvest}"
COURSE_DIR="$APP_DIR/public/course"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_ROOT/course-$STAMP.tar.gz"

if [[ ! -d "$COURSE_DIR" ]]; then
  echo "ERREUR : $COURSE_DIR introuvable."
  exit 1
fi

mkdir -p "$BACKUP_ROOT"
tar -czf "$DEST" -C "$APP_DIR/public" course
echo "OK — sauvegarde : $DEST"
echo "Taille : $(du -h "$DEST" | cut -f1)"
echo "Restaurer : tar -xzf $DEST -C $APP_DIR/public"
