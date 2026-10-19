#!/usr/bin/env bash
# Régénère quiz + examen sur les chapitres déjà présents (sans rescp du seed).
set -euo pipefail
APP_DIR="${APP_DIR:-$HOME/torinvest-formation}"
REF="${MASTERCLASS_REF:-cursor/masterclass-quiz-exam-691a}"
RAW="https://raw.githubusercontent.com/torinvest/torinvest/${REF}"
CH="$APP_DIR/data/masterclass/chapters"
echo "======== REGEN QUIZ MASTERCLASS ========"
N=$(find "$CH" -maxdepth 1 -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
echo "Chapitres trouvés : $N"
[[ "$N" -ge 1 ]] || { echo "ERREUR — aucun chapitre dans $CH — installe le seed d'abord"; exit 1; }
curl -fsSL "$RAW/scripts/generate-masterclass-quizzes.py" -o /tmp/generate-masterclass-quizzes.py
curl -fsSL "$RAW/la-forge/js/forge-masterclass.js" -o "$APP_DIR/public/js/forge-masterclass.js"
curl -fsSL "$RAW/la-forge/css/forge-masterclass.css" -o "$APP_DIR/public/css/forge-masterclass.css"
curl -fsSL "$RAW/deploy/vps/app-shells/masterclass-chapter.html" -o "$APP_DIR/public/masterclass-chapter.html"
curl -fsSL "$RAW/deploy/vps/formation-server/routes-masterclass.js" -o "$APP_DIR/server-patches/routes-masterclass.js"
python3 /tmp/generate-masterclass-quizzes.py --chapters "$CH" --seed-dir "$APP_DIR/data/masterclass"
# verify
python3 -c "import json,glob; fs=sorted(glob.glob('$CH/*.json'));
assert fs; d=json.load(open(fs[0])); q=d.get('quiz') or {}; e=d.get('exam') or {};
assert isinstance(q,dict) and len(q.get('questions') or [])>=3, q;
assert isinstance(e,dict) and len(e.get('questions') or [])==5, e;
print('OK sample', fs[0], 'quiz', len(q['questions']), 'exam', len(e['questions']))"
source ~/.profile 2>/dev/null || true
pm2 restart la-forge --update-env 2>/dev/null || pm2 restart torinvest-formation --update-env
sleep 2
echo "→ Ctrl+Shift+R sur /masterclass-chapter.html?n=17"
echo "======== DONE ========"
