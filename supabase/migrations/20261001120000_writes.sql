-- BulkTCG — migration 11 : les écritures de la phase 2 qui demandent plus
-- qu'un insert. Une annonce se dépose et se modifie avec ses séries et ses
-- produits d'un seul bloc ; une conversation s'ouvre avec son premier
-- message ; l'identifiant tiré à l'affichage du formulaire rend un double
-- envoi inoffensif. Et ce que le navigateur peut maintenant écrire de plus —
-- l'identifiant, donc le lien — la base le tient : un lien permanent ne
-- désigne jamais une autre annonce, une annonce naît disponible, sa baisse de
-- prix est la vraie, et un croisement ne se notifie qu'une fois.
--
-- Les dix premières migrations sont appliquées au projet : celle-ci s'y
-- ajoute seule, collée telle quelle dans l'éditeur SQL.

-- ---------------------------------------------------------------------
-- Un double envoi ne crée pas deux annonces.
-- ---------------------------------------------------------------------

-- L'identifiant d'une annonce ou d'une demande est tiré quand la page du
-- formulaire s'affiche, et part dans un champ caché : un envoi répété —
-- réseau lent, nouvel essai après un délai — retombe sur la même ligne
-- (on conflict (id) do nothing) au lieu d'en créer une seconde. La clé
-- primaire et la RLS font le reste : un identifiant déjà pris par un autre
-- compte ne lui prend rien.
grant insert (id) on public.listings to authenticated;
grant insert (id) on public.wanted_listings to authenticated;

-- ---------------------------------------------------------------------
-- Un lien permanent ne désigne jamais une autre annonce.
-- ---------------------------------------------------------------------

-- Le lien finit par les huit premiers caractères de l'identifiant
-- (idSlugSuffix, src/lib/slug.ts), et un lien qui a servi ne ressert plus :
-- sans cela, l'annonce supprimée, un autre vendeur reprenait son lien exact —
-- et son identifiant, qu'il peut maintenant choisir —, et le lien partagé
-- dans un groupe montrait son annonce à lui. Les liens retirés sont gardés
-- ici, par sorte : une annonce et une demande peuvent porter le même.
create table public.retired_slugs (
  kind text not null check (kind in ('listing', 'wanted')),
  slug text not null,
  retired_at timestamptz not null default now(),
  primary key (kind, slug)
);

-- La table ne se lit que par cette question : un lien a-t-il déjà servi ?
create or replace function public.is_retired_slug(slug_kind text, candidate text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.retired_slugs r where r.kind = slug_kind and r.slug = candidate);
$$;

-- La règle tient le navigateur, qui choisit l'identifiant comme le lien —
-- directement, ou par create_listing, qui s'exécute sous ses droits. Le
-- serveur (clé de service, données de démonstration) choisit les siens. Un
-- lien mal formé est laissé à la contrainte de la colonne, qui le refuse
-- sous son nom.
create or replace function public.check_permalink() returns trigger
language plpgsql set search_path = public as $$
declare
  slug_kind text := case tg_table_name when 'listings' then 'listing' else 'wanted' end;
begin
  if current_user <> 'authenticated' or new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    return new;
  end if;
  if new.slug !~ ('(^|-)' || left(replace(new.id::text, '-', ''), 8) || '$') then
    raise exception 'le lien % ne finit pas par l''identifiant de la ligne', new.slug using errcode = '23514';
  end if;
  if public.is_retired_slug(slug_kind, new.slug) then
    raise exception 'le lien % a déjà servi : il ne désignera pas une autre annonce', new.slug using errcode = '23505';
  end if;
  return new;
end;
$$;

-- Une annonce ou une demande qui part — supprimée, ou avec son compte —
-- laisse son lien ici. security definer : le vendeur qui supprime n'écrit
-- pas dans cette table.
create or replace function public.retire_slug() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.retired_slugs (kind, slug)
  values (case tg_table_name when 'listings' then 'listing' else 'wanted' end, old.slug)
  on conflict do nothing;
  return old;
end;
$$;

create trigger listings_check_permalink before insert on public.listings
  for each row execute function public.check_permalink();
create trigger wanted_listings_check_permalink before insert on public.wanted_listings
  for each row execute function public.check_permalink();
create trigger listings_retire_slug after delete on public.listings
  for each row execute function public.retire_slug();
create trigger wanted_listings_retire_slug after delete on public.wanted_listings
  for each row execute function public.retire_slug();

