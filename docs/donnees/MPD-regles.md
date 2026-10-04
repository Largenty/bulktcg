# MPD — Fonctions et déclencheurs

Partie du [MPD](MPD.md). Quarante-deux fonctions et trente et un déclencheurs tiennent les
règles que la base doit garantir seule : ce que le navigateur ne fournit pas (la personne
notée, les coordonnées d'une commune), ce qu'il ne doit pas pouvoir écrire (les
compteurs), et ce qui doit arriver quoi qu'il fasse (prévenir la liste d'attente, dater le
retrait d'un fichier photo).

Trois principes :

* **`security definer` seulement quand il le faut** — quand la fonction doit voir ou
  écrire au-delà de la RLS de l'appelant (écrire une notification, lire les blocages de
  l'autre). Ces fonctions fixent toutes `set search_path = public`. Les autres
  (`listings_within`, `wanted_reaching`, `check_report_target`, `clear_reservation`,
  `create_listing`, `update_listing`, `open_conversation`) s'exécutent sous les droits de
  l'appelant, et la RLS s'applique à leurs lectures comme à leurs écritures.
* **L'identité vient de `auth.uid()`**, jamais d'un argument : `close_deal` et
  `reserve_listing` ne reçoivent qu'une conversation, et vérifient que l'appelant en est
  le vendeur — et que personne n'y a bloqué personne.
* **Un refus porte un code SQL standard**, que la couche données traduit en
  `MutationResult` : `23514` règle métier refusée, `23503` clé étrangère (commune ou série
  inconnue), `23505` unicité (lot déjà vendu, avis ou signalement en double), `P0002`
  introuvable, `42501` interdit.

## Fonctions appelées par l'application

| Fonction | Rend | Sécurité | Exécutable par | Ce qu'elle fait | Côté application |
|---|---|---|---|---|---|
| `create_listing(payload)` | `(permalink, created)` | invoker | connecté | l'annonce, ses séries et ses produits d'une seule transaction ; un doublon de l'identifiant rend le lien de l'annonce du vendeur avec `created` à faux, et rien d'autre ; refuse les photos jusqu'à la phase 3 | `listings.insert` (`createListing`) : seul `created` déclenche les notifications de croisement |
| `update_listing(listing, payload)` | — | invoker | connecté | retire séries et produits, met l'annonce à jour sans toucher au lien, au statut ni au prix d'avant, réinsère ; « introuvable » sur l'annonce d'un autre | `listings.update` (`updateListing`) |
| `open_conversation(listing, buyer, seller, first_message)` | `uuid` | invoker | connecté | la conversation et son premier message d'un seul bloc, sous les politiques des deux tables | `conversations.insert` (`contactSeller`, `proposeListing`) |
| `is_retired_slug(slug_kind, candidate)` | `boolean` | definer | connecté | un lien a-t-il déjà servi ? — la seule question posée à `retired_slugs` | `check_permalink` |
| `close_deal(conversation, deal_kind)` | `uuid` | definer | connecté | vérifie que l'appelant est le vendeur et que personne n'est bloqué ; crée la vente, passe le lot en « Vendu », prévient l'acheteur | `deals.close` (`closeDeal`) |
| `reserve_listing(conversation)` | — | definer | connecté | réserve le lot du vendeur pour l'autre partie de la conversation | `listings.reserve` (`reserveForBuyer`) |
| `hide_conversation(conversation)` | — | definer | connecté | pose la date de retrait de l'appelant, et seulement la sienne | `conversations.delete` (`hideConversation`) |
| `waitlist_count(listing)` | `integer` | definer | connecté | le nombre d'inscrits, pour le vendeur ; 0 pour tout autre | `getWaitlistCountsForSeller` |
| `listings_within(lat, lon, rayon)` | `setof listings` | invoker | tous | annonces en ligne du rayon — ni vendues, ni expirées —, les plus proches d'abord | `getListings` avec origine |
| `wanted_reaching(lat, lon)` | `setof wanted_listings` | invoker | tous | demandes ouvertes dont le rayon couvre le point | `getWantedListings({ reachableOnly })` |
| `pro_only_count_by_game()` | `(game_id, listing_count)` | definer | tous | combien de lots réservés aux pros en ligne, par jeu — jamais une ligne | `getProOnlyCountByGame` |
| `listing_expires_at(listing)`, `listing_on_market(listing)`, `listing_archived(listing)` | `timestamptz`, `boolean` | invoker | tous | l'échéance (dernier geste + 90 jours), en ligne (ni vendue ni expirée), archivée (30 jours après la vente ou l'expiration) — les durées de `LISTING_LIFECYCLE` (`tests/schema-sync.test.mjs`) | `isOnMarket`, `isArchived` (`src/lib/listing-lifecycle.ts`) en sont le miroir |
| `renew_listing(listing)` | `timestamptz` | definer | connecté | « Prolonger », « Remettre en ligne » : 90 jours de plus pour le vendeur seul, jamais sur une annonce vendue ; rend la nouvelle échéance | `listings.renew` (`renewListing`) |
| `leave_pro_status()` | — | definer | connecté | repasser en compte particulier, soi-même : refusé avec un forfait en cours ; statut, enseigne, fiche boutique, SIRET et pages déclarées partent ensemble | `profiles.leavePro` (`leaveProStatus`) |
| `run_listing_lifecycle()` | `(warned_listings, archived_listings, removed_photos)` | definer | **`service_role` seul** | prévient une fois par mise en ligne le vendeur d'une annonce qui expire dans 7 jours (`listing_expiring`), puis retire les photos des annonces archivées, sauf signalement ouvert ; un verrou consultatif l'empêche de tourner deux fois à la fois | la tâche quotidienne (`src/app/taches/quotidiennes`, Vercel Cron), `runListingLifecycle` |
| `record_listing_view(listing)` | — | definer | **`service_role` seul** | ajoute une vue sans toucher à la date de modification | sans appelant encore : listée en tête de `write-seam.ts` |
| `claim_photo_purge(purge_run, batch_size)` | `(file_key, retry)` | definer | **`service_role` seul** | un lot de 1 à 1 000 fichiers à retirer chez Cloudflare : ceux qu'aucune photo n'affiche depuis 7 jours (jamais accrochés, depuis `created_at`) ou 1 jour (décrochés, depuis `detached_at`), relus sous verrou et marqués `purge_started_at`, et ce qu'un passage a pris sans obtenir le retrait il y a plus d'une heure (`retry`, remarqué et renvoyé en fin de file) — les reprises gardant la moitié du lot au plus tant que des fichiers neufs attendent ; prend le bail du passage (`photo_purge_lease`, cinq minutes) ou refuse (`55P03`) ; refuse de tourner hors de `read committed` | `purgePhotoFiles` (`src/lib/photo-purge.ts`), lot après lot ; le ménage quotidien (Vercel Cron, `supabase/README.md` § 6) ; délais égaux à `PHOTO_DURATIONS` (`src/lib/photo-hosting.ts`), lot et reprise à `PHOTO_PURGE` (`tests/schema-sync.test.mjs`) |
| `forget_purged_photos(file_keys)` | `integer` | definer | **`service_role` seul** | efface, d'un appel, les lignes des fichiers dont Cloudflare a confirmé le retrait — seulement celles que le ménage a marquées ; rend leur nombre | `purgePhotoFiles` |
| `release_photo_purge(purge_run)` | — | definer | **`service_role` seul** | rend le bail du ménage, s'il est à ce passage | `purgePhotoFiles`, en fin de passage |
| `is_active_pro(uid)` | `boolean` | definer | tous | type pro et forfait en cours ; appelée par la politique de lecture des annonces | `isActiveProRow` en est le miroir |
| `is_blocked_between(a, b)` | `boolean` | definer | tous | un blocage dans un sens ou dans l'autre — seulement si l'appelant est `a` ou `b` | politiques de la messagerie, `close_deal` |
| `distance_km(lat1, lon1, lat2, lon2)` | `double precision` | immutable | tous | la formule de haversine de `src/lib/geo.ts` | `getDistanceKm` |

