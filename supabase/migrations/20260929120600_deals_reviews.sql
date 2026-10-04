-- BulkTCG — migration 7 sur 10 : les ventes clôturées et les avis.
--
-- La vente est clôturée par le vendeur. C'est son lot : il dit quand il est
-- parti, et à qui — l'autre partie de la conversation, jamais un tiers.
-- Clôturer passe le lot en « Vendu » et ouvre l'avis des deux côtés.

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  -- Une vente par conversation, et un lot ne se vend qu'une fois.
  conversation_id uuid not null unique references public.conversations (id) on delete cascade,
  -- restrict : une vente conclue est l'affaire de deux personnes. Supprimer
  -- l'annonce emporterait l'avis que l'autre a laissé — un vendeur mal noté
  -- n'aurait qu'à supprimer son annonce pour l'effacer. La suppression d'un
  -- compte passe quand même : ses ventes partent avec lui (seller_id,
  -- buyer_id) avant que la restriction sur l'annonce ne soit vérifiée.
  listing_id uuid not null unique references public.listings (id) on delete restrict,
  -- Recopiés de la conversation par close_deal() : la politique de lecture
  -- et les listes « Ventes et achats » les lisent sans jointure.
  seller_id uuid not null references public.profiles (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  kind public.deal_kind not null,
  closed_at timestamptz not null default now(),
  check (seller_id <> buyer_id)
);

create index deals_by_seller on public.deals (seller_id, closed_at desc);
create index deals_by_buyer on public.deals (buyer_id, closed_at desc);

-- Tout se déduit de la conversation : le vendeur ne fournit que son
-- identifiant et la nature de l'accord. Le lot peut déjà être en « Vendu »,
-- passé d'un clic depuis le tableau de bord : clôturer y ajoute l'acheteur,
-- et donc les avis. Le déclencheur listings_count_sale compte la vente.
create or replace function public.close_deal(conversation uuid, deal_kind public.deal_kind) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  thread public.conversations%rowtype;
  closed_deal uuid;
begin
  select * into thread from public.conversations
   where id = conversation and seller_id = auth.uid();
  if not found then
    raise exception 'conversation introuvable' using errcode = 'P0002';
  end if;
  if public.is_blocked_between(thread.seller_id, thread.buyer_id) then
    raise exception 'conversation bloquée' using errcode = '42501';
  end if;
  insert into public.deals (conversation_id, listing_id, seller_id, buyer_id, kind)
  values (thread.id, thread.listing_id, thread.seller_id, thread.buyer_id, deal_kind)
  returning id into closed_deal;
  update public.listings set status = 'sold', sold_at = coalesce(sold_at, now())
   where id = thread.listing_id;
  -- L'acheteur l'apprend, avec de quoi noter le vendeur.
  insert into public.notifications (user_id, kind, listing_id, deal_id)
  values (thread.buyer_id, 'deal_closed', thread.listing_id, closed_deal);
  return closed_deal;
end;
$$;

-- Une vente clôturée ne se défait pas depuis le tableau de bord : le lot
-- repasserait « Disponible » avec un acheteur et des avis.
create or replace function public.keep_closed_deal_sold() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'sold' and new.status <> 'sold'
     and exists (select 1 from public.deals where listing_id = new.id) then
    raise exception 'vente clôturée : le lot reste vendu' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listings_keep_closed_deal_sold before update of status on public.listings
  for each row execute function public.keep_closed_deal_sold();

-- Une vente clôturée fige l'annonce : elle est la pièce à laquelle les avis
-- se rapportent (« un lot conforme à l'annonce »). Réécrite après coup —
-- « environ 300 cartes » au lieu de 900 —, elle ferait mentir l'avis ;
-- passée aux pros, elle disparaîtrait pour l'acheteur qui l'a notée
-- (updateListing, src/lib/data/listing-mutations.ts). Le statut a sa propre
-- règle ci-dessus ; la date de vente, les vues et les options payantes
-- suivent leur cours, et close_deal() peut encore passer le lot en « Vendu ».
create or replace function public.freeze_listing_after_deal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.game_id, new.title, new.description, new.lot_type, new.card_count, new.weight_kg,
      new.condition, new.language, new.price_cents, new.previous_price_cents, new.city,
      new.postal_code, new.department_code, new.latitude, new.longitude, new.audience,
      new.open_to_trade, new.trade_note)
     is distinct from
     (old.game_id, old.title, old.description, old.lot_type, old.card_count, old.weight_kg,
      old.condition, old.language, old.price_cents, old.previous_price_cents, old.city,
      old.postal_code, old.department_code, old.latitude, old.longitude, old.audience,
      old.open_to_trade, old.trade_note)
     and exists (select 1 from public.deals where listing_id = old.id) then
    raise exception 'vente clôturée : l''annonce reste telle qu''elle a été vendue' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listings_freeze_after_deal before update on public.listings
  for each row execute function public.freeze_listing_after_deal();

