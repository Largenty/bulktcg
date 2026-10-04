-- Annonces : le dépôt, sa commune, son lien permanent, et les colonnes que
-- seul le serveur écrit — mise en avant, compteur de vues. Pose les trois
-- annonces d'Alice que les fichiers suivants reprennent : 1 (vrac Pokémon),
-- 2 (classeur Magic) et 3 (succession réservée aux pros).

-- @step [ok] dépôt par le vendeur connecté, avec l'identifiant tiré par le formulaire : coordonnées recopiées
-- @expect [{"department_code":"84","latitude":43.9493,"longitude":4.8055}]
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude)
values ('a1000000-0000-4000-8000-000000000001', 'lot-coordonnees-inventees-a1000000', '00000000-0000-0000-0000-00000000000a', 'pokemon', 'Vrac Pokémon 100 cartes', repeat('description ', 5), 'bulk', 'mixed', 'VF', 1500, 'Avignon', '84000', '99', 0, 0);
reset role;
select department_code, latitude, longitude from public.listings where slug = 'lot-coordonnees-inventees-a1000000';

-- @step [ok] données de départ (clé de service)
-- @expect [{"annonces":4}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude)
values
  ('10000000-0000-0000-0000-000000000001', 'vrac-pokemon-avignon-01', '00000000-0000-0000-0000-00000000000a', 'pokemon', 'Vrac Pokémon 400 cartes', repeat('description ', 5), 'bulk', 'mixed', 'VF', 3500, 'Avignon', '84000', '99', 0, 0),
  ('10000000-0000-0000-0000-000000000002', 'classeur-magic-avignon-02', '00000000-0000-0000-0000-00000000000a', 'magic', 'Classeur Magic 360 cartes', repeat('description ', 5), 'binder', 'EX', 'EN', 2500, 'Avignon', '84000', '84', 43.95, 4.81);
insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude, audience)
values ('10000000-0000-0000-0000-000000000003', 'succession-pokemon-avignon-03', '00000000-0000-0000-0000-00000000000a', 'pokemon', 'Succession Pokémon réservée', repeat('description ', 5), 'mixed', 'mixed', 'VF', 30000, 'Avignon', '84000', '84', 43.95, 4.81, 'pros');
select count(*) as annonces from public.listings;

-- @step [refus] dépôt dans une commune inconnue
-- @error listings_commune_fkey
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude)
values ('a2000000-0000-4000-8000-000000000002', 'lot-atlantis-a2000000', '00000000-0000-0000-0000-00000000000a', 'pokemon', 'Vrac Pokémon Atlantide', repeat('description ', 5), 'bulk', 'mixed', 'VF', 3500, 'Atlantis', '99999', '99', 0, 0);

-- @step [refus] slug qui casse une URL
-- @error listings_slug_check
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listings (slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude)
values ('../../admin', '00000000-0000-0000-0000-00000000000a', 'pokemon', 'Vrac Pokémon piégé ici', repeat('description ', 5), 'bulk', 'mixed', 'VF', 3500, 'Avignon', '84000', '84', 0, 0);

-- @step [ok] une « baisse » envoyée par le vendeur est ignorée : la base ne garde un prix d'avant que si le prix baisse (migration 11)
-- @expect [{"price_cents":3500,"previous_price_cents":null}]
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
update public.listings set previous_price_cents = 3000 where id = '10000000-0000-0000-0000-000000000001';
reset role;
select price_cents, previous_price_cents from public.listings where id = '10000000-0000-0000-0000-000000000001';

-- @step [refus] le vendeur se met à la une
-- @error permission denied for table listings
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
update public.listings set featured_until = now() + interval '7 days' where id = '10000000-0000-0000-0000-000000000001';

-- @step [refus] un vendeur gonfle ses vues
-- @error permission denied for function record_listing_view
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.record_listing_view('10000000-0000-0000-0000-000000000002');

-- @step [ok] le serveur compte une vue sans rajeunir la fiche
-- @expect [{"view_count":1,"meme_date":true}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
create temp table before_view as select updated_at from public.listings where id = '10000000-0000-0000-0000-000000000002';
set role service_role;
select public.record_listing_view('10000000-0000-0000-0000-000000000002');
reset role;
select l.view_count, l.updated_at = b.updated_at as meme_date from public.listings l, before_view b where l.id = '10000000-0000-0000-0000-000000000002';
