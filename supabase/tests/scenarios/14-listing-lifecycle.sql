-- Le cycle de vie d'une annonce (migration 15) : elle quitte le marché
-- quatre-vingt-dix jours après le dernier geste de son vendeur, qui seul la
-- prolonge ; expirée, elle ne reçoit plus ni conversation ni inscription, et
-- ne se compte plus dans l'espace pro ; la tâche quotidienne prévient le
-- vendeur une fois par mise en ligne, puis retire les photos d'une annonce
-- archivée — trente jours après sa vente, vente clôturée comprise —, sauf si
-- un signalement ouvert la vise. Pose ses propres comptes : Mona (f1, la
-- vendeuse) et Nino (f2, qui achète). La clé de service n'a pas d'identité :
-- chaque écriture faite en son nom efface d'abord celle de la session, sans
-- quoi elle passerait pour un geste de Mona et relancerait l'annonce.

-- @step [ok] comptes et annonces : une expirée, une qui expire dans trois jours, une neuve, trois à vendre, deux réservées aux pros
-- @expect [{"en_ligne":["f0000000-0000-4000-8000-000000000002","f0000000-0000-4000-8000-000000000003","f0000000-0000-4000-8000-000000000004","f0000000-0000-4000-8000-000000000005","f0000000-0000-4000-8000-000000000006","f0000000-0000-4000-8000-000000000008"]}]
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', '{"username":"mona","city":"Avignon","postal_code":"84000"}'),
  ('00000000-0000-0000-0000-0000000000f2', '{"username":"nino","city":"Orange","postal_code":"84100"}');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude, audience, created_at, renewed_at)
values
  ('f0000000-0000-4000-8000-000000000001', 'vrac-expire-f0000001', '00000000-0000-0000-0000-0000000000f1', 'pokemon', 'Vrac Pokémon jamais prolongé', repeat('description ', 5), 'bulk', 'mixed', 'VF', 1500, 'Avignon', '84000', '84', 0, 0, 'everyone', now() - interval '100 days', now() - interval '100 days'),
  ('f0000000-0000-4000-8000-000000000002', 'vrac-bientot-f0000002', '00000000-0000-0000-0000-0000000000f1', 'pokemon', 'Vrac Pokémon qui expire bientôt', repeat('description ', 5), 'bulk', 'mixed', 'VF', 1500, 'Avignon', '84000', '84', 0, 0, 'everyone', now() - interval '87 days', now() - interval '87 days'),
  ('f0000000-0000-4000-8000-000000000003', 'vrac-neuf-f0000003', '00000000-0000-0000-0000-0000000000f1', 'pokemon', 'Vrac Pokémon déposé ce matin', repeat('description ', 5), 'bulk', 'mixed', 'VF', 1500, 'Avignon', '84000', '84', 0, 0, 'everyone', now(), now()),
  ('f0000000-0000-4000-8000-000000000004', 'classeur-vendu-f0000004', '00000000-0000-0000-0000-0000000000f1', 'magic', 'Classeur Magic bientôt vendu', repeat('description ', 5), 'binder', 'EX', 'EN', 3000, 'Avignon', '84000', '84', 0, 0, 'everyone', now() - interval '50 days', now() - interval '50 days'),
  ('f0000000-0000-4000-8000-000000000005', 'classeur-signale-f0000005', '00000000-0000-0000-0000-0000000000f1', 'magic', 'Classeur Magic signalé', repeat('description ', 5), 'binder', 'EX', 'EN', 3000, 'Avignon', '84000', '84', 0, 0, 'everyone', now() - interval '50 days', now() - interval '50 days'),
  ('f0000000-0000-4000-8000-000000000006', 'classeur-recent-f0000006', '00000000-0000-0000-0000-0000000000f1', 'magic', 'Classeur Magic vendu récemment', repeat('description ', 5), 'binder', 'EX', 'EN', 3000, 'Avignon', '84000', '84', 0, 0, 'everyone', now() - interval '20 days', now() - interval '20 days'),
  ('f0000000-0000-4000-8000-000000000007', 'succession-expiree-f0000007', '00000000-0000-0000-0000-0000000000f1', 'naruto', 'Succession Naruto expirée', repeat('description ', 5), 'mixed', 'mixed', 'VF', 9000, 'Avignon', '84000', '84', 0, 0, 'pros', now() - interval '95 days', now() - interval '95 days'),
  ('f0000000-0000-4000-8000-000000000008', 'succession-en-ligne-f0000008', '00000000-0000-0000-0000-0000000000f1', 'naruto', 'Succession Naruto en ligne', repeat('description ', 5), 'mixed', 'mixed', 'VF', 9000, 'Avignon', '84000', '84', 0, 0, 'pros', now(), now());
