-- Le ménage des fichiers photo : le registre date lui-même le moment où plus
-- aucune photo n'affiche un fichier, le ménage ne prend que ce qui a passé
-- son délai de grâce — 7 jours pour un fichier jamais accroché, 1 jour pour
-- un fichier décroché —, par lots bornés où les reprises ne gardent que la
-- moitié des places tant que des fichiers neufs attendent, un seul passage à
-- la fois (le bail), un fichier pris ne s'accroche plus, et une clé que
-- Cloudflare remplace suit dans les photos. Reprend le registre laissé par
-- 03-photos (cf-a1 à cf-a4, cf-c1) et 10-account-deletion (Alice partie).
-- Le passage A tient le bail du début à la fin ; B arrive en cours de route.

-- @step [ok] le compte supprimé a daté le retrait de ses photos ; un dépôt jamais accroché n'a pas de date
-- @expect [{"key":"cf-a1","decroche":true},{"key":"cf-a2","decroche":true},{"key":"cf-a3","decroche":true},{"key":"cf-a4","decroche":false},{"key":"cf-c1","decroche":false}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
select key, detached_at is not null as decroche from public.photo_uploads order by key;

-- @step [ok] le ménage ne prend rien avant la fin des délais de grâce
-- @expect [{"pris":0}]
reset role;
set role service_role;
select count(*) as pris from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001');

-- @step [ok] passé les délais : un jour après le retrait, sept jours après un dépôt jamais accroché
-- @expect [{"pris":["cf-a1","cf-a3","cf-a4"],"reprise":false,"marques":["cf-a1","cf-a3","cf-a4"]}]
reset role;
update public.photo_uploads set detached_at = now() - interval '25 hours' where key = 'cf-a1';
update public.photo_uploads set detached_at = now() - interval '23 hours' where key = 'cf-a2';
update public.photo_uploads set detached_at = now() - interval '30 days' where key = 'cf-a3';
update public.photo_uploads set created_at = now() - interval '8 days' where key = 'cf-a4';
update public.photo_uploads set created_at = now() - interval '6 days' where key = 'cf-c1';
set role service_role;
create temp table purge_first as select * from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001');
reset role;
select (select array_agg(file_key order by file_key) from purge_first) as pris,
       (select bool_or(retry) from purge_first) as reprise,
       (select array_agg(key order by key) from public.photo_uploads where purge_started_at is not null) as marques;

-- @step [ok] Carla dépose deux annonces, avec ses téléversements : un vieux d'un mois, et un dépôt abandonné
-- @expect [{"photos":2}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude)
values
  ('10000000-0000-0000-0000-0000000000c1', 'vrac-magic-nimes-c1', '00000000-0000-0000-0000-00000000000c', 'magic', 'Vrac Magic 800 cartes', repeat('description ', 5), 'bulk', 'mixed', 'EN', 4000, 'Nîmes', '30000', '30', 0, 0),
  ('10000000-0000-0000-0000-0000000000c2', 'classeur-magic-nimes-c2', '00000000-0000-0000-0000-00000000000c', 'magic', 'Classeur Magic 200 cartes', repeat('description ', 5), 'binder', 'EX', 'EN', 3000, 'Nîmes', '30000', '30', 0, 0);
insert into public.photo_uploads (key, owner_id, created_at) values
  ('cf-c2', '00000000-0000-0000-0000-00000000000c', now() - interval '30 days'),
  ('cf-c3', '00000000-0000-0000-0000-00000000000c', now() - interval '8 days');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
insert into public.listing_photos (listing_id, storage_path, position) values
  ('10000000-0000-0000-0000-0000000000c1', 'cf-c1', 0),
  ('10000000-0000-0000-0000-0000000000c1', 'cf-c2', 1);
reset role;
select count(*) as photos from public.listing_photos;

-- @step [ok] le ménage prend le dépôt abandonné de Carla, et ne reprend pas ce qu'il vient de prendre
-- @expect [{"file_key":"cf-c3","retry":false}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
select * from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001');

-- @step [refus] une photo n'accroche plus un fichier que le ménage a pris, même par la clé de service
-- @error est en cours de retrait
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.listing_photos (listing_id, storage_path, position) values ('10000000-0000-0000-0000-0000000000c1', 'cf-c3', 2);

-- @step [refus] le fichier d'un compte supprimé n'appartient plus à personne, même pour la clé de service
-- @error n'appartient pas au vendeur de l'annonce
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.listing_photos (listing_id, storage_path, position) values ('10000000-0000-0000-0000-0000000000c1', 'cf-a2', 2);

-- @step [refus] une photo ne passe pas sur l'annonce d'un autre vendeur, même par la clé de service — l'annonce de Dora, créée ici, part avec le refus
-- @error n'appartient pas au vendeur de l'annonce
reset role;
select set_config('request.jwt.claim.sub', '', false);
insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude)
values ('10000000-0000-0000-0000-0000000000d1', 'vrac-magic-arles-d1', '00000000-0000-0000-0000-00000000000d', 'magic', 'Vrac Magic 300 cartes', repeat('description ', 5), 'bulk', 'mixed', 'EN', 2000, 'Arles', '13200', '13', 0, 0);
set role service_role;
update public.listing_photos set listing_id = '10000000-0000-0000-0000-0000000000d1' where storage_path = 'cf-c1';

-- @step [ok] ce qui vient d'être pris ne revient pas tout de suite : un passage en cours le traite peut-être encore
-- @expect [{"pris":0}]
reset role;
set role service_role;
select count(*) as pris from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001');

-- @step [ok] une heure après, ce qui a été pris sans être retiré revient en reprise, puis repart en fin de file ; un fichier affiché ne revient jamais, si vieux soit-il
-- @expect [{"premier":[{"cle":"cf-a1","reprise":true},{"cle":"cf-a3","reprise":true}],"second":[{"cle":"cf-a4","reprise":true}]}]
reset role;
update public.photo_uploads set purge_started_at = now() - interval '3 hours' where key = 'cf-a3';
update public.photo_uploads set purge_started_at = now() - interval '2 hours' where key in ('cf-a1', 'cf-a4');
set role service_role;
create temp table retry_first as select * from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001', 2);
create temp table retry_second as select * from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001', 5);
reset role;
select (select json_agg(json_build_object('cle', file_key, 'reprise', retry) order by file_key) from retry_first) as premier,
       (select json_agg(json_build_object('cle', file_key, 'reprise', retry) order by file_key) from retry_second) as second;

-- @step [ok] un lot ne rend jamais plus que sa taille, reprises comprises ; d'une place, il va au fichier neuf, et la reprise prend la place restée libre
-- @expect [{"premier":[{"cle":"cf-a2","reprise":false}],"second":[{"cle":"cf-a1","reprise":true}]}]
reset role;
update public.photo_uploads set purge_started_at = now() - interval '2 hours' where key = 'cf-a1';
update public.photo_uploads set detached_at = now() - interval '25 hours' where key = 'cf-a2';
set role service_role;
create temp table single_first as select * from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001', 1);
create temp table single_second as select * from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001', 1);
reset role;
select (select json_agg(json_build_object('cle', file_key, 'reprise', retry)) from single_first) as premier,
       (select json_agg(json_build_object('cle', file_key, 'reprise', retry)) from single_second) as second;

-- @step [ok] reprises et fichiers neufs se partagent le lot : les reprises n'en gardent que la moitié tant que des neufs attendent — celles qui échouent toujours ne les bloquent jamais —, et les neufs ne les en privent pas
-- @expect [{"premier":[{"cle":"cf-a1","reprise":true},{"cle":"cf-c5","reprise":false}],"second":[{"cle":"cf-a3","reprise":true},{"cle":"cf-a4","reprise":true},{"cle":"cf-c6","reprise":false}]}]
reset role;
update public.photo_uploads set purge_started_at = now() - interval '2 hours' where key in ('cf-a1', 'cf-a3', 'cf-a4');
insert into public.photo_uploads (key, owner_id, created_at) values
  ('cf-c5', '00000000-0000-0000-0000-00000000000c', now() - interval '8 days'),
  ('cf-c6', '00000000-0000-0000-0000-00000000000c', now() - interval '8 days');
set role service_role;
create temp table shared_first as select * from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001', 2);
create temp table shared_second as select * from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001', 4);
reset role;
select (select json_agg(json_build_object('cle', file_key, 'reprise', retry) order by file_key) from shared_first) as premier,
       (select json_agg(json_build_object('cle', file_key, 'reprise', retry) order by file_key) from shared_second) as second;

-- @step [ok] un lot compte de 1 à 1 000 fichiers : zéro, mille un et null sont refusés
reset role;
set role service_role;
do $$
declare
  bad integer;
begin
  foreach bad in array array[0, 1001, null]::integer[] loop
    begin
      perform public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001', bad);
      raise exception 'un lot de % fichiers est accepté', coalesce(bad::text, 'null');
    exception when invalid_parameter_value then
      null;
    end;
  end loop;
end $$;
reset role;

-- @step [ok] une session réglée sur un autre niveau d'isolement que read committed
-- @expect [{"default_transaction_isolation":"repeatable read"}]
reset role;
set session characteristics as transaction isolation level repeatable read;
show default_transaction_isolation;

-- @step [refus] le ménage ne tourne qu'en read committed : sous un instantané figé, la relecture sous verrou ne verrait pas une photo accrochée entre-temps
-- @error read committed
reset role;
set role service_role;
select * from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001');

-- @step [ok] la session revient au niveau read committed
-- @expect [{"default_transaction_isolation":"read committed"}]
reset role;
set session characteristics as transaction isolation level read committed;
show default_transaction_isolation;

-- @step [ok] le webhook accroche un fichier du vendeur ; décroché depuis deux heures, ce fichier vieux de deux mois n'est pas pris : le délai part du retrait, pas du dépôt
-- @expect [{"pris":0,"decroche":true}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.photo_uploads (key, owner_id, created_at) values ('cf-c4', '00000000-0000-0000-0000-00000000000c', now() - interval '60 days');
insert into public.listing_photos (listing_id, storage_path, position) values ('10000000-0000-0000-0000-0000000000c2', 'cf-c4', 0);
delete from public.listing_photos where storage_path = 'cf-c4';
update public.photo_uploads set detached_at = now() - interval '2 hours' where key = 'cf-c4';
create temp table purge_old as select * from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001');
reset role;
select (select count(*) from purge_old) as pris,
       (select detached_at is not null from public.photo_uploads where key = 'cf-c4') as decroche;

-- @step [ok] retirer une photo date son fichier ; l'accrocher de nouveau efface la date
-- @expect [{"apres_retrait":true,"apres_retour":false}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
delete from public.listing_photos where storage_path = 'cf-c2';
reset role;
create temp table detach_probe as select detached_at is not null as apres_retrait from public.photo_uploads where key = 'cf-c2';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
insert into public.listing_photos (listing_id, storage_path, position) values ('10000000-0000-0000-0000-0000000000c1', 'cf-c2', 1);
reset role;
select d.apres_retrait, u.detached_at is not null as apres_retour
  from detach_probe d, public.photo_uploads u where u.key = 'cf-c2';

-- @step [ok] Cloudflare rend un autre identifiant au changement de visibilité : la clé suit dans la seule photo qui l'affiche
-- @expect [{"storage_path":"cf-c2-prive","position":1,"cle_retiree":false}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.photo_uploads set key = 'cf-c2-prive' where key = 'cf-c2';
reset role;
select p.storage_path, p.position, exists (select 1 from public.photo_uploads where key = 'cf-c2') as cle_retiree
  from public.listing_photos p where p.storage_path like 'cf-c2%';

-- @step [refus] un second passage ne prend rien tant que le premier tient le bail : deux passages doubleraient le débit envoyé à Cloudflare
-- @error un autre passage du ménage est en cours
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
select * from public.claim_photo_purge('bbbbbbbb-0000-4000-8000-000000000002');

-- @step [ok] un bail échu se reprend : un passage tué ne retient le ménage que jusqu'à l'échéance
-- @expect [{"tenu_par_b":true}]
reset role;
update public.photo_purge_lease set expires_at = now() - interval '1 second';
set role service_role;
select count(*) from public.claim_photo_purge('bbbbbbbb-0000-4000-8000-000000000002');
reset role;
select run_id = 'bbbbbbbb-0000-4000-8000-000000000002' as tenu_par_b from public.photo_purge_lease;

-- @step [ok] la fin d'un passage rend son bail, et seulement le sien
-- @expect [{"apres_a":1,"apres_b":0}]
reset role;
set role service_role;
select public.release_photo_purge('aaaaaaaa-0000-4000-8000-000000000001');
create temp table lease_after_a as select count(*) as baux from public.photo_purge_lease;
select public.release_photo_purge('bbbbbbbb-0000-4000-8000-000000000002');
reset role;
select (select baux from lease_after_a) as apres_a, (select count(*) from public.photo_purge_lease) as apres_b;

-- @step [refus] un compte connecté ne lit pas le bail du ménage
-- @error permission denied for table photo_purge_lease
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select * from public.photo_purge_lease;

-- @step [refus] un compte connecté ne rend pas le bail d'un passage
-- @error permission denied for function release_photo_purge
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select public.release_photo_purge('aaaaaaaa-0000-4000-8000-000000000001');

-- @step [refus] un compte connecté ne lance pas le ménage
-- @error permission denied for function claim_photo_purge
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select * from public.claim_photo_purge('aaaaaaaa-0000-4000-8000-000000000001');

-- @step [refus] un compte connecté n'efface pas le registre
-- @error permission denied for function forget_purged_photos
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
select public.forget_purged_photos(array['cf-c3']);

-- @step [ok] Cloudflare a retiré les fichiers pris : le serveur efface leurs lignes en un appel, et seulement celles-là
-- @expect [{"lignes":7,"restent":["cf-c1","cf-c2-prive","cf-c4"]}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
create temp table forgotten as
  select public.forget_purged_photos(array['cf-a1', 'cf-a2', 'cf-a3', 'cf-a4', 'cf-c3', 'cf-c5', 'cf-c6', 'cf-c1', 'cf-c4']) as lignes;
reset role;
select (select lignes from forgotten) as lignes,
       (select array_agg(key order by key) from public.photo_uploads) as restent;
