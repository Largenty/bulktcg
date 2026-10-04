-- Écritures de la phase 2 (migration 11) : une annonce se dépose et se
-- modifie avec ses séries et ses produits d'un seul bloc, un double envoi ne
-- crée rien de plus et le dit, une conversation s'ouvre avec son premier
-- message. Et ce que le navigateur écrit de plus — l'identifiant, donc le
-- lien — la base le tient : un lien finit par l'identifiant et ne ressert
-- jamais, une annonce naît disponible, son prix d'avant est le vrai, un
-- croisement ne se notifie qu'une fois. Pose ses propres comptes : Jade (e1,
-- la vendeuse), Karim (e2) et Lucas (e3), qui achètent.

-- @step [ok] comptes et brouillons : le dépôt de Jade, tel que l'envoie le formulaire
-- @expect [{"profils":3}]
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', '{"username":"jade","city":"Avignon","postal_code":"84000"}'),
  ('00000000-0000-0000-0000-0000000000e2', '{"username":"karim","city":"Orange","postal_code":"84100"}'),
  ('00000000-0000-0000-0000-0000000000e3', '{"username":"lucas","city":"Nîmes","postal_code":"30000"}');
create temp table draft as select jsonb_build_object(
  'listing', jsonb_build_object(
    'id', '20000000-0000-4000-8000-000000000001', 'slug', 'vrac-pokemon-avignon-20000000',
    'seller_id', '00000000-0000-0000-0000-0000000000e1', 'game_id', 'pokemon',
    'title', 'Vrac Pokémon 300 cartes', 'description', repeat('description ', 5), 'lot_type', 'bulk',
    'card_count', 300, 'weight_kg', null, 'condition', 'mixed', 'language', 'VF', 'price_cents', 2500,
    'city', 'Avignon', 'postal_code', '84000', 'department_code', '84', 'latitude', 43.95, 'longitude', 4.81,
    'status', 'available', 'audience', 'everyone', 'open_to_trade', false, 'trade_note', null),
  'editions', jsonb_build_array(
    jsonb_build_object('edition_id', 'pokemon-ev10', 'position', 0),
    jsonb_build_object('edition_id', 'pokemon-ev09', 'position', 1)),
  'tags', jsonb_build_array(jsonb_build_object('tag', 'booster-box'))) as payload;
grant select on draft to authenticated, anon;
-- Un dépôt dérivé du brouillon : un autre identifiant, et le lien qui en découle.
create function pg_temp.variant(base jsonb, id text, slug text) returns jsonb language sql as $$
  select jsonb_set(jsonb_set(base, '{listing,id}', to_jsonb(id)), '{listing,slug}', to_jsonb(slug));
$$;
select count(*) as profils from public.profiles where username in ('jade', 'karim', 'lucas');

-- @step [ok] dépôt : l'annonce, ses séries et ses produits, son lien permanent, et la création annoncée
-- @expect [{"lien":"vrac-pokemon-avignon-20000000","cree":true,"annonces":1,"series":2,"produits":1}]
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
create temp table deposited as select permalink as lien, created as cree from draft, public.create_listing(payload);
reset role;
select (select lien from deposited) as lien, (select cree from deposited) as cree,
       (select count(*) from public.listings where id = '20000000-0000-4000-8000-000000000001') as annonces,
       (select count(*) from public.listing_editions where listing_id = '20000000-0000-4000-8000-000000000001') as series,
       (select count(*) from public.listing_tags where listing_id = '20000000-0000-4000-8000-000000000001') as produits;

-- @step [ok] double envoi : le même lien en retour, rien de créé — le serveur ne prévient personne une seconde fois
-- @expect [{"lien":"vrac-pokemon-avignon-20000000","cree":false,"annonces":1,"series":2,"produits":1}]
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
create temp table replayed as select permalink as lien, created as cree from draft, public.create_listing(payload);
reset role;
select (select lien from replayed) as lien, (select cree from replayed) as cree,
       (select count(*) from public.listings where id = '20000000-0000-4000-8000-000000000001') as annonces,
       (select count(*) from public.listing_editions where listing_id = '20000000-0000-4000-8000-000000000001') as series,
       (select count(*) from public.listing_tags where listing_id = '20000000-0000-4000-8000-000000000001') as produits;

-- @step [refus] un dépôt qui porte des photos, avant la phase 3
-- @error les photos arrivent avec la phase 3
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
select * from draft, public.create_listing(jsonb_set(pg_temp.variant(payload, '20000002-0000-4000-8000-000000000002', 'vrac-pokemon-avignon-20000002'),
                                                     '{photos}', '[{"storage_path":"cf-x","position":0}]'));

