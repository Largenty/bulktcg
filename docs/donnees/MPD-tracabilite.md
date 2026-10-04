# Traçabilité — des fonctionnalités aux tables

Partie du [MPD](MPD.md). Chaque fonctionnalité de l'application, les tables et colonnes
qui la portent, ce que la base fait pour elle, et le code qui l'exerce aujourd'hui. Les
coutures `deferWrite` (`src/lib/data/write-seam.ts`) sont citées entre crochets :
`[listings.insert]`.

## Comptes et profils

| Fonctionnalité | Tables et colonnes | Fonctions, déclencheurs, politiques | Code |
|---|---|---|---|
| Inscription par e-mail ou Google | `auth.users` ; `profiles` (`id`, `username`, `city`, `postal_code`, `avatar_initials`) ; `account_settings` | `handle_new_user`, `create_account_settings` ; clé étrangère vers `communes` ; « profil créé par son titulaire » | `src/app/inscription/page.tsx`, `src/components/auth/AuthForm.tsx`, `src/lib/data/session.ts` |
| Profil public | `profiles` (tout sauf `pro_until` à l'écran) ; `reviews` reçus | « profils lisibles par tous », « avis lisibles par tous » | `src/app/profil/[username]/page.tsx`, `src/lib/data/profiles.ts` |
| Modifier son profil, fiche boutique | `profiles` (`username`, `bio`, `city`, `postal_code`, `avatar_initials`, `shop_address`, `shop_hours`, `shop_website`) | droits de colonnes ; `profiles_shop_only_for_pros` ; `profiles_commune_fkey` `[profiles.update]` | `src/app/mon-compte/profil/page.tsx`, `src/lib/data/profile-mutations.ts`, `src/lib/schemas/profile-form.ts` |
| Réglages d'alerte | `account_settings` (`alert_matches`, `alert_messages`) | « réglages lus / modifiés par leur titulaire » ; création par déclencheur | `src/app/mon-compte/parametres/page.tsx` (section « Alertes ») |
| Supprimer son compte | toutes les tables en cascade depuis `profiles` ; `reviews.reviewer_id`, `deal_id`, `listing_id` à null | `auth.admin.deleteUser` avec la clé secrète `[profiles.delete]` | `src/lib/data/profile-mutations.ts`, `src/app/mon-compte/parametres/page.tsx` |
| Note et avis d'un profil | `profiles.rating_avg`, `rating_count`, `punctuality_avg`, `responsiveness_avg`, `reliability_avg` | `refresh_rating` | `src/lib/data/mappers/profiles.ts`, `src/components/profile/` |
| Historique des ventes | `profiles.sold_listing_count` | `count_sale` | `src/app/mon-compte/page.tsx` (« Vendu ici ») |

## Annonces

| Fonctionnalité | Tables et colonnes | Fonctions, déclencheurs, politiques | Code |
|---|---|---|---|
| Déposer une annonce | `listings` (colonnes de `ListingInsert`) ; `listing_editions` ; `listing_tags` ; `listing_photos` | « annonce déposée par son vendeur » ; droits d'insertion ; `listings_stamp_commune` ; `listings_slug_check` ; `listing_editions_match_game`, `listing_tags_match_game` `[listings.insert]` | `src/app/deposer/page.tsx`, `src/lib/data/listing-mutations.ts`, `src/lib/schemas/listing-form.ts` |
| Lien permanent | `listings.slug`, `wanted_listings.slug` (uniques, format d'URL) | absents des droits de mise à jour | `src/lib/slug.ts`, `src/app/annonces/[slug]/page.tsx` |
| Modifier une annonce | `listings` (colonnes de `ListingUpdate`), `previous_price_cents` | `listings_previous_price_above_price` ; `listings_game_change` ; `freeze_listing_after_deal`, `freeze_listing_parts_after_deal` — figée après la vente `[listings.update]` | `src/app/mon-compte/annonces/[slug]/modifier/page.tsx`, `nextPreviousPriceCents` |
| Statut en un clic | `listings.status`, `sold_at`, `reserved_for` | `listings_sold_at_matches_status`, `clear_reservation`, `keep_closed_deal_sold`, `count_sale`, `notify_waitlist` `[listings.status]` | `src/lib/data/listing-mutations.ts` (`setListingStatus`) |
| Supprimer une annonce | `listings` et ses liaisons en cascade | « annonce supprimée par son vendeur » ; `deals.listing_id … on delete restrict` `[listings.delete]` | `deleteListing` |
| Photos (3 gratuites, 8 avec l'option) | `listing_photos` (`storage_path`, `position`) ; `listings.extra_photos` ; `photo_uploads` (fichiers chez Cloudflare Images) | `check_photo_allowance` ; politique d'écriture (téléversements du vendeur) et `listing_photos_check_upload` (la même règle pour la clé de service du webhook de paiement) ; un fichier par photo (`listing_photos_one_photo_per_file`) ; registre écrit par la clé de service ; clé remplacée par Cloudflare suivie (`on update cascade`) | `src/components/deposit/PhotoPicker.tsx`, `src/lib/photo-upload.ts`, `src/lib/photo-refs.ts`, `src/lib/site.ts`, `src/lib/photo-hosting.ts` (variantes, chargeur `next/image`), `src/lib/data/photo-uploads.ts` (`findUnattachableUploads`, avant le paiement des photos 4 à 8) |
| Photos d'une annonce réservée aux pros | `listings.audience` ; `listing_photos` sous la politique de lecture des annonces | « photos lisibles avec leur annonce » : la route des photos privées ne signe que ce que le lecteur peut lire | `src/lib/photo-signing.ts` ; route `/photos/<clé>/<variante>` à écrire (`supabase/README.md`, § 8) |
| Ménage des fichiers photo | `photo_uploads` (`created_at`, `detached_at`, `purge_started_at`) | `claim_photo_purge`, `forget_purged_photos`, `release_photo_purge` (clé de service seule) et le bail `photo_purge_lease` ; `listing_photos_track_upload`, `listing_photos_check_upload` ; délais de `PHOTO_DURATIONS`, lots, reprises et bail de `PHOTO_PURGE` | `src/lib/photo-hosting.ts`, `src/lib/photo-purge.ts` (`purgePhotoFiles`) ; la tâche quotidienne (`src/app/taches/quotidiennes`, Vercel Cron, `CRON_SECRET`) l'appellera avec Cloudflare Images (`supabase/README.md` § 6) |
| Filigrane des photos | `profiles.username` ; `listings.id` (référence dérivée) | aucune règle en base : le libellé se compose à l'affichage | `src/lib/watermark.ts`, `src/app/securite/page.tsx` |
| Séries d'une annonce | `listing_editions` (`edition_id`, `position`) ; `editions` | clé étrangère ; `check_listing_edition` ; index `listing_editions_by_edition` | `src/components/deposit/EditionTagFields.tsx`, `src/lib/editions.ts` |
| Produits d'une annonce | `listing_tags` ; `product_tag_games` | `check_listing_tag` ; index `listing_tags_by_tag` | `src/lib/product-tags.ts`, `src/components/listing/ListingTags.tsx` |
| Ouvert à l'échange | `listings.open_to_trade`, `trade_note` | `listings_trade_note_needs_trade` | `src/components/deposit/ListingOptions.tsx`, filtre `?echange=1` |
| À la une, Urgent | `listings.featured_until`, `urgent_until` | écrits par le service de paiement seul (droits de colonnes) ; index `listings_featured` | `src/lib/listing-display.ts`, `src/lib/site.ts` |
| Remonter | `listings.bump_started_at`, `bump_until` | écrits par le service de paiement seul ; `listings_bump_window` ; le rang se déduit des deux dates | `getRankedAt`, `isBumped` (`src/lib/listing-lifecycle.ts`), `src/components/deposit/ListingOptions.tsx`, `ListingCard` |
| Expiration, prolongation | `listings.renewed_at` ; `notifications` de sorte `listing_expiring` | `listing_on_market`, `listing_expires_at` ; `listings_renew_on_activity`, `renew_listing` `[listings.renew]` ; politiques d'ouverture des conversations et de la liste d'attente ; `run_listing_lifecycle` (clé de service) | `src/lib/listing-lifecycle.ts`, `ListingLifecycleNote`, `src/app/mon-compte/annonces/page.tsx`, `src/app/taches/quotidiennes/route.ts` |
| Archivage des photos | `listing_photos` retirées ; `photo_uploads.detached_at` ; `reports` ouverts | `listing_archived` ; `run_listing_lifecycle` ; `freeze_listing_parts_after_deal` l'admet ; index `reports_open_by_target` | `getShownPhotos`, `src/components/listing/PhotoGallery.tsx`, `src/lib/mock/listings.mock.ts` |
| Vues | `listings.view_count` | `record_listing_view` (clé de service seule) ; `listings_updated_at` l'ignore | `src/components/listing/ListingHeadline.tsx`, `src/app/mon-compte/page.tsx` |

## Recherche, listes et référencement

| Fonctionnalité | Tables et colonnes | Fonctions, index | Code |
|---|---|---|---|
| Liste publique et filtres | `listings` (jeu, format, état, langue, prix, échange, statut), `listing_editions`, `listing_tags` | `listings_public_feed`, `listings_by_game` ; RLS « selon leur audience » | `src/lib/data/listings.ts`, `src/lib/listing-query.ts` |
| Facettes par série et par produit | `listing_editions.edition_id`, `listing_tags.tag`, `editions` | index par série et par produit | `getEditionFacets`, `getTagFacets` |
| Autour de soi | `listings.latitude`, `longitude` ; `communes` | `listings_within`, `distance_km`, `listings_by_position` | `src/lib/geo.ts`, `src/lib/cities.ts` |
| Pages jeu × ville, plan de site | `communes.slug`, `name`, `department_*` ; `listings.city`, `department_code` | lecture publique | `src/app/[game]/[city]/page.tsx`, `src/app/sitemap.ts`, `src/lib/seo.ts` |
| Annonces voisines | `listings.game_id`, `department_code`, coordonnées | — | `getRelatedListings` |
| Accueil (derniers dépôts, à la une, statistiques) | `listings.created_at`, `featured_until`, `sold_at`, `city`, `seller_id` | index du flux public et de la une | `src/app/page.tsx`, `src/lib/data/listings.ts` |

## Offre professionnelle

| Fonctionnalité | Tables et colonnes | Fonctions, politiques | Code |
|---|---|---|---|
| Statut professionnel, badge | `profiles.account_type`, `company_name`, `siret`, `legal_name`, `pro_verified_at` | écrits par le serveur après la vérification du SIRET (clé de service) `[profiles.pro]` ; `profiles_one_account_per_siret` ; `leave_pro_status` `[profiles.leavePro]` | `src/lib/siret.ts`, `src/lib/company-registry.ts`, `src/lib/data/pro-status-mutations.ts`, `ProStatusSection` |
| Forfait pro | `profiles.pro_until` | `is_active_pro` ; `profiles_plan_needs_pro` ; droits de colonnes (paiement seul) | `isActiveProRow`, `hasProPlan`, `src/app/pro/page.tsx` |
| Qualité du vendeur sur l'annonce | `profiles.account_type` ; déclaration du particulier au dépôt (non stockée) | — (le serveur refuse le dépôt d'un particulier sans elle) | `SellerStatusSection`, `SaleTerms`, `createListing` |
| Pages Cardmarket et CardNexus | `profiles.cardmarket_url`, `cardnexus_url` | droits de colonnes ; `profiles_pro_details_only_for_pros` ; formes vérifiées par `check` | `ShopFields`, `ShopDetails` |
| Annonce réservée aux pros | `listings.audience` | politique de lecture ; liaisons qui suivent l'annonce ; `listings_pros_feed` | `src/app/pro/lots/page.tsx`, `getListingForViewer`, `getProOnlyListings` |
| « 3 autres lots réservés aux pros » | `listings.audience`, `status`, `game_id` | `pro_only_count_by_game` | `src/components/pro/ReservedTeaser.tsx`, `getProOnlyCountByGame` |

## Demandes de recherche et croisement

| Fonctionnalité | Tables et colonnes | Fonctions, politiques | Code |
|---|---|---|---|
| Déposer, modifier une demande | `wanted_listings` (colonnes de `WantedInsert`, `WantedUpdate`) | droits de colonnes ; `wanted_stamp_commune` ; `wanted_commune_fkey` `[wanted.insert]` `[wanted.update]` | `src/app/deposer/recherche/page.tsx`, `src/lib/data/wanted-mutations.ts` |
| Fermer : Trouvé, Abandonnée | `wanted_listings.status`, `fulfilled_at` | `wanted_fulfilled_at_matches_status` `[wanted.status]` | `WantedStatusSwitcher`, `toWantedStatusUpdate` |
| Supprimer une demande | `wanted_listings` ; `notifications.wanted_id` en cascade | « demande supprimée par son acheteur » `[wanted.delete]` | `deleteWanted` |
| Qui viendrait jusqu'à moi | `wanted_listings.latitude`, `longitude`, `max_distance_km` | `wanted_reaching` | `src/app/recherches/page.tsx`, `isWantedReachableFrom` |
| Croisement lot / demande | aucune table : calculé à la lecture ; `notifications` de sorte `wanted_match` au dépôt | écrit avec la clé de service `[notifications.insert]` | `src/lib/matching.ts`, `createListing` |
| Proposer son lot à une demande | `conversations`, `messages` | politique d'ouverture : demande ouverte sur ce jeu | `proposeListing`, `src/components/messages/ProposeForm.tsx` |

## Messagerie, réservation, vente

| Fonctionnalité | Tables et colonnes | Fonctions, politiques | Code |
|---|---|---|---|
| Contacter le vendeur, répondre | `conversations` (`ConversationInsert`) ; `messages` (`MessageInsert`) | ouverture sur un lot disponible, avec le vendeur de l'annonce ; `touch_conversation` `[conversations.insert]` `[messages.insert]` | `src/lib/data/message-mutations.ts`, `src/app/messages/` |
| Non-lus, messages lus | `messages.read_at`, `sender_id` | index `messages_unread` ; `read_at` seule colonne du destinataire | `getUnreadConversationCount`, `MessageThread` |
| Retirer une conversation de sa boîte | `conversations.buyer_deleted_at`, `seller_deleted_at`, `last_message_at` | `hide_conversation` `[conversations.delete]` | `src/lib/data/conversations.ts` |
| Bloquer | `blocks` | `is_blocked_between` ; politiques de la messagerie ; `close_deal` `[blocks.insert]` | `src/components/messages/ConversationActions.tsx` |
| Réserver pour quelqu'un | `listings.status`, `reserved_for` | `reserve_listing`, `clear_reservation` ; seuls vendeur et personne désignée écrivent `[listings.reserve]` | `reserveForBuyer`, `src/lib/conversation-display.ts` |
| Liste d'attente | `listing_waitlist` | inscription sur le lot réservé d'un autre ; `waitlist_count` ; `notify_waitlist` `[waitlist.insert]` `[waitlist.delete]` | `src/components/listing/WaitlistButton.tsx`, `src/lib/data/waitlist.ts` |
| Clôturer la vente, désigner l'acheteur | `deals` ; `listings.status`, `sold_at` ; `notifications` | `close_deal` ; `keep_closed_deal_sold` `[deals.close]` | `closeDeal`, `src/app/mon-compte/transactions/` |
| Noter l'autre partie | `reviews` (`ReviewInsert`) ; `profiles` (notes) | politique d'écriture ; `stamp_review`, `refresh_rating`, `notify_review` `[reviews.insert]` | `reviewDeal`, `src/components/review/ReviewForm.tsx` |
| Récapitulatif d'une vente | `deals`, `reviews`, `listings`, `conversations.created_at` | « vente lue par ses parties » | `src/app/mon-compte/transactions/[id]/page.tsx`, `getDealById` |

## Notifications et modération

| Fonctionnalité | Tables et colonnes | Fonctions, politiques | Code |
|---|---|---|---|
| Cloche et page des notifications | `notifications` | lecture par le destinataire ; contraintes de sujet | `src/app/notifications/page.tsx`, `src/lib/data/notifications.ts` |
| Tout marquer comme lu | `notifications.read_at` | seule colonne modifiable `[notifications.read]` | `src/components/notifications/MarkAllRead.tsx` |
| Signaler | `reports` (`ReportInsert`) | `check_report_target` ; unicité par auteur et cible ; lecture par la modération seule `[reports.insert]` | `src/app/signaler/page.tsx`, `src/lib/data/report-mutations.ts` |

## Tableau de bord du compte

Aucune table propre : le suivi, les compteurs et « Vendu ici » sont recalculés à chaque
visite sur `listings` (par vendeur), `wanted_listings` (par acheteur), `deals`, `reviews`
et `conversations` (`src/lib/account-pipeline.ts`, `src/app/mon-compte/page.tsx`). Un
compteur stocké finirait par contredire la liste vers laquelle il mène.

## Index inverse : chaque table, ses fonctionnalités

| Table | Fonctionnalités |
|---|---|
| `communes` | inscription, profil, dépôt d'annonce et de demande, autour de soi, pages de ville |
| `editions` | séries d'une annonce, facettes, recherche par série |
| `product_tag_games` | produits d'une annonce |
| `profiles` | profil public, fiche boutique, forfait pro, note, historique des ventes |
| `account_settings` | réglages d'alerte |
| `listings` | dépôt, modification, statut, suppression, options payantes, échange, audience, vues, listes |
| `listing_photos` | photos, filigrane, photos privées |
| `photo_uploads` | photos, ménage des fichiers |
| `listing_editions`, `listing_tags` | séries, produits, facettes |
| `wanted_listings` | demandes de recherche, croisement, proposer son lot |
| `conversations`, `messages` | messagerie, réservation, retrait de la boîte, non-lus |
| `deals` | clôture de la vente, « Ventes et achats », récapitulatif |
| `reviews` | avis, note des profils |
| `listing_waitlist` | liste d'attente |
| `notifications` | cloche, liste d'attente, clôture, avis reçu, croisement |
| `blocks` | blocage |
| `reports` | signalement |
