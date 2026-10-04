# MPD — Modèle physique des données

Le [MLD](MLD.md) implémenté pour Supabase : PostgreSQL 15 ou plus, schéma `public`, les
comptes dans `auth.users`. Les fichiers photo vivent chez Cloudflare Images ; la
base n'en tient que le registre (`photo_uploads`). Le SQL est dans `supabase/migrations/`,
en dix-sept migrations ; ce document en donne la vue d'ensemble, et
le détail vit dans six parties :

| Partie | Contenu |
|---|---|
| [Référentiels et profils](MPD-referentiels-profils.md) | `communes`, `editions`, `product_tag_games`, `profiles`, `account_settings` |
| [Annonces et demandes](MPD-annonces.md) | `listings`, `photo_uploads`, `photo_purge_lease`, `listing_photos`, `listing_editions`, `listing_tags`, `wanted_listings`, `retired_slugs`, lectures géographiques |
| [Messagerie, ventes, avis, notifications, modération](MPD-echanges.md) | `conversations`, `messages`, `deals`, `reviews`, `listing_waitlist`, `notifications`, `blocks`, `reports` |
| [Fonctions et déclencheurs](MPD-regles.md) | les 42 fonctions et 31 déclencheurs, et ce qu'ils garantissent |
| [Sécurité](MPD-securite.md) | RLS, droits de colonnes et de fonctions, photos chez Cloudflare, limites connues |
| [Traçabilité](MPD-tracabilite.md) | chaque fonctionnalité, ses tables, ses colonnes, son code |

## 1. Les migrations

Appliquées dans l'ordre de leur horodatage par `supabase db push`, ou en une fois par
`supabase/setup.sql`, qui les réunit dans le même ordre et se colle dans l'éditeur SQL.
Aucune ne dépasse 500 lignes ; chacune ne
référence que ce que les précédentes ont créé.

| # | Fichier | Contenu |
|---|---|---|
| 1 | `20260929120000_types.sql` | 14 énumérations, `distance_km`, `set_updated_at` |
| 2 | `20260929120100_referentials.sql` | `communes` (112), `editions` (98), `product_tag_games` (78), remplies |
| 3 | `20260929120200_profiles.sql` | `profiles`, `account_settings`, inscription |
| 4 | `20260929120300_listings.sql` | annonces, registre des téléversements, photos, séries, produits, contrôles (`check_photo_upload` : le fichier du vendeur, même pour la clé de service), ménage des fichiers (`photo_purge_lease`, `claim_photo_purge`, `forget_purged_photos`, `release_photo_purge`), `listings_within`, `pro_only_count_by_game`, `record_listing_view` |
| 5 | `20260929120400_wanted.sql` | demandes, `wanted_reaching` |
| 6 | `20260929120500_messaging.sql` | conversations, messages |
| 7 | `20260929120600_deals_reviews.sql` | ventes, avis, notes, historique des ventes |
| 8 | `20260929120700_reservations_notifications.sql` | réservation, liste d'attente, notifications |
| 9 | `20260929120800_blocks_reports.sql` | blocages, signalements |
| 10 | `20260929120900_security.sql` | RLS, droits de colonnes et de fonctions |
| 11 | `20261001120000_writes.sql` | les écritures de la phase 2 : `create_listing`, `update_listing`, `open_conversation`, l'identifiant tiré par le formulaire (`grant insert (id)`) ; et ce qu'il permet au navigateur, tenu par la base — liens permanents (`retired_slugs`, `check_permalink`), annonce née disponible et prix d'avant déduit (`derive_listing_display`), une notification par croisement (`notifications_one_per_match`) |
| 12 | `20261001120100_product_tag_singles.sql` | le produit « Cartes à l'unité » : la valeur `singles`, seule dans sa migration (une valeur ajoutée ne s'emploie qu'après validation) |
| 13 | `20261001120200_product_tag_singles_games.sql` | les huit jeux qui proposent « Cartes à l'unité » |

Les dix premières sont appliquées au projet depuis le 1er octobre 2026 : elles ne se
modifient plus, et une base existante reçoit chaque nouvelle migration seule, collée dans
l'éditeur SQL.

Une onzième d'avant, `20260929121000_storage.sql`, créait un bucket Supabase Storage et ses
politiques. Les photos étant passées chez Cloudflare, elle a été retirée avant d'avoir été
appliquée à un projet ; ce qu'elle garantissait est désormais tenu par le registre
`photo_uploads` (écarts 13 et 14).

## 2. Types énumérés