-- @step [refus] une série d'un autre jeu : tout le dépôt est refusé
-- @error n'appartient pas au jeu de l'annonce
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
select * from draft, public.create_listing(jsonb_set(pg_temp.variant(payload, '20000003-0000-4000-8000-000000000003', 'vrac-pokemon-avignon-20000003'),
                                                     '{editions}', '[{"edition_id":"magic-fdn","position":0}]'));

-- @step [ok] le dépôt refusé n'a rien laissé, pas même l'annonce sans sa série
-- @expect [{"annonces":0}]
select count(*) as annonces from public.listings where id = '20000003-0000-4000-8000-000000000003';

-- @step [refus] déposer au nom d'un autre vendeur
-- @error row-level security policy for table "listings"
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
set role authenticated;
select * from draft, public.create_listing(pg_temp.variant(payload, '20000004-0000-4000-8000-000000000004', 'vrac-pokemon-avignon-20000004'));

-- @step [refus] rejouer l'identifiant d'une annonce qui n'est pas la sienne
-- @error annonce introuvable
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
set role authenticated;
select * from draft, public.create_listing(jsonb_set(payload, '{listing,seller_id}', '"00000000-0000-0000-0000-0000000000e2"'));

-- @step [refus] un visiteur anonyme ne dépose rien
-- @error permission denied for function create_listing
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select * from draft, public.create_listing(payload);

-- @step [refus] un lien qui ne finit pas par l'identifiant de l'annonce, déposé directement
-- @error ne finit pas par l'identifiant de la ligne
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude)
values ('20000008-0000-4000-8000-000000000008', 'vrac-pokemon-avignon-01', '00000000-0000-0000-0000-0000000000e1', 'pokemon',
        'Vrac Pokémon lien choisi', repeat('description ', 5), 'bulk', 'mixed', 'VF', 1500, 'Avignon', '84000', '84', 43.95, 4.81);

-- @step [ok] déposée directement « Réservé », une annonce naît disponible
-- @expect [{"status":"available","reserved_for":null,"previous_price_cents":null}]
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude, status)
values ('20000006-0000-4000-8000-000000000006', 'lot-reserve-avignon-20000006', '00000000-0000-0000-0000-0000000000e1', 'pokemon',
        'Lot Pokémon déjà réservé', repeat('description ', 5), 'bulk', 'mixed', 'VF', 1500, 'Avignon', '84000', '84', 43.95, 4.81, 'reserved');
reset role;
select status, reserved_for, previous_price_cents from public.listings where id = '20000006-0000-4000-8000-000000000006';

-- @step [ok] même par le serveur, une annonce naît disponible et sans prix d'avant ; ses liens, eux, sont à lui
-- @expect [{"status":"available","sold_at":null,"reserved_for":null,"previous_price_cents":null}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, previous_price_cents, city, postal_code, department_code, latitude, longitude, status, sold_at, reserved_for)
values ('20000007-0000-4000-8000-000000000007', 'lot-serveur-avignon-07', '00000000-0000-0000-0000-0000000000e1', 'pokemon',
        'Lot Pokémon né vendu', repeat('description ', 5), 'bulk', 'mixed', 'VF', 1500, 499999, 'Avignon', '84000', '84', 43.95, 4.81,
        'sold', now(), '00000000-0000-0000-0000-0000000000e2');
select status, sold_at, reserved_for, previous_price_cents from public.listings where id = '20000007-0000-4000-8000-000000000007';

-- @step [ok] modification : le jeu change avec ses séries, le lien reste, et le prix d'avant est celui de la base, pas celui envoyé
-- @expect [{"game_id":"magic","slug":"vrac-pokemon-avignon-20000000","price_cents":2000,"previous_price_cents":2500,"series":["magic-fdn"],"produits":["booster-pack"]}]
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
select public.update_listing('20000000-0000-4000-8000-000000000001', jsonb_build_object(
  'listing', (payload -> 'listing') - 'id' - 'slug' - 'seller_id' - 'status'
             || '{"game_id":"magic","price_cents":2000,"previous_price_cents":499999}',
  'editions', '[{"edition_id":"magic-fdn","position":0}]'::jsonb,
  'tags', '[{"tag":"booster-pack"}]'::jsonb))
  from draft;
reset role;
select l.game_id, l.slug, l.price_cents, l.previous_price_cents,
       (select array_agg(edition_id) from public.listing_editions where listing_id = l.id) as series,
       (select array_agg(tag::text) from public.listing_tags where listing_id = l.id) as produits
  from public.listings l where l.id = '20000000-0000-4000-8000-000000000001';

