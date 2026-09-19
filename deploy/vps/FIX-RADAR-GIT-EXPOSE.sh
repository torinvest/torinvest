#!/usr/bin/env bash
# URGENT — coupe l'exposition HTTP de /.git sur radar (et docroot torinvest).
# Preuve live 2026-09-19 : https://radar.torinvest-trading.com/.git/HEAD → 200
#
# ssh ubuntu@164.132.46.191 'curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/audit-complet-19sep-691a/deploy/vps/FIX-RADAR-GIT-EXPOSE.sh | bash'
set -euo pipefail

if [[ -d /mnt/c/Windows ]] || [[ "$(hostname)" == DESKTOP* ]]; then
  echo "ERREUR: lance sur le VPS ubuntu@164.132.46.191, pas Windows/WSL."
  exit 1
fi

echo "======== FIX RADAR .git EXPOSE ========"

# Chemins docroot courants (Apache / Nginx)
CANDIDATES=(
  /var/www/torinvest
  /var/www/html
  /var/www/radar
  /home/ubuntu/torinvest
  /home/ubuntu/www
)

deny_git() {
  local root="$1"
  [[ -d "$root" ]] || return 0
  echo "→ docroot $root"
  if [[ -d "$root/.git" ]]; then
    echo "  .git présent ($(du -sh "$root/.git" 2>/dev/null | awk '{print $1}'))"
  fi
  # Apache .htaccess à la racine
  local ht="$root/.htaccess"
  if [[ -f "$ht" ]] || [[ -d "$root" ]]; then
    if ! grep -q 'TORINVEST_GIT_DENY' "$ht" 2>/dev/null; then
      {
        echo ""
        echo "# TORINVEST_GIT_DENY — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo "RedirectMatch 404 /\.git"
        echo "RewriteEngine On"
        echo "RewriteRule (^|/)\.git(/|$) - [F,L]"
      } | sudo tee -a "$ht" >/dev/null
      echo "  .htaccess: deny .git ajouté"
    else
      echo "  .htaccess: déjà protégé"
    fi
  fi
  # Snippet Apache conf.d
  local conf="/etc/apache2/conf-available/torinvest-deny-git.conf"
  if command -v apache2ctl >/dev/null 2>&1; then
    sudo tee "$conf" >/dev/null <<'EOF'
# TORINVEST — deny .git everywhere
<DirectoryMatch "(?i)/\.git">
    Require all denied
</DirectoryMatch>
RedirectMatch 404 /\.git
EOF
    sudo a2enconf torinvest-deny-git >/dev/null 2>&1 || true
    sudo apache2ctl configtest && sudo systemctl reload apache2 || true
    echo "  apache2: conf deny-git active"
  fi
  # Nginx snippet (si radar derrière nginx)
  if command -v nginx >/dev/null 2>&1; then
    local nconf="/etc/nginx/snippets/torinvest-deny-git.conf"
    sudo tee "$nconf" >/dev/null <<'EOF'
# TORINVEST — deny .git
location ~ /\.git {
    deny all;
    return 404;
}
EOF
    # Inclure dans sites radar si pas déjà
    for site in /etc/nginx/sites-enabled/*; do
      [[ -f "$site" ]] || continue
      if grep -qE 'radar\.torinvest|torinvest' "$site" 2>/dev/null; then
        if ! grep -q 'torinvest-deny-git' "$site"; then
          # Insert include inside first server { } block — best effort
          if grep -q 'include snippets/torinvest-deny-git.conf' "$site"; then
            :
          else
            sudo sed -i '/server_name.*radar\.torinvest/a\    include snippets/torinvest-deny-git.conf;' "$site" 2>/dev/null || true
          fi
        fi
      fi
    done
    sudo nginx -t && sudo systemctl reload nginx || true
    echo "  nginx: snippet deny-git"
  fi
}

for d in "${CANDIDATES[@]}"; do
  deny_git "$d"
done

# Also scan for live DocumentRoot from apache
if command -v apache2ctl >/dev/null 2>&1; then
  while read -r dr; do
    [[ -n "$dr" && -d "$dr" ]] && deny_git "$dr"
  done < <(apache2ctl -S 2>/dev/null | grep -oE 'DocumentRoot:[[:space:]]*[^ ]+' | awk '{print $2}' | sort -u || true)
fi

echo ""
echo "Vérif locale :"
curl -sS -o /dev/null -w "local HEAD %{http_code}\n" -H 'Host: radar.torinvest-trading.com' http://127.0.0.1/.git/HEAD || true
echo "Vérif publique (attendu 403/404) :"
echo "  curl -sI https://radar.torinvest-trading.com/.git/HEAD | head -3"
echo "======== DONE ========"
