-- Ventes : le vendeur clôture, chacun note l'autre, et l'annonce vendue est
-- figée — ni supprimée, ni réécrite, ni retirée à son acheteur — mais compte
-- encore ses vues.

-- @step [ok] clôture par le vendeur, avis de l'acheteur, avis du vendeur
-- @expect [{"username":"alice","rating_avg":"1.7","rating_count":1,"sold_listing_count":1},{"username":"bob","rating_avg":"4.7","rating_count":1,"sold_listing_count":0}]
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select public.close_deal('20000000-0000-0000-0000-000000000001', 'sale') is not null as closed;
insert into public.reviews (deal_id, reviewer_id, punctuality, responsiveness, reliability, comment)
select id, '00000000-0000-0000-0000-00000000000a', 5, 4, 5, 'Acheteur à l''heure' from public.deals;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
insert into public.reviews (deal_id, reviewer_id, punctuality, responsiveness, reliability)
select id, '00000000-0000-0000-0000-00000000000b', 2, 2, 1 from public.deals;
reset role;
select username, rating_avg, rating_count, sold_listing_count from public.profiles where username in ('alice', 'bob') order by username;

-- @step [refus] le vendeur supprime l'annonce d'une vente clôturée
-- @error deals_listing_id_fkey
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
delete from public.listings where id = '10000000-0000-0000-0000-000000000001';

-- @step [refus] le vendeur réécrit l'annonce d'une vente clôturée
-- @error l'annonce reste telle qu'elle a été vendue
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
update public.listings set card_count = 300, title = 'Environ 300 cartes Pokémon' where id = '10000000-0000-0000-0000-000000000001';

-- @step [refus] le vendeur la réserve aux pros après la vente, et l'acheteur ne la verrait plus
-- @error l'annonce reste telle qu'elle a été vendue
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
update public.listings set audience = 'pros' where id = '10000000-0000-0000-0000-000000000001';

-- @step [refus] le vendeur retire une photo de l'annonce vendue
-- @error l'annonce reste telle qu'elle a été vendue
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
delete from public.listing_photos where listing_id = '10000000-0000-0000-0000-000000000001' and position = 2;

-- @step [refus] le vendeur ajoute une série à l'annonce vendue
-- @error l'annonce reste telle qu'elle a été vendue
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listing_editions (listing_id, edition_id, position) values ('10000000-0000-0000-0000-000000000001', 'pokemon-ev08', 7);

-- @step [ok] l'annonce vendue garde son contenu, et compte encore ses vues
-- @expect [{"title":"Vrac Pokémon 400 cartes","card_count":null,"audience":"everyone","view_count":1,"photos":3}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
select public.record_listing_view('10000000-0000-0000-0000-000000000001');
reset role;
select l.title, l.card_count, l.audience, l.view_count,
       (select count(*) from public.listing_photos p where p.listing_id = l.id) as photos
  from public.listings l where l.id = '10000000-0000-0000-0000-000000000001';