reset role;
select array_agg(l.id order by l.id) as en_ligne from public.listings l
 where l.seller_id = '00000000-0000-0000-0000-0000000000f1' and public.listing_on_market(l);

-- @step [ok] chaque annonce sort quatre-vingt-dix jours après le dernier geste de son vendeur, et seule une vente ou une expiration de plus de trente jours l'archive
-- @expect [{"echeance":true,"archivee":false}]
reset role;
select (select public.listing_expires_at(l) = l.renewed_at + interval '90 days' from public.listings l where l.id = 'f0000000-0000-4000-8000-000000000002') as echeance,
       (select public.listing_archived(l) from public.listings l where l.id = 'f0000000-0000-4000-8000-000000000001') as archivee;

-- @step [refus] une conversation ne s'ouvre pas sur un lot expiré
-- @error row-level security policy for table "conversations"
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
set role authenticated;
select public.open_conversation('f0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', 'Toujours disponible ?');

-- @step [refus] un autre que son vendeur ne la prolonge pas
-- @error annonce introuvable
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
set role authenticated;
select public.renew_listing('f0000000-0000-4000-8000-000000000001');

-- @step [refus] son vendeur ne repousse pas l'échéance lui-même depuis la console
-- @error permission denied for table listings
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
set role authenticated;
update public.listings set renewed_at = now() + interval '10 years' where id = 'f0000000-0000-4000-8000-000000000001';

