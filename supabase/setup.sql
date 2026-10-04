-- BulkTCG — toute la base, en un seul fichier.
--
-- À exécuter une seule fois, sur un projet Supabase neuf : dans le tableau de bord du
-- projet, SQL Editor, coller tout le fichier, puis Run. Il crée les énumérations, les
-- référentiels (communes, séries, produits), les tables, les fonctions, les déclencheurs,
-- la RLS et les droits. Rien à installer avant : il ne s'appuie que sur ce que tout projet
-- Supabase fournit (les rôles anon, authenticated et service_role, et auth.users).
--
-- Fichier généré, à ne pas modifier : il met bout à bout les migrations de
-- supabase/migrations/, qui restent la source. Après avoir modifié l'une d'elles :
-- node scripts/supabase-setup.mjs — tests/supabase-setup.test.mjs le vérifie.
--
-- Une fois la base créée, un changement de schéma s'applique par sa seule nouvelle
-- migration ; ce fichier ne sert qu'à créer une base vide. Pour passer ensuite à la CLI
-- (supabase db push), marquer d'abord ces migrations comme déjà appliquées :
--   npx supabase migration repair --status applied 20260929120000 20260929120100 20260929120200 20260929120300 20260929120400 20260929120500 20260929120600 20260929120700 20260929120800 20260929120900 20261001120000 20261001120100 20261001120200 20261002120000 20261002120100 20261002120200 20261004120000
--
-- Sommaire :
--   20260929120000_types.sql
--   20260929120100_referentials.sql
--   20260929120200_profiles.sql
--   20260929120300_listings.sql
--   20260929120400_wanted.sql
--   20260929120500_messaging.sql
--   20260929120600_deals_reviews.sql
--   20260929120700_reservations_notifications.sql
--   20260929120800_blocks_reports.sql
--   20260929120900_security.sql
--   20261001120000_writes.sql
--   20261001120100_product_tag_singles.sql
--   20261001120200_product_tag_singles_games.sql
--   20261002120000_listing_expiring_kind.sql
--   20261002120100_listing_lifecycle.sql
--   20261002120200_pro_status.sql
--   20261004120000_reserve_respects_blocks.sql

-- ======================================================================================
-- 20260929120000_types.sql
-- ======================================================================================

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

-- ======================================================================================
-- 20260929120100_referentials.sql
-- ======================================================================================

-- BulkTCG — migration 2 sur 10 : les référentiels.
--
-- Trois listes que le code tient aujourd'hui à la main, et dont la base a
-- besoin pour refuser en dernier recours ce que les formulaires refusent
-- déjà : la commune d'un dépôt, la série d'une annonce, le produit qu'elle
-- contient. Chacune est remplie ici avec le référentiel de la phase 1, et
-- tests/schema-sync.test.mjs compare ligne à ligne les deux versions : une
-- entrée ajoutée d'un côté sans l'autre fait échouer les tests.
--
-- Les jeux, eux, n'ont pas de table : l'énumération game_id (migration 1)
-- est leur liste, dans l'ordre d'affichage, et GAME_IDS sa seule source.

-- ---------------------------------------------------------------------
-- Communes. src/lib/cities.ts : « Une commune existe si son nom et son code
-- postal vont ensemble. En phase 2, la même question est posée à la table
-- des communes. » La voici. Les annonces, les demandes et les profils la
-- référencent par ce couple ; la base officielle (INSEE / La Poste) la
-- remplacera par un import, sans changer sa forme — celle du type City.
-- Les coordonnées sont celles du centre-ville : assez pour trier par
-- distance, pas pour guider quelqu'un jusqu'au rendez-vous.
-- ---------------------------------------------------------------------

create table public.communes (
  -- Le segment d'URL des pages /[jeu]/[ville] : unique, donc un homonyme
  -- (Saint-Denis 93 et 974) devra le distinguer à l'import.
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  postal_code text not null check (postal_code ~ '^\d{5}$'),
  department_code text not null check (department_code ~ '^(\d{2}|2[AB]|97\d)$'),
  department_name text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- Le couple que les formulaires envoient et que les clés étrangères visent.
  unique (name, postal_code)
);

insert into public.communes (slug, name, postal_code, department_code, department_name, latitude, longitude) values
  ('paris', 'Paris', '75001', '75', 'Paris', 48.8566, 2.3522),
  ('marseille', 'Marseille', '13001', '13', 'Bouches-du-Rhône', 43.2965, 5.3698),
  ('lyon', 'Lyon', '69001', '69', 'Rhône', 45.764, 4.8357),
  ('toulouse', 'Toulouse', '31000', '31', 'Haute-Garonne', 43.6047, 1.4442),
  ('nice', 'Nice', '06000', '06', 'Alpes-Maritimes', 43.7102, 7.262),
  ('nantes', 'Nantes', '44000', '44', 'Loire-Atlantique', 47.2184, -1.5536),
  ('montpellier', 'Montpellier', '34000', '34', 'Hérault', 43.6108, 3.8767),
  ('strasbourg', 'Strasbourg', '67000', '67', 'Bas-Rhin', 48.5734, 7.7521),
  ('bordeaux', 'Bordeaux', '33000', '33', 'Gironde', 44.8378, -0.5792),
  ('lille', 'Lille', '59000', '59', 'Nord', 50.6292, 3.0573),
  ('rennes', 'Rennes', '35000', '35', 'Ille-et-Vilaine', 48.1173, -1.6778),
  ('reims', 'Reims', '51100', '51', 'Marne', 49.2583, 4.0317),
  ('toulon', 'Toulon', '83000', '83', 'Var', 43.1242, 5.928),
  ('saint-etienne', 'Saint-Étienne', '42000', '42', 'Loire', 45.4397, 4.3872),
  ('le-havre', 'Le Havre', '76600', '76', 'Seine-Maritime', 49.4944, 0.1079),
  ('grenoble', 'Grenoble', '38000', '38', 'Isère', 45.1885, 5.7245),
  ('dijon', 'Dijon', '21000', '21', 'Côte-d''Or', 47.322, 5.0415),
  ('angers', 'Angers', '49000', '49', 'Maine-et-Loire', 47.4784, -0.5632),
  ('nimes', 'Nîmes', '30000', '30', 'Gard', 43.8367, 4.3601),
  ('villeurbanne', 'Villeurbanne', '69100', '69', 'Rhône', 45.7719, 4.8902),
  ('clermont-ferrand', 'Clermont-Ferrand', '63000', '63', 'Puy-de-Dôme', 45.7772, 3.087),
  ('le-mans', 'Le Mans', '72000', '72', 'Sarthe', 48.0061, 0.1996),
  ('aix-en-provence', 'Aix-en-Provence', '13100', '13', 'Bouches-du-Rhône', 43.5297, 5.4474),
  ('brest', 'Brest', '29200', '29', 'Finistère', 48.3904, -4.4861),
  ('tours', 'Tours', '37000', '37', 'Indre-et-Loire', 47.3941, 0.6848),
  ('amiens', 'Amiens', '80000', '80', 'Somme', 49.8941, 2.2958),
  ('limoges', 'Limoges', '87000', '87', 'Haute-Vienne', 45.8336, 1.2611),
  ('annecy', 'Annecy', '74000', '74', 'Haute-Savoie', 45.8992, 6.1294),
  ('perpignan', 'Perpignan', '66000', '66', 'Pyrénées-Orientales', 42.6887, 2.8948),
  ('boulogne-billancourt', 'Boulogne-Billancourt', '92100', '92', 'Hauts-de-Seine', 48.8352, 2.2409),
  ('metz', 'Metz', '57000', '57', 'Moselle', 49.1193, 6.1757),
  ('besancon', 'Besançon', '25000', '25', 'Doubs', 47.2378, 6.0241),
  ('orleans', 'Orléans', '45000', '45', 'Loiret', 47.9029, 1.9093),
  ('rouen', 'Rouen', '76000', '76', 'Seine-Maritime', 49.4432, 1.0999),
  ('mulhouse', 'Mulhouse', '68100', '68', 'Haut-Rhin', 47.7508, 7.3359),
  ('caen', 'Caen', '14000', '14', 'Calvados', 49.1829, -0.3707),
  ('nancy', 'Nancy', '54000', '54', 'Meurthe-et-Moselle', 48.6921, 6.1844),
  ('argenteuil', 'Argenteuil', '95100', '95', 'Val-d''Oise', 48.9474, 2.247),
  ('saint-denis', 'Saint-Denis', '93200', '93', 'Seine-Saint-Denis', 48.9362, 2.3574),
  ('roubaix', 'Roubaix', '59100', '59', 'Nord', 50.6942, 3.1746),
  ('tourcoing', 'Tourcoing', '59200', '59', 'Nord', 50.7236, 3.161),
  ('nanterre', 'Nanterre', '92000', '92', 'Hauts-de-Seine', 48.8924, 2.2069),
  ('avignon', 'Avignon', '84000', '84', 'Vaucluse', 43.9493, 4.8055),
  ('vitry-sur-seine', 'Vitry-sur-Seine', '94400', '94', 'Val-de-Marne', 48.7875, 2.3928),
  ('creteil', 'Créteil', '94000', '94', 'Val-de-Marne', 48.7904, 2.4556),
  ('dunkerque', 'Dunkerque', '59140', '59', 'Nord', 51.0344, 2.3768),
  ('poitiers', 'Poitiers', '86000', '86', 'Vienne', 46.5802, 0.3404),
  ('asnieres-sur-seine', 'Asnières-sur-Seine', '92600', '92', 'Hauts-de-Seine', 48.9169, 2.2853),
  ('courbevoie', 'Courbevoie', '92400', '92', 'Hauts-de-Seine', 48.8975, 2.2569),
  ('versailles', 'Versailles', '78000', '78', 'Yvelines', 48.8014, 2.1301),
  ('colombes', 'Colombes', '92700', '92', 'Hauts-de-Seine', 48.9236, 2.2522),
  ('aulnay-sous-bois', 'Aulnay-sous-Bois', '93600', '93', 'Seine-Saint-Denis', 48.9386, 2.4906),
  ('rueil-malmaison', 'Rueil-Malmaison', '92500', '92', 'Hauts-de-Seine', 48.876, 2.1808),
  ('pau', 'Pau', '64000', '64', 'Pyrénées-Atlantiques', 43.2951, -0.3708),
  ('aubervilliers', 'Aubervilliers', '93300', '93', 'Seine-Saint-Denis', 48.9146, 2.3822),
  ('champigny-sur-marne', 'Champigny-sur-Marne', '94500', '94', 'Val-de-Marne', 48.8172, 2.5153),
  ('antibes', 'Antibes', '06600', '06', 'Alpes-Maritimes', 43.5808, 7.1251),
  ('beziers', 'Béziers', '34500', '34', 'Hérault', 43.3442, 3.2158),
  ('la-rochelle', 'La Rochelle', '17000', '17', 'Charente-Maritime', 46.1603, -1.1511),
  ('saint-maur-des-fosses', 'Saint-Maur-des-Fossés', '94100', '94', 'Val-de-Marne', 48.7994, 2.4931),
  ('cannes', 'Cannes', '06400', '06', 'Alpes-Maritimes', 43.5528, 7.0174),
  ('calais', 'Calais', '62100', '62', 'Pas-de-Calais', 50.9513, 1.8587),
  ('colmar', 'Colmar', '68000', '68', 'Haut-Rhin', 48.0794, 7.3585),
  ('bourges', 'Bourges', '18000', '18', 'Cher', 47.081, 2.3988),
  ('drancy', 'Drancy', '93700', '93', 'Seine-Saint-Denis', 48.9276, 2.4453),
  ('merignac', 'Mérignac', '33700', '33', 'Gironde', 44.8386, -0.6455),
  ('saint-nazaire', 'Saint-Nazaire', '44600', '44', 'Loire-Atlantique', 47.2735, -2.2134),
  ('valence', 'Valence', '26000', '26', 'Drôme', 44.9333, 4.8924),
  ('quimper', 'Quimper', '29000', '29', 'Finistère', 47.996, -4.1024),
  ('noisy-le-grand', 'Noisy-le-Grand', '93160', '93', 'Seine-Saint-Denis', 48.8483, 2.5527),
  ('villejuif', 'Villejuif', '94800', '94', 'Val-de-Marne', 48.7939, 2.3592),
  ('levallois-perret', 'Levallois-Perret', '92300', '92', 'Hauts-de-Seine', 48.8939, 2.2874),
  ('troyes', 'Troyes', '10000', '10', 'Aube', 48.2973, 4.0744),
  ('neuilly-sur-seine', 'Neuilly-sur-Seine', '92200', '92', 'Hauts-de-Seine', 48.8846, 2.2697),
  ('antony', 'Antony', '92160', '92', 'Hauts-de-Seine', 48.7539, 2.2975),
  ('la-seyne-sur-mer', 'La Seyne-sur-Mer', '83500', '83', 'Var', 43.1024, 5.8781),
  ('chambery', 'Chambéry', '73000', '73', 'Savoie', 45.5646, 5.9178),
  ('niort', 'Niort', '79000', '79', 'Deux-Sèvres', 46.3239, -0.4644),
  ('lorient', 'Lorient', '56100', '56', 'Morbihan', 47.7483, -3.3702),
  ('sarcelles', 'Sarcelles', '95200', '95', 'Val-d''Oise', 48.9954, 2.3789),
  ('beauvais', 'Beauvais', '60000', '60', 'Oise', 49.4295, 2.081),
  ('cholet', 'Cholet', '49300', '49', 'Maine-et-Loire', 47.0594, -0.8797),
  ('venissieux', 'Vénissieux', '69200', '69', 'Rhône', 45.697, 4.8862),
  ('chelles', 'Chelles', '77500', '77', 'Seine-et-Marne', 48.8797, 2.5936),
  ('saint-quentin', 'Saint-Quentin', '02100', '02', 'Aisne', 49.8486, 3.287),
  ('hyeres', 'Hyères', '83400', '83', 'Var', 43.1204, 6.1286),
  ('arles', 'Arles', '13200', '13', 'Bouches-du-Rhône', 43.6768, 4.628),
  ('salon-de-provence', 'Salon-de-Provence', '13300', '13', 'Bouches-du-Rhône', 43.6406, 5.0972),
  ('carpentras', 'Carpentras', '84200', '84', 'Vaucluse', 44.0553, 5.048),
  ('orange', 'Orange', '84100', '84', 'Vaucluse', 44.138, 4.8079),
  ('cavaillon', 'Cavaillon', '84300', '84', 'Vaucluse', 43.837, 5.0392),
  ('l-isle-sur-la-sorgue', 'L''Isle-sur-la-Sorgue', '84800', '84', 'Vaucluse', 43.9186, 5.051),
  ('apt', 'Apt', '84400', '84', 'Vaucluse', 43.876, 5.396),
  ('pertuis', 'Pertuis', '84120', '84', 'Vaucluse', 43.6944, 5.5028),
  ('sorgues', 'Sorgues', '84700', '84', 'Vaucluse', 44.0086, 4.872),
  ('monteux', 'Monteux', '84170', '84', 'Vaucluse', 44.0353, 4.9997),
  ('le-pontet', 'Le Pontet', '84130', '84', 'Vaucluse', 43.9647, 4.8556),
  ('bollene', 'Bollène', '84500', '84', 'Vaucluse', 44.2803, 4.7489),
  ('vaison-la-romaine', 'Vaison-la-Romaine', '84110', '84', 'Vaucluse', 44.2411, 5.0742),
  ('valreas', 'Valréas', '84600', '84', 'Vaucluse', 44.3846, 4.9891),
  ('montelimar', 'Montélimar', '26200', '26', 'Drôme', 44.5581, 4.7508),
  ('romans-sur-isere', 'Romans-sur-Isère', '26100', '26', 'Drôme', 45.045, 5.0508),
  ('bourg-les-valence', 'Bourg-lès-Valence', '26500', '26', 'Drôme', 44.9483, 4.8894),
  ('pierrelatte', 'Pierrelatte', '26700', '26', 'Drôme', 44.3775, 4.6975),
  ('nyons', 'Nyons', '26110', '26', 'Drôme', 44.36, 5.14),
  ('crest', 'Crest', '26400', '26', 'Drôme', 44.7286, 5.0222),
  ('die', 'Die', '26150', '26', 'Drôme', 44.7539, 5.3703),
  ('bourg-de-peage', 'Bourg-de-Péage', '26300', '26', 'Drôme', 45.03, 5.05),
  ('livron-sur-drome', 'Livron-sur-Drôme', '26250', '26', 'Drôme', 44.7736, 4.8394),
  ('tain-l-hermitage', 'Tain-l''Hermitage', '26600', '26', 'Drôme', 45.0703, 4.8547),
  ('villeneuve-les-avignon', 'Villeneuve-lès-Avignon', '30400', '30', 'Gard', 43.9667, 4.7972),
  ('bagnols-sur-ceze', 'Bagnols-sur-Cèze', '30200', '30', 'Gard', 44.1622, 4.6197);

