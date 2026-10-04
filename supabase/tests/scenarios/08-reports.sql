-- Signalements : sur ce qu'on peut lire, jamais sur soi-même, et jamais déjà
-- traités — la modération seule les clôt.

-- @step [refus] se signaler soi-même
-- @error on ne se signale pas soi-même
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into public.reports (reporter_id, target_type, target_id, reason) values ('00000000-0000-0000-0000-00000000000a', 'listing', '10000000-0000-0000-0000-000000000002', 'scam');

-- @step [refus] signaler un lot réservé aux pros qu'on ne peut pas lire
-- @error cible du signalement introuvable
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
insert into public.reports (reporter_id, target_type, target_id, reason) values ('00000000-0000-0000-0000-00000000000c', 'listing', '10000000-0000-0000-0000-000000000003', 'scam');

-- @step [refus] signaler la conversation des autres
-- @error cible du signalement introuvable
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
insert into public.reports (reporter_id, target_type, target_id, reason) values ('00000000-0000-0000-0000-00000000000c', 'conversation', '20000000-0000-0000-0000-000000000001', 'harassment');

-- @step [refus] un signalement déposé déjà traité
-- @error permission denied for table reports
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
insert into public.reports (reporter_id, target_type, target_id, reason, resolved_at) values ('00000000-0000-0000-0000-00000000000c', 'listing', '10000000-0000-0000-0000-000000000002', 'scam', now());

-- @step [ok] signaler l'annonce d'un autre
-- @expect [{"signalements":1}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
set role authenticated;
insert into public.reports (reporter_id, target_type, target_id, reason, details) values ('00000000-0000-0000-0000-00000000000c', 'listing', '10000000-0000-0000-0000-000000000002', 'misleading', 'Photos d''un autre lot');
reset role;
select count(*) as signalements from public.reports;
