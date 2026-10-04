-- Photos : le registre des téléversements, que seul le serveur remplit, et
-- les photos d'une annonce, prises dans ce registre et dans celui de son
-- vendeur seulement — même quand la clé de service les accroche. Trois
-- photos sans l'option « 8 photos », un fichier par photo ; le ménage ne
-- retire que les fichiers qu'aucune photo n'affiche.

-- @step [ok] le serveur inscrit les téléversements, avec la clé de service
-- @expect [{"televersements":5}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.photo_uploads (key, owner_id) values
  ('cf-a1', '00000000-0000-0000-0000-00000000000a'), ('cf-a2', '00000000-0000-0000-0000-00000000000a'), ('cf-a3', '00000000-0000-0000-0000-00000000000a'), ('cf-a4', '00000000-0000-0000-0000-00000000000a'),
  ('cf-c1', '00000000-0000-0000-0000-00000000000c');
reset role;
select count(*) as televersements from public.photo_uploads;

-- @step [refus] un vendeur s'inscrit lui-même un téléversement — il y déclarerait l'image d'un autre
-- @error permission denied for table photo_uploads
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.photo_uploads (key, owner_id) values ('cf-c1-copie', '00000000-0000-0000-0000-00000000000a');

-- @step [refus] une URL à la place d'une clé de fichier
-- @error photo_uploads_key_check
reset role;
set role service_role;
insert into public.photo_uploads (key, owner_id) values ('https://ailleurs.example/vol.jpg', '00000000-0000-0000-0000-00000000000a');

-- @step [ok] photos : trois de ses téléversements
-- @expect [{"photos":3}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listing_photos (listing_id, storage_path, position) values
  ('10000000-0000-0000-0000-000000000001', 'cf-a1', 0),
  ('10000000-0000-0000-0000-000000000001', 'cf-a2', 1),
  ('10000000-0000-0000-0000-000000000001', 'cf-a3', 2);
reset role;
select count(*) as photos from public.listing_photos;

-- @step [refus] quatrième photo sans l'option
-- @error l'option « 8 photos » est requise
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listing_photos (listing_id, storage_path, position) values ('10000000-0000-0000-0000-000000000001', 'cf-a4', 3);

-- @step [refus] photo sans fichier
-- @error row-level security policy for table "listing_photos"
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listing_photos (listing_id, storage_path, position) values ('10000000-0000-0000-0000-000000000002', null, 0);

-- @step [refus] photo prise dans les téléversements d'un autre
-- @error n'appartient pas au vendeur de l'annonce
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listing_photos (listing_id, storage_path, position) values ('10000000-0000-0000-0000-000000000002', 'cf-c1', 0);

-- @step [ok] l'option « 8 photos » est payée : le webhook l'écrit, avec la clé de service
-- @expect [{"extra_photos":true}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.listings set extra_photos = true where id = '10000000-0000-0000-0000-000000000001';
reset role;
select extra_photos from public.listings where id = '10000000-0000-0000-0000-000000000001';

-- @step [refus] le webhook n'accroche pas, parmi les photos 4 à 8, le fichier d'un autre vendeur — la clé de service passe la RLS, pas ce contrôle
-- @error n'appartient pas au vendeur de l'annonce
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.listing_photos (listing_id, storage_path, position) values ('10000000-0000-0000-0000-000000000001', 'cf-c1', 3);

-- @step [refus] photo qu'aucun téléversement n'a délivrée, même par la clé de service
-- @error listing_photos_storage_path_fkey
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.listing_photos (listing_id, storage_path, position) values ('10000000-0000-0000-0000-000000000002', 'cf-inconnu', 0);

-- @step [refus] un fichier n'affiche qu'une photo, d'une seule annonce
-- @error listing_photos_one_photo_per_file
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.listing_photos (listing_id, storage_path, position) values ('10000000-0000-0000-0000-000000000002', 'cf-a1', 0);

-- @step [ok] chacun ne voit que ses propres téléversements
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$ begin
  if (select count(*) from public.photo_uploads) <> 4 then raise exception 'attendu : les 4 téléversements du compte a, et eux seuls'; end if;
end $$;
reset role;

-- @step [refus] un visiteur anonyme lit le registre des téléversements
-- @error permission denied for table photo_uploads
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
select count(*) from public.photo_uploads;

-- @step [refus] le ménage retire un fichier encore affiché
-- @error listing_photos_storage_path_fkey
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
delete from public.photo_uploads where key = 'cf-a1';

-- @step [ok] le ménage trouve les fichiers qu'aucune photo n'affiche
reset role;
set role service_role;
do $$ begin
  if array(select u.key from public.photo_uploads u
            where not exists (select 1 from public.listing_photos p where p.storage_path = u.key)
            order by u.key) <> array['cf-a4', 'cf-c1'] then
    raise exception 'le ménage ne trouve pas exactement les fichiers orphelins';
  end if;
end $$;
reset role;