-- Les photos, les séries et les produits en font partie. Une annonce
-- supprimée emporte les siens en cascade : elle n'est alors plus visible
-- ici, et le compte qui disparaît peut partir malgré une vente clôturée.
create or replace function public.freeze_listing_parts_after_deal() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  touched uuid[];
begin
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

create trigger listing_photos_freeze_after_deal before insert or update or delete on public.listing_photos
  for each row execute function public.freeze_listing_parts_after_deal();
create trigger listing_editions_freeze_after_deal before insert or update or delete on public.listing_editions
  for each row execute function public.freeze_listing_parts_after_deal();
create trigger listing_tags_freeze_after_deal before insert or update or delete on public.listing_tags
  for each row execute function public.freeze_listing_parts_after_deal();

-- Le passage en « Vendu » incrémente l'historique du vendeur ; en sortir le
-- décrémente. Le nombre d'annonces actives, lui, n'est jamais stocké.
create or replace function public.count_sale() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'sold' and old.status <> 'sold' then
    update public.profiles set sold_listing_count = sold_listing_count + 1 where id = new.seller_id;
  elsif old.status = 'sold' and new.status <> 'sold' then
    update public.profiles set sold_listing_count = greatest(sold_listing_count - 1, 0) where id = new.seller_id;
  end if;
  return new;
end;
$$;

create trigger listings_count_sale after update of status on public.listings
  for each row execute function public.count_sale();

-- ---------------------------------------------------------------------
-- Avis : ils nourrissent la note dénormalisée du profil. Trois critères de
-- 1 à 5 ; la note d'un avis et celle d'un profil en sont la moyenne.
-- ---------------------------------------------------------------------

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  -- Un avis appartient à la personne notée, pas à son auteur : « Les avis
  -- que vous avez laissés à d'autres vendeurs restent sur leur profil : ils
  -- leur appartiennent, pas à vous » (src/app/mon-compte/parametres). Quand
  -- un compte est supprimé, la vente, l'annonce et l'auteur deviennent donc
  -- nuls au lieu d'emporter l'avis ; les notes, le commentaire et la
  -- personne notée restent. À l'écriture, les trois sont toujours posés : la
  -- politique d'écriture exige la vente, stamp_review en déduit le reste.
  deal_id uuid references public.deals (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  reviewer_id uuid references public.profiles (id) on delete set null,
  -- Posés par stamp_review à partir de la vente : le navigateur ne désigne
  -- que la vente et ses notes, jamais la personne notée.
  reviewed_id uuid not null references public.profiles (id) on delete cascade,
  reviewed_role public.review_role not null,
  punctuality smallint not null check (punctuality between 1 and 5),
  responsiveness smallint not null check (responsiveness between 1 and 5),
  reliability smallint not null check (reliability between 1 and 5),
  comment text check (comment is null or char_length(comment) between 1 and 1000),
  created_at timestamptz not null default now(),
  -- Un avis par personne et par vente.
  unique (deal_id, reviewer_id),
  check (reviewer_id <> reviewed_id)
);

create index reviews_by_reviewed on public.reviews (reviewed_id, created_at desc);
create index reviews_by_reviewer on public.reviews (reviewer_id);
create index reviews_by_listing on public.reviews (listing_id);

create or replace function public.stamp_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sale public.deals%rowtype;
begin
  select * into sale from public.deals where id = new.deal_id;
  if not found then
    raise exception 'vente introuvable' using errcode = 'P0002';
  end if;
  new.listing_id := sale.listing_id;
  if new.reviewer_id = sale.seller_id then
    new.reviewed_id := sale.buyer_id;
    new.reviewed_role := 'buyer';
  elsif new.reviewer_id = sale.buyer_id then
    new.reviewed_id := sale.seller_id;
    new.reviewed_role := 'seller';
  else
    raise exception 'seules les parties de la vente la notent' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger reviews_stamp before insert on public.reviews
  for each row execute function public.stamp_review();

create or replace function public.refresh_rating() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.reviewed_id, old.reviewed_id);
begin
  -- null et non 0 quand il n'y a plus d'avis : un compte sans avis n'a pas
  -- une note de zéro. La note globale est la moyenne des trois critères.
  update public.profiles p set
    rating_count = stats.count,
    rating_avg = case when stats.count = 0 then null else round(stats.overall, 1) end,
    punctuality_avg = case when stats.count = 0 then null else round(stats.punctuality, 1) end,
    responsiveness_avg = case when stats.count = 0 then null else round(stats.responsiveness, 1) end,
    reliability_avg = case when stats.count = 0 then null else round(stats.reliability, 1) end
  from (
    select count(*)::integer as count,
           avg((punctuality + responsiveness + reliability) / 3.0)::numeric as overall,
           avg(punctuality)::numeric as punctuality,
           avg(responsiveness)::numeric as responsiveness,
           avg(reliability)::numeric as reliability
    from public.reviews where reviewed_id = target
  ) as stats
  where p.id = target;
  return null;
end;
$$;

create trigger reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_rating();
