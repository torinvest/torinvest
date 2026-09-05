# Méthodologie des données

Ce document définit les concepts économiques et statistiques utilisés dans USA War Atlas, et les précautions d'interprétation associées. Il fait autorité pour toute rédaction ou intégration de données chiffrées.

## 1. Concepts à ne jamais confondre

### PIB (produit intérieur brut)
Valeur de la production économique d'un territoire sur une année. Le PIB actuel de la Californie mesure ce que produit la Californie **aujourd'hui**, avec sa population, ses infrastructures et son capital accumulés depuis 175 ans. Il ne mesure en aucun cas la « valeur » de l'acquisition de 1848.

### Recettes fiscales fédérales (federal tax collections)
Montant des impôts fédéraux collectés dans un État (source : IRS). C'est un flux annuel vers le budget fédéral, dépendant de la structure économique et démographique actuelle.

### Dépenses fédérales (federal spending)
Montant des dépenses fédérales reçues par un État (contrats, salaires, transferts, retraites…). Un État peut être contributeur net ou bénéficiaire net : recettes et dépenses doivent toujours être présentées ensemble.

### Coût d'une guerre
Estimation des dépenses budgétaires militaires directes attribuables à un conflit (référence : Congressional Research Service, RS22926). Les estimations élargies (intérêts de la dette, soins aux vétérans, coûts macroéconomiques — ex. Costs of War Project) reposent sur des méthodologies différentes : ne jamais additionner ou comparer des chiffres issus de méthodologies différentes sans le signaler.

### Valeur d'un territoire
Notion ambiguë devant toujours être précisée : prix payé à l'acquisition (fait historique documenté), valeur foncière actuelle (estimation), production actuelle (PIB), ou ressources extraites cumulées. Ces mesures ne sont pas interchangeables.

### Bénéfice net
Un « bénéfice net » d'une guerre ou d'une acquisition exigerait un contrefactuel (que se serait-il passé sans l'acquisition ?) impossible à établir rigoureusement. L'application **ne présente jamais** de bénéfice net ; elle juxtapose des indicateurs distincts, chacun avec son périmètre.

### Valeur nominale vs valeur corrigée de l'inflation
- **Nominale** : dollars de l'époque (les 15 millions de dollars de 1848 sont des dollars de 1848).
- **Corrigée de l'inflation** : conversion en dollars actuels via un indice (CPI, déflateur du PIB…). Le résultat varie fortement selon l'indice choisi ; sur des périodes longues (avant la création d'indices officiels), toute conversion est une estimation à afficher comme telle, avec sa méthode. Un champ sans méthodologie sourcée reste à `null`.

## 2. Règles d'affichage des statistiques

Chaque statistique affichée doit comporter :

1. **l'année** de la donnée ;
2. **la source** (organisme, lien) ;
3. **le périmètre** (quel territoire, quelle population, quelle définition) ;
4. **la méthode** (donnée officielle, estimation, conversion) ;
5. **la mention** « donnée officielle » ou « estimation ».

Techniquement : le modèle `EconomicMetric` exige une année ; une métrique sans source doit être marquée `needsReview = true` (règle validée par Zod et testée).

## 3. Cas du module guerre américano-mexicaine

Avertissements méthodologiques obligatoires :

- Les frontières actuelles des États **ne correspondent pas exactement** aux territoires acquis en 1848 (champ `coverageType` : FULL / MOSTLY / PARTIAL / SMALL_PART).
- Des parties de l'Arizona et du Nouveau-Mexique proviennent de l'**achat Gadsden (1853)**, pas de la cession de 1848.
- Seules des parties du Colorado et du Wyoming étaient concernées.
- **Ne jamais** présenter la totalité du PIB moderne de ces États comme un bénéfice direct de la guerre : la richesse actuelle résulte de 175 ans de développement (population, capital, technologie) qui ne peut être attribué à l'acquisition elle-même.

## 4. Données manquantes ou incertaines

- Aucune donnée chiffrée fictive n'est introduite dans la base.
- Une valeur non vérifiée est stockée à `null` et affichée « Donnée à vérifier ».
- Les estimations contradictoires (ex. mortalité de la guerre d'Irak) sont présentées **étude par étude**, avec leurs méthodologies respectives, jamais fusionnées en un chiffre unique.