Une valeur inconnue est refusée à l'écriture, comme le mapper la refuse à la lecture.
`tests/schema-sync.test.mjs` compare chaque énumération aux libellés de
`src/lib/labels.ts`, et l'ordre de `game_id` à `GAME_IDS`.

| Type | Valeurs | Remarque |
|---|---|---|
| `game_id` | `pokemon`, `magic`, `onepiece`, `lorcana`, `riftbound`, `yugioh`, `naruto`, `other` | ordre d'affichage ; un jeu ajouté après la production : `alter type … add value … before …` |
| `account_type` | `individual`, `pro` | |
| `listing_audience` | `everyone`, `pros` | |
| `lot_type` | `bulk`, `binder`, `deck`, `sealed`, `mixed` | |
| `card_condition` | `NM`, `EX`, `LP`, `MP`, `HP`, `sealed`, `mixed` | |
| `card_language` | `VF`, `EN`, `JP`, `mixed` | |
| `listing_status` | `available`, `reserved`, `sold` | |
| `wanted_status` | `open`, `fulfilled`, `closed` | |
| `deal_kind` | `sale`, `trade` | |
| `review_role` | `seller`, `buyer` | |
| `notification_kind` | `listing_available`, `deal_closed`, `review_received`, `wanted_match`, `listing_expiring` | `listing_expiring` ajoutée par la migration 14, seule |
| `report_target` | `listing`, `profile`, `conversation`, `wanted` | |
| `report_reason` | `scam`, `counterfeit`, `misleading`, `stolen_photos`, `harassment`, `other` | |
| `product_tag` | `booster-box`, `booster-pack`, `etb`, `upc`, `tin`, `coffret`, `bundle`, `precon`, `structure-deck`, `promo`, `graded`, `playmat`, `sleeves`, `binder-included` | |

## 3. Conventions physiques

| Sujet | Choix | Pourquoi |
|---|---|---|
| Identifiants | `uuid default gen_random_uuid()` ; codes naturels pour les référentiels | un identifiant ne dit rien du volume ni de l'ordre ; le slug d'une commune et l'identifiant `pokemon-ev08` circulent dans les URL |
| Dates | `timestamptz`, `default now()` | les dates relatives (« il y a 3 h ») se calculent côté serveur |
| Montants | `integer`, en centimes | l'euro n'apparaît qu'à l'affichage (`src/lib/format.ts`) |
| Textes | `text` borné par `check (char_length(…) between …)` | les bornes sont celles des schémas Zod |
| Absence | colonne nullable, jamais `0` ni chaîne vide | « une information absente s'affiche —, jamais 0 » |
| Coordonnées | `double precision`, bornées | distance de haversine, `distance_km` |
| Contraintes nommées | `<table>_<règle>` | un refus se lit dans le message d'erreur |
| Fonctions `security definer` | toujours `set search_path = public` | pas de détournement par un schéma de l'appelant |
| Colonnes sur une ligne | chaque colonne et chaque contrainte de table tient sur une ligne | `tests/schema.mjs` lit les colonnes ligne à ligne |

## 4. Les tables

| Table | Entité ou association | Lignes de démonstration | Lecture |
|---|---|---|---|
| `communes` | COMMUNE (+ DÉPARTEMENT) | 112 | tous |
| `editions` | SÉRIE | 98 | tous |
| `product_tag_games` | EXISTE POUR | 78 | tous |
| `profiles` | PROFIL | 15 | tous |
| `account_settings` | PROFIL (réglages privés) | 15 | le titulaire |
| `listings` | ANNONCE | 39 | selon l'audience |
| `listing_photos` | PHOTO | 128 | avec l'annonce |
| `listing_editions` | COUVRE | 63 | avec l'annonce |
| `listing_tags` | CONTIENT | 31 | avec l'annonce |
| `wanted_listings` | DEMANDE | 17 | tous |
| `conversations` | CONVERSATION | 10 | les deux participants |
| `messages` | MESSAGE | 13 | les deux participants |
| `deals` | VENTE | 7 | les deux parties |
| `reviews` | AVIS | 8 | tous |
| `listing_waitlist` | ATTEND | 4 | l'inscrit |
| `notifications` | NOTIFICATION | 12 | le destinataire |
| `blocks` | BLOQUE | 0 | l'auteur |
| `reports` | SIGNALEMENT | 0 | la modération |

Les lignes de démonstration sont celles de `src/lib/mock/`, chargées telles quelles dans
une base réelle (§ 7) : les avis y créent leurs notifications, d'où 12 au lieu de 4.

## 5. Clés étrangères et suppression