-- ---------------------------------------------------------------------
-- Séries. src/lib/editions.ts est « remplacé en phase 2 par une vraie base
-- de séries — Scryfall pour Magic, TCGdex pour Pokémon » ; la table existe
-- dès maintenant parce que la base doit refuser une série inconnue : le
-- mapper lève sur un identifiant qu'il ne connaît pas (« Édition inconnue en
-- base »), et une seule ligne de listing_editions écrite au hasard par un
-- appel direct à l'API ferait tomber les facettes de toute la liste.
-- L'identifiant porte le jeu : « NEO » est Neo Genesis chez Pokémon et la
-- Dynastie Néon chez Magic ; « pokemon-neo » et « magic-neo » ne se
-- confondent pas.
-- ---------------------------------------------------------------------

create table public.editions (
  id text primary key check (id ~ '^[a-z]+-[a-z0-9]+(-[a-z0-9]+)*$'),
  game_id public.game_id not null,
  code text not null,
  name text not null,
  year smallint not null,
  -- Le regroupement du formulaire de dépôt : sans lui, quarante cases à
  -- cocher à plat.
  block text not null,
  -- L'ordre du référentiel, par jeu : le bloc entier en tête de sa liste,
  -- puis la série la plus récente, celle qu'on coche le plus. L'année ne le
  -- rend pas : « EV » (2023) passe avant EV10 (2025).
  sort_order smallint not null check (sort_order > 0),
  constraint editions_id_carries_game check (starts_with(id, game_id::text || '-')),
  unique (game_id, code),
  unique (game_id, sort_order)
);

insert into public.editions (id, game_id, code, name, year, block, sort_order) values
  ('pokemon-ev', 'pokemon', 'EV', 'Bloc Écarlate & Violet (toutes séries)', 2023, 'Écarlate & Violet', 1),
  ('pokemon-ev10', 'pokemon', 'EV10', 'Rivalités Destinées', 2025, 'Écarlate & Violet', 2),
  ('pokemon-ev09', 'pokemon', 'EV09', 'Aventures Ensemble', 2025, 'Écarlate & Violet', 3),
  ('pokemon-ev08-5', 'pokemon', 'EV08.5', 'Évolutions Prismatiques', 2025, 'Écarlate & Violet', 4),
  ('pokemon-ev08', 'pokemon', 'EV08', 'Étincelles Déferlantes', 2024, 'Écarlate & Violet', 5),
  ('pokemon-ev07', 'pokemon', 'EV07', 'Couronne Stellaire', 2024, 'Écarlate & Violet', 6),
  ('pokemon-ev06-5', 'pokemon', 'EV06.5', 'Fable Nébuleuse', 2024, 'Écarlate & Violet', 7),
  ('pokemon-ev06', 'pokemon', 'EV06', 'Mascarade Crépusculaire', 2024, 'Écarlate & Violet', 8),
  ('pokemon-ev05', 'pokemon', 'EV05', 'Forces Temporelles', 2024, 'Écarlate & Violet', 9),
  ('pokemon-ev04-5', 'pokemon', 'EV04.5', 'Destinées de Paldea', 2024, 'Écarlate & Violet', 10),
  ('pokemon-ev04', 'pokemon', 'EV04', 'Faille Paradoxe', 2023, 'Écarlate & Violet', 11),
  ('pokemon-ev03-5', 'pokemon', 'EV03.5', 'Pokémon 151', 2023, 'Écarlate & Violet', 12),
  ('pokemon-ev03', 'pokemon', 'EV03', 'Flammes Obsidiennes', 2023, 'Écarlate & Violet', 13),
  ('pokemon-ev02', 'pokemon', 'EV02', 'Évolutions à Paldea', 2023, 'Écarlate & Violet', 14),
  ('pokemon-ev01', 'pokemon', 'EV01', 'Écarlate et Violet', 2023, 'Écarlate & Violet', 15),
  ('pokemon-eb', 'pokemon', 'EB', 'Bloc Épée & Bouclier (toutes séries)', 2020, 'Épée & Bouclier', 16),
  ('pokemon-eb12-5', 'pokemon', 'EB12.5', 'Zénith Suprême', 2023, 'Épée & Bouclier', 17),
  ('pokemon-eb12', 'pokemon', 'EB12', 'Tempête Argentée', 2022, 'Épée & Bouclier', 18),
  ('pokemon-eb11', 'pokemon', 'EB11', 'Origine Perdue', 2022, 'Épée & Bouclier', 19),
  ('pokemon-eb10', 'pokemon', 'EB10', 'Astres Radieux', 2022, 'Épée & Bouclier', 20),
  ('pokemon-eb09', 'pokemon', 'EB09', 'Stars Étincelantes', 2022, 'Épée & Bouclier', 21),
  ('pokemon-eb08', 'pokemon', 'EB08', 'Poing de Fusion', 2021, 'Épée & Bouclier', 22),
  ('pokemon-eb07-5', 'pokemon', 'EB07.5', 'Destinées Radieuses', 2021, 'Épée & Bouclier', 23),
  ('pokemon-eb07', 'pokemon', 'EB07', 'Évolution Céleste', 2021, 'Épée & Bouclier', 24),
  ('pokemon-eb06-5', 'pokemon', 'EB06.5', 'Célébrations', 2021, 'Épée & Bouclier', 25),
  ('pokemon-eb06', 'pokemon', 'EB06', 'Règne de Glace', 2021, 'Épée & Bouclier', 26),
  ('pokemon-eb05', 'pokemon', 'EB05', 'Styles de Combat', 2021, 'Épée & Bouclier', 27),
  ('pokemon-eb03-5', 'pokemon', 'EB03.5', 'La Voie du Maître', 2021, 'Épée & Bouclier', 28),
  ('pokemon-eb01', 'pokemon', 'EB01', 'Épée et Bouclier', 2020, 'Épée & Bouclier', 29),
  ('pokemon-sl', 'pokemon', 'SL', 'Bloc Soleil et Lune', 2017, 'Séries anciennes', 30),
  ('pokemon-xy', 'pokemon', 'XY', 'Bloc XY', 2014, 'Séries anciennes', 31),
  ('pokemon-nb', 'pokemon', 'NB', 'Bloc Noir et Blanc', 2011, 'Séries anciennes', 32),
  ('pokemon-dp', 'pokemon', 'DP', 'Bloc Diamant et Perle', 2007, 'Séries anciennes', 33),
  ('pokemon-ex', 'pokemon', 'EX', 'Bloc EX', 2003, 'Séries anciennes', 34),
  ('pokemon-neo', 'pokemon', 'NEO', 'Bloc Neo', 2000, 'Séries anciennes', 35),
  ('magic-fdn', 'magic', 'FDN', 'Foundations', 2024, 'Extensions récentes', 1),
  ('magic-dsk', 'magic', 'DSK', 'Duskmourn : la Maison de l''Horreur', 2024, 'Extensions récentes', 2),
  ('magic-blb', 'magic', 'BLB', 'Bloomburrow', 2024, 'Extensions récentes', 3),
  ('magic-otj', 'magic', 'OTJ', 'Outlaws of Thunder Junction', 2024, 'Extensions récentes', 4),
  ('magic-mkm', 'magic', 'MKM', 'Meurtres au manoir Karlov', 2024, 'Extensions récentes', 5),
  ('magic-lci', 'magic', 'LCI', 'Les Cavernes d''Ixalan', 2023, 'Extensions récentes', 6),
  ('magic-woe', 'magic', 'WOE', 'Les Friches d''Eldraine', 2023, 'Extensions récentes', 7),
  ('magic-ltr', 'magic', 'LTR', 'Le Seigneur des Anneaux : Chroniques de la Terre du Milieu', 2023, 'Extensions récentes', 8),
  ('magic-mom', 'magic', 'MOM', 'L''Invasion des Machines', 2023, 'Extensions récentes', 9),
  ('magic-one', 'magic', 'ONE', 'Phyrexia : Tous une seule étincelle', 2023, 'Extensions récentes', 10),
  ('magic-bro', 'magic', 'BRO', 'La Guerre Fratricide', 2022, 'Extensions récentes', 11),
  ('magic-dmu', 'magic', 'DMU', 'Dominaria Uni', 2022, 'Extensions récentes', 12),
  ('magic-snc', 'magic', 'SNC', 'Les Rues de la Nouvelle-Capenne', 2022, 'Extensions récentes', 13),
  ('magic-neo', 'magic', 'NEO', 'Kamigawa : la Dynastie Néon', 2022, 'Extensions récentes', 14),
  ('magic-mh3', 'magic', 'MH3', 'Modern Horizons 3', 2024, 'Suppléments', 15),
  ('magic-mh2', 'magic', 'MH2', 'Modern Horizons 2', 2021, 'Suppléments', 16),
  ('magic-mh1', 'magic', 'MH1', 'Modern Horizons', 2019, 'Suppléments', 17),
  ('magic-cmm', 'magic', 'CMM', 'Commander Masters', 2023, 'Suppléments', 18),
  ('magic-2x2', 'magic', '2X2', 'Double Masters 2022', 2022, 'Suppléments', 19),
  ('magic-mma', 'magic', 'MMA', 'Modern Masters', 2013, 'Suppléments', 20),
  ('magic-inn', 'magic', 'INN', 'Bloc Innistrad', 2011, 'Séries anciennes', 21),
  ('magic-zen', 'magic', 'ZEN', 'Bloc Zendikar', 2009, 'Séries anciennes', 22),
  ('magic-rav', 'magic', 'RAV', 'Bloc Ravnica', 2005, 'Séries anciennes', 23),
  ('onepiece-op-10', 'onepiece', 'OP-10', 'Royal Blood', 2025, 'Extensions', 1),
  ('onepiece-op-09', 'onepiece', 'OP-09', 'Emperors in the New World', 2024, 'Extensions', 2),
  ('onepiece-op-08', 'onepiece', 'OP-08', 'Two Legends', 2024, 'Extensions', 3),
  ('onepiece-op-07', 'onepiece', 'OP-07', '500 Years in the Future', 2024, 'Extensions', 4),
  ('onepiece-op-06', 'onepiece', 'OP-06', 'Wings of the Captain', 2024, 'Extensions', 5),
  ('onepiece-op-05', 'onepiece', 'OP-05', 'Awakening of the New Era', 2023, 'Extensions', 6),
  ('onepiece-op-04', 'onepiece', 'OP-04', 'Kingdoms of Intrigue', 2023, 'Extensions', 7),
  ('onepiece-op-03', 'onepiece', 'OP-03', 'Pillars of Strength', 2023, 'Extensions', 8),
  ('onepiece-op-02', 'onepiece', 'OP-02', 'Paramount War', 2023, 'Extensions', 9),
  ('onepiece-op-01', 'onepiece', 'OP-01', 'Romance Dawn', 2022, 'Extensions', 10),
  ('onepiece-eb-01', 'onepiece', 'EB-01', 'Memorial Collection', 2024, 'Suppléments', 11),
  ('lorcana-ch9', 'lorcana', 'CH9', 'Fabled', 2025, 'Chapitres', 1),
  ('lorcana-ch8', 'lorcana', 'CH8', 'Reign of Jafar', 2025, 'Chapitres', 2),
  ('lorcana-ch7', 'lorcana', 'CH7', 'Archazia''s Island', 2025, 'Chapitres', 3),
  ('lorcana-ch6', 'lorcana', 'CH6', 'Azurite Sea', 2024, 'Chapitres', 4),
  ('lorcana-ch5', 'lorcana', 'CH5', 'Shimmering Skies', 2024, 'Chapitres', 5),
  ('lorcana-ch4', 'lorcana', 'CH4', 'Ursula''s Return', 2024, 'Chapitres', 6),
  ('lorcana-ch3', 'lorcana', 'CH3', 'Into the Inklands', 2024, 'Chapitres', 7),
  ('lorcana-ch2', 'lorcana', 'CH2', 'Rise of the Floodborn', 2023, 'Chapitres', 8),
  ('lorcana-ch1', 'lorcana', 'CH1', 'The First Chapter', 2023, 'Chapitres', 9),
  ('riftbound-ven', 'riftbound', 'VEN', 'Vendetta', 2026, 'Extensions', 1),
  ('riftbound-unl', 'riftbound', 'UNL', 'Unleashed / Déchaînement', 2026, 'Extensions', 2),
  ('riftbound-sfd', 'riftbound', 'SFD', 'Spiritforged / Armes Spirituelles', 2026, 'Extensions', 3),
  ('riftbound-ogn', 'riftbound', 'OGN', 'Origins / Origines', 2025, 'Extensions', 4),
  ('riftbound-ogs', 'riftbound', 'OGS', 'Proving Grounds / Premiers Pas', 2025, 'Coffret d''initiation', 5),
  ('yugioh-rota', 'yugioh', 'ROTA', 'Rage of the Abyss', 2024, 'Extensions récentes', 1),
  ('yugioh-lede', 'yugioh', 'LEDE', 'Legacy of Destruction', 2024, 'Extensions récentes', 2),
  ('yugioh-phni', 'yugioh', 'PHNI', 'Phantom Nightmare', 2024, 'Extensions récentes', 3),
  ('yugioh-agov', 'yugioh', 'AGOV', 'Age of Overlord', 2023, 'Extensions récentes', 4),
  ('yugioh-dune', 'yugioh', 'DUNE', 'Duelist Nexus', 2023, 'Extensions récentes', 5),
  ('yugioh-cyac', 'yugioh', 'CYAC', 'Cyberstorm Access', 2023, 'Extensions récentes', 6),
  ('yugioh-phhy', 'yugioh', 'PHHY', 'Photon Hypernova', 2023, 'Extensions récentes', 7),
  ('yugioh-xyz', 'yugioh', 'XYZ', 'Ère XYZ', 2011, 'Époques', 8),
  ('yugioh-synchro', 'yugioh', 'SYNCHRO', 'Ère Synchro', 2008, 'Époques', 9),
  ('yugioh-gx', 'yugioh', 'GX', 'Ère GX', 2004, 'Époques', 10),
  ('yugioh-dm', 'yugioh', 'DM', 'Ère Duel Monsters', 2002, 'Époques', 11),
  ('naruto-ky-t4', 'naruto', 'KY-T4', 'Kayou tier 4', 2023, 'Kayou', 1),
  ('naruto-ky-t3', 'naruto', 'KY-T3', 'Kayou tier 3', 2022, 'Kayou', 2),
  ('naruto-ky-t2', 'naruto', 'KY-T2', 'Kayou tier 2', 2021, 'Kayou', 3),
  ('naruto-ky-t1', 'naruto', 'KY-T1', 'Kayou tier 1', 2020, 'Kayou', 4);

-- ---------------------------------------------------------------------
-- Produits par jeu. src/lib/product-tags.ts : « UPC » et « Coffret Dresseur
-- d'Élite » sont du vocabulaire Pokémon, « Structure Deck » du vocabulaire
-- Yu-Gi-Oh. Le formulaire ne propose que ce qui existe pour le jeu choisi, le
-- schéma refuse le reste (src/lib/schemas/listing-form.ts), et la base aussi
-- grâce à cette table : un couple (produit, jeu) absent n'existe pas.
-- ---------------------------------------------------------------------

create table public.product_tag_games (
  tag public.product_tag not null,
  game_id public.game_id not null,
  primary key (tag, game_id)
);

