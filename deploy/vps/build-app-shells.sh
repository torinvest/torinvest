#!/usr/bin/env bash
# Génère deploy/vps/app-shells/ depuis la-forge/ (chemins /js /css pour l'app VPS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../" && pwd)"
SRC="$ROOT/la-forge"
OUT="$ROOT/deploy/vps/app-shells"

mkdir -p "$OUT/course"

transform() {
  sed -e 's|/la-forge/js/|/js/|g' \
      -e 's|/la-forge/css/|/css/|g' \
      -e 's|https://www\.torinvest-trading\.com/la-forge/img/|/img/|g' \
      -e 's|/la-forge/img/|/img/|g' \
      -e 's|https://app\.torinvest-trading\.com/course/index\.html|/course/index.html|g' \
      -e 's|https://app\.torinvest-trading\.com/calendar\.html|/calendar.html|g' \
      -e 's|https://app\.torinvest-trading\.com/calendar-day\.html|/calendar-day.html|g' \
      -e 's|https://app\.torinvest-trading\.com/dashboard\.html|/dashboard.html|g' \
      -e 's|https://app\.torinvest-trading\.com/login\.html|/login.html|g' \
      -e 's|/la-forge/login\.html|/login.html|g' \
      -e 's|href="/la-forge/pricing\.html"|href="https://www.torinvest-trading.com/la-forge/pricing.html"|g'
}

for page in dashboard.html calendar.html calendar-day.html; do
  transform < "$SRC/$page" > "$OUT/$page"
  echo "  $page"
done

cat > "$OUT/login.html" <<'LOGIN_EOF'
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Connexion — TORINVEST La Forge</title>
  <link rel="icon" href="/img/forge-anvil.png" type="image/png" />
  <link rel="stylesheet" href="/css/main.css" />
  <link rel="stylesheet" href="/css/legal.css" />
</head>
<body>
  <header class="site-header" data-forge-header="connexion"></header>

  <div class="container" style="max-width:440px;padding-top:2rem">
    <div style="text-align:center;margin-bottom:1.5rem">
      <img src="/img/forge-anvil.png" alt="La Forge" width="72" height="72" class="forge-logo-img" style="margin-bottom:0.75rem" />
      <p class="forge-slogan" style="margin:0">La force d'un esprit libre</p>
    </div>
    <div class="card">
      <h2>Connexion membre</h2>
      <p style="margin-bottom:1rem;color:var(--muted);font-size:0.95rem">
        Accès réservé aux abonnés La Forge (349€/an). Identifiants envoyés par email après paiement Stripe.
      </p>
      <div id="login-alert" class="alert" hidden></div>
      <form id="login-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required autocomplete="email" />
        </div>
        <div class="form-group">
          <label for="password">Mot de passe</label>
          <input type="password" id="password" name="password" required autocomplete="current-password" />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%;margin-top:0.5rem">Se connecter</button>
      </form>
      <p style="margin-top:1rem;font-size:0.85rem;color:var(--muted);text-align:center">
        Pas encore inscrit ? <a href="https://www.torinvest-trading.com/formation.html">Liste d'attente</a>
        · <a href="https://www.torinvest-trading.com/la-forge/pricing.html">Tarifs</a>
      </p>
    </div>
  </div>

  <footer data-forge-footer></footer>
  <script src="/js/forge-brand.js"></script>
  <script src="/js/auth.js"></script>
  <script src="/js/forge-legal.js"></script>
</body>
</html>
LOGIN_EOF
echo "  login.html (formulaire app)"

cat > "$OUT/course/index.html" <<'COURSE_EOF'
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Formation ÉLITE — La Forge</title>
  <link rel="icon" href="/img/forge-anvil.png" type="image/png" />
  <link rel="stylesheet" href="/css/main.css" />
  <link rel="stylesheet" href="/css/legal.css" />
  <link rel="stylesheet" href="/css/forge-charts.css" />
</head>
<body>
  <header class="site-header" data-forge-member-header="course"></header>

  <div class="container">
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">
      <img src="/img/forge-anvil.png" alt="" width="48" height="48" class="forge-logo-img" />
      <div>
        <h1 id="forge-title" style="margin:0.15rem 0">La Forge ÉLITE</h1>
        <p id="forge-slogan-line" class="forge-slogan" style="margin:0;color:var(--muted);font-size:0.92rem"></p>
      </div>
    </div>
    <p id="forge-hours" style="color:var(--muted);font-size:0.9rem;margin-bottom:1.25rem"></p>

    <div class="overall-progress">
      <h3>Progression globale</h3>
      <div class="progress-bar"><div id="overall-bar" style="width:0%"></div></div>
      <p id="overall-text" style="color:var(--muted);font-size:0.9rem;margin-top:0.5rem">Chargement…</p>
      <p id="unlock-banner" class="alert" hidden style="margin-top:0.75rem;font-size:0.88rem;border-color:rgba(255,180,0,.35)"></p>
      <p style="margin-top:0.35rem;font-size:0.82rem;color:var(--muted)">
        <span id="progress-sync-badge" class="cal-sync-badge idle">—</span>
      </p>
    </div>

    <ul id="module-list" class="module-list" style="margin-top:1.5rem"></ul>
  </div>

  <footer data-forge-footer></footer>
  <script src="/js/forge-brand.js"></script>
  <script src="/js/auth.js"></script>
  <script src="/js/forge-gate.js"></script>
  <script src="/js/progress.js"></script>
  <script src="/js/course-data.js"></script>
  <script src="/js/forge-unlock.js"></script>
  <script src="/js/course-index.js"></script>
  <script src="/js/forge-legal.js"></script>
</body>
</html>
COURSE_EOF
echo "  course/index.html"

echo "OK — shells → $OUT"
