-- Séries et produits : ceux du jeu de l'annonce seulement, et un changement
-- de jeu qui ne laisse pas derrière lui les séries de l'ancien.

-- @step [ok] séries et produits du bon jeu
-- @expect [{"liaisons":2}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listing_editions (listing_id, edition_id, position) values ('10000000-0000-0000-0000-000000000001', 'pokemon-ev08', 0), ('10000000-0000-0000-0000-000000000001', 'pokemon-eb', 1);
insert into public.listing_tags (listing_id, tag) values ('10000000-0000-0000-0000-000000000001', 'etb');
reset role;
select count(*) as liaisons from public.listing_editions;

-- @step [refus] série inconnue
-- @error n'appartient pas au jeu de l'annonce
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listing_editions (listing_id, edition_id, position) values ('10000000-0000-0000-0000-000000000001', 'n-importe-quoi', 2);

-- @step [refus] série Magic sur une annonce Pokémon
-- @error n'appartient pas au jeu de l'annonce
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listing_editions (listing_id, edition_id, position) values ('10000000-0000-0000-0000-000000000001', 'magic-mh3', 2);

-- @step [refus] Structure Deck sur une annonce Pokémon
-- @error n'existe pas pour le jeu de l'annonce
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listing_tags (listing_id, tag) values ('10000000-0000-0000-0000-000000000001', 'structure-deck');

-- @step [refus] changer de jeu en gardant les séries de l'ancien
-- @error retirez d'abord les séries et les produits
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
update public.listings set game_id = 'magic' where id = '10000000-0000-0000-0000-000000000001';

-- @step [ok] changer de jeu après avoir retiré séries et produits
-- @expect [{"game_id":"pokemon"}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
delete from public.listing_editions where listing_id = '10000000-0000-0000-0000-000000000001';
delete from public.listing_tags where listing_id = '10000000-0000-0000-0000-000000000001';
update public.listings set game_id = 'magic' where id = '10000000-0000-0000-0000-000000000001';
update public.listings set game_id = 'pokemon' where id = '10000000-0000-0000-0000-000000000001';
reset role;
select game_id from public.listings where id = '10000000-0000-0000-0000-000000000001';
