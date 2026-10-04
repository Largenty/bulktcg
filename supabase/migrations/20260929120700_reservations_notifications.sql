-- BulkTCG — migration 8 sur 10 : réservation, liste d'attente et
-- notifications.
--
-- Un lot réservé ne reçoit plus de nouvelle conversation, et seule la
-- personne pour qui il est réservé continue d'écrire : le vendeur n'est pas
-- relancé par ceux qui arrivent trop tard. Eux s'inscrivent sur la liste
-- d'attente, et sont tous prévenus en même temps si le lot redevient
-- disponible.

-- Réserver pour quelqu'un : l'autre partie d'une de ses conversations,
-- jamais un identifiant fourni par le navigateur.
create or replace function public.reserve_listing(conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  thread public.conversations%rowtype;
begin
  select * into thread from public.conversations
   where id = conversation and seller_id = auth.uid();
  if not found then
    raise exception 'conversation introuvable' using errcode = 'P0002';
  end if;
  update public.listings set status = 'reserved', reserved_for = thread.buyer_id
   where id = thread.listing_id and status <> 'sold';
end;
$$;

-- Quitter « Réservé » efface la personne désignée.
create or replace function public.clear_reservation() returns trigger
language plpgsql as $$
begin
  if new.status <> 'reserved' then
    new.reserved_for := null;
  end if;
  return new;
end;
$$;

create trigger listings_clear_reservation before update of status on public.listings
  for each row execute function public.clear_reservation();

create table public.listing_waitlist (
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

-- La suppression d'un compte emporte ses inscriptions.
create index listing_waitlist_by_user on public.listing_waitlist (user_id);

-- ---------------------------------------------------------------------
-- Notifications : la cloche de l'en-tête compte les non lues, /notifications
-- les liste. Chacune mène à ce dont elle parle, et chaque sorte a sa source
-- en base : la liste d'attente, la clôture, l'avis, le croisement d'un dépôt.
-- ---------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  listing_id uuid references public.listings (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  wanted_id uuid references public.wanted_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- Une notification sans ce dont elle parle ne mène nulle part : chaque
  -- sorte exige son sujet. L'autre personne (le vendeur qui a clôturé,
  -- celle qui a noté) se lit sur la vente et sur l'avis, pas ici.
  constraint notifications_listing_available_subject check (kind <> 'listing_available' or listing_id is not null),
  constraint notifications_deal_closed_subject check (kind <> 'deal_closed' or (listing_id is not null and deal_id is not null)),
  constraint notifications_review_received_subject check (kind <> 'review_received' or deal_id is not null),
  constraint notifications_wanted_match_subject check (kind <> 'wanted_match' or (listing_id is not null and wanted_id is not null))
);

create index notifications_by_user on public.notifications (user_id, created_at desc);
-- Les sujets partent en cascade : sans index, chaque suppression
-- d'annonce, de vente ou de demande parcourrait toutes les notifications.
create index notifications_by_listing on public.notifications (listing_id) where listing_id is not null;
create index notifications_by_deal on public.notifications (deal_id) where deal_id is not null;
create index notifications_by_wanted on public.notifications (wanted_id) where wanted_id is not null;

-- Le vendeur ne voit que le nombre d'inscrits, jamais leurs noms : il n'a
-- personne à relancer, et personne ne le relance.
create or replace function public.waitlist_count(listing uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer
    from public.listing_waitlist w
    join public.listings l on l.id = w.listing_id
   where w.listing_id = listing and l.seller_id = auth.uid();
$$;

-- Tous les inscrits sont prévenus en même temps quand le lot redevient
-- disponible ; la liste se vide dès qu'il quitte « Réservé ».
create or replace function public.notify_waitlist() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'reserved' and new.status = 'available' then
    insert into public.notifications (user_id, kind, listing_id)
    select user_id, 'listing_available', new.id from public.listing_waitlist where listing_id = new.id;
  end if;
  if new.status <> 'reserved' then
    delete from public.listing_waitlist where listing_id = new.id;
  end if;
  return null;
end;
$$;

create trigger listings_notify_waitlist after update of status on public.listings
  for each row when (old.status is distinct from new.status) execute function public.notify_waitlist();

-- Un avis reçu se signale à la personne notée.
create or replace function public.notify_review() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, listing_id, deal_id)
  values (new.reviewed_id, 'review_received', new.listing_id, new.deal_id);
  return null;
end;
$$;

create trigger reviews_notify after insert on public.reviews
  for each row execute function public.notify_review();

-- wanted_match n'a pas de déclencheur : le croisement lot / recherche est
-- calculé en TypeScript (lib/matching.ts), le même qui s'affiche au vendeur
-- au moment du dépôt. L'action de dépôt pose ces notifications avec la clé
-- de service, qui seule écrit dans cette table.