| Clé | Vise | À la suppression | Pourquoi |
|---|---|---|---|
| `profiles.id` | `auth.users` | cascade | supprimer le compte supprime le profil |
| `(city, postal_code)` de `profiles`, `listings`, `wanted_listings` | `communes` | refus | un référentiel ne perd pas une commune utilisée |
| `account_settings.user_id` | `profiles` | cascade | |
| `listings.seller_id`, `wanted_listings.buyer_id` | `profiles` | cascade | « annonces et recherches disparaîtraient avec lui » |
| `listings.reserved_for` | `profiles` | mise à null | le lot reste réservé, pour personne |
| `listing_photos`, `listing_editions`, `listing_tags` `.listing_id` | `listings` | cascade | |
| `listing_editions.edition_id` | `editions` | refus | une série citée ne disparaît pas du référentiel |
| `conversations.listing_id`, `buyer_id`, `seller_id` | `listings`, `profiles` | cascade | |
| `messages.conversation_id`, `sender_id` | `conversations`, `profiles` | cascade | |
| `deals.conversation_id`, `seller_id`, `buyer_id` | `conversations`, `profiles` | cascade | une vente part avec le compte de l'une de ses parties |
| `deals.listing_id` | `listings` | **refus** | une annonce vendue ne se supprime plus : l'avis resterait sans objet |
| `reviews.deal_id`, `listing_id`, `reviewer_id` | `deals`, `listings`, `profiles` | **mise à null** | l'avis reste sur le profil noté |
| `reviews.reviewed_id` | `profiles` | cascade | les avis reçus partent avec le compte noté |
| `listing_waitlist`, `notifications`, `blocks`, `reports` (vers profils et sujets) | … | cascade | |

`reports.target_id` n'a pas de clé étrangère : la cible est de l'une de quatre natures,
et le signalement survit à sa disparition.

## 6. Index

58 index, dont les clés primaires et les contraintes d'unicité. Les index secondaires
servent trois besoins, détaillés table par table dans les parties : les listes publiques
(`listings_public_feed`, `listings_by_game`, `wanted_open_by_game`…), les listes d'un
compte (`listings_by_seller`, `conversations_by_buyer`, `deals_by_seller`…), et les
suppressions en cascade d'un compte, qui parcourraient sinon des tables entières
(`messages_by_sender`, `reviews_by_reviewer`, `listing_waitlist_by_user`,
`blocks_by_blocked`, `listings_by_reserved_for`, les trois index partiels de
`notifications`).

## 7. Validation

* `node --import ./tests/alias-hook.mjs --test tests/schema-sync.test.mjs
  tests/schema-security.test.mjs` — 48 tests, dont chaque nouvelle règle, falsifiée une à
  une (la retirer fait échouer son test).
* Les dix-sept migrations sont appliquées dans l'ordre à un PostgreSQL 17 réel (PGlite),
  précédées d'une émulation minimale de Supabase (`auth.uid()`, rôles `anon`,
  `authenticated`, `service_role`, droits par défaut : `supabase/tests/prelude.sql`).
* 164 scénarios y sont rejoués sous les rôles de l'API (`supabase/tests/`, commande
  ci-dessous) : chaque règle refuse ce qu'elle doit refuser (faux vendeur, message
  réécrit, série d'un autre jeu, quatrième photo sans option, photo prise dans les
  téléversements d'un autre, registre lu par un anonyme, fichier encore affiché retiré par
  le ménage, fichier pris par le ménage accroché de nouveau, ménage lancé par un compte
  connecté, annonce vendue supprimée, réécrite ou dépouillée de ses photos, vue
  gonflée…) et laisse passer le parcours normal
  (dépôt, conversation, clôture, avis, réservation, liste d'attente, suppression de
  compte, ménage des fichiers après leur délai de grâce). Le code de sortie compte les
  écarts ; retirer les déclencheurs qui figent une annonce vendue en fait apparaître
  quatre, raccourcir un délai du ménage trois à sept.
  ```
  npm install --no-save @electric-sql/pglite
  node supabase/tests/run.mjs
  ```
* Le jeu de démonstration complet (`src/lib/mock/`) y a été chargé avant le passage à
  Cloudflare : 15 profils, 39 annonces, 128 photos, 7 ventes, 8 avis — toutes les
  contraintes passaient, et `stamp_review` retrouvait exactement la personne notée, son rôle
  et l'annonce du mock. Ses photos sont des adresses Unsplash : depuis le registre, elles
  doivent être téléversées chez Cloudflare avant d'être chargées (`supabase/README.md`,
  § 10).

## 8. Confrontation avec la migration initiale

La migration unique de 902 lignes (`20260929120000_initial_schema.sql`) couvrait la
plupart des fonctionnalités. Rejouée contre une base réelle et comparée au code, elle
laissait ces écarts, tous corrigés dans les migrations actuelles :

