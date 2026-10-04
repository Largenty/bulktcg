-- Migration 16 : le statut professionnel, séparé du forfait.
--
-- Une boutique devient professionnelle en déclarant son SIRET dans
-- Paramètres : le serveur le vérifie auprès du répertoire des entreprises
-- (src/lib/company-registry.ts), puis écrit le statut avec la clé de service
-- — account_type, siret, legal_name et pro_verified_at restent hors des
-- droits du rôle connecté. Le statut est gratuit et porte le badge PRO,
-- l'enseigne et la fiche boutique : un acheteur doit savoir qu'il traite avec
-- un professionnel (Code de la consommation, L111-7), forfait ou non. Le
-- forfait (pro_until), payant, n'ouvre plus que les lots réservés aux pros
-- (is_active_pro, inchangée), et suppose le statut.
--
-- Les comptes pro déjà en base le restent, sans SIRET vérifié : leur fiche
-- dit « — », comme avant.

alter table public.profiles
  -- La raison sociale du répertoire, null quand il la masque, et la date de
  -- la vérification du SIRET.
  add column legal_name text check (legal_name is null or char_length(legal_name) between 1 and 200),
  add column pro_verified_at timestamptz,
  -- Ses profils de vendeur ailleurs, déclarés par la boutique et affichés
  -- comme tels : rien ne prouve qu'ils sont les siens. Cardmarket : l'adresse
  -- de sa page vendeur, telle que le navigateur la montre.
  add column cardmarket_url text check (
    cardmarket_url is null
    or (cardmarket_url ~ '^https://www\.cardmarket\.com/[a-z]{2}/[A-Za-z]+/Users/[A-Za-z0-9_.-]+$' and char_length(cardmarket_url) <= 200)
  ),
  add column cardnexus_url text check (
    cardnexus_url is null or (cardnexus_url ~ '^https://(www\.)?cardnexus\.com/\S+$' and char_length(cardnexus_url) <= 200)
  ),
  add constraint profiles_pro_details_only_for_pros check (
    account_type = 'pro' or (legal_name is null and pro_verified_at is null and cardmarket_url is null and cardnexus_url is null)
  ),
  -- Le forfait suppose le statut : le service de paiement ne vend pas
  -- l'espace pro à un compte de particulier.
  add constraint profiles_plan_needs_pro check (pro_until is null or account_type = 'pro');

-- Un SIRET ne sert qu'un compte : un second compte qui le déclarerait se
-- ferait passer pour la boutique. La vraie boutique, refusée, le signale.
create unique index profiles_one_account_per_siret on public.profiles (siret) where siret is not null;

-- La boutique renseigne elle-même ses profils de places de marché, comme
-- son adresse et ses horaires ; la contrainte ci-dessus les refuse à un
-- particulier.
grant update (cardmarket_url, cardnexus_url) on public.profiles to authenticated;

-- Repasser en compte particulier : une déclaration faite par erreur, une
-- activité arrêtée. Le compte seul, sur lui-même, et jamais avec un forfait
-- en cours — il le paie pour voir les lots réservés. Le statut, l'enseigne,
-- la fiche boutique et ses liens partent ensemble, et un forfait échu avec
-- eux. security definer : account_type n'est dans les droits de personne.
create or replace function public.leave_pro_status() returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles%rowtype;
begin
  select * into me from public.profiles where id = auth.uid() for update;
  if not found or me.account_type <> 'pro' then
    raise exception 'compte professionnel introuvable' using errcode = 'P0002';
  end if;
  if me.pro_until is not null and me.pro_until > now() then
    raise exception 'le forfait pro court jusqu''au % : résiliez-le d''abord', me.pro_until using errcode = '23514';
  end if;
  update public.profiles
     set account_type = 'individual', company_name = null, siret = null, legal_name = null, pro_verified_at = null,
         shop_address = null, shop_hours = null, shop_website = null, cardmarket_url = null, cardnexus_url = null,
         pro_until = null
   where id = me.id;
end;
$$;

revoke execute on function public.leave_pro_status() from public, anon;
grant execute on function public.leave_pro_status() to authenticated;
