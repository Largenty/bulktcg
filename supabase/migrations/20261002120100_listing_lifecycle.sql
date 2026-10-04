-- Migration 15 : le cycle de vie d'une annonce. Elle quitte les listes
-- quatre-vingt-dix jours après le dernier geste de son vendeur, à moins
-- qu'il ne la prolonge — gratuitement, en un clic ; trente jours après sa
-- sortie du marché, vente ou expiration, elle est archivée : ses photos sont
-- supprimées, le texte, le prix et les avis restent, et son lien répond
-- toujours. La remontée payante la replace en tête du tri par défaut une
-- fois par jour.
--
-- À coller après la migration 14, dans une exécution à part : la sorte de
-- notification « listing_expiring » doit être validée avant d'être employée
-- ici.
--
-- Rien n'expire par une tâche : une annonce est expirée dès que sa date est
-- passée, et chaque lecture le voit — src/lib/listing-lifecycle.ts pour le
-- site, les fonctions ci-dessous pour la base ; tests/schema-sync.test.mjs
-- compare leurs durées. La tâche quotidienne ne fait que ce qui demande une
-- écriture : prévenir le vendeur, retirer les photos d'une annonce archivée.

-- ---------------------------------------------------------------------
-- Les colonnes.
-- ---------------------------------------------------------------------

-- Le dernier geste du vendeur : le dépôt, puis chaque modification,
-- changement de statut ou prolongation. Ni inséré ni modifié directement —
-- aucun droit de colonne ne le rend au rôle connecté : un vendeur
-- repousserait son échéance à 2099 depuis la console. Les annonces déjà en
-- ligne partent pour quatre-vingt-dix jours à compter de cette migration :
-- aucune n'expire le jour où la règle arrive.
alter table public.listings
  add column renewed_at timestamptz not null default now(),
  -- L'option « Remonter » : son début et sa fin, écrits par le service de
  -- paiement seul, comme les autres options. Le rang se déduit des deux
  -- (getRankedAt) : une remontée par jour, du début à la fin.
  add column bump_started_at timestamptz,
  add column bump_until timestamptz,
  add constraint listings_bump_window check (
    (bump_started_at is null) = (bump_until is null) and (bump_until is null or bump_until > bump_started_at)
  );

-- Ce que parcourt la tâche quotidienne : les annonces en ligne par
-- échéance, les ventes par date, les signalements encore ouverts par cible.
create index listings_by_renewal on public.listings (renewed_at) where status <> 'sold';
create index listings_by_sale on public.listings (sold_at) where status = 'sold';
create index reports_open_by_target on public.reports (target_type, target_id) where resolved_at is null;

-- ---------------------------------------------------------------------
-- Les échéances, écrites une fois.
-- ---------------------------------------------------------------------

-- La fin de la mise en ligne : quatre-vingt-dix jours après le dernier geste
-- du vendeur.
create or replace function public.listing_expires_at(listing public.listings) returns timestamptz
language sql stable as $$
  select listing.renewed_at + interval '90 days';
$$;

-- En ligne : ni vendue, ni passée sa date. Seule une annonce en ligne
-- s'ouvre à une conversation ou à la liste d'attente, et se compte dans
-- l'espace pro.
create or replace function public.listing_on_market(listing public.listings) returns boolean
language sql stable as $$
  select listing.status <> 'sold' and public.listing_expires_at(listing) > now();
$$;

-- Archivée : trente jours après sa vente ou son expiration — le jour où une
-- annonce vendue sort aussi de l'index. Ses photos partent au passage
-- suivant de la tâche quotidienne.
create or replace function public.listing_archived(listing public.listings) returns boolean
language sql stable as $$
  select coalesce(
    case when listing.status = 'sold' then listing.sold_at else public.listing_expires_at(listing) end
      <= now() - interval '30 days',
    false
  );
$$;