## Déclencheurs

| Déclencheur | Table | Moment | Fonction | Règle |
|---|---|---|---|---|
| `on_auth_user_created` | `auth.users` | après insertion | `handle_new_user` | le profil naît avec le compte, si les métadonnées portent un pseudo |
| `profiles_create_settings` | `profiles` | après insertion | `create_account_settings` | les réglages d'alerte naissent avec le profil, cochés |
| `account_settings_updated_at` | `account_settings` | avant mise à jour | `set_updated_at` | date du dernier changement |
| `listings_stamp_commune` | `listings` | avant insertion ou mise à jour du lieu | `stamp_commune` | département et coordonnées recopiés de la commune |
| `listings_game_change` | `listings` | avant mise à jour de `game_id` | `check_listing_game_change` | changer de jeu exige d'avoir retiré les séries et produits de l'ancien |
| `listings_clear_reservation` | `listings` | avant mise à jour du statut | `clear_reservation` | quitter « Réservé » efface la personne désignée |
| `listings_keep_closed_deal_sold` | `listings` | avant mise à jour du statut | `keep_closed_deal_sold` | un lot dont la vente est clôturée reste vendu |
| `listings_freeze_after_deal` | `listings` | avant mise à jour | `freeze_listing_after_deal` | une annonce dont la vente est clôturée garde son contenu — titre, description, prix, lieu, audience… — : les avis s'y rapportent ; statut, date de vente, vues et options suivent leur cours |
| `listing_photos_freeze_after_deal`, `listing_editions_freeze_after_deal`, `listing_tags_freeze_after_deal` | `listing_photos`, `listing_editions`, `listing_tags` | avant toute écriture | `freeze_listing_parts_after_deal` | photos, séries et produits d'une annonce vendue ne bougent plus ; la cascade d'un compte supprimé passe encore, et l'archivage retire les photos d'une annonce archivée (migration 15) |
| `listings_renew_on_activity` | `listings` | avant mise à jour | `renew_on_seller_activity` | un geste du vendeur connecté — modifier, changer le statut, réserver — relance l'annonce pour 90 jours ; ni une vue, ni le paiement, ni la tâche quotidienne |
| `listings_updated_at` | `listings` | avant mise à jour, sauf vue comptée | `set_updated_at` | une vue n'est pas une modification |
| `listings_count_sale` | `listings` | après mise à jour du statut | `count_sale` | +1 à l'historique en passant « Vendu », −1 en sortant |
| `listings_notify_waitlist` | `listings` | après changement de statut | `notify_waitlist` | tous les inscrits prévenus au retour à « Disponible » ; la liste se vide dès que le lot quitte « Réservé » |
| `listing_photos_allowance` | `listing_photos` | avant insertion ou changement de rang | `check_photo_allowance` | rang 3 et au-delà : l'option « 8 photos » est requise |
| `listing_photos_check_upload` | `listing_photos` | avant insertion, changement de fichier ou d'annonce | `check_photo_upload` | pour tous les rôles, clé de service comprise : le fichier est un téléversement du vendeur de l'annonce (celui d'un compte supprimé n'est à personne), et le ménage ne l'a pas pris ; le verrou partagé attend un ménage en cours |
| `listing_photos_track_upload` | `listing_photos` | après insertion, changement de fichier ou suppression | `track_photo_upload_use` | le registre date le moment où plus aucune photo n'affiche un fichier (cascades d'une annonce ou d'un compte comprises), et l'efface quand une photo le reprend ; le fichier est verrouillé avant d'être daté |
| `listing_editions_match_game` | `listing_editions` | avant insertion ou mise à jour | `check_listing_edition` | la série appartient au jeu de l'annonce |
| `listing_tags_match_game` | `listing_tags` | avant insertion ou mise à jour | `check_listing_tag` | le produit existe pour le jeu de l'annonce |
| `wanted_updated_at` | `wanted_listings` | avant mise à jour | `set_updated_at` | date de modification |
| `wanted_stamp_commune` | `wanted_listings` | avant insertion ou mise à jour du lieu | `stamp_commune` | comme pour les annonces : le centre du rayon vient du référentiel |
| `messages_touch_conversation` | `messages` | après insertion | `touch_conversation` | la conversation remonte en tête de boîte |
| `reviews_stamp` | `reviews` | avant insertion | `stamp_review` | la personne notée, son rôle et l'annonce se déduisent de la vente ; un tiers est refusé |
| `reviews_refresh_rating` | `reviews` | après toute écriture | `refresh_rating` | note globale et notes par critère recalculées, nulles sans avis |
| `reviews_notify` | `reviews` | après insertion | `notify_review` | la personne notée est prévenue |
| `reports_check_target` | `reports` | avant insertion | `check_report_target` | la cible existe pour celui qui signale, et n'est pas à lui |
| `listings_check_permalink`, `wanted_listings_check_permalink` | `listings`, `wanted_listings` | avant insertion | `check_permalink` | pour le rôle connecté : le lien finit par les huit premiers caractères de l'identifiant, et n'a jamais servi |
| `listings_retire_slug`, `wanted_listings_retire_slug` | `listings`, `wanted_listings` | après suppression | `retire_slug` | le lien rejoint `retired_slugs` |
| `listings_derive_display` | `listings` | avant insertion, ou mise à jour du prix ou du prix d'avant | `derive_listing_display` | une annonce naît « Disponible », sans réservation ni prix d'avant ; ensuite le prix d'avant suit le prix seul — l'ancien quand il baisse, plus rien quand il remonte —, la valeur envoyée ignorée. Passe avant le gel d'une annonce vendue |

