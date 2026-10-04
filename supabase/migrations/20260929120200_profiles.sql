-- BulkTCG — migration 3 sur 10 : les profils et leurs réglages.

-- ---------------------------------------------------------------------
-- Profils : un par compte d'authentification.
-- ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,24}$'),
  city text not null,
  postal_code text not null check (postal_code ~ '^\d{5}$'),
  avatar_initials text not null,
  bio text check (bio is null or char_length(bio) <= 280),
  -- Dénormalisés par déclencheur : null tant qu'aucun avis n'existe, jamais 0.
  rating_avg numeric(2, 1) check (rating_avg is null or rating_avg between 1 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  -- La note critère par critère, dénormalisée par le même déclencheur :
  -- rating_avg en est la moyenne.
  punctuality_avg numeric(2, 1) check (punctuality_avg is null or punctuality_avg between 1 and 5),
  responsiveness_avg numeric(2, 1) check (responsiveness_avg is null or responsiveness_avg between 1 and 5),
  reliability_avg numeric(2, 1) check (reliability_avg is null or reliability_avg between 1 and 5),
  -- L'historique du compte, tenu par count_sale (migration 7). Ce n'est pas
  -- un décompte des annonces : une annonce vendue puis supprimée reste une
  -- vente, et l'écart avec la liste affichée est écrit en clair.
  sold_listing_count integer not null default 0 check (sold_listing_count >= 0),
  account_type public.account_type not null default 'individual',
  -- Nom de la boutique, affiché à côté du pseudo. Présent si et seulement si
  -- le compte est pro.
  company_name text check (company_name is null or char_length(company_name) between 2 and 80),
  -- La fiche boutique d'un pro, publique tant que le forfait court. Le SIRET
  -- est vérifié à la souscription et écrit par le service de paiement ;
  -- l'adresse, les horaires et le site sont renseignés par la boutique.
  siret text check (siret is null or siret ~ '^\d{14}$'),
  shop_address text check (shop_address is null or char_length(shop_address) between 5 and 160),
  shop_hours text check (shop_hours is null or char_length(shop_hours) between 3 and 160),
  shop_website text check (shop_website is null or (shop_website ~ '^https://\S+$' and char_length(shop_website) <= 200)),
  -- Fin de la période payée, écrite par le service de paiement. C'est la date
  -- qui ouvre les annonces réservées, pas le type de compte : un forfait
  -- expiré ne voit plus rien de plus qu'un particulier.
  pro_until timestamptz,
  created_at timestamptz not null default now(),
  constraint profiles_company_matches_type check ((account_type = 'pro') = (company_name is not null)),
  -- Un particulier n'a pas de fiche boutique.
  constraint profiles_shop_only_for_pros check (account_type = 'pro' or coalesce(siret, shop_address, shop_hours, shop_website) is null),
  -- La commune du profil existe, comme celle d'une annonce : le formulaire
  -- de profil la refuse sinon (src/lib/schemas/profile-form.ts).
  constraint profiles_commune_fkey foreign key (city, postal_code) references public.communes (name, postal_code)
);

-- À l'inscription par e-mail, le formulaire envoie pseudo et commune dans
-- les métadonnées : le profil naît avec le compte. Une inscription Google
-- n'a pas de pseudo — le profil se complète alors au premier passage, avant
-- tout dépôt (voir supabase/README.md).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data ? 'username' then
    insert into public.profiles (id, username, city, postal_code, avatar_initials)
    values (
      new.id,
      new.raw_user_meta_data ->> 'username',
      new.raw_user_meta_data ->> 'city',
      new.raw_user_meta_data ->> 'postal_code',
      upper(left(regexp_replace(new.raw_user_meta_data ->> 'username', '[^a-z0-9]', '', 'g'), 2))
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Réglages du compte : les alertes de /mon-compte/parametres, « Me prévenir
-- quand un croisement tombe » et « Me prévenir d'un nouveau message ». Ils
-- ne vivent pas sur le profil parce que le profil se lit en entier par
-- n'importe qui, et que ces réglages ne regardent que leur titulaire (« Rien
-- de ce qui est ici n'apparaît sur vos annonces »). Cochés par défaut, comme
-- dans le formulaire ; le service d'envoi d'e-mails les lit avec la clé de
-- service.
-- ---------------------------------------------------------------------

create table public.account_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  alert_matches boolean not null default true,
  alert_messages boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger account_settings_updated_at before update on public.account_settings
  for each row execute function public.set_updated_at();

-- Les réglages naissent avec le profil, quel que soit le chemin : le
-- déclencheur d'inscription, ou le profil complété après une connexion
-- Google. Personne n'a donc à les créer depuis le navigateur.
create or replace function public.create_account_settings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.account_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return null;
end;
$$;

create trigger profiles_create_settings after insert on public.profiles
  for each row execute function public.create_account_settings();
