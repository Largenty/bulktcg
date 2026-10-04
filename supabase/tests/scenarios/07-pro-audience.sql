-- Annonces réservées aux pros : comptées pour tous, lues par les seuls pros,
-- leur vendeur et qui avait déjà un fil à leur sujet — lequel ne relance plus
-- le vendeur.

-- @step [ok] un anonyme compte les lots réservés sans les voir
-- @expect [{"visibles":0,"comptes":[{"game_id":"pokemon","listing_count":1}]}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select (select count(*) from public.listings where audience = 'pros') as visibles,
       (select json_agg(c) from public.pro_only_count_by_game() c) as comptes;

-- @step [ok] un particulier avait écrit à propos d'une annonce passée ensuite « pros »
-- @expect [{"conversations":1}]
-- La conversation date d'avant le passage aux pros : elle est posée avec la
-- clé de service, dans son propre scénario, pour qu'un refus plus bas ne
-- l'annule pas avec lui.
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.conversations (id, listing_id, buyer_id, seller_id) values
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a');
select count(*) as conversations from public.conversations where id = '20000000-0000-0000-0000-000000000006';

-- @step [ok] qui avait écrit garde la fiche passée « pros » ; un particulier sans fil, non
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
do $$ begin
  if (select count(*) from public.listings where id = '10000000-0000-0000-0000-000000000003') <> 1 then
    raise exception 'le participant du fil ne voit plus l''annonce';
  end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
set role authenticated;
do $$ begin
  if (select count(*) from public.listings where id = '10000000-0000-0000-0000-000000000003') <> 0 then
    raise exception 'un particulier sans fil voit l''annonce réservée aux pros';
  end if;
end $$;
reset role;

-- @step [refus] le particulier ne relance plus le fil d'une annonce passée « pros »
-- @error row-level security policy for table "messages"
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
insert into public.messages (conversation_id, sender_id, body) values
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000b', 'Toujours disponible ?');

-- @step [ok] le vendeur y écrit encore
-- @expect [{"messages":1}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.messages (conversation_id, sender_id, body) values
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000a', 'Une boutique passe samedi.');
reset role;
select count(*) as messages from public.messages where conversation_id = '20000000-0000-0000-0000-000000000006';