## Ordre de création

Les migrations créent chaque fonction avant le déclencheur qui l'appelle, et chaque table
avant les clés étrangères qui la visent ; `tests/schema-sync.test.mjs` le vérifie. Une
fonction `plpgsql` peut nommer une table créée plus tard — son corps n'est vérifié qu'à
l'exécution : `close_deal` (migration 7) écrit dans `notifications` (migration 8). Une
fonction `sql` non : `is_blocked_between`, `waitlist_count`, `listings_within` et
`wanted_reaching` suivent leurs tables.

## Ce qui n'est pas un déclencheur

* **Le croisement lot / demande** (`wanted_match`) : calculé en TypeScript
  (`src/lib/matching.ts`), le même que celui montré au vendeur au dépôt ; l'action de
  dépôt écrit les notifications avec la clé de service. Un lot réservé aux pros ne se
  signale qu'aux pros.
* **Le slug** : construit par l'application (`buildSlug`), unique en base. Le commentaire
  de `createListing` prévoit un suffixe tiré par la base en phase 2 ; l'unicité suffit à
  refuser une collision d'ici là.
* **La référence citable** (`BK-…`, `RC-…`) : dérivée de l'identifiant par le mapper. À
  l'échelle réelle, elle devra devenir une colonne unique (`src/lib/data/mappers/shared.ts`).
