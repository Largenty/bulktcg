-- Réserver respecte les blocages (migration 17) : comme clôturer une vente,
-- réserver un lot ne se fait pas entre deux comptes dont l'un a bloqué
-- l'autre, dans un sens comme dans l'autre. Pose ses propres comptes : Oscar
-- (b1, le vendeur), Pia (b2) et Quentin (b3), qui lui ont écrit.

-- @step [ok] un lot d'Oscar, et deux conversations à son sujet
-- @expect [{"conversations":2}]
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', '{"username":"oscar","city":"Avignon","postal_code":"84000"}'),
  ('00000000-0000-0000-0000-0000000000b2', '{"username":"pia","city":"Orange","postal_code":"84100"}'),
  ('00000000-0000-0000-0000-0000000000b3', '{"username":"quentin","city":"Orange","postal_code":"84100"}');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude, audience)
values ('b0000000-0000-4000-8000-000000000001', 'classeur-oscar-b0000001', '00000000-0000-0000-0000-0000000000b1', 'magic', 'Classeur Magic d''Oscar', repeat('description ', 5), 'binder', 'EX', 'EN', 4000, 'Avignon', '84000', '84', 0, 0, 'everyone');
insert into public.conversations (id, listing_id, buyer_id, seller_id) values
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b1'),
  ('b1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b1');
reset role;
select count(*) as conversations from public.conversations where seller_id = '00000000-0000-0000-0000-0000000000b1';

-- @step [ok] Pia bloque Oscar, et Oscar bloque Quentin
-- @expect [{"blocages":2}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
set role authenticated;
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b1');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b3');
reset role;
select count(*) as blocages from public.blocks where '00000000-0000-0000-0000-0000000000b1' in (blocker_id, blocked_id);

-- @step [refus] Oscar ne réserve pas son lot pour Pia, qui l'a bloqué
-- @error conversation bloquée
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select public.reserve_listing('b1000000-0000-4000-8000-000000000002');

-- @step [refus] ni pour Quentin, qu'il a lui-même bloqué
-- @error conversation bloquée
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select public.reserve_listing('b1000000-0000-4000-8000-000000000003');

-- @step [ok] le lot est resté disponible, sans personne pour qui il serait réservé
-- @expect [{"status":"available","reserved_for":null}]
reset role;
select status, reserved_for from public.listings where id = 'b0000000-0000-4000-8000-000000000001';

-- @step [ok] Oscar lève son blocage : la réservation pour Quentin passe, et celui de Pia demeure
-- @expect [{"status":"reserved","reserved_for":"00000000-0000-0000-0000-0000000000b3","blocages":1}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
delete from public.blocks where blocker_id = '00000000-0000-0000-0000-0000000000b1' and blocked_id = '00000000-0000-0000-0000-0000000000b3';
select public.reserve_listing('b1000000-0000-4000-8000-000000000003');
reset role;
select status, reserved_for,
       (select count(*) from public.blocks where '00000000-0000-0000-0000-0000000000b1' in (blocker_id, blocked_id)) as blocages
  from public.listings where id = 'b0000000-0000-4000-8000-000000000001';