-- @step [ok] le prix remonte : plus de baisse affichée ; une baisse inventée sans changer le prix est ignorée
-- @expect [{"apres_hausse":null,"apres_invention":null}]
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
update public.listings set price_cents = 2600 where id = '20000000-0000-4000-8000-000000000001';
reset role;
create temp table raised as select previous_price_cents from public.listings where id = '20000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
update public.listings set previous_price_cents = 499999 where id = '20000000-0000-4000-8000-000000000001';
reset role;
select (select previous_price_cents from raised) as apres_hausse,
       (select previous_price_cents from public.listings where id = '20000000-0000-4000-8000-000000000001') as apres_invention;

-- @step [refus] modifier l'annonce d'un autre : introuvable
-- @error annonce introuvable
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
set role authenticated;
select public.update_listing('20000000-0000-4000-8000-000000000001', jsonb_build_object(
  'listing', (payload -> 'listing') - 'id' - 'slug' - 'seller_id' - 'status' || '{"title":"Annonce prise par un autre"}',
  'editions', '[]'::jsonb, 'tags', '[]'::jsonb))
  from draft;

-- @step [ok] la tentative d'un autre n'a rien retiré : séries et produits sont restés
-- @expect [{"title":"Vrac Pokémon 300 cartes","series":1,"produits":1}]
select l.title,
       (select count(*) from public.listing_editions where listing_id = l.id) as series,
       (select count(*) from public.listing_tags where listing_id = l.id) as produits
  from public.listings l where l.id = '20000000-0000-4000-8000-000000000001';

-- @step [refus] une modification qui porte des photos, avant la phase 3
-- @error les photos arrivent avec la phase 3
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
select public.update_listing('20000000-0000-4000-8000-000000000001', jsonb_build_object(
  'listing', (payload -> 'listing') - 'id' - 'slug' - 'seller_id' - 'status',
  'photos', '[{"storage_path":"cf-x","position":0}]'::jsonb))
  from draft;

-- @step [ok] une annonce supprimée laisse son lien aux liens retirés
-- @expect [{"annonces":0,"retire":true}]
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
select * from draft, public.create_listing(pg_temp.variant(payload, '20000005-0000-4000-8000-000000000005', 'lot-a-supprimer-avignon-20000005'));
delete from public.listings where id = '20000005-0000-4000-8000-000000000005';
reset role;
select (select count(*) from public.listings where id = '20000005-0000-4000-8000-000000000005') as annonces,
       exists (select 1 from public.retired_slugs where kind = 'listing' and slug = 'lot-a-supprimer-avignon-20000005') as retire;

-- @step [refus] un autre vendeur reprend le lien et l'identifiant d'une annonce supprimée
-- @error a déjà servi
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
set role authenticated;
insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude)
values ('20000005-0000-4000-8000-000000000005', 'lot-a-supprimer-avignon-20000005', '00000000-0000-0000-0000-0000000000e2', 'pokemon',
        'Un autre lot sous le même lien', repeat('description ', 5), 'bulk', 'mixed', 'VF', 1500, 'Orange', '84100', '84', 44.13, 4.81);

-- @step [refus] son vendeur ne le reprend pas non plus, en rejouant le dépôt
-- @error a déjà servi
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
select * from draft, public.create_listing(pg_temp.variant(payload, '20000005-0000-4000-8000-000000000005', 'lot-a-supprimer-avignon-20000005'));

-- @step [refus] la table des liens retirés n'est ni lue ni écrite par un compte
-- @error permission denied for table retired_slugs
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
delete from public.retired_slugs;

-- @step [ok] conversation : ouverte par l'acheteur, avec son premier message, signé de lui
-- @expect [{"conversations":1,"messages":1,"auteur":"karim"}]
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
set role authenticated;
create temp table opened as
  select public.open_conversation('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000e2',
                                  '00000000-0000-0000-0000-0000000000e1', 'Bonjour, le lot est-il complet ?') as id;
reset role;
select (select count(*) from public.conversations c join opened o on o.id = c.id) as conversations,
       (select count(*) from public.messages m join opened o on o.id = m.conversation_id) as messages,
       (select p.username from public.messages m join opened o on o.id = m.conversation_id
          join public.profiles p on p.id = m.sender_id) as auteur;

-- @step [refus] un premier message refusé : la conversation n'est pas ouverte non plus
-- @error messages_body_check
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e3', false);
set role authenticated;
select public.open_conversation('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000e3',
                                '00000000-0000-0000-0000-0000000000e1', 'x');

-- @step [ok] rien n'est resté de la conversation refusée
-- @expect [{"conversations":0}]
select count(*) as conversations from public.conversations where buyer_id = '00000000-0000-0000-0000-0000000000e3';

-- @step [refus] le vendeur démarche un acheteur qui ne cherche rien
-- @error row-level security policy for table "conversations"
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
set role authenticated;
select public.open_conversation('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000e3',
                                '00000000-0000-0000-0000-0000000000e1', 'Bonjour, ce lot vous intéresse ?');

