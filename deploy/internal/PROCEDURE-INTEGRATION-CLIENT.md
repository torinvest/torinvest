# Procédure d’intégration client — La Forge ÉLITE (MANAGER)

> Document interne · torinvest-trading.com · Accompagnement 349€/an  
> Dernière mise à jour : aligné unlock par lots de 3 (PR #55–#56)

---

## 1. Vue d’ensemble du parcours client

```
Paiement Stripe (349€/an)
    → Email automatique (identifiants La Forge)
    → Profil accompagnement (www)
    → Discord (communauté + suivi)
    → Connexion app.torinvest-trading.com
    → Lot 1 : 3 modules (0, F1, F2)
    → Validation complète du lot → lot 2 (F3, F4, F5)…
```

**Durée totale formation** : 37 modules · ~57 h · parcours guidé sur ~13 lots.

---

## 2. Règles système (à connaître — ne pas promettre autre chose au client)

### 2.1 Accès Premium

| Élément | Règle |
|--------|--------|
| URL formation | https://app.torinvest-trading.com |
| Login | Email + mot de passe envoyés après paiement |
| Sans Premium | Redirection pricing / message « Premium requis » |
| Leçons HTML | Sur VPS uniquement — paywall serveur actif |

### 2.2 Déblocage par lots (3 modules)

| Règle | Détail |
|-------|--------|
| Lot 1 ouvert | Dès activation Premium : **Module 0**, **F1**, **F2** |
| Lot suivant | Quand les **3 modules du lot courant** sont **validés** |
| Total | 37 modules → 13 lots (dernier lot = 1 module) |
| UI client | Banner « Parcours guidé — X/37 · lot Y/13 » |

### 2.3 Validation d’un module (critères plateforme)

Un module est **validé** (`completed: true`) quand **les trois** conditions sont remplies :

1. **Sections** : 12 sections parcourues (`stepsDone ≥ 12`)
2. **Quiz** : score ≥ **70 %** (si quiz présent ; sinon ignoré)
3. **Pratique** : score ≥ **70 %** (si exercice chart présent ; sinon ignoré)

**Important manager** :
- Le client ne peut pas « sauter » un lot en ouvrant une URL de leçon verrouillée → redirection index `locked_module=1`.
- La progression est sauvegardée serveur (`/api/progress`).
- Ne pas débloquer manuellement tous les modules sans validation — ça casse la pédagogie du parcours guidé.

### 2.4 Ce que le client ne voit pas

- Ce document et les guides `modules/LOT-1-*.md`
- Ordre exact des 37 IDs dans `course-module-order.json`
- Comptes démo serveur (`abonne@…`, `visiteur@…`)

---

## 3. Chronologie d’intégration (jour 0 → jour 7)

### J0 — Paiement (Stripe 349€/an)

**Texte type email / Discord (copiable au client)** :

> Bienvenue dans l’accompagnement TORINVEST La Forge.  
> Tu vas recevoir un email avec ton **email de connexion** et ton **mot de passe** pour https://app.torinvest-trading.com  
> **Étape 1** : payer (fait)  
> **Étape 2** : compléter ton profil → https://www.torinvest-trading.com/activation-accompagnement.html  
> **Étape 3** : rejoindre Discord (lien dans l’email ou sur le site)  
> **Étape 4** : ouvrir la formation → login sur app → Module 0

**Règles manager** :
- Vérifier dans Stripe / CRM que le paiement est `succeeded`.
- Si pas d’email sous 24 h ouvrées → vérifier Brevo + webhook Stripe VPS.
- Ne pas envoyer le mot de passe en clair sur Discord public.

### J0–J1 — Profil accompagnement

URL : https://www.torinvest-trading.com/activation-accompagnement.html

**Objectif** : Discord, niveau, objectifs, contexte (MT5, capital, fuseau).

**Texte type (client)** :

> Le formulaire profil nous permet d’adapter le suivi (Discord, replays, questions).  
> Ce n’est pas un test — sois honnête sur ton niveau réel.

**Règles manager** :
- Profil incomplet = pas de blocage technique formation, mais suivi moins personnalisé.
- Tag Discord / role accompagnement si workflow Discord configuré.

### J1 — Première connexion app

URL : https://app.torinvest-trading.com/login.html

**Texte onboarding (message Discord ou email J1)** :

> **Première connexion La Forge**  
> 1. Va sur app.torinvest-trading.com → Connexion  
> 2. Tu verras le **dashboard** et la **progression**  
> 3. Ouvre **Parcours ÉLITE** — tu n’as accès qu’aux **3 premiers modules** (c’est normal)  
> 4. Commence par **Module 0** (~90 min) — ne saute pas cette base  
> 5. Le lot suivant (3 modules) s’ouvre quand tu **valides** les 3 du lot actuel (sections + quiz + pratique si présents)

**Règles manager** :
- Si « Premium requis » → compte pas activé côté serveur (`subscribed: false`).
- Si tous les modules visibles → VPS pas à jour ou bug unlock (vérifier deploy).

### J2–J7 — Rituel hebdomadaire recommandé

| Jour | Action client | Ton message type |
|------|---------------|------------------|
| Lun | Module ou section | « 1 module = ~90 min, découpé en sections » |
| Mar–Jeu | Sections + quiz | « Quiz ≥ 70 % requis pour valider » |
| Ven | Exercice chart si module le propose | « Replay chart = pratique, pas spectacle » |
| WE | Repos ou journal | « Pas d’obligation de trader le WE » |

**Règle manager** : rappeler que **Robot Access (79€/mois)** est **séparé** de l’accompagnement formation.

---

## 4. Messages types par situation

### Client frustré — « Je ne vois que 3 modules »

> C’est le **parcours guidé** : 3 modules par lot.  
> Valide le lot actuel (sections + quiz) et les 3 suivants s’ouvrent automatiquement.  
> Objectif : assimiler avant d’empiler la suite — pas un bug.

### Client veut tout d’un coup

> La plateforme ne permet pas le saut de lots (volontaire).  
> Si tu as une contrainte pro (deadline), contacte-nous en privé — on regarde le cas, sans promettre déblocage massif.

### Client bloqué sur quiz

> Il faut **70 % minimum**. Relire la section liée à la question, réessayer.  
> Le quiz vérifie la compréhension, pas la mémoire de mots-clés.

### Client n’a pas reçu identifiants

> Vérifier spam. Email d’achat = email de login.  
> Si paiement OK > 24 h → support avec **email Stripe** + **date paiement**.

### Client confond formation et robot

> **Accompagnement 349€/an** = La Forge + Discord + suivi.  
> **Robot Access 79€/mois** = EA MT5 + Worker (produit différent, activation sur activation.html).

---

## 5. Checklist manager — nouveau client

- [ ] Paiement Stripe confirmé
- [ ] Email identifiants envoyé (Brevo)
- [ ] Client a complété activation-accompagnement
- [ ] Discord : accès channel accompagnement
- [ ] Test login app OK (ou client confirme)
- [ ] Client informé : **lot 1 = 0, F1, F2**
- [ ] Client informé : règles validation (12 sections, quiz 70 %)
- [ ] Première question / objectif noté pour suivi

---

## 6. Liens utiles (manager)

| Ressource | URL |
|-----------|-----|
| Login formation | https://app.torinvest-trading.com/login.html |
| Index modules | https://app.torinvest-trading.com/course/index.html |
| Dashboard | https://app.torinvest-trading.com/dashboard.html |
| Profil accompagnement | https://www.torinvest-trading.com/activation-accompagnement.html |
| Tarifs | https://www.torinvest-trading.com/la-forge/pricing.html |
| Hub formation www | https://www.torinvest-trading.com/formation.html |

---

## 7. Comptes démo (tests internes VPS — ne pas donner aux clients)

Utilisés pour tester paywall / unlock sur le VPS :

- Premium démo : `abonne@torinvest-trading.com`
- Gratuit démo : `visiteur@torinvest-trading.com`

Mot de passe : config `server.js` / env sur VPS — **ne pas diffuser**.

---

## 8. Escalade technique

| Problème | Action |
|----------|--------|
| Unlock ne marche pas | VPS : `apply-unlock-now.sh` + `pm2 restart la-forge` |
| 401 / pas de session | Cookies domaine app, HTTPS |
| Progression perdue | Vérifier `/api/progress` + sync badge sur index |
| Leçon 404 | Fichier HTML sur VPS `public/course/` uniquement |
