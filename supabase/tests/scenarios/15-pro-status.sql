-- Le statut professionnel (migration 16) : il ne s'écrit qu'avec la clé de
-- service, après la vérification du SIRET par le serveur ; un SIRET ne sert
-- qu'un compte ; une boutique déclare elle-même ses pages Cardmarket et
-- CardNexus, un particulier non ; le forfait suppose le statut ; et l'on
-- repasse en particulier soi-même, jamais avec un forfait en cours. Pose
-- ses propres comptes : Paul (g1) et Rita (g2). La clé de service n'a pas
-- d'identité : chaque écriture faite en son nom efface celle de la session.

-- @step [ok] deux particuliers
-- @expect [{"particuliers":2}]
insert into auth.users (id, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', '{"username":"paul","city":"Avignon","postal_code":"84000"}'),
  ('00000000-0000-0000-0000-0000000000a2', '{"username":"rita","city":"Orange","postal_code":"84100"}');
select count(*) as particuliers from public.profiles where username in ('paul', 'rita') and account_type = 'individual';

-- @step [refus] un compte ne se déclare pas professionnel depuis la console
-- @error permission denied for table profiles
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
update public.profiles set account_type = 'pro', company_name = 'Chez Paul', siret = '55203253400703' where id = auth.uid();

-- @step [ok] le serveur écrit le statut vérifié, avec la clé de service
-- @expect [{"account_type":"pro","company_name":"Chez Paul","legal_name":"DANONE","verifie":true}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.profiles
   set account_type = 'pro', company_name = 'Chez Paul', siret = '55203253400703', legal_name = 'DANONE', pro_verified_at = now()
 where id = '00000000-0000-0000-0000-0000000000a1';
reset role;
select account_type, company_name, legal_name, pro_verified_at is not null as verifie from public.profiles where username = 'paul';

-- @step [refus] un second compte ne prend pas le SIRET d'une boutique déjà inscrite
-- @error profiles_one_account_per_siret
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.profiles set account_type = 'pro', company_name = 'Fausse boutique', siret = '55203253400703'
 where id = '00000000-0000-0000-0000-0000000000a2';

-- @step [ok] la boutique déclare sa page Cardmarket
-- @expect [{"cardmarket_url":"https://www.cardmarket.com/fr/Magic/Users/ChezPaul"}]
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
update public.profiles set cardmarket_url = 'https://www.cardmarket.com/fr/Magic/Users/ChezPaul' where id = auth.uid();
reset role;
select cardmarket_url from public.profiles where username = 'paul';

-- @step [refus] une adresse qui n'est pas une page vendeur Cardmarket
-- @error profiles_cardmarket_url_check
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
update public.profiles set cardmarket_url = 'https://cardmarket.example/Users/ChezPaul' where id = auth.uid();

-- @step [refus] un particulier n'affiche pas de page de vendeur
-- @error profiles_pro_details_only_for_pros
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
set role authenticated;
update public.profiles set cardnexus_url = 'https://cardnexus.com/u/rita' where id = auth.uid();

-- @step [refus] le forfait ne se vend pas à un compte de particulier
-- @error profiles_plan_needs_pro
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.profiles set pro_until = now() + interval '30 days' where id = '00000000-0000-0000-0000-0000000000a2';

-- @step [refus] une boutique au forfait en cours ne repasse pas en particulier
-- @error le forfait pro court
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.profiles set pro_until = now() + interval '30 days' where id = '00000000-0000-0000-0000-0000000000a1';
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select public.leave_pro_status();

-- @step [ok] forfait échu, elle repasse en particulier : statut, enseigne, fiche et liens partent ensemble, et son SIRET se libère
-- @expect [{"account_type":"individual","company_name":null,"siret":null,"cardmarket_url":null,"pro_until":null}]
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role service_role;
update public.profiles set pro_until = now() - interval '1 day' where id = '00000000-0000-0000-0000-0000000000a1';
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select public.leave_pro_status();
reset role;
select account_type, company_name, siret, cardmarket_url, pro_until from public.profiles where username = 'paul';

-- @step [refus] un particulier n'a pas de statut à quitter
-- @error compte professionnel introuvable
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', false);
set role authenticated;
select public.leave_pro_status();
