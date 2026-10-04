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