insert into public.product_tag_games (tag, game_id) values
  ('booster-box', 'pokemon'), ('booster-box', 'magic'), ('booster-box', 'onepiece'), ('booster-box', 'lorcana'), ('booster-box', 'riftbound'), ('booster-box', 'yugioh'), ('booster-box', 'naruto'), ('booster-box', 'other'),
  ('booster-pack', 'pokemon'), ('booster-pack', 'magic'), ('booster-pack', 'onepiece'), ('booster-pack', 'lorcana'), ('booster-pack', 'riftbound'), ('booster-pack', 'yugioh'), ('booster-pack', 'naruto'), ('booster-pack', 'other'),
  ('etb', 'pokemon'),
  ('upc', 'pokemon'),
  ('tin', 'pokemon'), ('tin', 'yugioh'),
  ('coffret', 'pokemon'), ('coffret', 'magic'), ('coffret', 'onepiece'), ('coffret', 'lorcana'), ('coffret', 'riftbound'), ('coffret', 'yugioh'), ('coffret', 'naruto'), ('coffret', 'other'),
  ('bundle', 'magic'),
  ('precon', 'pokemon'), ('precon', 'magic'), ('precon', 'onepiece'), ('precon', 'lorcana'), ('precon', 'riftbound'), ('precon', 'yugioh'), ('precon', 'naruto'), ('precon', 'other'),
  ('structure-deck', 'yugioh'),
  ('promo', 'pokemon'), ('promo', 'magic'), ('promo', 'onepiece'), ('promo', 'lorcana'), ('promo', 'riftbound'), ('promo', 'yugioh'), ('promo', 'naruto'), ('promo', 'other'),
  ('graded', 'pokemon'), ('graded', 'magic'), ('graded', 'onepiece'), ('graded', 'lorcana'), ('graded', 'riftbound'), ('graded', 'yugioh'), ('graded', 'naruto'), ('graded', 'other'),
  ('playmat', 'pokemon'), ('playmat', 'magic'), ('playmat', 'onepiece'), ('playmat', 'lorcana'), ('playmat', 'riftbound'), ('playmat', 'yugioh'), ('playmat', 'naruto'), ('playmat', 'other'),
  ('sleeves', 'pokemon'), ('sleeves', 'magic'), ('sleeves', 'onepiece'), ('sleeves', 'lorcana'), ('sleeves', 'riftbound'), ('sleeves', 'yugioh'), ('sleeves', 'naruto'), ('sleeves', 'other'),
  ('binder-included', 'pokemon'), ('binder-included', 'magic'), ('binder-included', 'onepiece'), ('binder-included', 'lorcana'), ('binder-included', 'riftbound'), ('binder-included', 'yugioh'), ('binder-included', 'naruto'), ('binder-included', 'other');

-- ======================================================================================
-- 20260929120200_profiles.sql
-- ======================================================================================

-- BulkTCG — migration 3 sur 10 : les profils et leurs réglages.

-- ---------------------------------------------------------------------
-- Profils : un par compte d'authentification.
-- ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,24}$'),
  city text not null,
  postal_code text not null check (postal_code ~ '^\d{5}$'),
  avatar_initials text not null,
  bio text check (bio is null or char_length(bio) <= 280),
  -- Dénormalisés par déclencheur : null tant qu'aucun avis n'existe, jamais 0.
  rating_avg numeric(2, 1) check (rating_avg is null or rating_avg between 1 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  -- La note critère par critère, dénormalisée par le même déclencheur :
  -- rating_avg en est la moyenne.
  punctuality_avg numeric(2, 1) check (punctuality_avg is null or punctuality_avg between 1 and 5),
  responsiveness_avg numeric(2, 1) check (responsiveness_avg is null or responsiveness_avg between 1 and 5),
  reliability_avg numeric(2, 1) check (reliability_avg is null or reliability_avg between 1 and 5),
  -- L'historique du compte, tenu par count_sale (migration 7). Ce n'est pas
  -- un décompte des annonces : une annonce vendue puis supprimée reste une
  -- vente, et l'écart avec la liste affichée est écrit en clair.
  sold_listing_count integer not null default 0 check (sold_listing_count >= 0),
  account_type public.account_type not null default 'individual',
  -- Nom de la boutique, affiché à côté du pseudo. Présent si et seulement si
  -- le compte est pro.
  company_name text check (company_name is null or char_length(company_name) between 2 and 80),
  -- La fiche boutique d'un pro, publique tant que le forfait court. Le SIRET
  -- est vérifié à la souscription et écrit par le service de paiement ;
  -- l'adresse, les horaires et le site sont renseignés par la boutique.
  siret text check (siret is null or siret ~ '^\d{14}$'),
  shop_address text check (shop_address is null or char_length(shop_address) between 5 and 160),
  shop_hours text check (shop_hours is null or char_length(shop_hours) between 3 and 160),
  shop_website text check (shop_website is null or (shop_website ~ '^https://\S+$' and char_length(shop_website) <= 200)),
  -- Fin de la période payée, écrite par le service de paiement. C'est la date
  -- qui ouvre les annonces réservées, pas le type de compte : un forfait
  -- expiré ne voit plus rien de plus qu'un particulier.
  pro_until timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_company_matches_type check ((account_type = 'pro') = (company_name is not null)),
  -- Un particulier n'a pas de fiche boutique.
  constraint profiles_shop_only_for_pros check (account_type = 'pro' or coalesce(siret, shop_address, shop_hours, shop_website) is null),
  -- La commune du profil existe, comme celle d'une annonce : le formulaire
  -- de profil la refuse sinon (src/lib/schemas/profile-form.ts).
  constraint profiles_commune_fkey foreign key (city, postal_code) references public.communes (name, postal_code)
);

-- À l'inscription par e-mail, le formulaire envoie pseudo et commune dans
-- les métadonnées : le profil naît avec le compte. Une inscription Google
-- n'a pas de pseudo — le profil se complète alors au premier passage, avant
-- tout dépôt (voir supabase/README.md).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data ? 'username' then
    insert into public.profiles (id, username, city, postal_code, avatar_initials)
    values (
      new.id,
      new.raw_user_meta_data ->> 'username',
      new.raw_user_meta_data ->> 'city',
      new.raw_user_meta_data ->> 'postal_code',
      upper(left(regexp_replace(new.raw_user_meta_data ->> 'username', '[^a-z0-9]', '', 'g'), 2))
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Réglages du compte : les alertes de /mon-compte/parametres, « Me prévenir
-- quand un croisement tombe » et « Me prévenir d'un nouveau message ». Ils
-- ne vivent pas sur le profil parce que le profil se lit en entier par
-- n'importe qui, et que ces réglages ne regardent que leur titulaire (« Rien
-- de ce qui est ici n'apparaît sur vos annonces »). Cochés par défaut, comme
-- dans le formulaire ; le service d'envoi d'e-mails les lit avec la clé de
-- service.
-- ---------------------------------------------------------------------

create table public.account_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  alert_matches boolean not null default true,
  alert_messages boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger account_settings_updated_at before update on public.account_settings
  for each row execute function public.set_updated_at();

-- Les réglages naissent avec le profil, quel que soit le chemin : le
-- déclencheur d'inscription, ou le profil complété après une connexion
-- Google. Personne n'a donc à les créer depuis le navigateur.
create or replace function public.create_account_settings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.account_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return null;
end;
$$;

create trigger profiles_create_settings after insert on public.profiles
  for each row execute function public.create_account_settings();

-- ======================================================================================
-- 20260929120300_listings.sql
-- ======================================================================================

-- BulkTCG — migration 4 sur 10 : les annonces, leurs photos, leurs séries
-- et leurs produits.

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  -- Le lien permanent partagé sur Facebook : il ne change jamais, même quand
  -- le titre change (le slug n'est pas dans les droits de mise à jour). La
  -- forme est celle de buildSlug (src/lib/slug.ts) : rien qui casse une URL.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  game_id public.game_id not null,
  title text not null check (char_length(title) between 12 and 90),
  description text not null check (char_length(description) between 40 and 4000),
  lot_type public.lot_type not null,
  -- null = non compté, non pesé. Jamais 0 : « je n'ai pas compté » n'est pas
  -- « il y a zéro carte ».
  card_count integer check (card_count is null or card_count > 0),
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg > 0),
  condition public.card_condition not null,
  language public.card_language not null,
  price_cents integer not null check (price_cents > 0 and price_cents <= 500000),
  previous_price_cents integer check (previous_price_cents is null or previous_price_cents > 0),
  -- La commune du rendez-vous. Le navigateur envoie le couple nom et code
  -- postal, que la clé étrangère vérifie ; le département et les
  -- coordonnées sont recopiés depuis le référentiel par stamp_commune(). La
  -- copie reste figée si le référentiel change : l'annonce est publiée là.
  city text not null,
  postal_code text not null check (postal_code ~ '^\d{5}$'),
  department_code text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  status public.listing_status not null default 'available',
  -- Pour qui le lot est réservé : l'autre partie d'une conversation, posée
  -- par reserve_listing(). Elle seule continue d'écrire au vendeur à son
  -- sujet. null pour une réservation faite hors du site, et dès que le lot
  -- quitte « Réservé » (déclencheur clear_reservation).
  reserved_for uuid references public.profiles (id) on delete set null,
  -- 'pros' : l'annonce n'apparaît ni dans la recherche publique, ni dans le
  -- plan de site, ni aux particuliers — seulement à son vendeur et aux pros
  -- au forfait actif (voir la politique de lecture, migration 10).
  audience public.listing_audience not null default 'everyone',
  -- Ouvert à l'échange : le prix reste — il donne la valeur de référence —,
  -- et le vendeur accepte aussi des cartes contre le lot. La note dit
  -- lesquelles ; elle n'existe que si l'échange est ouvert.
  open_to_trade boolean not null default false,
  trade_note text check (trade_note is null or char_length(trade_note) between 1 and 140),
  -- Les deux options payantes : une date de fin, écrite par le service de
  -- paiement seul (voir les droits de colonnes, migration 10). Une option qui
  -- expire ne se retire pas à la main.
  featured_until timestamptz,
  urgent_until timestamptz,
  -- L'option « 8 photos » : trois photos sont gratuites, les cinq suivantes
  -- la demandent. Achetée une fois pour toutes, écrite par le service de
  -- paiement seul comme les deux dates ci-dessus.
  extra_photos boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sold_at timestamptz,
  constraint listings_sold_at_matches_status check ((status = 'sold') = (sold_at is not null)),
  constraint listings_reserved_for_matches_status check (reserved_for is null or status = 'reserved'),
  constraint listings_trade_note_needs_trade check (trade_note is null or open_to_trade),
  -- « Baisse de 20 % » se calcule contre le prix d'avant : il est donc plus
  -- haut que le prix actuel, ou il n'existe pas. Remonter le prix l'efface
  -- (src/lib/data/mappers.ts, nextPreviousPriceCents).
  constraint listings_previous_price_above_price check (previous_price_cents is null or previous_price_cents > price_cents),
  constraint listings_commune_fkey foreign key (city, postal_code) references public.communes (name, postal_code)
);

create index listings_public_feed on public.listings (status, created_at desc);
create index listings_by_game on public.listings (game_id, status, created_at desc);
create index listings_by_seller on public.listings (seller_id, created_at desc);
create index listings_by_position on public.listings (latitude, longitude);
create index listings_featured on public.listings (featured_until) where featured_until is not null;
-- Le flux de l'espace pro : les annonces réservées, les plus récentes d'abord.
create index listings_pros_feed on public.listings (created_at desc) where audience = 'pros';
-- Le compte qui disparaît remet reserved_for à null : sans index, chaque
-- suppression de compte parcourrait toutes les annonces.
create index listings_by_reserved_for on public.listings (reserved_for) where reserved_for is not null;

-- Une vue comptée n'est pas une modification : sans la condition, chaque
-- visite rajeunirait la date de mise à jour de la fiche.
create trigger listings_updated_at before update on public.listings
  for each row when (old.view_count is not distinct from new.view_count)
  execute function public.set_updated_at();

-- La commune place l'annonce sur la carte : le navigateur la désigne, la
-- base recopie son département et ses coordonnées. Une annonce ne s'invente
-- pas un emplacement pour apparaître dans les recherches d'une autre ville.
-- Commune inconnue : rien n'est recopié, et la clé étrangère refuse.
create or replace function public.stamp_commune() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  place public.communes%rowtype;
begin
  select * into place from public.communes where name = new.city and postal_code = new.postal_code;
  if found then
    new.department_code := place.department_code;
    new.latitude := place.latitude;
    new.longitude := place.longitude;
  end if;
  return new;
end;
$$;

create trigger listings_stamp_commune before insert or update of city, postal_code, department_code, latitude, longitude on public.listings
  for each row execute function public.stamp_commune();

-- ---------------------------------------------------------------------
-- Photos téléversées : le registre des fichiers déposés chez Cloudflare.
-- ---------------------------------------------------------------------

-- Les fichiers vivent chez Cloudflare Images. Le serveur inscrit ici chaque
-- fichier en délivrant l'adresse de dépôt, avec la clé de service (droits,
-- migration 10) : c'est la seule preuve qu'une image appartient à un compte.
-- Un préfixe de chemin ne le pourrait pas — Cloudflare tire lui-même
-- l'identifiant d'une image privée, et les photos d'un lot réservé aux pros
-- doivent l'être. Le registre sert aussi le ménage, que les cascades
-- n'atteignent pas : une ligne qu'aucune photo n'affiche plus désigne un
-- fichier à retirer, passé son délai de grâce (claim_photo_purge).
create table public.photo_uploads (
  -- L'identifiant de l'image chez Cloudflare Images. Jamais une URL :
  -- l'adresse de livraison se compose à la lecture (resolvePhotoUrl), et ne
  -- dépend pas du domaine qui sert les photos. Il peut changer : la
  -- référence de l'API annonce qu'un changement de visibilité « rend un
  -- nouvel UID ». Le serveur remplace alors la clé ici, et les photos
  -- suivent (on update cascade, dans listing_photos).
  key text primary key check (key ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$' and key !~ '\.\.'),
  -- null quand le compte a été supprimé : la ligne reste, le temps que le
  -- ménage retire le fichier chez Cloudflare.
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Quand la dernière photo qui affichait le fichier est partie : photo
  -- retirée, annonce ou compte supprimés. null tant qu'une photo l'affiche,
  -- et pour un fichier jamais accroché, dont le délai part de created_at.
  -- Posée et effacée par listing_photos_track_upload, jamais à la main.
  detached_at timestamptz,
  -- Le ménage a pris le fichier : plus aucune photo ne peut l'accrocher
  -- (listing_photos_check_upload), et la ligne part une fois le retrait
  -- confirmé par Cloudflare (forget_purged_photos).
  purge_started_at timestamptz
);

-- ---------------------------------------------------------------------
-- Photos : jusqu'à huit par annonce, dans l'ordre choisi par le vendeur.
-- ---------------------------------------------------------------------

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- Un fichier du registre, jamais nul : une ligne sans fichier faisait
  -- afficher « 4 photos » sur une vignette qui n'en montrait aucune
  -- (src/lib/mock/seed.ts). La clé étrangère refuse une photo que le
  -- serveur n'a pas délivrée, et empêche le ménage de retirer un fichier
  -- encore affiché. Qu'il vienne des téléversements du vendeur, et non de
  -- ceux d'un autre : listing_photos_check_upload, plus bas, même pour la
  -- clé de service. Une clé que Cloudflare remplace se remplace ici aussi,
  -- dans la même instruction.
  storage_path text not null references public.photo_uploads (key) on delete restrict on update cascade,
  position smallint not null check (position between 0 and 7),
  unique (listing_id, position),
  -- Un fichier n'affiche qu'une photo : la clé que Cloudflare rend en
  -- changeant sa visibilité ne touche qu'une annonce. Partagé avec une
  -- annonce vendue, que rien ne modifie plus, il refuserait sa nouvelle clé
  -- — Cloudflare l'aurait, la base garderait l'ancienne. La modification
  -- retire donc les photos avant de les réinsérer ; l'index sert le ménage.
  constraint listing_photos_one_photo_per_file unique (storage_path)
);

-- Au-delà de trois photos, l'option est requise. La position suffit : elle
-- est unique par annonce et commence à 0. Le paiement précède donc
-- l'écriture des photos 4 à 8 ; le formulaire refuse déjà le cas, la base
-- le refuse en dernier recours.
create or replace function public.check_photo_allowance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.position >= 3
     and not (select extra_photos from public.listings where id = new.listing_id) then
    raise exception 'photo % : au-delà de trois, l''option « 8 photos » est requise', new.position + 1
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listing_photos_allowance before insert or update of position on public.listing_photos
  for each row execute function public.check_photo_allowance();

-- ---------------------------------------------------------------------
-- Le ménage : les fichiers qu'aucune photo n'affiche plus, passé leur délai
-- de grâce (supabase/README.md, § 6 ; src/lib/photo-hosting.ts).
-- ---------------------------------------------------------------------

