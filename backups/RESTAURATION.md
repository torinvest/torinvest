# Restauration de la sauvegarde pré-audit

Sauvegarde créée le **9 juin 2025** avant les mises à jour SEO et sécurité.

## Option 1 — Branche Git (recommandé)

```bash
git fetch origin
git checkout backup/pre-audit-2025-06-09
```

Pour revenir sur la version actuelle ensuite :

```bash
git checkout main
```

## Option 2 — Tag Git

```bash
git fetch origin
git checkout snapshot/pre-audit-2025-06-09
```

## Option 3 — Archive locale

Fichier : `backups/torinvest-snapshot-2025-06-09.tar.gz` (non versionné sur Git)

```bash
cd /chemin/vers/votre/site
tar -xzf backups/torinvest-snapshot-2025-06-09.tar.gz
```

## Références GitHub

- Branche : `backup/pre-audit-2025-06-09`
- Tag : `snapshot/pre-audit-2025-06-09`