-- ---------------------------------------------------------------------
-- Ce qu'une annonce affiche, tenu par la base.
-- ---------------------------------------------------------------------

-- Une annonce naît « Disponible » et sans prix d'avant, quel que soit
-- l'envoi : déposée « Réservé », elle portait un tampon qu'aucune
-- réservation n'avait posé, et née « Vendu », elle échappait au compte des
-- ventes (count_sale ne voit qu'un changement de statut). Ensuite, le prix
-- d'avant — « Baisse 20 % » sur la vignette — suit le prix seul : l'ancien
-- quand il baisse, plus rien quand il remonte, inchangé sinon
-- (nextPreviousPriceCents, src/lib/data/mappers/listing-writes.ts). La
-- valeur envoyée est ignorée : un vendeur s'inventait une baisse depuis
-- 4 999,99 € sur un lot à 25 €. Nommé pour passer avant le gel d'une
-- annonce vendue, qui compare donc le prix d'avant que la base a gardé.
create or replace function public.derive_listing_display() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'available';
    new.sold_at := null;
    new.reserved_for := null;
    new.previous_price_cents := null;
  elsif new.price_cents < old.price_cents then
    new.previous_price_cents := old.price_cents;
  elsif new.price_cents > old.price_cents then
    new.previous_price_cents := null;
  else
    new.previous_price_cents := old.previous_price_cents;
  end if;
  return new;
end;
$$;

create trigger listings_derive_display before insert or update of price_cents, previous_price_cents on public.listings
  for each row execute function public.derive_listing_display();

-- ---------------------------------------------------------------------
-- Le dépôt et la modification d'une annonce, d'un seul bloc.
-- ---------------------------------------------------------------------

-- L'annonce, ses séries et ses produits dans une seule transaction : une
-- série refusée ne laisse pas une annonce à moitié écrite. security invoker
-- — la RLS et les droits de colonnes du vendeur connecté s'appliquent comme
-- à trois inserts directs. Les photos arrivent avec Cloudflare Images (phase
-- 3) : un dépôt qui en porte est refusé plutôt que publié sans elles. Rend
-- le lien permanent, et si l'annonce vient d'être créée : un double envoi
-- retombe sur celle du vendeur connecté, sans rien créer — et le serveur ne
-- prévient alors personne une seconde fois.
drop function if exists public.create_listing(jsonb);
create or replace function public.create_listing(payload jsonb) returns table (permalink text, created boolean)
language plpgsql security invoker set search_path = public as $$
declare
  draft public.listings%rowtype := jsonb_populate_record(null::public.listings, payload -> 'listing');
begin
  if jsonb_array_length(coalesce(payload -> 'photos', '[]'::jsonb)) > 0 then
    raise exception 'les photos arrivent avec la phase 3 : déposez l''annonce sans photo' using errcode = '0A000';
  end if;
  insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, card_count, weight_kg,
                               condition, language, price_cents, city, postal_code, department_code, latitude,
                               longitude, status, audience, open_to_trade, trade_note)
  values (draft.id, draft.slug, draft.seller_id, draft.game_id, draft.title, draft.description, draft.lot_type,
          draft.card_count, draft.weight_kg, draft.condition, draft.language, draft.price_cents, draft.city,
          draft.postal_code, draft.department_code, draft.latitude, draft.longitude, draft.status, draft.audience,
          draft.open_to_trade, draft.trade_note)
  on conflict (id) do nothing;
  if not found then
    return query select l.slug, false from public.listings l where l.id = draft.id and l.seller_id = auth.uid();
    if not found then
      raise exception 'annonce introuvable' using errcode = 'P0002';
    end if;
    return;
  end if;
  insert into public.listing_editions (listing_id, edition_id, position)
    select draft.id, picked.edition_id, picked.position
      from jsonb_to_recordset(coalesce(payload -> 'editions', '[]'::jsonb)) as picked (edition_id text, position smallint);
  insert into public.listing_tags (listing_id, tag)
    select draft.id, picked.tag
      from jsonb_to_recordset(coalesce(payload -> 'tags', '[]'::jsonb)) as picked (tag public.product_tag);
  return query select draft.slug, true;
end;
$$;