-- Le registre date lui-même le moment où un fichier cesse d'être affiché :
-- accroché à une photo, sa date de retrait s'efface ; décroché de la
-- dernière qui l'affichait — photo retirée, annonce ou compte supprimés, la
-- cascade passe aussi par ici —, elle se pose.
create or replace function public.track_photo_upload_use() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  released text;
begin
  if tg_op <> 'DELETE' then
    update public.photo_uploads set detached_at = null
     where key = new.storage_path and detached_at is not null;
  end if;
  if tg_op = 'DELETE' then
    released := old.storage_path;
  elsif tg_op = 'UPDATE' then
    if old.storage_path is distinct from new.storage_path then
      released := old.storage_path;
    end if;
  end if;
  if released is not null then
    -- Verrouillé d'abord : une photo qui reprend le fichier au même moment
    -- (lu « for share » par listing_photos_check_upload) attend, ou se fait
    -- attendre, et la condition relue après le verrou la voit. Sans lui, la
    -- date de retrait se poserait sur un fichier de nouveau affiché.
    perform 1 from public.photo_uploads where key = released for update;
    update public.photo_uploads set detached_at = now()
     where key = released
       and not exists (select 1 from public.listing_photos p where p.storage_path = released);
  end if;
  return null;
end;
$$;

create trigger listing_photos_track_upload after insert or update of storage_path or delete on public.listing_photos
  for each row execute function public.track_photo_upload_use();

-- Le fichier d'une photo, à chaque accrochage — même par la clé de
-- service, que la RLS ne retient pas : le webhook de paiement accroche
-- ainsi les photos 4 à 8, où un vendeur glisserait la clé du fichier d'un
-- autre, et rendrait publique la photo d'un lot réservé aux pros. Il
-- appartient au vendeur de l'annonce (celui d'un compte supprimé, à
-- personne), et le ménage ne l'a pas pris : il va disparaître de chez
-- Cloudflare. Le verrou partagé attend un ménage en cours, puis relit.
create or replace function public.check_photo_upload() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  upload public.photo_uploads%rowtype;
begin
  select * into upload from public.photo_uploads where key = new.storage_path for share;
  if not found then
    -- La clé étrangère refuse, avec son propre message.
    return new;
  end if;
  if upload.owner_id is distinct from (select l.seller_id from public.listings l where l.id = new.listing_id) then
    raise exception 'le fichier % n''appartient pas au vendeur de l''annonce', new.storage_path
      using errcode = '42501';
  end if;
  if upload.purge_started_at is not null then
    raise exception 'le fichier % est en cours de retrait, la photo doit être téléversée de nouveau', new.storage_path
      using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger listing_photos_check_upload before insert or update of storage_path, listing_id on public.listing_photos
  for each row execute function public.check_photo_upload();

-- Un seul passage du ménage à la fois : deux doubleraient le débit envoyé à
-- Cloudflare, qui bloque alors tout le compte cinq minutes — dépôts des
-- vendeurs compris —, et Vercel Cron livre parfois deux fois une échéance.
-- Le premier lot d'un passage prend le bail pour cinq minutes, au-delà de la
-- vie d'une fonction ; release_photo_purge le rend. Un passage tué le garde
-- jusqu'à l'échéance.
create table public.photo_purge_lease (
  singleton boolean primary key default true check (singleton),
  run_id uuid not null,
  expires_at timestamptz not null
);

-- Ce que le ménage retire, lot après lot (purgePhotoFiles,
-- src/lib/photo-purge.ts), avec la clé de service : les fichiers qu'aucune
-- photo n'affiche, passé leur délai de grâce — 7 jours jamais accroché, 1
-- jour décroché : ceux de src/lib/photo-hosting.ts (tests/schema-sync).
-- Chaque fichier rendu est marqué (purge_started_at) : plus rien ne
-- l'accroche, et sa ligne ne part qu'une fois le retrait confirmé
-- (forget_purged_photos). Marqué sans être retiré, il revient en reprise
-- (retry) une heure plus tard — un passage en cours le traite peut-être —,
-- puis repart en fin de file ; les reprises ne gardent que la moitié du lot
-- tant que des fichiers neufs attendent. De 1 à 1 000 fichiers par lot.
create or replace function public.claim_photo_purge(purge_run uuid, batch_size integer default 100)
returns table (file_key text, retry boolean)
language plpgsql security definer set search_path = public as $$
declare
  candidate text;
  reserved integer;
  taken integer := 0;
begin
  -- La relecture sous verrou ne voit une photo accrochée entre-temps qu'avec
  -- un instantané neuf à chaque instruction : celui de read committed.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'le ménage ne tourne qu''au niveau read committed, pas %', current_setting('transaction_isolation')
      using errcode = '55000';
  end if;
  if batch_size is null or batch_size not between 1 and 1000 then
    raise exception 'un lot du ménage compte de 1 à 1 000 fichiers, pas %', coalesce(batch_size::text, 'null')
      using errcode = '22023';
  end if;
  insert into public.photo_purge_lease as lease (singleton, run_id, expires_at)
       values (true, purge_run, now() + interval '5 minutes')
  on conflict (singleton) do update set run_id = excluded.run_id, expires_at = excluded.expires_at
       where lease.expires_at < now();
  if not exists (select 1 from public.photo_purge_lease where run_id = purge_run and expires_at > now()) then
    raise exception 'un autre passage du ménage est en cours' using errcode = '55P03';
  end if;
  select count(*) into reserved
    from (select 1 from public.photo_uploads u
           where u.purge_started_at < now() - interval '1 hour' limit batch_size / 2) stale;
  for candidate in
    select u.key from public.photo_uploads u
     where u.purge_started_at is null
       and not exists (select 1 from public.listing_photos p where p.storage_path = u.key)
       and ((u.detached_at is null and u.created_at < now() - interval '7 days')
            or u.detached_at < now() - interval '1 day')
     order by u.created_at, u.key
     limit batch_size - reserved
     for update of u skip locked
  loop
    -- Relu sous le verrou, avec un instantané neuf : une photo accrochée
    -- entre la sélection et le verrou garde son fichier.
    if not exists (select 1 from public.listing_photos p where p.storage_path = candidate) then
      update public.photo_uploads set purge_started_at = now() where key = candidate;
      file_key := candidate;
      retry := false;
      taken := taken + 1;
      return next;
    end if;
  end loop;
  for candidate in
    select u.key from public.photo_uploads u
     where u.purge_started_at < now() - interval '1 hour'
     order by u.purge_started_at, u.key
     limit batch_size - taken
     for update of u skip locked
  loop
    update public.photo_uploads set purge_started_at = now() where key = candidate;
    file_key := candidate;
    retry := true;
    return next;
  end loop;
end;
$$;

-- La fin d'un passage rend le bail — le sien seulement.
create or replace function public.release_photo_purge(purge_run uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.photo_purge_lease where run_id = purge_run;
$$;

-- Le retrait confirmé par Cloudflare : les lignes des fichiers partis
-- s'effacent en un appel — mille clés dans l'adresse d'une suppression
-- PostgREST (key=in.(…)) dépasseraient ce que les relais acceptent, pas le
-- corps d'un appel de fonction. Seules les lignes marquées par le ménage
-- partent. Rend le nombre de lignes effacées.
create or replace function public.forget_purged_photos(file_keys text[]) returns integer
language sql security definer set search_path = public as $$
  with forgotten as (
    delete from public.photo_uploads
     where key = any (file_keys) and purge_started_at is not null
    returning 1
  )
  select count(*)::integer from forgotten;
$$;

-- ---------------------------------------------------------------------
-- Séries et produits : deux tables de liaison vers les référentiels.
-- ---------------------------------------------------------------------

create table public.listing_editions (
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- « pokemon-ev08 », jamais le code seul : voir public.editions.
  edition_id text not null references public.editions (id),
  -- L'ordre de saisie : un vendeur cite ses séries dans l'ordre où elles lui
  -- viennent, et son annonce les relit ainsi. Douze au plus : au-delà, le
  -- formulaire demande de laisser vide.
  position smallint not null check (position between 0 and 11),
  primary key (listing_id, edition_id),
  unique (listing_id, position)
);

create table public.listing_tags (
  listing_id uuid not null references public.listings (id) on delete cascade,
  tag public.product_tag not null,
  primary key (listing_id, tag)
);

create index listing_editions_by_edition on public.listing_editions (edition_id);
create index listing_tags_by_tag on public.listing_tags (tag);

-- Une série appartient au jeu de son annonce, un produit existe pour ce jeu :
-- « sans ce contrôle, un formulaire trafiqué déposerait une extension Magic
-- sur une annonce Pokémon, et le filtre par série deviendrait faux pour tout
-- le monde » (src/lib/schemas/listing-form.ts). La base le refuse aussi.
create or replace function public.check_listing_edition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.listings l
                 join public.editions e on e.game_id = l.game_id
                 where l.id = new.listing_id and e.id = new.edition_id) then
    raise exception 'la série % n''appartient pas au jeu de l''annonce', new.edition_id using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listing_editions_match_game before insert or update on public.listing_editions
  for each row execute function public.check_listing_edition();

create or replace function public.check_listing_tag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.listings l
                 join public.product_tag_games p on p.game_id = l.game_id
                 where l.id = new.listing_id and p.tag = new.tag) then
    raise exception 'le produit % n''existe pas pour le jeu de l''annonce', new.tag using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listing_tags_match_game before insert or update on public.listing_tags
  for each row execute function public.check_listing_tag();

-- Changer le jeu d'une annonce laisserait ses séries et ses produits dans
-- l'ancien. La modification remplace les deux listes (supabase/README.md,
-- « Écritures ») : les retirer, changer le jeu, puis réinsérer.
create or replace function public.check_listing_game_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.listing_editions le
             join public.editions e on e.id = le.edition_id
             where le.listing_id = new.id and e.game_id <> new.game_id)
     or exists (select 1 from public.listing_tags lt
                where lt.listing_id = new.id
                  and not exists (select 1 from public.product_tag_games p
                                  where p.tag = lt.tag and p.game_id = new.game_id)) then
    raise exception 'changer de jeu : retirez d''abord les séries et les produits de l''ancien' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listings_game_change before update of game_id on public.listings
  for each row when (old.game_id is distinct from new.game_id)
  execute function public.check_listing_game_change();

-- ---------------------------------------------------------------------
-- Lectures et compteurs appelés en RPC par la couche données.
-- ---------------------------------------------------------------------

-- Les lots en ligne dans un rayon, les plus proches d'abord : c'est
-- getListings({ origin, maxDistanceKm }) sans la pagination, que le client
-- ajoute avec .range(). security invoker : la RLS des annonces s'applique.
create or replace function public.listings_within(
  origin_lat double precision, origin_lon double precision, radius_km integer
) returns setof public.listings
language sql stable as $$
  select l.* from public.listings l
  where l.status <> 'sold'
    -- Pré-filtre sur une boîte englobante, que l'index sait servir, avant le
    -- calcul exact.
    and l.latitude between origin_lat - radius_km / 111.0 and origin_lat + radius_km / 111.0
    and public.distance_km(origin_lat, origin_lon, l.latitude, l.longitude) <= radius_km
  order by public.distance_km(origin_lat, origin_lon, l.latitude, l.longitude);
$$;

-- Ce qu'un particulier a le droit de savoir de l'espace pro : combien de
-- lots y attendent, et de quels jeux — jamais un titre, jamais un prix
-- (getProOnlyCountByGame, src/lib/data/listings.ts). La RLS lui cache ces
-- lignes : compté sous sa session, le total serait zéro, et « 3 autres lots
-- sont réservés aux professionnels » disparaîtrait de l'accueil comme des
-- listes. security definer, et rien ne sort qu'un nombre par jeu.
create or replace function public.pro_only_count_by_game()
returns table (game_id public.game_id, listing_count integer)
language sql stable security definer set search_path = public as $$
  select l.game_id, count(*)::integer
    from public.listings l
   where l.audience = 'pros' and l.status <> 'sold'
   group by l.game_id
   order by l.game_id;
$$;

-- Le compteur de la fiche et du tableau de bord (« 412 vues », « Vues
-- cumulées »). Aucun rôle connecté ne l'écrit — un vendeur gonflerait le sien
-- depuis la console —, et une mise à jour PostgREST ne sait pas incrémenter :
-- le serveur appelle cette fonction avec la clé de service (droits,
-- migration 10).
create or replace function public.record_listing_view(listing uuid) returns void
language sql security definer set search_path = public as $$
  update public.listings set view_count = view_count + 1 where id = listing;
$$;

-- ======================================================================================
-- 20260929120400_wanted.sql
-- ======================================================================================

-- BulkTCG — migration 5 sur 10 : les demandes de recherche.
--
-- L'annonce vue de l'autre côté, volontairement plus pauvre : ni photo, ni
-- état, ni prix ferme. Un acheteur décrit un besoin — un jeu, un budget
-- plafond, un rayon —, pas un objet qu'il possède.

create table public.wanted_listings (
  id uuid primary key default gen_random_uuid(),
  -- Même lien permanent que les annonces, même forme (src/lib/slug.ts).
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  game_id public.game_id not null,
  title text not null check (char_length(title) between 12 and 90),
  description text not null check (char_length(description) between 30 and 2000),
  -- null = n'importe quel format, n'importe quel budget, n'importe quel volume.
  lot_type public.lot_type,
  max_price_cents integer check (max_price_cents is null or max_price_cents > 0),
  min_card_count integer check (min_card_count is null or min_card_count > 0),
  -- Le point de départ de l'acheteur, centre de son rayon : même référentiel
  -- et même recopie que pour les annonces (stamp_commune, migration 4).
  city text not null,
  postal_code text not null check (postal_code ~ '^\d{5}$'),
  department_code text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- Toujours renseignée : sans elle, une demande n'est croisable avec rien.
  max_distance_km integer not null check (max_distance_km between 5 and 200),
  status public.wanted_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- « Trouvé » est daté : c'est la seule mesure honnête de l'utilité du
  -- croisement. « Abandonnée » ne l'est pas.
  fulfilled_at timestamptz,
  constraint wanted_fulfilled_at_matches_status check ((status = 'fulfilled') = (fulfilled_at is not null)),
  constraint wanted_commune_fkey foreign key (city, postal_code) references public.communes (name, postal_code)
);

create index wanted_open_by_game on public.wanted_listings (status, game_id, created_at desc);
create index wanted_by_buyer on public.wanted_listings (buyer_id, created_at desc);

create trigger wanted_updated_at before update on public.wanted_listings
  for each row execute function public.set_updated_at();

create trigger wanted_stamp_commune before insert or update of city, postal_code, department_code, latitude, longitude on public.wanted_listings
  for each row execute function public.stamp_commune();

-- « Qui viendrait jusqu'à moi » : les demandes ouvertes dont le rayon de
-- l'acheteur couvre le point donné. C'est le rayon de l'acheteur qui décide,
-- jamais celui du vendeur.
create or replace function public.wanted_reaching(
  origin_lat double precision, origin_lon double precision
) returns setof public.wanted_listings
language sql stable as $$
  select w.* from public.wanted_listings w
  where w.status = 'open'
    and public.distance_km(origin_lat, origin_lon, w.latitude, w.longitude) <= w.max_distance_km
  order by public.distance_km(origin_lat, origin_lon, w.latitude, w.longitude);
$$;

-- ======================================================================================
-- 20260929120500_messaging.sql
-- ======================================================================================

-- BulkTCG — migration 6 sur 10 : la messagerie.
--
-- Une conversation porte toujours sur un lot : c'est ce qui permet
-- d'afficher sa photo, son prix et son statut en tête du fil, et de savoir
-- de quoi on parle trois semaines plus tard. Elle naît avec son premier
-- message — celui de l'acheteur depuis la fiche, ou celui du vendeur qui
-- propose son lot à une demande de recherche.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  -- Le vendeur de l'annonce, jamais un tiers : la politique d'ouverture le
  -- vérifie (migration 10).
  seller_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  -- Supprimer une conversation ne la retire que de sa propre boîte : l'autre
  -- partie garde son fil, et un nouveau message la fait revenir (la lecture
  -- compare cette date à last_message_at). Posées par hide_conversation().
  buyer_deleted_at timestamptz,
  seller_deleted_at timestamptz,
  -- Écrire deux fois au même vendeur pour le même lot reprend le fil.
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);

create index conversations_by_buyer on public.conversations (buyer_id, last_message_at desc);
create index conversations_by_seller on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 2000),
  -- Posée par le destinataire seul, et c'est la seule colonne qu'il modifie
  -- (droits, migration 10).
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_by_conversation on public.messages (conversation_id, created_at);
-- Le compteur de non-lus ne compte que les messages reçus.
create index messages_unread on public.messages (conversation_id) where read_at is null;
-- La suppression d'un compte emporte ses messages.
create index messages_by_sender on public.messages (sender_id);

create or replace function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation after insert on public.messages
  for each row execute function public.touch_conversation();