| # | Écart | Preuve dans le code | Correction | Test |
|---|---|---|---|---|
| 1 | Le destinataire d'un message pouvait en réécrire le texte : la politique de mise à jour n'avait pas de droits de colonnes (rejoué : texte modifié) | « Seul le destinataire marque un message comme lu » | `grant update (read_at)` seul ; insertion limitée à `MessageInsert` | sécurité |
| 2 | Une conversation s'ouvrait au nom d'un faux vendeur (rejoué) | `contactSeller`, `proposeListing` : le vendeur est celui de l'annonce | la politique d'ouverture exige `l.seller_id = conversations.seller_id` | sécurité |
| 3 | Un vendeur pouvait ouvrir un fil avec n'importe quel compte | `proposeListing` : une demande ouverte, du même jeu | la politique l'exige quand le vendeur écrit le premier | sécurité |
| 4 | N'importe qui savait qui bloque qui, par `is_blocked_between` en RPC (rejoué) | « le bloqué n'apprend rien » | réponse seulement pour une paire dont l'appelant fait partie | sécurité |
| 5 | Supprimer son compte effaçait les avis laissés aux autres (rejoué : 0 avis restant) | `/mon-compte/parametres` : « ils leur appartiennent, pas à vous » | `reviews.deal_id`, `listing_id`, `reviewer_id` en *set null* | structure |
| 6 | Sous la RLS, un particulier comptait zéro lot réservé : « 3 autres lots sont réservés aux professionnels » aurait disparu | `getProOnlyCountByGame`, `ReservedTeaser`, `/pro` | `pro_only_count_by_game()` | sécurité |
| 7 | Rien ne pouvait écrire les vues (colonne retirée au rôle connecté, pas d'incrément par l'API) : « 0 vue » à vie | `ListingHeadline`, « Vues cumulées » | `record_listing_view()`, clé de service seule ; une vue ne rajeunit plus la fiche | sécurité |
| 8 | Les réglages d'alerte n'avaient nulle part où vivre | `/mon-compte/parametres`, section « Alertes » | `account_settings`, privée, née avec le profil | structure, sécurité |
| 9 | Une série inconnue ou d'un autre jeu était acceptée — et le mapper lève sur une série inconnue : une ligne écrite par l'API faisait tomber les facettes | `listing-form.ts`, `resolveEditions`, « devient une table en phase 2 » | table `editions` remplie, clé étrangère, `check_listing_edition`, `check_listing_game_change` | structure |
| 10 | Un produit d'un autre jeu était accepté | `isTagAllowedForGame`, `product-tags.ts` | `product_tag_games`, `check_listing_tag` | structure |
| 11 | Commune et coordonnées libres : une annonce pouvait se placer n'importe où | `isKnownCommune` (trois schémas), `cities.ts` : « la table des communes » | table `communes`, clé étrangère `(city, postal_code)`, `stamp_commune` | structure |
| 12 | Une photo sans fichier était acceptée — le bug « 4 photos » sur une vignette vide | `seed.ts`, `toListingPhotoInserts` | `storage_path not null` | sécurité |
| 13 | Une annonce pouvait accrocher le fichier d'un autre vendeur | `findForeignPhotoRefs`, `photo-refs.ts`, filigrane | le fichier vient du registre `photo_uploads`, inscrit par le serveur seul, au nom du vendeur — un préfixe de chemin ne suffit plus : Cloudflare tire lui-même l'identifiant d'une image privée ; la RLS le vérifie sous la session, `listing_photos_check_upload` pour la clé de service du webhook de paiement | sécurité |
| 14 | N'importe qui listait le bucket, adresses des photos réservées comprises (rejoué) | « Limite connue » : lisible par qui connaît l'adresse, pas plus | plus de bucket Supabase ; le registre n'est lisible que par le propriétaire de chaque ligne, jamais par un anonyme, et les photos d'un lot réservé sont privées chez Cloudflare | sécurité |
| 15 | Demandes, conversations, blocages, signalements sans droits de colonnes : demande rajeunie, lien réécrit, signalement déposé « traité » | `WantedInsert`, `WantedUpdate`, `ConversationInsert`, `BlockInsert`, `ReportInsert` | droits de colonnes égaux à ces types | sécurité |
| 16 | On pouvait se signaler soi-même, ou signaler ce qu'on ne peut pas lire | `resolveTarget` (`report-mutations.ts`) | `check_report_target`, sous la RLS de l'auteur | sécurité |
| 17 | Une notification pouvait n'avoir aucun sujet | `NotificationList`, le mapper des notifications | quatre contraintes de sujet | structure |
| 18 | Un prix d'avant sous le prix donnait une « baisse » mensongère | `nextPreviousPriceCents`, `hasPriceDrop` | `listings_previous_price_above_price` | structure |
| 19 | Slug libre (`../admin`) | `buildSlug` | format d'URL vérifié, annonces et demandes | structure |
| 20 | Coordonnées d'une demande non bornées ; rangs de séries en double | symétrie avec les annonces ; ordre de saisie | contrôles ; `unique (listing_id, position)` | — |
| 21 | Clés étrangères parcourues par les cascades sans index | suppression de compte | sept index | — |
| 22 | Un fichier de 902 lignes | exigence du projet | dix-sept migrations, toutes sous 500 lignes | structure |