-- @step [ok] son vendeur la remet en ligne d'un clic : quatre-vingt-dix jours de plus, à compter d'aujourd'hui
-- @expect [{"en_ligne":true,"echeance_rendue":true}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
set role authenticated;
create temp table renewal as select public.renew_listing('f0000000-0000-4000-8000-000000000001') as expires_at;
reset role;
select (select public.listing_on_market(l) from public.listings l where l.id = 'f0000000-0000-4000-8000-000000000001') as en_ligne,
       (select expires_at between now() + interval '89 days' and now() + interval '91 days' from renewal) as echeance_rendue;

-- @step [ok] une annonce expirée se prolonge, une vendue non : elle n'expire jamais
-- @expect [{"vendue_prolongee":false}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.listings set status = 'sold', sold_at = now() where id = 'f0000000-0000-4000-8000-000000000006';
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
set role authenticated;
do $$ begin
  perform public.renew_listing('f0000000-0000-4000-8000-000000000006');
  raise exception 'une annonce vendue a été prolongée';
exception when sqlstate 'P0002' then null;
end $$;
reset role;
select false as vendue_prolongee;

-- @step [ok] tout geste du vendeur la relance, pas une vue comptée par le serveur
-- @expect [{"reservee_relancee":true,"vue_relancee":false}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.listings set renewed_at = now() - interval '60 days' where id in ('f0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000008');
select public.record_listing_view('f0000000-0000-4000-8000-000000000008');
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
set role authenticated;
update public.listings set status = 'reserved' where id = 'f0000000-0000-4000-8000-000000000003';
reset role;
select (select renewed_at > now() - interval '1 minute' from public.listings where id = 'f0000000-0000-4000-8000-000000000003') as reservee_relancee,
       (select renewed_at > now() - interval '1 minute' from public.listings where id = 'f0000000-0000-4000-8000-000000000008') as vue_relancee;

-- @step [refus] la tâche quotidienne ne se lance qu'avec la clé de service
-- @error permission denied for function run_listing_lifecycle
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
set role authenticated;
select * from public.run_listing_lifecycle();

-- @step [ok] la tâche prévient une fois le vendeur d'une annonce qui expire dans sept jours au plus, même lancée deux fois
-- @expect [{"prevenue":["f0000000-0000-4000-8000-000000000002"],"une_fois":1}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
select * from public.run_listing_lifecycle();
select * from public.run_listing_lifecycle();
reset role;
select array_agg(distinct listing_id) as prevenue, count(*) as une_fois from public.notifications
 where kind = 'listing_expiring' and user_id = '00000000-0000-0000-0000-0000000000f1';

-- @step [ok] prolongée, elle n'est plus prévenue, jusqu'à sa prochaine échéance
-- @expect [{"avertissements":1}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
set role authenticated;
select public.renew_listing('f0000000-0000-4000-8000-000000000002');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
select * from public.run_listing_lifecycle();
reset role;
select count(*) as avertissements from public.notifications where kind = 'listing_expiring' and user_id = '00000000-0000-0000-0000-0000000000f1';

-- @step [refus] une notification d'échéance sans son annonce
-- @error notifications_listing_expiring_subject
reset role;
insert into public.notifications (user_id, kind) values ('00000000-0000-0000-0000-0000000000f1', 'listing_expiring');

-- @step [ok] l'espace pro ne compte que les lots en ligne : la succession expirée n'y est plus
-- @expect [{"naruto":1}]
reset role;
select listing_count as naruto from public.pro_only_count_by_game() where game_id = 'naruto';

-- @step [ok] des photos à archiver : la vente clôturée avec Nino, une vente signalée, une vente récente
-- @expect [{"photos":4,"vente_close":true}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
insert into public.photo_uploads (key, owner_id) values
  ('cf-f1', '00000000-0000-0000-0000-0000000000f1'), ('cf-f2', '00000000-0000-0000-0000-0000000000f1'),
  ('cf-f3', '00000000-0000-0000-0000-0000000000f1'), ('cf-f4', '00000000-0000-0000-0000-0000000000f1');
insert into public.listing_photos (listing_id, storage_path, position) values
  ('f0000000-0000-4000-8000-000000000004', 'cf-f1', 0), ('f0000000-0000-4000-8000-000000000004', 'cf-f2', 1),
  ('f0000000-0000-4000-8000-000000000005', 'cf-f3', 0), ('f0000000-0000-4000-8000-000000000006', 'cf-f4', 0);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
set role authenticated;
create temp table thread as select public.open_conversation('f0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', 'Je le prends samedi.') as id;
insert into public.reports (reporter_id, target_type, target_id, reason) values ('00000000-0000-0000-0000-0000000000f2', 'listing', 'f0000000-0000-4000-8000-000000000005', 'misleading');
reset role;
grant select on thread to authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', false);
set role authenticated;
select public.close_deal((select id from thread), 'sale');
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.listings set sold_at = now() - interval '40 days' where id = 'f0000000-0000-4000-8000-000000000004';
update public.listings set status = 'sold', sold_at = now() - interval '40 days' where id = 'f0000000-0000-4000-8000-000000000005';
reset role;
select (select count(*) from public.listing_photos where storage_path like 'cf-f%') as photos,
       exists (select 1 from public.deals where listing_id = 'f0000000-0000-4000-8000-000000000004') as vente_close;

-- @step [refus] avant l'archivage, une vente clôturée garde ses photos : son vendeur n'en retire aucune
-- @error vente clôturée
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.listings set sold_at = now() - interval '10 days' where id = 'f0000000-0000-4000-8000-000000000004';
delete from public.listing_photos where storage_path = 'cf-f1';

-- @step [ok] trente jours après la vente, la tâche retire les photos — vente clôturée comprise —, sauf celles d'une annonce signalée ; le registre date leur décrochage
-- @expect [{"archivees":1,"retirees":2,"restantes":["cf-f3","cf-f4"],"decrochees":["cf-f1","cf-f2"]}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.listings set sold_at = now() - interval '40 days' where id = 'f0000000-0000-4000-8000-000000000004';
create temp table archived as select * from public.run_listing_lifecycle();
reset role;
select (select archived_listings from archived) as archivees,
       (select removed_photos from archived) as retirees,
       (select array_agg(storage_path order by storage_path) from public.listing_photos where storage_path like 'cf-f%') as restantes,
       (select array_agg(key order by key) from public.photo_uploads where key like 'cf-f%' and detached_at is not null) as decrochees;

-- @step [ok] la décision rendue, l'annonce signalée est archivée à son tour ; ses textes et sa vente restent
-- @expect [{"retirees":1,"annonces":2,"vente":1}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.reports set resolved_at = now() where target_id = 'f0000000-0000-4000-8000-000000000005';
create temp table released as select * from public.run_listing_lifecycle();
reset role;
select (select removed_photos from released) as retirees,
       (select count(*) from public.listings where id in ('f0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000005')) as annonces,
       (select count(*) from public.deals where listing_id = 'f0000000-0000-4000-8000-000000000004') as vente;

-- @step [ok] témoin : en ligne, le même lot réservé ouvre sa liste d'attente
-- @expect [{"inscrits":1}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
set role authenticated;
insert into public.listing_waitlist (listing_id, user_id) values ('f0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-0000000000f2');
reset role;
select count(*) as inscrits from public.listing_waitlist where listing_id = 'f0000000-0000-4000-8000-000000000003';

-- @step [ok] témoin retiré : Nino se désinscrit
-- @expect [{"inscrits":0}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
set role authenticated;
delete from public.listing_waitlist where listing_id = 'f0000000-0000-4000-8000-000000000003';
reset role;
select count(*) as inscrits from public.listing_waitlist where listing_id = 'f0000000-0000-4000-8000-000000000003';

-- @step [refus] la liste d'attente ne s'ouvre pas sur un lot réservé expiré
-- @error row-level security policy for table "listing_waitlist"
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.listings set renewed_at = now() - interval '100 days' where id = 'f0000000-0000-4000-8000-000000000003';
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', false);
set role authenticated;
insert into public.listing_waitlist (listing_id, user_id) values ('f0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-0000000000f2');
