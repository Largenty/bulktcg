# Le modèle de données de BulkTCG

Le modèle conceptuel, logique et physique des données, selon la méthode Merise, déduit
du code de l'application — ses pages, ses actions serveur, sa couche données, ses types,
ses schémas de formulaire et ses données de démonstration — et non d'une base existante.
Le SQL qui le crée est dans `supabase/migrations/`.

## Par où commencer

| Document | Ce qu'il contient |
|---|---|
| [MCD](MCD.md) | les entités, leurs propriétés et identifiants, les associations nommées par un verbe, leurs cardinalités, les contraintes et règles de gestion |
| [MLD](MLD.md) | les règles de passage, les relations en notation Merise, la normalisation et ses écarts voulus |
| [MPD](MPD.md) | la cible Supabase, les migrations, les types, les conventions, les clés étrangères, la validation, **la confrontation avec la migration initiale** et les points ouverts |
| [MPD — référentiels et profils](MPD-referentiels-profils.md) | `communes`, `editions`, `product_tag_games`, `profiles`, `account_settings` |
| [MPD — annonces et demandes](MPD-annonces.md) | `listings` et ses liaisons, `wanted_listings` |
| [MPD — échanges](MPD-echanges.md) | messagerie, ventes, avis, liste d'attente, notifications, blocages, signalements |
| [MPD — règles](MPD-regles.md) | fonctions et déclencheurs |
| [MPD — sécurité](MPD-securite.md) | RLS, droits de colonnes, stockage des photos |
| [Traçabilité](MPD-tracabilite.md) | chaque fonctionnalité reliée à ses tables, colonnes, fonctions et à son code |

Lire le MCD pour comprendre ce que le site retient, le MPD pour savoir ce que la base
garantit. Le guide de bascule vers Supabase — variables, lectures, écritures, photos —
reste [`supabase/README.md`](../../supabase/README.md).

## Le modèle en chiffres

| | |
|---|---|
| Entités au MCD | 16, et 5 associations porteuses ou non fonctionnelles |
| Tables | 19, toutes sous RLS |
| Types énumérés | 14 |
| Fonctions, déclencheurs | 33, 26 |
| Politiques RLS | 40, toutes sur les tables — les fichiers photo vivent chez Cloudflare |
| Migrations | 10, chacune sous 500 lignes |

## Conventions

* Les identifiants SQL sont en anglais, en `snake_case` : ce sont ceux du code
  (`src/lib/data/rows.ts`). La documentation est en français, dans le vocabulaire de
  l'interface ; le MCD donne pour chaque propriété son nom de colonne.
* Montants en centimes entiers, dates en `timestamptz`, absence en `null` — jamais `0`
  ni une chaîne vide : « une information absente s'affiche —, jamais 0 ».
* Toute règle de la base a sa source dans le code, citée ; aucune n'a été ajoutée sans
  fonctionnalité qui la demande.

## Ce qui tient le modèle

* `tests/schema-sync.test.mjs` — structure : les dix-sept migrations dans l'ordre, les colonnes
  de chaque table égales à `rows.ts`, les énumérations égales à `labels.ts`, les
  référentiels égaux au code, les contraintes d'intégrité.
* `tests/schema-security.test.mjs` — sécurité : la RLS de chaque table, les droits de
  colonnes égaux aux types d'écriture de `rows.ts`, les fonctions qui voient au-delà de la
  RLS et leurs bornes.
* `tests/schema.mjs` — la lecture commune des migrations et de `rows.ts`.

```
node --import ./tests/alias-hook.mjs --test tests/schema-sync.test.mjs tests/schema-security.test.mjs
```

Les migrations sont en outre appliquées à un PostgreSQL réel (PGlite), avec
164 scénarios rejoués sous les rôles de l'API : chaque refus attendu doit lever, chaque
parcours normal passer, et le code de sortie compte les écarts. Voir [MPD](MPD.md), § 7.

```
npm install --no-save @electric-sql/pglite
node supabase/tests/run.mjs
```

## Quand le modèle change

1. Écrire la règle dans le code (schéma Zod, couche données), puis dans une **nouvelle**
   migration une fois la base en production — avant, dans la migration du domaine.
2. Ajouter la colonne des deux côtés : la migration et `rows.ts`. Les tests comparent.
3. Une commune, une série ou un produit s'ajoute au référentiel du code **et** à la
   migration 2 : les tests comparent ligne à ligne.
4. Mettre à jour la partie du MPD concernée — ses tableaux de colonnes se régénèrent à
   partir des migrations —, et la [traçabilité](MPD-tracabilite.md).
