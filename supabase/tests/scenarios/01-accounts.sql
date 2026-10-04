-- Comptes : l'inscription crée le profil et les réglages, dans une commune
-- connue ; les réglages ne se lisent et ne se modifient que par leur
-- titulaire. Pose Alice (a, la vendeuse), Bob (b), Carla (c) et Dora (d),
-- que tous les fichiers suivants reprennent.

-- @step [ok] inscription : profil et réglages naissent avec le compte
-- @expect [{"profiles":4,"settings":4}]
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', '{"username":"alice","city":"Avignon","postal_code":"84000"}'),
  ('00000000-0000-0000-0000-00000000000b', '{"username":"bob","city":"Orange","postal_code":"84100"}'),
  ('00000000-0000-0000-0000-00000000000c', '{"username":"carla","city":"Nîmes","postal_code":"30000"}'),
  ('00000000-0000-0000-0000-00000000000d', '{"username":"dora","city":"Arles","postal_code":"13200"}');
select (select count(*) from public.profiles) as profiles, (select count(*) from public.account_settings) as settings;

-- @step [refus] inscription dans une commune inconnue
-- @error profiles_commune_fkey
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000e', '{"username":"eve","city":"Atlantis","postal_code":"99999"}');

-- @step [ok] réglages : lus et modifiés par leur titulaire seul
-- @expect [{"visibles":1,"alertes":false}]
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
update public.account_settings set alert_messages = false;
select count(*) as visibles, bool_and(alert_messages) as alertes from public.account_settings;
reset role;

-- @step [refus] réglages créés depuis le navigateur
-- @error permission denied for table account_settings
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
set role authenticated;
insert into public.account_settings (user_id) values ('00000000-0000-0000-0000-00000000000b');