-- ---------------------------------------------------------------------
-- Prolonger.
-- ---------------------------------------------------------------------

-- Tout geste du vendeur sur son annonce la relance pour quatre-vingt-dix
-- jours : la modifier, en changer le statut, la réserver. Seul compte le
-- vendeur connecté — auth.uid(), que voient aussi les fonctions security
-- definer qu'il appelle, comme reserve_listing() : une vue comptée, ce
-- qu'écrivent le service de paiement ou la tâche quotidienne ne la relancent
-- pas. Le paiement d'une remontée la relance lui-même, en posant renewed_at.
create or replace function public.renew_on_seller_activity() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() = new.seller_id then
    new.renewed_at := now();
  end if;
  return new;
end;
$$;

create trigger listings_renew_on_activity before update on public.listings
  for each row execute function public.renew_on_seller_activity();

-- « Prolonger » et « Remettre en ligne » : gratuits, en un clic, pour le
-- vendeur seul — pas pour une annonce vendue, qui n'expire pas. Une annonce
-- archivée repart sans ses photos, que la tâche quotidienne a retirées.
-- security definer : renewed_at n'est dans les droits de personne. Rend la
-- nouvelle échéance.
create or replace function public.renew_listing(listing uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  renewed public.listings%rowtype;
begin
  update public.listings set renewed_at = now()
   where id = listing and seller_id = auth.uid() and status <> 'sold'
  returning * into renewed;
  if not found then
    raise exception 'annonce introuvable' using errcode = 'P0002';
  end if;
  return public.listing_expires_at(renewed);
end;
$$;

-- ---------------------------------------------------------------------
-- Ce qui n'est plus en ligne ne reçoit plus rien.
-- ---------------------------------------------------------------------

-- Une conversation ne s'ouvre que sur un lot en ligne : expiré, son vendeur
-- ne le vend peut-être plus. La politique de la migration 10, plus cette
-- condition.
drop policy "conversation ouverte par un participant" on public.conversations;
create policy "conversation ouverte par un participant" on public.conversations
  for insert with check (
    auth.uid() in (buyer_id, seller_id)
    and not public.is_blocked_between(buyer_id, seller_id)
    and exists (select 1 from public.listings l
                where l.id = listing_id and l.status = 'available' and l.seller_id = conversations.seller_id
                  and public.listing_on_market(l)
                  and (l.audience = 'everyone' or public.is_active_pro(conversations.buyer_id)))
    and (auth.uid() = buyer_id
         or exists (select 1 from public.wanted_listings w
                    join public.listings l on l.id = conversations.listing_id
                    where w.buyer_id = conversations.buyer_id and w.status = 'open' and w.game_id = l.game_id))
  );

-- Ni d'inscription en liste d'attente : la réservation d'un lot expiré ne
-- tombera pas.
drop policy "inscription sur le lot réservé d'un autre" on public.listing_waitlist;
create policy "inscription sur le lot réservé d'un autre" on public.listing_waitlist for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.listings l
              where l.id = listing_id and l.status = 'reserved' and l.seller_id <> auth.uid()
                and public.listing_on_market(l))
);

-- L'espace pro ne compte que les lots en ligne.
create or replace function public.pro_only_count_by_game()
returns table (game_id public.game_id, listing_count integer)
language sql stable security definer set search_path = public as $$
  select l.game_id, count(*)::integer
    from public.listings l
   where l.audience = 'pros' and public.listing_on_market(l)
   group by l.game_id
   order by l.game_id;
$$;

-- La lecture par rayon non plus (getListings avec une origine).
create or replace function public.listings_within(
  origin_lat double precision, origin_lon double precision, radius_km integer
) returns setof public.listings
language sql stable as $$
  select l.* from public.listings l
  where public.listing_on_market(l)
    and l.latitude between origin_lat - radius_km / 111.0 and origin_lat + radius_km / 111.0
    and public.distance_km(origin_lat, origin_lon, l.latitude, l.longitude) <= radius_km
  order by public.distance_km(origin_lat, origin_lon, l.latitude, l.longitude);