-- Se retirer d'une conversation : seule sa propre colonne bouge. Aucune
-- mise à jour directe n'est permise sur conversations (migration 10).
create or replace function public.hide_conversation(conversation uuid) returns void
language sql security definer set search_path = public as $$
  update public.conversations
     set buyer_deleted_at = case when buyer_id = auth.uid() then now() else buyer_deleted_at end,
         seller_deleted_at = case when seller_id = auth.uid() then now() else seller_deleted_at end
   where id = conversation and auth.uid() in (buyer_id, seller_id);
$$;

-- ======================================================================================
-- 20260929120600_deals_reviews.sql
-- ======================================================================================

-- BulkTCG — migration 7 sur 10 : les ventes clôturées et les avis.
--
-- La vente est clôturée par le vendeur. C'est son lot : il dit quand il est
-- parti, et à qui — l'autre partie de la conversation, jamais un tiers.
-- Clôturer passe le lot en « Vendu » et ouvre l'avis des deux côtés.

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  -- Une vente par conversation, et un lot ne se vend qu'une fois.
  conversation_id uuid not null unique references public.conversations (id) on delete cascade,
  -- restrict : une vente conclue est l'affaire de deux personnes. Supprimer
  -- l'annonce emporterait l'avis que l'autre a laissé — un vendeur mal noté
  -- n'aurait qu'à supprimer son annonce pour l'effacer. La suppression d'un
  -- compte passe quand même : ses ventes partent avec lui (seller_id,
  -- buyer_id) avant que la restriction sur l'annonce ne soit vérifiée.
  listing_id uuid not null unique references public.listings (id) on delete restrict,
  -- Recopiés de la conversation par close_deal() : la politique de lecture
  -- et les listes « Ventes et achats » les lisent sans jointure.
  seller_id uuid not null references public.profiles (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  kind public.deal_kind not null,
  closed_at timestamptz not null default now(),
  check (seller_id <> buyer_id)
);

create index deals_by_seller on public.deals (seller_id, closed_at desc);
create index deals_by_buyer on public.deals (buyer_id, closed_at desc);

-- Tout se déduit de la conversation : le vendeur ne fournit que son
-- identifiant et la nature de l'accord. Le lot peut déjà être en « Vendu »,
-- passé d'un clic depuis le tableau de bord : clôturer y ajoute l'acheteur,
-- et donc les avis. Le déclencheur listings_count_sale compte la vente.
create or replace function public.close_deal(conversation uuid, deal_kind public.deal_kind) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  thread public.conversations%rowtype;
  closed_deal uuid;
begin
  select * into thread from public.conversations
   where id = conversation and seller_id = auth.uid();
  if not found then
    raise exception 'conversation introuvable' using errcode = 'P0002';
  end if;
  if public.is_blocked_between(thread.seller_id, thread.buyer_id) then
    raise exception 'conversation bloquée' using errcode = '42501';
  end if;
  insert into public.deals (conversation_id, listing_id, seller_id, buyer_id, kind)
  values (thread.id, thread.listing_id, thread.seller_id, thread.buyer_id, deal_kind)
  returning id into closed_deal;
  update public.listings set status = 'sold', sold_at = coalesce(sold_at, now())
   where id = thread.listing_id;
  -- L'acheteur l'apprend, avec de quoi noter le vendeur.
  insert into public.notifications (user_id, kind, listing_id, deal_id)
  values (thread.buyer_id, 'deal_closed', thread.listing_id, closed_deal);
  return closed_deal;
end;
$$;

-- Une vente clôturée ne se défait pas depuis le tableau de bord : le lot
-- repasserait « Disponible » avec un acheteur et des avis.
create or replace function public.keep_closed_deal_sold() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'sold' and new.status <> 'sold'
     and exists (select 1 from public.deals where listing_id = new.id) then
    raise exception 'vente clôturée : le lot reste vendu' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listings_keep_closed_deal_sold before update of status on public.listings
  for each row execute function public.keep_closed_deal_sold();

-- Une vente clôturée fige l'annonce : elle est la pièce à laquelle les avis
-- se rapportent (« un lot conforme à l'annonce »). Réécrite après coup —
-- « environ 300 cartes » au lieu de 900 —, elle ferait mentir l'avis ;
-- passée aux pros, elle disparaîtrait pour l'acheteur qui l'a notée
-- (updateListing, src/lib/data/listing-mutations.ts). Le statut a sa propre
-- règle ci-dessus ; la date de vente, les vues et les options payantes
-- suivent leur cours, et close_deal() peut encore passer le lot en « Vendu ».
create or replace function public.freeze_listing_after_deal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.game_id, new.title, new.description, new.lot_type, new.card_count, new.weight_kg,
      new.condition, new.language, new.price_cents, new.previous_price_cents, new.city,
      new.postal_code, new.department_code, new.latitude, new.longitude, new.audience,
      new.open_to_trade, new.trade_note)
     is distinct from
     (old.game_id, old.title, old.description, old.lot_type, old.card_count, old.weight_kg,
      old.condition, old.language, old.price_cents, old.previous_price_cents, old.city,
      old.postal_code, old.department_code, old.latitude, old.longitude, old.audience,
      old.open_to_trade, old.trade_note)
     and exists (select 1 from public.deals where listing_id = old.id) then
    raise exception 'vente clôturée : l''annonce reste telle qu''elle a été vendue' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listings_freeze_after_deal before update on public.listings
  for each row execute function public.freeze_listing_after_deal();

-- Les photos, les séries et les produits en font partie. Une annonce
-- supprimée emporte les siens en cascade : elle n'est alors plus visible
-- ici, et le compte qui disparaît peut partir malgré une vente clôturée.
create or replace function public.freeze_listing_parts_after_deal() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  touched uuid[];
begin
  if tg_op = 'INSERT' then
    touched := array[new.listing_id];
  elsif tg_op = 'DELETE' then
    touched := array[old.listing_id];
  else
    touched := array[old.listing_id, new.listing_id];
  end if;
  if exists (
    select 1 from public.deals d join public.listings l on l.id = d.listing_id
     where d.listing_id = any (touched)
  ) then
    raise exception 'vente clôturée : l''annonce reste telle qu''elle a été vendue' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger listing_photos_freeze_after_deal before insert or update or delete on public.listing_photos
  for each row execute function public.freeze_listing_parts_after_deal();
create trigger listing_editions_freeze_after_deal before insert or update or delete on public.listing_editions
  for each row execute function public.freeze_listing_parts_after_deal();
create trigger listing_tags_freeze_after_deal before insert or update or delete on public.listing_tags
  for each row execute function public.freeze_listing_parts_after_deal();

-- Le passage en « Vendu » incrémente l'historique du vendeur ; en sortir le
-- décrémente. Le nombre d'annonces actives, lui, n'est jamais stocké.
create or replace function public.count_sale() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'sold' and old.status <> 'sold' then
    update public.profiles set sold_listing_count = sold_listing_count + 1 where id = new.seller_id;
  elsif old.status = 'sold' and new.status <> 'sold' then
    update public.profiles set sold_listing_count = greatest(sold_listing_count - 1, 0) where id = new.seller_id;
  end if;
  return new;
end;
$$;

create trigger listings_count_sale after update of status on public.listings
  for each row execute function public.count_sale();

-- ---------------------------------------------------------------------
-- Avis : ils nourrissent la note dénormalisée du profil. Trois critères de
-- 1 à 5 ; la note d'un avis et celle d'un profil en sont la moyenne.
-- ---------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  -- Un avis appartient à la personne notée, pas à son auteur : « Les avis
  -- que vous avez laissés à d'autres vendeurs restent sur leur profil : ils
  -- leur appartiennent, pas à vous » (src/app/mon-compte/parametres). Quand
  -- un compte est supprimé, la vente, l'annonce et l'auteur deviennent donc
  -- nuls au lieu d'emporter l'avis ; les notes, le commentaire et la
  -- personne notée restent. À l'écriture, les trois sont toujours posés : la
  -- politique d'écriture exige la vente, stamp_review en déduit le reste.
  deal_id uuid references public.deals (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  reviewer_id uuid references public.profiles (id) on delete set null,
  -- Posés par stamp_review à partir de la vente : le navigateur ne désigne
  -- que la vente et ses notes, jamais la personne notée.
  reviewed_id uuid not null references public.profiles (id) on delete cascade,
  reviewed_role public.review_role not null,
  punctuality smallint not null check (punctuality between 1 and 5),
  responsiveness smallint not null check (responsiveness between 1 and 5),
  reliability smallint not null check (reliability between 1 and 5),
  comment text check (comment is null or char_length(comment) between 1 and 1000),
  created_at timestamptz not null default now(),
  -- Un avis par personne et par vente.
  unique (deal_id, reviewer_id),
  check (reviewer_id <> reviewed_id)
);

create index reviews_by_reviewed on public.reviews (reviewed_id, created_at desc);
create index reviews_by_reviewer on public.reviews (reviewer_id);
create index reviews_by_listing on public.reviews (listing_id);

create or replace function public.stamp_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sale public.deals%rowtype;
begin
  select * into sale from public.deals where id = new.deal_id;
  if not found then
    raise exception 'vente introuvable' using errcode = 'P0002';
  end if;
  new.listing_id := sale.listing_id;
  if new.reviewer_id = sale.seller_id then
    new.reviewed_id := sale.buyer_id;
    new.reviewed_role := 'buyer';
  elsif new.reviewer_id = sale.buyer_id then
    new.reviewed_id := sale.seller_id;
    new.reviewed_role := 'seller';
  else
    raise exception 'seules les parties de la vente la notent' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger reviews_stamp before insert on public.reviews
  for each row execute function public.stamp_review();

create or replace function public.refresh_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.reviewed_id, old.reviewed_id);
begin
  -- null et non 0 quand il n'y a plus d'avis : un compte sans avis n'a pas
  -- une note de zéro. La note globale est la moyenne des trois critères.
  update public.profiles p set
    rating_count = stats.count,
    rating_avg = case when stats.count = 0 then null else round(stats.overall, 1) end,
    punctuality_avg = case when stats.count = 0 then null else round(stats.punctuality, 1) end,
    responsiveness_avg = case when stats.count = 0 then null else round(stats.responsiveness, 1) end,
    reliability_avg = case when stats.count = 0 then null else round(stats.reliability, 1) end
  from (
    select count(*)::integer as count,
           avg((punctuality + responsiveness + reliability) / 3.0)::numeric as overall,
           avg(punctuality)::numeric as punctuality,
           avg(responsiveness)::numeric as responsiveness,
           avg(reliability)::numeric as reliability
    from public.reviews where reviewed_id = target
  ) as stats
  where p.id = target;
  return null;
end;
$$;

create trigger reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_rating();

-- ======================================================================================
-- 20260929120700_reservations_notifications.sql
-- ======================================================================================

-- BulkTCG — migration 8 sur 10 : réservation, liste d'attente et
-- notifications.
--
-- Un lot réservé ne reçoit plus de nouvelle conversation, et seule la
-- personne pour qui il est réservé continue d'écrire : le vendeur n'est pas
-- relancé par ceux qui arrivent trop tard. Eux s'inscrivent sur la liste
-- d'attente, et sont tous prévenus en même temps si le lot redevient
-- disponible.

-- Réserver pour quelqu'un : l'autre partie d'une de ses conversations,
-- jamais un identifiant fourni par le navigateur.
create or replace function public.reserve_listing(conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  thread public.conversations%rowtype;
begin
  select * into thread from public.conversations
   where id = conversation and seller_id = auth.uid();
  if not found then
    raise exception 'conversation introuvable' using errcode = 'P0002';
  end if;
  update public.listings set status = 'reserved', reserved_for = thread.buyer_id
   where id = thread.listing_id and status <> 'sold';
end;
$$;

-- Quitter « Réservé » efface la personne désignée.
create or replace function public.clear_reservation() returns trigger
language plpgsql as $$
begin
  if new.status <> 'reserved' then
    new.reserved_for := null;
  end if;
  return new;
end;
$$;

create trigger listings_clear_reservation before update of status on public.listings
  for each row execute function public.clear_reservation();

create table public.listing_waitlist (
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

-- La suppression d'un compte emporte ses inscriptions.
create index listing_waitlist_by_user on public.listing_waitlist (user_id);

-- ---------------------------------------------------------------------
-- Notifications : la cloche de l'en-tête compte les non lues, /notifications
-- les liste. Chacune mène à ce dont elle parle, et chaque sorte a sa source
-- en base : la liste d'attente, la clôture, l'avis, le croisement d'un dépôt.
-- ---------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  listing_id uuid references public.listings (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  wanted_id uuid references public.wanted_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- Une notification sans ce dont elle parle ne mène nulle part : chaque
  -- sorte exige son sujet. L'autre personne (le vendeur qui a clôturé,
  -- celle qui a noté) se lit sur la vente et sur l'avis, pas ici.
  constraint notifications_listing_available_subject check (kind <> 'listing_available' or listing_id is not null),
  constraint notifications_deal_closed_subject check (kind <> 'deal_closed' or (listing_id is not null and deal_id is not null)),
  constraint notifications_review_received_subject check (kind <> 'review_received' or deal_id is not null),
  constraint notifications_wanted_match_subject check (kind <> 'wanted_match' or (listing_id is not null and wanted_id is not null))
);

create index notifications_by_user on public.notifications (user_id, created_at desc);
-- Les sujets partent en cascade : sans index, chaque suppression
-- d'annonce, de vente ou de demande parcourrait toutes les notifications.
create index notifications_by_listing on public.notifications (listing_id) where listing_id is not null;
create index notifications_by_deal on public.notifications (deal_id) where deal_id is not null;
create index notifications_by_wanted on public.notifications (wanted_id) where wanted_id is not null;

-- Le vendeur ne voit que le nombre d'inscrits, jamais leurs noms : il n'a
-- personne à relancer, et personne ne le relance.
create or replace function public.waitlist_count(listing uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.listing_waitlist w
    join public.listings l on l.id = w.listing_id
   where w.listing_id = listing and l.seller_id = auth.uid();
$$;

-- Tous les inscrits sont prévenus en même temps quand le lot redevient
-- disponible ; la liste se vide dès qu'il quitte « Réservé ».
create or replace function public.notify_waitlist() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'reserved' and new.status = 'available' then
    insert into public.notifications (user_id, kind, listing_id)
    select user_id, 'listing_available', new.id from public.listing_waitlist where listing_id = new.id;
  end if;
  if new.status <> 'reserved' then
    delete from public.listing_waitlist where listing_id = new.id;
  end if;
  return null;
end;
$$;

create trigger listings_notify_waitlist after update of status on public.listings
  for each row when (old.status is distinct from new.status) execute function public.notify_waitlist();

-- Un avis reçu se signale à la personne notée.
create or replace function public.notify_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, listing_id, deal_id)
  values (new.reviewed_id, 'review_received', new.listing_id, new.deal_id);
  return null;
end;
$$;

create trigger reviews_notify after insert on public.reviews
  for each row execute function public.notify_review();

-- wanted_match n'a pas de déclencheur : le croisement lot / recherche est
-- calculé en TypeScript (lib/matching.ts), le même qui s'affiche au vendeur
-- au moment du dépôt. L'action de dépôt pose ces notifications avec la clé
-- de service, qui seule écrit dans cette table.

-- ======================================================================================
-- 20260929120800_blocks_reports.sql
-- ======================================================================================

-- BulkTCG — migration 9 sur 10 : bloquer et signaler.

-- ---------------------------------------------------------------------
-- Blocages : bloquer empêche d'écrire dans les deux sens, dans le fil
-- existant comme dans un nouveau. On ne bloque que quelqu'un avec qui l'on
-- a parlé (src/lib/data/conversation-mutations.ts).
-- ---------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- L'autre sens du contrôle, et la suppression du compte bloqué.
create index blocks_by_blocked on public.blocks (blocked_id);

-- security definer : la RLS ne montre à chacun que ses propres blocages, or
-- les politiques d'écriture doivent aussi voir celui que l'autre a posé.
-- Seulement pour une paire dont l'appelant fait partie : sans cette garde,
-- la fonction, appelable par tous en RPC, dirait qui bloque qui entre deux
-- autres comptes — et « le bloqué n'apprend rien ». Les politiques et
-- close_deal() l'appellent toujours avec l'appelant parmi les deux.
create or replace function public.is_blocked_between(first_user uuid, second_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.uid() in (first_user, second_user), false)
     and exists (
       select 1 from public.blocks
        where (blocker_id = first_user and blocked_id = second_user)
           or (blocker_id = second_user and blocked_id = first_user)
     );
$$;

-- ---------------------------------------------------------------------
-- Signalements : un motif dans une liste fermée, un détail facultatif, lus
-- par la modération seule. La cible est désignée par son type et son
-- identifiant, sans clé étrangère : elle peut être une annonce, un compte,
-- une conversation ou une demande, et le signalement doit survivre à sa
-- disparition pour que la modération garde la trace.
-- ---------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- Signaler deux fois la même chose ne compte qu'une fois.
  unique (reporter_id, target_type, target_id)
);