Vérifié et gardé tel quel : une annonce dont la vente est clôturée ne se supprime pas
(`on delete restrict` tient, rejoué), et la suppression du compte de son vendeur passe
quand même.

## 9. Points ouverts

À faire côté application avant la bascule (hors du périmètre de ces migrations) :

* **Trois écritures n'ont pas encore d'appelant** : les messages lus à l'ouverture d'un
  fil, les vues (`record_listing_view`, clé de service), les réglages d'alerte
  (`account_settings`). Elles sont listées en tête de `write-seam.ts` ; la base les attend
  (`supabase/README.md`, § 5).
* **Une modification d'annonce** retire les séries, les produits et les photos avant de
  changer le jeu, puis les réinsère ; une photo conservée, reconnue à sa clé et non à son
  adresse, qui change avec l'audience de l'annonce, se réinsère après le retrait — un
  fichier n'affiche qu'une photo (`listing_photos_one_photo_per_file`).
* **Le ménage des fichiers** attend sa tâche planifiée : une fois par jour, un
  gestionnaire de route appelé par Vercel Cron (`CRON_SECRET`) branche `purgePhotoFiles`
  (`src/lib/photo-purge.ts`), écrit et testé — un seul passage à la fois (le bail), lot
  après lot, `claim_photo_purge()` rend des fichiers, Cloudflare les retire à deux par
  seconde, chaque appel dans son délai, `forget_purged_photos()` efface leurs lignes au fil
  de l'eau, jusqu'à un lot incomplet ou 240 secondes, et le journal dit le retard. La
  base tient déjà le reste : elle date le décrochage (`detached_at`, cascades d'une
  annonce ou d'un compte comprises), n'attend que sept jours pour un dépôt jamais accroché
  et un jour pour un fichier décroché, marque ce qu'elle rend (`purge_started_at`) pour
  que plus rien ne l'accroche, rend une reprise une heure plus tard, et la clé étrangère
  empêche d'effacer la ligne d'un fichier affiché (`supabase/README.md`, § 6). Restent à
  vérifier sur un vrai compte le code « image introuvable » (`5404`, lu sur les forums de
  Cloudflare, pas dans sa documentation) — sur une image retirée deux fois, et sur un dépôt
  abandonné —, et à écrire la réconciliation mensuelle.

Décidé depuis (`supabase/README.md`, § 6 et 8) :

* **Les photos d'une annonce réservée aux pros** : privées chez Cloudflare Images. La page
  porte une route du site, `/photos/<clé>/<variante>`, qui revérifie le lecteur sous la RLS
  à chaque image et le redirige vers une URL signée de dix à quinze minutes. Un lot
  redevenu public rend ses photos publiques aussitôt, dans l'action qui change son
  audience ; si Cloudflare rend alors un autre identifiant, la clé se remplace au registre
  et les photos suivent (`on update cascade`).

Décisions à prendre, écrites ici plutôt qu'inventées :

* **L'historique des ventes** (`sold_listing_count`) monte à chaque passage en « Vendu » et
  ne redescend pas quand l'annonce est supprimée : un vendeur peut le gonfler en
  vendant puis supprimant des annonces sans acheteur désigné. Seules les ventes clôturées
  (`deals`) sont infalsifiables.
* **Une annonce sans photo** : le formulaire en exige une, la base non (la démonstration
  montre des lots sans photo honnête). Une fonction `create_listing(payload)`, suggérée
  par `supabase/README.md`, écrirait l'annonce et ses liaisons dans une seule transaction
  et pourrait l'exiger.
* **La référence citable** `BK-…` est dérivée de l'identifiant ; à l'échelle réelle, elle
  devient une colonne unique (`src/lib/data/mappers/shared.ts`).
* **La recherche plein texte** de la phase 2 n'a pas d'index : elle cherche aussi dans les
  noms de séries et les libellés de produits, et son index se choisira avec sa requête.
