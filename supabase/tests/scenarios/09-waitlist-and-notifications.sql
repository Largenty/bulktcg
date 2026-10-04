-- Réservation et liste d'attente : le vendeur seul en voit le nombre, et le
-- retour à « Disponible » prévient tous les inscrits d'un coup. Une
-- notification porte toujours son sujet.

-- @step [ok] réservation, liste d'attente, puis retour à « Disponible »
-- @expect [{"prevenus":1,"attente_restante":0,"reserve_pour":null}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.reserve_listing('20000000-0000-0000-0000-000000000002');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
insert into public.listing_waitlist (listing_id, user_id) values ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000c');
do $$ begin
  if public.waitlist_count('10000000-0000-0000-0000-000000000002') <> 0 then
    raise exception 'un inscrit lit le nombre de la liste d''attente';
  end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$ begin
  if public.waitlist_count('10000000-0000-0000-0000-000000000002') <> 1 then
    raise exception 'le vendeur ne lit pas le nombre de la liste d''attente';
  end if;
end $$;
update public.listings set status = 'available' where id = '10000000-0000-0000-0000-000000000002';
reset role;
select (select count(*) from public.notifications where kind = 'listing_available') as prevenus,
       (select count(*) from public.listing_waitlist) as attente_restante,
       (select reserved_for from public.listings where id = '10000000-0000-0000-0000-000000000002') as reserve_pour;

-- @step [refus] notification sans son sujet
-- @error notifications_wanted_match_subject
insert into public.notifications (user_id, kind, listing_id) values ('00000000-0000-0000-0000-00000000000b', 'wanted_match', '10000000-0000-0000-0000-000000000002');