-- On ne signale ni ce qu'on ne peut pas lire — une annonce réservée aux pros
-- pour un particulier, la conversation des autres —, ni soi-même
-- (src/lib/data/report-mutations.ts). La couche données résout la cible
-- côté serveur ; la base refuse en dernier recours. security invoker, le
-- défaut : ces lectures passent par la RLS de celui qui signale, et c'est
-- elle qui dit ce qu'il peut lire.
create or replace function public.check_report_target() returns trigger
language plpgsql set search_path = public as $$
declare
  owner_id uuid;
begin
  case new.target_type
    when 'listing' then
      select seller_id into owner_id from public.listings where id = new.target_id;
    when 'wanted' then
      select buyer_id into owner_id from public.wanted_listings where id = new.target_id;
    when 'profile' then
      select id into owner_id from public.profiles where id = new.target_id;
    when 'conversation' then
      select case when buyer_id = new.reporter_id then seller_id else buyer_id end into owner_id
        from public.conversations where id = new.target_id;
  end case;
  if owner_id is null then
    raise exception 'cible du signalement introuvable' using errcode = 'P0002';
  end if;
  if owner_id = new.reporter_id then
    raise exception 'on ne se signale pas soi-même' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reports_check_target before insert on public.reports
  for each row execute function public.check_report_target();

-- ======================================================================================
-- 20260929120900_security.sql
-- ======================================================================================

-- BulkTCG — migration 10 sur 10 : sécurité au niveau des lignes et droits.
--
-- Supabase accorde par défaut tous les droits sur le schéma public aux rôles
-- de l'API (anon, authenticated) : c'est la RLS qui fait le tri, ligne par
-- ligne. Là où une politique laisse quelqu'un modifier sa ligne, des droits
-- de colonnes disent lesquelles : sinon le vendeur se mettrait « À la une »
-- depuis la console du navigateur.

-- Un pro au forfait actif. security definer : la politique de lecture des
-- annonces l'appelle ligne à ligne ; elle ne révèle rien que le profil,
-- public, ne dise déjà.
create or replace function public.is_active_pro(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = uid and account_type = 'pro' and pro_until > now()
  );
$$;

alter table public.communes enable row level security;
alter table public.editions enable row level security;
alter table public.product_tag_games enable row level security;
alter table public.profiles enable row level security;
alter table public.account_settings enable row level security;
alter table public.listings enable row level security;
alter table public.photo_uploads enable row level security;
alter table public.photo_purge_lease enable row level security;
alter table public.listing_photos enable row level security;
alter table public.listing_editions enable row level security;
alter table public.listing_tags enable row level security;
alter table public.wanted_listings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.deals enable row level security;
alter table public.reviews enable row level security;
alter table public.listing_waitlist enable row level security;
alter table public.notifications enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- Référentiels : lisibles par tous, écrits par les seuls imports (clé de
-- service). Un appel direct à l'API n'invente ni une commune, ni une série.
create policy "communes lisibles par tous" on public.communes for select using (true);
create policy "séries lisibles par tous" on public.editions for select using (true);
create policy "produits par jeu lisibles par tous" on public.product_tag_games for select using (true);
revoke insert, update, delete on public.communes, public.editions, public.product_tag_games from anon, authenticated;

-- Profils : publics en lecture ; chacun ne modifie que le sien.
create policy "profils lisibles par tous" on public.profiles for select using (true);
create policy "profil modifiable par son titulaire" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profil créé par son titulaire" on public.profiles
  for insert with check (id = auth.uid());

-- La politique ci-dessus laisse chacun modifier sa ligne : sans restriction
-- de colonnes, n'importe qui se passerait pro et prolongerait son forfait
-- depuis la console du navigateur. Le type de compte, la fin du forfait et
-- les compteurs ne s'écrivent qu'avec la clé service_role — le service de
-- paiement et les déclencheurs.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, username, city, postal_code, avatar_initials, bio) on public.profiles to authenticated;
grant update (username, city, postal_code, avatar_initials, bio, company_name, shop_address, shop_hours, shop_website) on public.profiles to authenticated;

-- Réglages : lus et modifiés par leur titulaire seul. Ils naissent avec le
-- profil (create_account_settings) et partent avec lui.
create policy "réglages lus par leur titulaire" on public.account_settings for select using (user_id = auth.uid());
create policy "réglages modifiés par leur titulaire" on public.account_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.account_settings from anon, authenticated;
grant update (alert_matches, alert_messages) on public.account_settings to authenticated;

-- Annonces : lisibles selon leur audience — une annonce vendue reste servie,
-- son lien a été partagé ; une annonce réservée ne l'est qu'à son vendeur et
-- aux pros au forfait actif. Qui en a déjà parlé la garde aussi : passée
-- « pros » après coup, elle reste lisible depuis sa conversation, qui sinon
-- renverrait vers une annonce disparue (getListingForViewer en est le
-- miroir). Photos, séries et produits suivent, leurs politiques lisant
-- l'annonce sous cette même règle. Écriture réservée au vendeur.
create policy "annonces lisibles selon leur audience" on public.listings for select using (
  audience = 'everyone' or seller_id = auth.uid() or public.is_active_pro(auth.uid())
  or exists (select 1 from public.conversations c
             where c.listing_id = listings.id and auth.uid() in (c.buyer_id, c.seller_id))
);
create policy "annonce déposée par son vendeur" on public.listings
  for insert with check (seller_id = auth.uid());
create policy "annonce modifiée par son vendeur" on public.listings
  for update using (seller_id = auth.uid()) with check (seller_id = auth.uid());

-- Comme pour les profils : la politique ci-dessus laisse le vendeur modifier
-- sa ligne, et sans restriction de colonnes il se mettrait « À la une » ou
-- « Urgent » sans payer, ou gonflerait son compteur de vues, depuis la console
-- du navigateur. Les options payantes et les compteurs ne s'écrivent qu'avec
-- la clé service_role. Ces deux listes sont celles de ListingInsert et de
-- ListingUpdate (src/lib/data/rows.ts) : tests/schema-security.test.mjs les compare.
revoke insert, update on public.listings from anon, authenticated;
grant insert (slug, seller_id, game_id, title, description, lot_type, card_count, weight_kg, condition, language, price_cents, city, postal_code, department_code, latitude, longitude, status, audience, open_to_trade, trade_note) on public.listings to authenticated;
grant update (game_id, title, description, lot_type, card_count, weight_kg, condition, language, price_cents, previous_price_cents, city, postal_code, department_code, latitude, longitude, status, audience, open_to_trade, trade_note, sold_at) on public.listings to authenticated;
create policy "annonce supprimée par son vendeur" on public.listings
  for delete using (seller_id = auth.uid());

-- Les compteurs et les décomptes publics passent par des fonctions : le
-- compteur de vues n'est incrémenté que par le serveur, avec la clé de
-- service ; le décompte des lots réservés est ouvert à tous, il ne rend
-- qu'un nombre par jeu.
revoke execute on function public.record_listing_view(uuid) from public, anon, authenticated;
grant execute on function public.record_listing_view(uuid) to service_role;

-- Tables de liaison : suivent l'annonce. La sous-requête sur listings est
-- elle-même soumise à la politique ci-dessus : ce qu'on ne voit pas de
-- l'annonce, on ne le voit pas non plus de ses photos, séries et produits.
create policy "photos lisibles avec leur annonce" on public.listing_photos for select using (
  exists (select 1 from public.listings l where l.id = listing_id)
);
-- Une photo vient des téléversements de son vendeur, jamais de ceux d'un
-- autre : une photo reprise porterait le pseudo d'un autre dans son
-- filigrane, et c'est précisément ce que le filigrane promet de rendre
-- visible. Le registre en tranche — un préfixe de chemin ne le pourrait
-- pas, voir photo_uploads (migration 4).
create policy "photos écrites par le vendeur" on public.listing_photos for all
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
    and exists (select 1 from public.photo_uploads u where u.key = storage_path and u.owner_id = auth.uid())
  );

-- Le registre des téléversements : écrit par le serveur seul, avec la clé
-- de service, au moment où il délivre l'adresse de dépôt — un compte qui
-- s'y inscrirait lui-même pourrait y déclarer l'image d'un autre. Chacun y
-- lit ses propres fichiers : c'est ce que consulte la politique ci-dessus.
create policy "téléversements lus par leur propriétaire" on public.photo_uploads
  for select using (owner_id = auth.uid());
revoke all on public.photo_uploads from anon;
revoke insert, update, delete on public.photo_uploads from authenticated;
-- Le ménage rend les fichiers de tous les comptes, les promet au retrait,
-- puis efface leur registre : il ne se lance qu'avec la clé de service,
-- depuis la tâche planifiée, et son bail n'est à personne d'autre.
revoke execute on function public.claim_photo_purge(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_photo_purge(uuid, integer) to service_role;
revoke execute on function public.release_photo_purge(uuid) from public, anon, authenticated;
grant execute on function public.release_photo_purge(uuid) to service_role;
revoke execute on function public.forget_purged_photos(text[]) from public, anon, authenticated;
grant execute on function public.forget_purged_photos(text[]) to service_role;
revoke all on public.photo_purge_lease from anon, authenticated;
create policy "séries lisibles avec leur annonce" on public.listing_editions for select using (
  exists (select 1 from public.listings l where l.id = listing_id)
);
create policy "séries écrites par le vendeur" on public.listing_editions for all
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "produits lisibles avec leur annonce" on public.listing_tags for select using (
  exists (select 1 from public.listings l where l.id = listing_id)
);
create policy "produits écrits par le vendeur" on public.listing_tags for all
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- Demandes : publiques en lecture, écriture réservée à l'acheteur.
create policy "demandes lisibles par tous" on public.wanted_listings for select using (true);
create policy "demande déposée par son acheteur" on public.wanted_listings
  for insert with check (buyer_id = auth.uid());
create policy "demande modifiée par son acheteur" on public.wanted_listings
  for update using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
create policy "demande supprimée par son acheteur" on public.wanted_listings
  for delete using (buyer_id = auth.uid());

-- Les écritures directes n'ont que les colonnes que l'application envoie :
-- celles de WantedInsert, WantedUpdate, ConversationInsert, MessageInsert,
-- BlockInsert et ReportInsert (src/lib/data/rows.ts), que
-- tests/schema-security.test.mjs compare à ces droits. Sans elles, un acheteur
-- rajeunirait sa demande (created_at) pour repasser en tête des « Plus
-- récentes », changerait son lien permanent (slug), et un signalement se
-- déposerait déjà « traité » (resolved_at, qui est à la modération).
revoke insert, update on public.wanted_listings from anon, authenticated;
grant insert (slug, buyer_id, game_id, title, description, lot_type, max_price_cents, min_card_count, city, postal_code, department_code, latitude, longitude, max_distance_km, status) on public.wanted_listings to authenticated;
grant update (game_id, title, description, lot_type, max_price_cents, min_card_count, city, postal_code, department_code, latitude, longitude, max_distance_km, status, fulfilled_at) on public.wanted_listings to authenticated;

-- Conversations : visibles de leurs deux participants, et d'eux seuls.
create policy "conversation lue par ses participants" on public.conversations
  for select using (auth.uid() in (buyer_id, seller_id));
-- Une conversation ne s'ouvre que sur un lot disponible : réservé, il ne
-- reçoit plus de nouvelle demande — on s'inscrit sur sa liste d'attente.
-- Le vendeur désigné est celui de l'annonce : sans ce contrôle, n'importe
-- qui ouvrirait un fil au nom d'un tiers. Et le vendeur n'écrit le premier
-- qu'à quelqu'un qui cherche ce jeu (proposeListing,
-- src/lib/data/message-mutations.ts) : proposer du Magic à qui cherche du
-- Pokémon serait du démarchage. Un lot réservé aux pros ne se discute
-- qu'avec un pro au forfait actif : un particulier ne le lit pas, et son
-- vendeur ne le lui propose pas non plus.
create policy "conversation ouverte par un participant" on public.conversations
  for insert with check (
    auth.uid() in (buyer_id, seller_id)
    and not public.is_blocked_between(buyer_id, seller_id)
    and exists (select 1 from public.listings l
                where l.id = listing_id and l.status = 'available' and l.seller_id = conversations.seller_id
                  and (l.audience = 'everyone' or public.is_active_pro(conversations.buyer_id)))
    and (auth.uid() = buyer_id
         or exists (select 1 from public.wanted_listings w
                    join public.listings l on l.id = conversations.listing_id
                    where w.buyer_id = conversations.buyer_id and w.status = 'open' and w.game_id = l.game_id))
  );
-- Aucune mise à jour directe : se retirer d'une conversation passe par
-- hide_conversation(), qui ne touche que sa propre colonne. Et une
-- conversation ne naît pas déjà « supprimée » d'un côté, ni antidatée.
revoke insert, update on public.conversations from anon, authenticated;
grant insert (listing_id, buyer_id, seller_id) on public.conversations to authenticated;

create policy "messages lus par les participants" on public.messages for select using (
  exists (select 1 from public.conversations c
          where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
);
-- Un compte bloqué n'écrit plus : ni dans le fil existant, ni dans un
-- nouveau (voir la politique d'ouverture ci-dessus).
-- Sur un lot réservé, seuls le vendeur et la personne pour qui il l'est
-- continuent d'écrire : les autres lisent leur fil, mais ne relancent plus.
create policy "message écrit par un participant, en son nom" on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c
              where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
                and not public.is_blocked_between(c.buyer_id, c.seller_id))
  and not exists (select 1 from public.conversations c
                  join public.listings l on l.id = c.listing_id
                  where c.id = conversation_id and l.status = 'reserved'
                    and auth.uid() <> c.seller_id and auth.uid() is distinct from l.reserved_for)
  -- Passée « pros » après coup : un particulier relit son fil, il n'y écrit
  -- plus ; le vendeur, lui, peut encore expliquer (getReplyBlock).
  and not exists (select 1 from public.conversations c
                  join public.listings l on l.id = c.listing_id
                  where c.id = conversation_id and l.audience = 'pros'
                    and auth.uid() <> c.seller_id and not public.is_active_pro(auth.uid()))
);
-- Seul le destinataire marque un message comme lu, et c'est tout ce qu'il
-- touche : sans droits de colonnes, la politique le laisserait réécrire le
-- texte qu'on lui a envoyé.
create policy "message marqué lu par son destinataire" on public.messages for update
  using (
    sender_id <> auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
  )
  with check (sender_id <> auth.uid());
-- Un message ne naît ni lu, ni antidaté.
revoke insert, update on public.messages from anon, authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- Avis : publics ; écrits par une partie d'une vente clôturée, sur l'autre.
-- Une conversation seule ne suffisait pas : n'importe qui ayant écrit un
-- message pouvait noter un vendeur. La personne notée, son rôle et l'annonce
-- sont posés par stamp_review ; le navigateur ne fournit que la vente et les
-- notes, et un avis ne se modifie pas.
create policy "avis lisibles par tous" on public.reviews for select using (true);
create policy "avis laissé par une partie de la vente" on public.reviews for insert with check (
  reviewer_id = auth.uid()
  and exists (select 1 from public.deals d
              where d.id = reviews.deal_id
                and auth.uid() in (d.buyer_id, d.seller_id)
                and reviews.reviewed_id in (d.buyer_id, d.seller_id))
);
revoke insert, update on public.reviews from anon, authenticated;
grant insert (deal_id, reviewer_id, punctuality, responsiveness, reliability, comment) on public.reviews to authenticated;

-- Ventes : lues par leurs deux parties. Aucune écriture directe : la
-- clôture passe par close_deal(), qui déduit tout de la conversation et
-- n'admet que son vendeur.
create policy "vente lue par ses parties" on public.deals for select using (auth.uid() in (seller_id, buyer_id));
revoke insert, update, delete on public.deals from anon, authenticated;

-- Liste d'attente : chacun ne voit, ne pose et ne retire que son
-- inscription, sur le lot réservé d'un autre. Le vendeur n'en lit que le
-- nombre, par waitlist_count().
create policy "inscription lue par son auteur" on public.listing_waitlist for select using (user_id = auth.uid());
create policy "inscription sur le lot réservé d'un autre" on public.listing_waitlist for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.listings l
              where l.id = listing_id and l.status = 'reserved' and l.seller_id <> auth.uid())
);
create policy "inscription retirée par son auteur" on public.listing_waitlist for delete using (user_id = auth.uid());

