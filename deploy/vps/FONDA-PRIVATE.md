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

```powershell
.\deploy\vps\push-applifonda.ps1 -Source "C:\laragon\www\fondamental\dist"
```

## Purge historique (fait le 2026-08-09)

`git filter-repo --path applifonda/ --invert-paths` + force-push de **toutes** les branches.

- `main` et branches : plus de dossier `applifonda/`
- **Reste côté GitHub** : les commits des anciennes Pull Requests (`refs/pull/*/head`) peuvent encore servir les fichiers via SHA.

### Action obligatoire — Support GitHub

1. Ouvre https://support.github.com/contact?tags=docs-sensitive-data  
2. Demande la purge des données sensibles du repo `torinvest/torinvest`  
3. Indique les chemins : `applifonda/**`  
4. Exemples de commits encore exposés après rewrite :
   - `82e090051ec5d2e74697c71a57392ad64e063c5f` (PR #19)
   - `feeeb71354c55949ca27af454d571ace817a46d9` (merge #19)
   - `8f75abb` (branche applifonda)
5. Demande aussi la purge du cache `raw.githubusercontent.com`

Sans cette étape Support, un SHA d’ancienne PR peut encore télécharger le build.

## Site live

L’accès www reste verrouillé VPS (session ≥ 250 KRM). Ce n’est pas lié à GitHub.
