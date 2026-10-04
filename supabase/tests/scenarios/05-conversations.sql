-- Conversations : l'acheteur écrit à propos d'un lot disponible ; le vendeur
-- n'écrit le premier qu'à qui cherche ce jeu, et jamais un lot réservé aux
-- pros à un particulier. Un message ne se réécrit pas, ne naît pas lu, et
-- les blocages ne se sondent pas. Pose le fil de Bob sur l'annonce 1 et
-- celui de Dora sur l'annonce 2.

-- @step [ok] l'acheteur ouvre une conversation sur un lot disponible
-- @expect [{"conversations":1}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
insert into public.conversations (listing_id, buyer_id, seller_id) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a');
reset role;
update public.conversations set id = '20000000-0000-0000-0000-000000000001' where listing_id = '10000000-0000-0000-0000-000000000001';
set role authenticated;
insert into public.messages (conversation_id, sender_id, body) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Bonjour, toujours dispo ?');
reset role;
select count(*) as conversations from public.conversations;

-- @step [refus] conversation ouverte au nom d'un faux vendeur
-- @error row-level security policy for table "conversations"
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
insert into public.conversations (listing_id, buyer_id, seller_id) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000b');

-- @step [refus] le vendeur démarche quelqu'un qui ne cherche rien
-- @error row-level security policy for table "conversations"
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.conversations (listing_id, buyer_id, seller_id) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000a');

-- @step [ok] le vendeur propose son lot Magic à qui cherche du Magic
-- @expect [{"stamped":true}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
set role authenticated;
insert into public.wanted_listings (id, slug, buyer_id, game_id, title, description, city, postal_code, department_code, latitude, longitude, max_distance_km)
values ('b1000000-0000-4000-8000-000000000001', 'cherche-magic-arles-b1000000', '00000000-0000-0000-0000-00000000000d', 'magic', 'Cherche classeurs Magic', repeat('je cherche ', 4), 'Arles', '13200', '13', 0, 0, 60);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.conversations (listing_id, buyer_id, seller_id) values
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000a');
reset role;
update public.conversations set id = '20000000-0000-0000-0000-000000000002' where listing_id = '10000000-0000-0000-0000-000000000002';
set role authenticated;
insert into public.messages (conversation_id, sender_id, body) values ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000a', 'Mon classeur pourrait vous plaire');
reset role;
select latitude > 43 as stamped from public.wanted_listings where slug = 'cherche-magic-arles-b1000000';

-- @step [refus] le vendeur propose son lot réservé aux pros à une particulière qui cherche ce jeu
-- @error row-level security policy for table "conversations"
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
set role authenticated;
insert into public.wanted_listings (id, slug, buyer_id, game_id, title, description, city, postal_code, department_code, latitude, longitude, max_distance_km)
values ('b2000000-0000-4000-8000-000000000002', 'cherche-pokemon-arles-b2000000', '00000000-0000-0000-0000-00000000000d', 'pokemon', 'Cherche vrac Pokémon', repeat('je cherche ', 4), 'Arles', '13200', '13', 0, 0, 60);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.conversations (listing_id, buyer_id, seller_id) values
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000a');

-- @step [refus] le destinataire réécrit le message reçu
-- @error permission denied for table messages
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
update public.messages set body = 'Texte réécrit' where conversation_id = '20000000-0000-0000-0000-000000000001';

-- @step [refus] une demande rajeunie pour repasser en tête
-- @error permission denied for table wanted_listings
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
set role authenticated;
update public.wanted_listings set created_at = now() + interval '1 year' where slug = 'cherche-magic-arles-b1000000';

-- @step [refus] un message qui naît déjà lu
-- @error permission denied for table messages
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
insert into public.messages (conversation_id, sender_id, body, read_at) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'Relance', now());

-- @step [ok] le destinataire marque le message lu
-- @expect [{"lus":1}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
update public.messages set read_at = now() where conversation_id = '20000000-0000-0000-0000-000000000001';
reset role;
select count(*) as lus from public.messages where read_at is not null;

-- @step [ok] un tiers ne sonde pas les blocages
-- @expect [{"tiers":false,"lignes_visibles":0}]
insert into public.blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000c');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.is_blocked_between('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000c') as tiers,
       (select count(*) from public.blocks) as lignes_visibles;

-- @step [ok] le participant bloqué, lui, le voit
-- @expect [{"participant":true}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select public.is_blocked_between('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000c') as participant;
reset role;