-- La modification : retirer les séries et les produits, mettre l'annonce à
-- jour, réinsérer — dans cet ordre, sans quoi un changement de jeu bute sur
-- check_listing_game_change. Le lien permanent ne change pas : le slug n'est
-- pas dans les droits de mise à jour, ni le statut, qui a sa propre écriture ;
-- le prix d'avant, la base le déduit du prix (derive_listing_display). Une
-- annonce qui n'est pas au vendeur connecté répond « introuvable », et rien
-- n'a bougé : la RLS a écarté chaque ligne. Les photos restent telles
-- qu'elles sont jusqu'à la phase 3.
create or replace function public.update_listing(listing uuid, payload jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  draft public.listings%rowtype := jsonb_populate_record(null::public.listings, payload -> 'listing');
begin
  if jsonb_array_length(coalesce(payload -> 'photos', '[]'::jsonb)) > 0 then
    raise exception 'les photos arrivent avec la phase 3 : enregistrez l''annonce sans photo' using errcode = '0A000';
  end if;
  delete from public.listing_editions where listing_id = listing;
  delete from public.listing_tags where listing_id = listing;
  update public.listings
     set game_id = draft.game_id, title = draft.title, description = draft.description, lot_type = draft.lot_type,
         card_count = draft.card_count, weight_kg = draft.weight_kg, condition = draft.condition,
         language = draft.language, price_cents = draft.price_cents, city = draft.city,
         postal_code = draft.postal_code, department_code = draft.department_code, latitude = draft.latitude,
         longitude = draft.longitude, audience = draft.audience, open_to_trade = draft.open_to_trade,
         trade_note = draft.trade_note
   where id = listing;
  if not found then
    raise exception 'annonce introuvable' using errcode = 'P0002';
  end if;
  insert into public.listing_editions (listing_id, edition_id, position)
    select listing, picked.edition_id, picked.position
      from jsonb_to_recordset(coalesce(payload -> 'editions', '[]'::jsonb)) as picked (edition_id text, position smallint);
  insert into public.listing_tags (listing_id, tag)
    select listing, picked.tag
      from jsonb_to_recordset(coalesce(payload -> 'tags', '[]'::jsonb)) as picked (tag public.product_tag);
end;
$$;

-- ---------------------------------------------------------------------
-- Une conversation s'ouvre avec son premier message.
-- ---------------------------------------------------------------------

-- Sans lui, un message refusé après l'ouverture laisserait une conversation
-- vide dans les deux boîtes. security invoker : la politique d'ouverture des
-- conversations et celle des messages s'appliquent comme à deux inserts —
-- lot disponible, aucun blocage, démarchage refusé, message signé par son
-- auteur. Rend l'identifiant de la conversation, vers laquelle l'écran
-- emmène.
create or replace function public.open_conversation(listing uuid, buyer uuid, seller uuid, first_message text)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  opened uuid;
begin
  insert into public.conversations (listing_id, buyer_id, seller_id) values (listing, buyer, seller)
    returning id into opened;
  insert into public.messages (conversation_id, sender_id, body) values (opened, auth.uid(), first_message);
  return opened;
end;
$$;

-- ---------------------------------------------------------------------
-- Un croisement ne se notifie qu'une fois.
-- ---------------------------------------------------------------------

-- Un acheteur apprend une fois qu'un lot répond à sa demande, quoi que fasse
-- le serveur — un envoi rejoué, deux passages concurrents : il écrit avec
-- on conflict do nothing. Seules les notifications de croisement portent
-- une demande ; les autres, sans elle, ne se heurtent jamais (null ne vaut
-- pas null).
create unique index notifications_one_per_match on public.notifications (kind, user_id, listing_id, wanted_id);

-- ---------------------------------------------------------------------
-- Droits.
-- ---------------------------------------------------------------------

alter table public.retired_slugs enable row level security;
revoke all on public.retired_slugs from anon, authenticated;
revoke execute on function public.is_retired_slug(text, text) from public, anon;
grant execute on function public.is_retired_slug(text, text) to authenticated;

-- Le rôle connecté seul : un visiteur anonyme ne dépose ni n'écrit rien.
revoke execute on function public.create_listing(jsonb) from public, anon;
grant execute on function public.create_listing(jsonb) to authenticated;
revoke execute on function public.update_listing(uuid, jsonb) from public, anon;
grant execute on function public.update_listing(uuid, jsonb) to authenticated;
revoke execute on function public.open_conversation(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.open_conversation(uuid, uuid, uuid, text) to authenticated;
