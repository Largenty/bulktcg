-- Suppression de compte : les avis survivent, anonymes ; une vente clôturée
-- ne retient pas le vendeur ; ses fichiers vont au ménage.

-- @step [ok] l'acheteur supprime son compte : son avis reste sur le vendeur
-- @expect [{"avis":1,"anonyme":true,"avis_alice":1}]
select set_config('request.jwt.claim.sub', '', false);
delete from auth.users where id = '00000000-0000-0000-0000-00000000000b';
select (select count(*) from public.reviews) as avis,
       (select reviewer_id is null and deal_id is null from public.reviews) as anonyme,
       (select rating_count from public.profiles where username = 'alice') as avis_alice;

-- @step [ok] le vendeur supprime son compte malgré une vente clôturée
-- @expect [{"profils":3,"annonces":0,"avis_de_fanny":1,"note_fanny":1}]
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f0', '{"username":"fanny","city":"Arles","postal_code":"13200"}');
insert into public.conversations (id, listing_id, buyer_id, seller_id) values
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-00000000000a');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.close_deal('20000000-0000-0000-0000-000000000009', 'trade') is not null as closed;
insert into public.reviews (deal_id, reviewer_id, punctuality, responsiveness, reliability)
select id, '00000000-0000-0000-0000-00000000000a', 4, 4, 4 from public.deals where conversation_id = '20000000-0000-0000-0000-000000000009';
reset role;
select set_config('request.jwt.claim.sub', '', false);
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
select (select count(*) from public.profiles) as profils,
       (select count(*) from public.listings) as annonces,
       (select count(*) from public.reviews where reviewed_id = '00000000-0000-0000-0000-0000000000f0') as avis_de_fanny,
       (select rating_count from public.profiles where username = 'fanny') as note_fanny;

-- @step [ok] le compte supprimé laisse ses fichiers au ménage, sans propriétaire ni photo qui les affiche
reset role;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  if exists (select 1 from public.photo_uploads where key like 'cf-a%' and owner_id is not null) then
    raise exception 'un téléversement garde le compte supprimé pour propriétaire';
  end if;
  if (select count(*) from public.photo_uploads u where key like 'cf-a%'
        and not exists (select 1 from public.listing_photos p where p.storage_path = u.key)) <> 4 then
    raise exception 'les fichiers du compte supprimé ne sont pas tous livrés au ménage';
  end if;
end $$;
