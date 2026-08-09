# Fondamental — hors GitHub public

Le build `applifonda/` **ne doit pas** être dans le dépôt GitHub (repo public).
Il vit uniquement sur le VPS : `/var/lib/torinvest/applifonda`.

## Mettre à jour l’API (sur le VPS)

```bash
cd /tmp
curl -fsSL -o pull-fondamental.sh \
  https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/pull-fondamental.sh
bash pull-fondamental.sh main
```

## Mettre à jour l’app (depuis ton PC)

1. Build local (Vite) → dossier `dist` ou `applifonda`
2. PowerShell :

```powershell
.\deploy\vps\push-applifonda.ps1 -Source "C:\laragon\www\fondamental\dist"
```

## Historique Git

Retirer le dossier du `main` actuel ne l’efface pas des **anciens commits**.
Pour purger l’historique (optionnel, force-push) :

```bash
# Sur une machine avec git-filter-repo, après backup
git filter-repo --path applifonda/ --invert-paths
git push origin --force --all
```

Sans purge, un curieux peut encore lire d’anciennes versions via l’historique GitHub.