$$;

-- ---------------------------------------------------------------------
-- Archiver.
-- ---------------------------------------------------------------------

-- Une vente clôturée fige l'annonce, photos comprises (migration 7). Un
-- seul geste y est permis : l'archivage retire ses photos trente jours après
-- la vente. Il ne réécrit rien de ce que les avis citent — le texte, le prix
-- et la description restent.
create or replace function public.freeze_listing_parts_after_deal() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  touched uuid[];
begin
  if tg_op = 'DELETE' and tg_table_name = 'listing_photos'
     and exists (select 1 from public.listings l where l.id = old.listing_id and public.listing_archived(l)) then
    return old;
  end if;
  if tg_op = 'INSERT' then
    touched := array[new.listing_id];
  elsif tg_op = 'DELETE' then
    touched := array[old.listing_id];
  else
    touched := array[old.listing_id, new.listing_id];
  end if;
  if exists (
    select 1 from public.deals d join public.listings l on l.id = d.listing_id
     where d.listing_id = any (touched)
  ) then
    raise exception 'vente clôturée : l''annonce reste telle qu''elle a été vendue' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Une notification « listing_expiring » mène à son annonce, comme les autres.
alter table public.notifications
  add constraint notifications_listing_expiring_subject check (kind <> 'listing_expiring' or listing_id is not null);

-- La tâche quotidienne, appelée par Vercel Cron (src/app/taches/quotidiennes)
-- avec la clé de service :
--   1. le vendeur d'une annonce qui expire dans sept jours au plus est
--      prévenu, une fois par mise en ligne : prolongée, elle le sera de
--      nouveau à sept jours de sa nouvelle échéance ;
--   2. les photos d'une annonce archivée sont retirées. Le registre date leur
--      décrochage (track_photo_upload_use), et le ménage supprime les
--      fichiers chez Cloudflare le lendemain (claim_photo_purge). Une
--      annonce visée par un signalement encore ouvert garde les siennes
--      jusqu'à la décision : elles en sont la pièce.
-- Un verrou l'empêche de tourner deux fois à la fois : Vercel Cron livre
-- parfois deux fois une échéance, et deux passages préviendraient deux fois.
-- Rend ce qu'elle a fait, pour le journal.
create or replace function public.run_listing_lifecycle()
returns table (warned_listings integer, archived_listings integer, removed_photos integer)
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.run_listing_lifecycle'));
  insert into public.notifications (user_id, kind, listing_id)
  select l.seller_id, 'listing_expiring', l.id
    from public.listings l
   where public.listing_on_market(l)
     and public.listing_expires_at(l) <= now() + interval '7 days'
     and not exists (select 1 from public.notifications n
                     where n.kind = 'listing_expiring' and n.listing_id = l.id and n.created_at >= l.renewed_at);
  get diagnostics warned_listings = row_count;
  with removed as (
    delete from public.listing_photos p
     using public.listings l
     where l.id = p.listing_id
       and public.listing_archived(l)
       and not exists (select 1 from public.reports r
                       where r.target_type = 'listing' and r.target_id = l.id and r.resolved_at is null)
    returning p.listing_id
  )
  select count(distinct removed.listing_id)::integer, count(*)::integer
    into archived_listings, removed_photos
    from removed;
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- Droits.
-- ---------------------------------------------------------------------

-- Prolonger : le rôle connecté seul, sur ses annonces (la fonction le
-- vérifie). La tâche quotidienne : la clé de service seule.
revoke execute on function public.renew_listing(uuid) from public, anon;
grant execute on function public.renew_listing(uuid) to authenticated;
revoke execute on function public.run_listing_lifecycle() from public, anon, authenticated;
grant execute on function public.run_listing_lifecycle() to service_role;