-- Notifications : lues et marquées lues par leur destinataire seul. Elles
-- s'écrivent par déclencheur ou avec la clé de service, jamais depuis le
-- navigateur ; la seule colonne modifiable est read_at.
create policy "notifications lues par leur destinataire" on public.notifications for select using (user_id = auth.uid());
create policy "notifications marquées lues par leur destinataire" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Blocages : chacun ne voit, ne pose et ne lève que les siens. Le bloqué
-- n'apprend rien : aucune ligne ne lui est lisible.
create policy "blocages lus par leur auteur" on public.blocks for select using (blocker_id = auth.uid());
create policy "blocage posé par son auteur" on public.blocks for insert with check (blocker_id = auth.uid());
create policy "blocage levé par son auteur" on public.blocks for delete using (blocker_id = auth.uid());
revoke insert, update on public.blocks from anon, authenticated;
grant insert (blocker_id, blocked_id) on public.blocks to authenticated;

-- Signalements : déposés en son nom, lus par la modération seule (clé
-- service_role) — aucune politique de lecture pour le rôle connecté.
create policy "signalement déposé en son nom" on public.reports for insert with check (reporter_id = auth.uid());
revoke insert, update, delete on public.reports from anon, authenticated;
grant insert (reporter_id, target_type, target_id, reason, details) on public.reports to authenticated;

-- ======================================================================================
-- 20261001120000_writes.sql
-- ======================================================================================

-- BulkTCG — migration 11 : les écritures de la phase 2 qui demandent plus
-- qu'un insert. Une annonce se dépose et se modifie avec ses séries et ses
-- produits d'un seul bloc ; une conversation s'ouvre avec son premier
-- message ; l'identifiant tiré à l'affichage du formulaire rend un double
-- envoi inoffensif. Et ce que le navigateur peut maintenant écrire de plus —
-- l'identifiant, donc le lien — la base le tient : un lien permanent ne
-- désigne jamais une autre annonce, une annonce naît disponible, sa baisse de
-- prix est la vraie, et un croisement ne se notifie qu'une fois.
--
-- Les dix premières migrations sont appliquées au projet : celle-ci s'y
-- ajoute seule, collée telle quelle dans l'éditeur SQL.

-- ---------------------------------------------------------------------
-- Un double envoi ne crée pas deux annonces.
-- ---------------------------------------------------------------------

-- L'identifiant d'une annonce ou d'une demande est tiré quand la page du
-- formulaire s'affiche, et part dans un champ caché : un envoi répété —
-- réseau lent, nouvel essai après un délai — retombe sur la même ligne
-- (on conflict (id) do nothing) au lieu d'en créer une seconde. La clé
-- primaire et la RLS font le reste : un identifiant déjà pris par un autre
-- compte ne lui prend rien.
grant insert (id) on public.listings to authenticated;
grant insert (id) on public.wanted_listings to authenticated;

-- ---------------------------------------------------------------------
-- Un lien permanent ne désigne jamais une autre annonce.
-- ---------------------------------------------------------------------

-- Le lien finit par les huit premiers caractères de l'identifiant
-- (idSlugSuffix, src/lib/slug.ts), et un lien qui a servi ne ressert plus :
-- sans cela, l'annonce supprimée, un autre vendeur reprenait son lien exact —
-- et son identifiant, qu'il peut maintenant choisir —, et le lien partagé
-- dans un groupe montrait son annonce à lui. Les liens retirés sont gardés
-- ici, par sorte : une annonce et une demande peuvent porter le même.
create table public.retired_slugs (
  kind text not null check (kind in ('listing', 'wanted')),
  slug text not null,
  retired_at timestamptz not null default now(),
  primary key (kind, slug)
);

-- La table ne se lit que par cette question : un lien a-t-il déjà servi ?
create or replace function public.is_retired_slug(slug_kind text, candidate text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.retired_slugs r where r.kind = slug_kind and r.slug = candidate);
$$;

-- La règle tient le navigateur, qui choisit l'identifiant comme le lien —
-- directement, ou par create_listing, qui s'exécute sous ses droits. Le
-- serveur (clé de service, données de démonstration) choisit les siens. Un
-- lien mal formé est laissé à la contrainte de la colonne, qui le refuse
-- sous son nom.
create or replace function public.check_permalink() returns trigger
language plpgsql set search_path = public as $$
declare
  slug_kind text := case tg_table_name when 'listings' then 'listing' else 'wanted' end;
begin
  if current_user <> 'authenticated' or new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return new;
  end if;
  if new.slug !~ ('(^|-)' || left(replace(new.id::text, '-', ''), 8) || '$') then
    raise exception 'le lien % ne finit pas par l''identifiant de la ligne', new.slug using errcode = '23514';
  end if;
  if public.is_retired_slug(slug_kind, new.slug) then
    raise exception 'le lien % a déjà servi : il ne désignera pas une autre annonce', new.slug using errcode = '23505';
  end if;
  return new;
end;
$$;

-- Une annonce ou une demande qui part — supprimée, ou avec son compte —
-- laisse son lien ici. security definer : le vendeur qui supprime n'écrit
-- pas dans cette table.
create or replace function public.retire_slug() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.retired_slugs (kind, slug)
  values (case tg_table_name when 'listings' then 'listing' else 'wanted' end, old.slug)
  on conflict do nothing;
  return old;
end;
$$;

create trigger listings_check_permalink before insert on public.listings
  for each row execute function public.check_permalink();
create trigger wanted_listings_check_permalink before insert on public.wanted_listings
  for each row execute function public.check_permalink();
create trigger listings_retire_slug after delete on public.listings
  for each row execute function public.retire_slug();
create trigger wanted_listings_retire_slug after delete on public.wanted_listings
  for each row execute function public.retire_slug();

-- ---------------------------------------------------------------------
-- Ce qu'une annonce affiche, tenu par la base.
-- ---------------------------------------------------------------------

-- Une annonce naît « Disponible » et sans prix d'avant, quel que soit
-- l'envoi : déposée « Réservé », elle portait un tampon qu'aucune
-- réservation n'avait posé, et née « Vendu », elle échappait au compte des
-- ventes (count_sale ne voit qu'un changement de statut). Ensuite, le prix
-- d'avant — « Baisse 20 % » sur la vignette — suit le prix seul : l'ancien
-- quand il baisse, plus rien quand il remonte, inchangé sinon
-- (nextPreviousPriceCents, src/lib/data/mappers/listing-writes.ts). La
-- valeur envoyée est ignorée : un vendeur s'inventait une baisse depuis
-- 4 999,99 € sur un lot à 25 €. Nommé pour passer avant le gel d'une
-- annonce vendue, qui compare donc le prix d'avant que la base a gardé.
create or replace function public.derive_listing_display() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'available';
    new.sold_at := null;
    new.reserved_for := null;
    new.previous_price_cents := null;
  elsif new.price_cents < old.price_cents then
    new.previous_price_cents := old.price_cents;
  elsif new.price_cents > old.price_cents then
    new.previous_price_cents := null;
  else
    new.previous_price_cents := old.previous_price_cents;
  end if;
  return new;
end;
$$;

create trigger listings_derive_display before insert or update of price_cents, previous_price_cents on public.listings
  for each row execute function public.derive_listing_display();

-- ---------------------------------------------------------------------
-- Le dépôt et la modification d'une annonce, d'un seul bloc.
-- ---------------------------------------------------------------------

-- L'annonce, ses séries et ses produits dans une seule transaction : une
-- série refusée ne laisse pas une annonce à moitié écrite. security invoker
-- — la RLS et les droits de colonnes du vendeur connecté s'appliquent comme
-- à trois inserts directs. Les photos arrivent avec Cloudflare Images (phase
-- 3) : un dépôt qui en porte est refusé plutôt que publié sans elles. Rend
-- le lien permanent, et si l'annonce vient d'être créée : un double envoi
-- retombe sur celle du vendeur connecté, sans rien créer — et le serveur ne
-- prévient alors personne une seconde fois.
drop function if exists public.create_listing(jsonb);
create or replace function public.create_listing(payload jsonb) returns table (permalink text, created boolean)
language plpgsql security invoker set search_path = public as $$
declare
  draft public.listings%rowtype := jsonb_populate_record(null::public.listings, payload -> 'listing');
begin
  if jsonb_array_length(coalesce(payload -> 'photos', '[]'::jsonb)) > 0 then
    raise exception 'les photos arrivent avec la phase 3 : déposez l''annonce sans photo' using errcode = '0A000';
  end if;
  insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, card_count, weight_kg,
                               condition, language, price_cents, city, postal_code, department_code, latitude,
                               longitude, status, audience, open_to_trade, trade_note)
  values (draft.id, draft.slug, draft.seller_id, draft.game_id, draft.title, draft.description, draft.lot_type,
          draft.card_count, draft.weight_kg, draft.condition, draft.language, draft.price_cents, draft.city,
          draft.postal_code, draft.department_code, draft.latitude, draft.longitude, draft.status, draft.audience,
          draft.open_to_trade, draft.trade_note)
  on conflict (id) do nothing;
  if not found then
    return query select l.slug, false from public.listings l where l.id = draft.id and l.seller_id = auth.uid();
    if not found then
      raise exception 'annonce introuvable' using errcode = 'P0002';
    end if;
    return;
  end if;
  insert into public.listing_editions (listing_id, edition_id, position)
    select draft.id, picked.edition_id, picked.position
      from jsonb_to_recordset(coalesce(payload -> 'editions', '[]'::jsonb)) as picked (edition_id text, position smallint);
  insert into public.listing_tags (listing_id, tag)
    select draft.id, picked.tag
      from jsonb_to_recordset(coalesce(payload -> 'tags', '[]'::jsonb)) as picked (tag public.product_tag);
  return query select draft.slug, true;
end;
$$;

