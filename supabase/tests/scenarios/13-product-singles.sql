-- « Cartes à l'unité » (migrations 12 et 13) : une valeur de plus pour les
-- produits, proposée par tous les jeux, et qu'un vendeur coche sur son lot.

-- @step [ok] tous les jeux proposent « Cartes à l'unité »
-- @expect [{"jeux":8}]
reset role;
select count(*) as jeux from public.product_tag_games where tag = 'singles';

-- @step [ok] un vendeur la coche sur son propre lot
-- @expect [{"cochees":1}]
reset role;
select set_config('request.jwt.claim.sub', (select seller_id::text from public.listings where status = 'available' order by id limit 1), false);
set role authenticated;
insert into public.listing_tags (listing_id, tag)
  select id, 'singles' from public.listings where seller_id = auth.uid() and status = 'available' order by id limit 1;
reset role;
select count(*) as cochees from public.listing_tags where tag = 'singles';

-- @step [refus] une valeur que l'énumération ne connaît pas
-- @error invalid input value for enum product_tag
reset role;
select 'single'::public.product_tag;