-- @step [refus] un visiteur anonyme n'ouvre aucune conversation
-- @error permission denied for function open_conversation
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select public.open_conversation('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000e3',
                                '00000000-0000-0000-0000-0000000000e1', 'Bonjour, ce lot vous intéresse ?');

-- @step [ok] demande : un double envoi avec le même identifiant ne crée qu'une ligne
-- @expect [{"demandes":1}]
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
set role authenticated;
insert into public.wanted_listings (id, slug, buyer_id, game_id, title, description, city, postal_code, department_code, latitude, longitude, max_distance_km)
values ('30000000-0000-4000-8000-000000000001', 'cherche-magic-orange-30000000', '00000000-0000-0000-0000-0000000000e2', 'magic',
        'Cherche du vrac Magic', repeat('description ', 5), 'Orange', '84100', '84', 44.13, 4.81, 50)
on conflict (id) do nothing;
insert into public.wanted_listings (id, slug, buyer_id, game_id, title, description, city, postal_code, department_code, latitude, longitude, max_distance_km)
values ('30000000-0000-4000-8000-000000000001', 'cherche-magic-orange-30000000', '00000000-0000-0000-0000-0000000000e2', 'magic',
        'Cherche du vrac Magic', repeat('description ', 5), 'Orange', '84100', '84', 44.13, 4.81, 50)
on conflict (id) do nothing;
reset role;
select count(*) as demandes from public.wanted_listings where id = '30000000-0000-4000-8000-000000000001';

-- @step [refus] une demande dont le lien ne finit pas par son identifiant
-- @error ne finit pas par l'identifiant de la ligne
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
set role authenticated;
insert into public.wanted_listings (id, slug, buyer_id, game_id, title, description, city, postal_code, department_code, latitude, longitude, max_distance_km)
values ('30000002-0000-4000-8000-000000000002', 'cherche-magic-orange', '00000000-0000-0000-0000-0000000000e2', 'magic',
        'Cherche encore du Magic', repeat('description ', 5), 'Orange', '84100', '84', 44.13, 4.81, 50);

-- @step [refus] une demande supprimée ne rend pas son lien
-- @error a déjà servi
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', false);
set role authenticated;
insert into public.wanted_listings (id, slug, buyer_id, game_id, title, description, city, postal_code, department_code, latitude, longitude, max_distance_km)
values ('30000003-0000-4000-8000-000000000003', 'cherche-yugioh-orange-30000003', '00000000-0000-0000-0000-0000000000e2', 'yugioh',
        'Cherche du vrac Yu-Gi-Oh', repeat('description ', 5), 'Orange', '84100', '84', 44.13, 4.81, 50);
delete from public.wanted_listings where id = '30000003-0000-4000-8000-000000000003';
insert into public.wanted_listings (id, slug, buyer_id, game_id, title, description, city, postal_code, department_code, latitude, longitude, max_distance_km)
values ('30000003-0000-4000-8000-000000000003', 'cherche-yugioh-orange-30000003', '00000000-0000-0000-0000-0000000000e2', 'yugioh',
        'Cherche du vrac Yu-Gi-Oh', repeat('description ', 5), 'Orange', '84100', '84', 44.13, 4.81, 50);

-- @step [ok] un croisement notifié deux fois — envoi rejoué, passages concurrents — n'en laisse qu'un ; les autres sortes se répètent
-- @expect [{"croisements":1,"disponibles":2}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.notifications (user_id, kind, listing_id, wanted_id) values
  ('00000000-0000-0000-0000-0000000000e2', 'wanted_match', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
insert into public.notifications (user_id, kind, listing_id, wanted_id) values
  ('00000000-0000-0000-0000-0000000000e2', 'wanted_match', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001')
on conflict (kind, user_id, listing_id, wanted_id) do nothing;
insert into public.notifications (user_id, kind, listing_id) values
  ('00000000-0000-0000-0000-0000000000e2', 'listing_available', '20000000-0000-4000-8000-000000000001'),
  ('00000000-0000-0000-0000-0000000000e2', 'listing_available', '20000000-0000-4000-8000-000000000001');
reset role;
select (select count(*) from public.notifications where kind = 'wanted_match' and user_id = '00000000-0000-0000-0000-0000000000e2') as croisements,
       (select count(*) from public.notifications where kind = 'listing_available' and user_id = '00000000-0000-0000-0000-0000000000e2') as disponibles;

-- @step [refus] le même croisement inséré sans précaution est refusé par la base
-- @error notifications_one_per_match
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.notifications (user_id, kind, listing_id, wanted_id) values
  ('00000000-0000-0000-0000-0000000000e2', 'wanted_match', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