-- La modification : retirer les séries et les produits, mettre l'annonce à
-- jour, réinsérer — dans cet ordre, sans quoi un changement de jeu bute sur
-- check_listing_game_change. Le lien permanent ne change pas : le slug n'est
-- pas dans les droits de mise à jour, ni le statut, qui a sa propre écriture ;
-- le prix d'avant, la base le déduit du prix (derive_listing_display). Une
-- annonce qui n'est pas au vendeur connecté répond « introuvable », et rien
-- n'a bougé : la RLS a écarté chaque ligne. Les photos restent telles
-- qu'elles sont jusqu'à la phase 3.
create or replace function public.update_listing(listing uuid, payload jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  draft public.listings%rowtype := jsonb_populate_record(null::public.listings, payload -> 'listing');
begin
  if jsonb_array_length(coalesce(payload -> 'photos', '[]'::jsonb)) > 0 then
    raise exception 'les photos arrivent avec la phase 3 : enregistrez l''annonce sans photo' using errcode = '0A000';
  end if;
  delete from public.listing_editions where listing_id = listing;
  delete from public.listing_tags where listing_id = listing;
  update public.listings
     set game_id = draft.game_id, title = draft.title, description = draft.description, lot_type = draft.lot_type,
         card_count = draft.card_count, weight_kg = draft.weight_kg, condition = draft.condition,
         language = draft.language, price_cents = draft.price_cents, city = draft.city,
         postal_code = draft.postal_code, department_code = draft.department_code, latitude = draft.latitude,
         longitude = draft.longitude, audience = draft.audience, open_to_trade = draft.open_to_trade,
         trade_note = draft.trade_note
   where id = listing;
  if not found then
    raise exception 'annonce introuvable' using errcode = 'P0002';
  end if;
  insert into public.listing_editions (listing_id, edition_id, position)
    select listing, picked.edition_id, picked.position
      from jsonb_to_recordset(coalesce(payload -> 'editions', '[]'::jsonb)) as picked (edition_id text, position smallint);
  insert into public.listing_tags (listing_id, tag)
    select listing, picked.tag
      from jsonb_to_recordset(coalesce(payload -> 'tags', '[]'::jsonb)) as picked (tag public.product_tag);
end;
$$;

-- ---------------------------------------------------------------------
-- Une conversation s'ouvre avec son premier message.
-- ---------------------------------------------------------------------

-- Sans lui, un message refusé après l'ouverture laisserait une conversation
-- vide dans les deux boîtes. security invoker : la politique d'ouverture des
-- conversations et celle des messages s'appliquent comme à deux inserts —
-- lot disponible, aucun blocage, démarchage refusé, message signé par son
-- auteur. Rend l'identifiant de la conversation, vers laquelle l'écran
-- emmène.
create or replace function public.open_conversation(listing uuid, buyer uuid, seller uuid, first_message text)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  opened uuid;
begin
  insert into public.conversations (listing_id, buyer_id, seller_id) values (listing, buyer, seller)
    returning id into opened;
  insert into public.messages (conversation_id, sender_id, body) values (opened, auth.uid(), first_message);
  return opened;
end;
$$;

-- ---------------------------------------------------------------------
-- Un croisement ne se notifie qu'une fois.
-- ---------------------------------------------------------------------

-- Un acheteur apprend une fois qu'un lot répond à sa demande, quoi que fasse
-- le serveur — un envoi rejoué, deux passages concurrents : il écrit avec
-- on conflict do nothing. Seules les notifications de croisement portent
-- une demande ; les autres, sans elle, ne se heurtent jamais (null ne vaut
-- pas null).
create unique index notifications_one_per_match on public.notifications (kind, user_id, listing_id, wanted_id);

-- ---------------------------------------------------------------------
-- Droits.
-- ---------------------------------------------------------------------

alter table public.retired_slugs enable row level security;
revoke all on public.retired_slugs from anon, authenticated;
revoke execute on function public.is_retired_slug(text, text) from public, anon;
grant execute on function public.is_retired_slug(text, text) to authenticated;

-- Le rôle connecté seul : un visiteur anonyme ne dépose ni n'écrit rien.
revoke execute on function public.create_listing(jsonb) from public, anon;
grant execute on function public.create_listing(jsonb) to authenticated;
revoke execute on function public.update_listing(uuid, jsonb) from public, anon;
grant execute on function public.update_listing(uuid, jsonb) to authenticated;
revoke execute on function public.open_conversation(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.open_conversation(uuid, uuid, uuid, text) to authenticated;

-- ======================================================================================
-- 20261001120100_product_tag_singles.sql
-- ======================================================================================

-- Migration 12 : un produit de plus, « Cartes à l'unité » (singles) — des
-- cartes choisies qui partent avec le lot, jamais une annonce pour une seule
-- carte. La valeur prend sa place après « graded », dans l'ordre du code
-- (src/lib/product-tags.ts).
--
-- Seule dans son fichier : PostgreSQL refuse d'utiliser une valeur ajoutée à
-- une énumération dans la transaction qui l'ajoute, et l'éditeur SQL de
-- Supabase joue un fichier collé en une seule transaction. Les jeux qui la
-- proposent arrivent donc par la migration suivante, collée après celle-ci.

alter type public.product_tag add value if not exists 'singles' after 'graded';

-- ======================================================================================
-- 20261001120200_product_tag_singles_games.sql
-- ======================================================================================

-- Migration 13 : « Cartes à l'unité » existe pour tous les jeux, « Autre »
-- compris. À coller après la migration 12, dans une exécution à part : la
-- valeur 'singles' doit être validée avant d'être employée ici.

insert into public.product_tag_games (tag, game_id) values
  ('singles', 'pokemon'), ('singles', 'magic'), ('singles', 'onepiece'), ('singles', 'lorcana'), ('singles', 'riftbound'), ('singles', 'yugioh'), ('singles', 'naruto'), ('singles', 'other')
on conflict do nothing;

-- ======================================================================================
-- 20261002120000_listing_expiring_kind.sql
-- ======================================================================================

-- Migration 14 : une sorte de notification de plus, « listing_expiring » —
-- une annonce arrive à expiration, et son vendeur la prolonge en un clic
-- (migration 15).
--
-- Seule dans son fichier, comme la migration 12 : PostgreSQL refuse
-- d'utiliser une valeur ajoutée à une énumération dans la transaction qui
-- l'ajoute, et l'éditeur SQL de Supabase joue un fichier collé en une seule
-- transaction. La migration 15, qui l'emploie, se colle ensuite, à part.

alter type public.notification_kind add value if not exists 'listing_expiring';

-- ======================================================================================
-- 20261002120100_listing_lifecycle.sql
-- ======================================================================================

-- Migration 15 : le cycle de vie d'une annonce. Elle quitte les listes
-- quatre-vingt-dix jours après le dernier geste de son vendeur, à moins
-- qu'il ne la prolonge — gratuitement, en un clic ; trente jours après sa
-- sortie du marché, vente ou expiration, elle est archivée : ses photos sont
-- supprimées, le texte, le prix et les avis restent, et son lien répond
-- toujours. La remontée payante la replace en tête du tri par défaut une
-- fois par jour.
--
-- À coller après la migration 14, dans une exécution à part : la sorte de
-- notification « listing_expiring » doit être validée avant d'être employée
-- ici.
--
-- Rien n'expire par une tâche : une annonce est expirée dès que sa date est
-- passée, et chaque lecture le voit — src/lib/listing-lifecycle.ts pour le
-- site, les fonctions ci-dessous pour la base ; tests/schema-sync.test.mjs
-- compare leurs durées. La tâche quotidienne ne fait que ce qui demande une
-- écriture : prévenir le vendeur, retirer les photos d'une annonce archivée.

-- ---------------------------------------------------------------------
-- Les colonnes.
-- ---------------------------------------------------------------------

-- Le dernier geste du vendeur : le dépôt, puis chaque modification,
-- changement de statut ou prolongation. Ni inséré ni modifié directement —
-- aucun droit de colonne ne le rend au rôle connecté : un vendeur
-- repousserait son échéance à 2099 depuis la console. Les annonces déjà en
-- ligne partent pour quatre-vingt-dix jours à compter de cette migration :
-- aucune n'expire le jour où la règle arrive.
alter table public.listings
  add column renewed_at timestamptz not null default now(),
  -- L'option « Remonter » : son début et sa fin, écrits par le service de
  -- paiement seul, comme les autres options. Le rang se déduit des deux
  -- (getRankedAt) : une remontée par jour, du début à la fin.
  add column bump_started_at timestamptz,
  add column bump_until timestamptz,
  add constraint listings_bump_window check (
    (bump_started_at is null) = (bump_until is null) and (bump_until is null or bump_until > bump_started_at)
  );

-- Ce que parcourt la tâche quotidienne : les annonces en ligne par
-- échéance, les ventes par date, les signalements encore ouverts par cible.
create index listings_by_renewal on public.listings (renewed_at) where status <> 'sold';
create index listings_by_sale on public.listings (sold_at) where status = 'sold';
create index reports_open_by_target on public.reports (target_type, target_id) where resolved_at is null;

-- ---------------------------------------------------------------------
-- Les échéances, écrites une fois.
-- ---------------------------------------------------------------------

-- La fin de la mise en ligne : quatre-vingt-dix jours après le dernier geste
-- du vendeur.
create or replace function public.listing_expires_at(listing public.listings) returns timestamptz
language sql stable as $$
  select listing.renewed_at + interval '90 days';
$$;

-- En ligne : ni vendue, ni passée sa date. Seule une annonce en ligne
-- s'ouvre à une conversation ou à la liste d'attente, et se compte dans
-- l'espace pro.
create or replace function public.listing_on_market(listing public.listings) returns boolean
language sql stable as $$
  select listing.status <> 'sold' and public.listing_expires_at(listing) > now();
$$;

-- Archivée : trente jours après sa vente ou son expiration — le jour où une
-- annonce vendue sort aussi de l'index. Ses photos partent au passage
-- suivant de la tâche quotidienne.
create or replace function public.listing_archived(listing public.listings) returns boolean
language sql stable as $$
  select coalesce(
    case when listing.status = 'sold' then listing.sold_at else public.listing_expires_at(listing) end
      <= now() - interval '30 days',
    false
  );
$$;

-- ---------------------------------------------------------------------
-- Prolonger.
-- ---------------------------------------------------------------------

-- Tout geste du vendeur sur son annonce la relance pour quatre-vingt-dix
-- jours : la modifier, en changer le statut, la réserver. Seul compte le
-- vendeur connecté — auth.uid(), que voient aussi les fonctions security
-- definer qu'il appelle, comme reserve_listing() : une vue comptée, ce
-- qu'écrivent le service de paiement ou la tâche quotidienne ne la relancent
-- pas. Le paiement d'une remontée la relance lui-même, en posant renewed_at.
create or replace function public.renew_on_seller_activity() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() = new.seller_id then
    new.renewed_at := now();
  end if;
  return new;
end;
$$;

create trigger listings_renew_on_activity before update on public.listings
  for each row execute function public.renew_on_seller_activity();

-- « Prolonger » et « Remettre en ligne » : gratuits, en un clic, pour le
-- vendeur seul — pas pour une annonce vendue, qui n'expire pas. Une annonce
-- archivée repart sans ses photos, que la tâche quotidienne a retirées.
-- security definer : renewed_at n'est dans les droits de personne. Rend la
-- nouvelle échéance.
create or replace function public.renew_listing(listing uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  renewed public.listings%rowtype;
begin
  update public.listings set renewed_at = now()
   where id = listing and seller_id = auth.uid() and status <> 'sold'
  returning * into renewed;
  if not found then
    raise exception 'annonce introuvable' using errcode = 'P0002';
  end if;
  return public.listing_expires_at(renewed);
end;
$$;

-- ---------------------------------------------------------------------
-- Ce qui n'est plus en ligne ne reçoit plus rien.
-- ---------------------------------------------------------------------

-- Une conversation ne s'ouvre que sur un lot en ligne : expiré, son vendeur
-- ne le vend peut-être plus. La politique de la migration 10, plus cette
-- condition.
drop policy "conversation ouverte par un participant" on public.conversations;
create policy "conversation ouverte par un participant" on public.conversations
  for insert with check (
    auth.uid() in (buyer_id, seller_id)
    and not public.is_blocked_between(buyer_id, seller_id)
    and exists (select 1 from public.listings l
                where l.id = listing_id and l.status = 'available' and l.seller_id = conversations.seller_id
                  and public.listing_on_market(l)
                  and (l.audience = 'everyone' or public.is_active_pro(conversations.buyer_id)))
    and (auth.uid() = buyer_id
         or exists (select 1 from public.wanted_listings w
                    join public.listings l on l.id = conversations.listing_id
                    where w.buyer_id = conversations.buyer_id and w.status = 'open' and w.game_id = l.game_id))
  );

-- Ni d'inscription en liste d'attente : la réservation d'un lot expiré ne
-- tombera pas.
drop policy "inscription sur le lot réservé d'un autre" on public.listing_waitlist;
create policy "inscription sur le lot réservé d'un autre" on public.listing_waitlist for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.listings l
              where l.id = listing_id and l.status = 'reserved' and l.seller_id <> auth.uid()
                and public.listing_on_market(l))
);

-- L'espace pro ne compte que les lots en ligne.
create or replace function public.pro_only_count_by_game()
returns table (game_id public.game_id, listing_count integer)
language sql stable security definer set search_path = public as $$
  select l.game_id, count(*)::integer
    from public.listings l
   where l.audience = 'pros' and public.listing_on_market(l)
   group by l.game_id
   order by l.game_id;
$$;

-- La lecture par rayon non plus (getListings avec une origine).
create or replace function public.listings_within(
  origin_lat double precision, origin_lon double precision, radius_km integer
) returns setof public.listings
language sql stable as $$
  select l.* from public.listings l
  where public.listing_on_market(l)
    and l.latitude between origin_lat - radius_km / 111.0 and origin_lat + radius_km / 111.0
    and public.distance_km(origin_lat, origin_lon, l.latitude, l.longitude) <= radius_km
  order by public.distance_km(origin_lat, origin_lon, l.latitude, l.longitude);
$$;

-- ---------------------------------------------------------------------
-- Archiver.
-- ---------------------------------------------------------------------

-- Une vente clôturée fige l'annonce, photos comprises (migration 7). Un
-- seul geste y est permis : l'archivage retire ses photos trente jours après
-- la vente. Il ne réécrit rien de ce que les avis citent — le texte, le prix
-- et la description restent.
create or replace function public.freeze_listing_parts_after_deal() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  touched uuid[];
begin
  if tg_op = 'DELETE' and tg_table_name = 'listing_photos'
     and exists (select 1 from public.listings l where l.id = old.listing_id and public.listing_archived(l)) then
    return old;
  end if;
  if tg_op = 'INSERT' then
    touched := array[new.listing_id];
  elsif tg_op = 'DELETE' then
    touched := array[old.listing_id];
  else
    touched := array[old.listing_id, new.listing_id];
  end if;
  if exists (
    select 1 from public.deals d join public.listings l on l.id = d.listing_id
     where d.listing_id = any (touched)
  ) then
    raise exception 'vente clôturée : l''annonce reste telle qu''elle a été vendue' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Une notification « listing_expiring » mène à son annonce, comme les autres.
alter table public.notifications
  add constraint notifications_listing_expiring_subject check (kind <> 'listing_expiring' or listing_id is not null);

-- La tâche quotidienne, appelée par Vercel Cron (src/app/taches/quotidiennes)
-- avec la clé de service :
--   1. le vendeur d'une annonce qui expire dans sept jours au plus est
--      prévenu, une fois par mise en ligne : prolongée, elle le sera de
--      nouveau à sept jours de sa nouvelle échéance ;
--   2. les photos d'une annonce archivée sont retirées. Le registre date leur
--      décrochage (track_photo_upload_use), et le ménage supprime les
--      fichiers chez Cloudflare le lendemain (claim_photo_purge). Une
--      annonce visée par un signalement encore ouvert garde les siennes
--      jusqu'à la décision : elles en sont la pièce.
-- Un verrou l'empêche de tourner deux fois à la fois : Vercel Cron livre
-- parfois deux fois une échéance, et deux passages préviendraient deux fois.
-- Rend ce qu'elle a fait, pour le journal.
create or replace function public.run_listing_lifecycle()
returns table (warned_listings integer, archived_listings integer, removed_photos integer)
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.run_listing_lifecycle'));
  insert into public.notifications (user_id, kind, listing_id)
  select l.seller_id, 'listing_expiring', l.id
    from public.listings l
   where public.listing_on_market(l)
     and public.listing_expires_at(l) <= now() + interval '7 days'
     and not exists (select 1 from public.notifications n
                     where n.kind = 'listing_expiring' and n.listing_id = l.id and n.created_at >= l.renewed_at);
  get diagnostics warned_listings = row_count;
  with removed as (
    delete from public.listing_photos p
     using public.listings l
     where l.id = p.listing_id
       and public.listing_archived(l)
       and not exists (select 1 from public.reports r
                       where r.target_type = 'listing' and r.target_id = l.id and r.resolved_at is null)
    returning p.listing_id
  )
  select count(distinct removed.listing_id)::integer, count(*)::integer
    into archived_listings, removed_photos
    from removed;
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- Droits.
-- ---------------------------------------------------------------------

-- Prolonger : le rôle connecté seul, sur ses annonces (la fonction le
-- vérifie). La tâche quotidienne : la clé de service seule.
revoke execute on function public.renew_listing(uuid) from public, anon;
grant execute on function public.renew_listing(uuid) to authenticated;
revoke execute on function public.run_listing_lifecycle() from public, anon, authenticated;
grant execute on function public.run_listing_lifecycle() to service_role;

-- ======================================================================================
-- 20261002120200_pro_status.sql
-- ======================================================================================

-- Migration 16 : le statut professionnel, séparé du forfait.
--
-- Une boutique devient professionnelle en déclarant son SIRET dans
-- Paramètres : le serveur le vérifie auprès du répertoire des entreprises
-- (src/lib/company-registry.ts), puis écrit le statut avec la clé de service
-- — account_type, siret, legal_name et pro_verified_at restent hors des
-- droits du rôle connecté. Le statut est gratuit et porte le badge PRO,
-- l'enseigne et la fiche boutique : un acheteur doit savoir qu'il traite avec
-- un professionnel (Code de la consommation, L111-7), forfait ou non. Le
-- forfait (pro_until), payant, n'ouvre plus que les lots réservés aux pros
-- (is_active_pro, inchangée), et suppose le statut.
--
-- Les comptes pro déjà en base le restent, sans SIRET vérifié : leur fiche
-- dit « — », comme avant.

alter table public.profiles
  -- La raison sociale du répertoire, null quand il la masque, et la date de
  -- la vérification du SIRET.
  add column legal_name text check (legal_name is null or char_length(legal_name) between 1 and 200),
  add column pro_verified_at timestamptz,
  -- Ses profils de vendeur ailleurs, déclarés par la boutique et affichés
  -- comme tels : rien ne prouve qu'ils sont les siens. Cardmarket : l'adresse
  -- de sa page vendeur, telle que le navigateur la montre.
  add column cardmarket_url text check (
    cardmarket_url is null
    or (cardmarket_url ~ '^https://www\.cardmarket\.com/[a-z]{2}/[A-Za-z]+/Users/[A-Za-z0-9_.-]+$' and char_length(cardmarket_url) <= 200)
  ),
  add column cardnexus_url text check (
    cardnexus_url is null or (cardnexus_url ~ '^https://(www\.)?cardnexus\.com/\S+$' and char_length(cardnexus_url) <= 200)
  ),
  add constraint profiles_pro_details_only_for_pros check (
    account_type = 'pro' or (legal_name is null and pro_verified_at is null and cardmarket_url is null and cardnexus_url is null)
  ),
  -- Le forfait suppose le statut : le service de paiement ne vend pas
  -- l'espace pro à un compte de particulier.
  add constraint profiles_plan_needs_pro check (pro_until is null or account_type = 'pro');

-- Un SIRET ne sert qu'un compte : un second compte qui le déclarerait se
-- ferait passer pour la boutique. La vraie boutique, refusée, le signale.
create unique index profiles_one_account_per_siret on public.profiles (siret) where siret is not null;

-- La boutique renseigne elle-même ses profils de places de marché, comme
-- son adresse et ses horaires ; la contrainte ci-dessus les refuse à un
-- particulier.
grant update (cardmarket_url, cardnexus_url) on public.profiles to authenticated;

-- Repasser en compte particulier : une déclaration faite par erreur, une
-- activité arrêtée. Le compte seul, sur lui-même, et jamais avec un forfait
-- en cours — il le paie pour voir les lots réservés. Le statut, l'enseigne,
-- la fiche boutique et ses liens partent ensemble, et un forfait échu avec
-- eux. security definer : account_type n'est dans les droits de personne.
create or replace function public.leave_pro_status() returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles%rowtype;
begin
  select * into me from public.profiles where id = auth.uid() for update;
  if not found or me.account_type <> 'pro' then
    raise exception 'compte professionnel introuvable' using errcode = 'P0002';
  end if;
  if me.pro_until is not null and me.pro_until > now() then
    raise exception 'le forfait pro court jusqu''au % : résiliez-le d''abord', me.pro_until using errcode = '23514';
  end if;
  update public.profiles
     set account_type = 'individual', company_name = null, siret = null, legal_name = null, pro_verified_at = null,
         shop_address = null, shop_hours = null, shop_website = null, cardmarket_url = null, cardnexus_url = null,
         pro_until = null
   where id = me.id;
end;
$$;

revoke execute on function public.leave_pro_status() from public, anon;
grant execute on function public.leave_pro_status() to authenticated;

-- ======================================================================================
-- 20261004120000_reserve_respects_blocks.sql
-- ======================================================================================

-- Migration 17 : réserver respecte les blocages.
--
-- Bloquer empêche d'écrire dans les deux sens, et close_deal() refuse déjà
-- de clôturer une vente entre deux comptes qui se sont bloqués. Réserver ne
-- le vérifiait pas (audit du front, suite, point 4) : un vendeur pouvait
-- réserver son lot pour quelqu'un qu'il avait bloqué — ou qui l'avait bloqué
-- —, et le lot restait « Réservé » pour une personne qui ne pouvait plus
-- écrire dans le fil. Même refus, même code que close_deal() : 42501, que le
-- site lit comme « introuvable » (src/lib/data/mutation-result.ts).
--
-- Seule la vérification s'ajoute : la fonction reste celle de la migration
-- 8, qu'elle remplace.

create or replace function public.reserve_listing(conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  thread public.conversations%rowtype;
begin
  select * into thread from public.conversations
   where id = conversation and seller_id = auth.uid();
  if not found then
    raise exception 'conversation introuvable' using errcode = 'P0002';
  end if;
  if public.is_blocked_between(thread.seller_id, thread.buyer_id) then
    raise exception 'conversation bloquée' using errcode = '42501';
  end if;
  update public.listings set status = 'reserved', reserved_for = thread.buyer_id
   where id = thread.listing_id and status <> 'sold';
end;
$$;
