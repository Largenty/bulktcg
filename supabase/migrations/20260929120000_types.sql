-- BulkTCG — schéma de la phase 2, migration 1 sur 10 : types et fonctions
-- utilitaires.
--
-- Le schéma est découpé en migrations ordonnées par leur horodatage : types,
-- référentiels, profils, annonces, demandes, messagerie, ventes et avis,
-- réservation et notifications, blocages et signalements, sécurité, stockage.
-- `supabase db push` les applique dans cet ordre ; dans l'éditeur SQL, on les
-- colle une à une dans le même ordre. Chaque fichier ne référence que ce que
-- les précédents ont créé. supabase/README.md les liste ; docs/donnees/ décrit
-- le modèle qu'ils implémentent (MCD, MLD, MPD).
--
-- Ces fichiers sont la contrepartie SQL de src/lib/data/rows.ts : mêmes
-- tables, mêmes colonnes, mêmes noms. tests/schema-sync.test.mjs (structure)
-- et tests/schema-security.test.mjs (RLS, droits) les lisent concaténés dans
-- l'ordre, et échouent si l'un des deux côtés bouge sans l'autre.
--
-- Les contraintes reprennent celles des schémas Zod (src/lib/schemas) : le
-- navigateur valide pour répondre vite, l'action serveur revalide parce
-- qu'un formulaire se trafique, et la base refuse en dernier recours.
--
-- La sécurité repose sur la RLS : lecture publique de ce qui est public,
-- écriture réservée au propriétaire, conversations visibles de leurs deux
-- participants seulement. La couche données refait ces contrôles pour
-- rendre une réponse lisible ; la base les garantit.

-- ---------------------------------------------------------------------
-- Énumérations : une valeur inconnue est refusée à l'écriture, comme le
-- mapper la refuse à la lecture.
-- ---------------------------------------------------------------------

-- L'ordre suit src/types/game.ts (GAME_IDS) ; tests/schema-sync.test.mjs le
-- compare. Un enum se trie dans l'ordre de sa déclaration : « order by
-- game_id » rend l'ordre des menus et de la tranche. Ajouter un jeu après la
-- mise en production se fera par « alter type public.game_id add value …
-- before … », dans une migration à part. « other » ferme la liste : les jeux
-- sans intercalaire (Digimon, Flesh and Blood…).
create type public.game_id as enum ('pokemon', 'magic', 'onepiece', 'lorcana', 'riftbound', 'yugioh', 'naruto', 'other');
-- Particulier ou professionnel. Un pro paie un forfait ; pro_until (profils)
-- porte la fin de la période payée.
create type public.account_type as enum ('individual', 'pro');
-- Qui voit une annonce : tout le monde, ou les seuls pros au forfait actif.
create type public.listing_audience as enum ('everyone', 'pros');
create type public.lot_type as enum ('bulk', 'binder', 'deck', 'sealed', 'mixed');
create type public.card_condition as enum ('NM', 'EX', 'LP', 'MP', 'HP', 'sealed', 'mixed');
create type public.card_language as enum ('VF', 'EN', 'JP', 'mixed');
create type public.listing_status as enum ('available', 'reserved', 'sold');
create type public.wanted_status as enum ('open', 'fulfilled', 'closed');
create type public.deal_kind as enum ('sale', 'trade');
-- Le rôle de la personne notée dans la vente : les critères sont les mêmes,
-- la fiabilité n'y veut pas dire la même chose.
create type public.review_role as enum ('seller', 'buyer');
-- Ce que dit une notification. listing_available : un lot réservé sur
-- lequel on attendait est de nouveau disponible ; deal_closed : le vendeur
-- a clôturé la vente, on peut le noter ; review_received : quelqu'un vous a
-- noté ; wanted_match : un lot déposé répond à l'une de vos recherches.
create type public.notification_kind as enum ('listing_available', 'deal_closed', 'review_received', 'wanted_match');
create type public.report_target as enum ('listing', 'profile', 'conversation', 'wanted');
create type public.report_reason as enum ('scam', 'counterfeit', 'misleading', 'stolen_photos', 'harassment', 'other');
create type public.product_tag as enum (
  'booster-box', 'booster-pack', 'etb', 'upc', 'tin', 'coffret', 'bundle',
  'precon', 'structure-deck', 'promo', 'graded', 'playmat', 'sleeves', 'binder-included'
);

-- ---------------------------------------------------------------------
-- Distance à vol d'oiseau, en kilomètres : la même formule que
-- src/lib/geo.ts, pour que « à moins de 50 km » veuille dire la même chose
-- en SQL et à l'écran.
-- ---------------------------------------------------------------------

create or replace function public.distance_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
) returns double precision
language sql immutable parallel safe as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
  ));
$$;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
