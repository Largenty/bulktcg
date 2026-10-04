-- BulkTCG — migration 4 sur 10 : les annonces, leurs photos, leurs séries
-- et leurs produits.

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  -- Le lien permanent partagé sur Facebook : il ne change jamais, même quand
  -- le titre change (le slug n'est pas dans les droits de mise à jour). La
  -- forme est celle de buildSlug (src/lib/slug.ts) : rien qui casse une URL.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  game_id public.game_id not null,
  title text not null check (char_length(title) between 12 and 90),
  description text not null check (char_length(description) between 40 and 4000),
  lot_type public.lot_type not null,
  -- null = non compté, non pesé. Jamais 0 : « je n'ai pas compté » n'est pas
  -- « il y a zéro carte ».
  card_count integer check (card_count is null or card_count > 0),
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg > 0),
  condition public.card_condition not null,
  language public.card_language not null,
  price_cents integer not null check (price_cents > 0 and price_cents <= 500000),
  previous_price_cents integer check (previous_price_cents is null or previous_price_cents > 0),
  -- La commune du rendez-vous. Le navigateur envoie le couple nom et code
  -- postal, que la clé étrangère vérifie ; le département et les
  -- coordonnées sont recopiés depuis le référentiel par stamp_commune(). La
  -- copie reste figée si le référentiel change : l'annonce est publiée là.
  city text not null,
  postal_code text not null check (postal_code ~ '^\d{5}$'),
  department_code text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  status public.listing_status not null default 'available',
  -- Pour qui le lot est réservé : l'autre partie d'une conversation, posée
  -- par reserve_listing(). Elle seule continue d'écrire au vendeur à son
  -- sujet. null pour une réservation faite hors du site, et dès que le lot
  -- quitte « Réservé » (déclencheur clear_reservation).
  reserved_for uuid references public.profiles (id) on delete set null,
  -- 'pros' : l'annonce n'apparaît ni dans la recherche publique, ni dans le
  -- plan de site, ni aux particuliers — seulement à son vendeur et aux pros
  -- au forfait actif (voir la politique de lecture, migration 10).
  audience public.listing_audience not null default 'everyone',
  -- Ouvert à l'échange : le prix reste — il donne la valeur de référence —,
  -- et le vendeur accepte aussi des cartes contre le lot. La note dit
  -- lesquelles ; elle n'existe que si l'échange est ouvert.
  open_to_trade boolean not null default false,
  trade_note text check (trade_note is null or char_length(trade_note) between 1 and 140),
  -- Les deux options payantes : une date de fin, écrite par le service de
  -- paiement seul (voir les droits de colonnes, migration 10). Une option qui
  -- expire ne se retire pas à la main.
  featured_until timestamptz,
  urgent_until timestamptz,
  -- L'option « 8 photos » : trois photos sont gratuites, les cinq suivantes
  -- la demandent. Achetée une fois pour toutes, écrite par le service de
  -- paiement seul comme les deux dates ci-dessus.
  extra_photos boolean not null default false,
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sold_at timestamptz,
  constraint listings_sold_at_matches_status check ((status = 'sold') = (sold_at is not null)),
  constraint listings_reserved_for_matches_status check (reserved_for is null or status = 'reserved'),
  constraint listings_trade_note_needs_trade check (trade_note is null or open_to_trade),
  -- « Baisse de 20 % » se calcule contre le prix d'avant : il est donc plus
  -- haut que le prix actuel, ou il n'existe pas. Remonter le prix l'efface
  -- (src/lib/data/mappers.ts, nextPreviousPriceCents).
  constraint listings_previous_price_above_price check (previous_price_cents is null or previous_price_cents > price_cents),
  constraint listings_commune_fkey foreign key (city, postal_code) references public.communes (name, postal_code)
);

create index listings_public_feed on public.listings (status, created_at desc);
create index listings_by_game on public.listings (game_id, status, created_at desc);
create index listings_by_seller on public.listings (seller_id, created_at desc);
create index listings_by_position on public.listings (latitude, longitude);
create index listings_featured on public.listings (featured_until) where featured_until is not null;
-- Le flux de l'espace pro : les annonces réservées, les plus récentes d'abord.
create index listings_pros_feed on public.listings (created_at desc) where audience = 'pros';
-- Le compte qui disparaît remet reserved_for à null : sans index, chaque
-- suppression de compte parcourrait toutes les annonces.
create index listings_by_reserved_for on public.listings (reserved_for) where reserved_for is not null;

-- Une vue comptée n'est pas une modification : sans la condition, chaque
-- visite rajeunirait la date de mise à jour de la fiche.
create trigger listings_updated_at before update on public.listings
  for each row when (old.view_count is not distinct from new.view_count)
  execute function public.set_updated_at();

-- La commune place l'annonce sur la carte : le navigateur la désigne, la
-- base recopie son département et ses coordonnées. Une annonce ne s'invente
-- pas un emplacement pour apparaître dans les recherches d'une autre ville.
-- Commune inconnue : rien n'est recopié, et la clé étrangère refuse.
create or replace function public.stamp_commune() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  place public.communes%rowtype;
begin
  select * into place from public.communes where name = new.city and postal_code = new.postal_code;
  if found then
    new.department_code := place.department_code;
    new.latitude := place.latitude;
    new.longitude := place.longitude;
  end if;
  return new;
end;
$$;

create trigger listings_stamp_commune before insert or update of city, postal_code, department_code, latitude, longitude on public.listings
  for each row execute function public.stamp_commune();

-- ---------------------------------------------------------------------
-- Photos téléversées : le registre des fichiers déposés chez Cloudflare.
-- ---------------------------------------------------------------------

-- Les fichiers vivent chez Cloudflare Images. Le serveur inscrit ici chaque
-- fichier en délivrant l'adresse de dépôt, avec la clé de service (droits,
-- migration 10) : c'est la seule preuve qu'une image appartient à un compte.
-- Un préfixe de chemin ne le pourrait pas — Cloudflare tire lui-même
-- l'identifiant d'une image privée, et les photos d'un lot réservé aux pros
-- doivent l'être. Le registre sert aussi le ménage, que les cascades
-- n'atteignent pas : une ligne qu'aucune photo n'affiche plus désigne un
-- fichier à retirer, passé son délai de grâce (claim_photo_purge).
create table public.photo_uploads (
  -- L'identifiant de l'image chez Cloudflare Images. Jamais une URL :
  -- l'adresse de livraison se compose à la lecture (resolvePhotoUrl), et ne
  -- dépend pas du domaine qui sert les photos. Il peut changer : la
  -- référence de l'API annonce qu'un changement de visibilité « rend un
  -- nouvel UID ». Le serveur remplace alors la clé ici, et les photos
  -- suivent (on update cascade, dans listing_photos).
  key text primary key check (key ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$' and key !~ '\.\.'),
  -- null quand le compte a été supprimé : la ligne reste, le temps que le
  -- ménage retire le fichier chez Cloudflare.
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Quand la dernière photo qui affichait le fichier est partie : photo
  -- retirée, annonce ou compte supprimés. null tant qu'une photo l'affiche,
  -- et pour un fichier jamais accroché, dont le délai part de created_at.
  -- Posée et effacée par listing_photos_track_upload, jamais à la main.
  detached_at timestamptz,
  -- Le ménage a pris le fichier : plus aucune photo ne peut l'accrocher
  -- (listing_photos_check_upload), et la ligne part une fois le retrait
  -- confirmé par Cloudflare (forget_purged_photos).
  purge_started_at timestamptz
);

-- ---------------------------------------------------------------------
-- Photos : jusqu'à huit par annonce, dans l'ordre choisi par le vendeur.
-- ---------------------------------------------------------------------

create table public.listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- Un fichier du registre, jamais nul : une ligne sans fichier faisait
  -- afficher « 4 photos » sur une vignette qui n'en montrait aucune
  -- (src/lib/mock/seed.ts). La clé étrangère refuse une photo que le
  -- serveur n'a pas délivrée, et empêche le ménage de retirer un fichier
  -- encore affiché. Qu'il vienne des téléversements du vendeur, et non de
  -- ceux d'un autre : listing_photos_check_upload, plus bas, même pour la
  -- clé de service. Une clé que Cloudflare remplace se remplace ici aussi,
  -- dans la même instruction.
  storage_path text not null references public.photo_uploads (key) on delete restrict on update cascade,
  position smallint not null check (position between 0 and 7),
  unique (listing_id, position),
  -- Un fichier n'affiche qu'une photo : la clé que Cloudflare rend en
  -- changeant sa visibilité ne touche qu'une annonce. Partagé avec une
  -- annonce vendue, que rien ne modifie plus, il refuserait sa nouvelle clé
  -- — Cloudflare l'aurait, la base garderait l'ancienne. La modification
  -- retire donc les photos avant de les réinsérer ; l'index sert le ménage.
  constraint listing_photos_one_photo_per_file unique (storage_path)
);

-- Au-delà de trois photos, l'option est requise. La position suffit : elle
-- est unique par annonce et commence à 0. Le paiement précède donc
-- l'écriture des photos 4 à 8 ; le formulaire refuse déjà le cas, la base
-- le refuse en dernier recours.
create or replace function public.check_photo_allowance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.position >= 3
     and not (select extra_photos from public.listings where id = new.listing_id) then
    raise exception 'photo % : au-delà de trois, l''option « 8 photos » est requise', new.position + 1
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listing_photos_allowance before insert or update of position on public.listing_photos
  for each row execute function public.check_photo_allowance();

-- ---------------------------------------------------------------------
-- Le ménage : les fichiers qu'aucune photo n'affiche plus, passé leur délai
-- de grâce (supabase/README.md, § 6 ; src/lib/photo-hosting.ts).
-- ---------------------------------------------------------------------

-- Le registre date lui-même le moment où un fichier cesse d'être affiché :
-- accroché à une photo, sa date de retrait s'efface ; décroché de la
-- dernière qui l'affichait — photo retirée, annonce ou compte supprimés, la
-- cascade passe aussi par ici —, elle se pose.
create or replace function public.track_photo_upload_use() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  released text;
begin
  if tg_op <> 'DELETE' then
    update public.photo_uploads set detached_at = null
     where key = new.storage_path and detached_at is not null;
  end if;
  if tg_op = 'DELETE' then
    released := old.storage_path;
  elsif tg_op = 'UPDATE' then
    if old.storage_path is distinct from new.storage_path then
      released := old.storage_path;
    end if;
  end if;
  if released is not null then
    -- Verrouillé d'abord : une photo qui reprend le fichier au même moment
    -- (lu « for share » par listing_photos_check_upload) attend, ou se fait
    -- attendre, et la condition relue après le verrou la voit. Sans lui, la
    -- date de retrait se poserait sur un fichier de nouveau affiché.
    perform 1 from public.photo_uploads where key = released for update;
    update public.photo_uploads set detached_at = now()
     where key = released
       and not exists (select 1 from public.listing_photos p where p.storage_path = released);
  end if;
  return null;
end;
$$;

create trigger listing_photos_track_upload after insert or update of storage_path or delete on public.listing_photos
  for each row execute function public.track_photo_upload_use();

-- Le fichier d'une photo, à chaque accrochage — même par la clé de
-- service, que la RLS ne retient pas : le webhook de paiement accroche
-- ainsi les photos 4 à 8, où un vendeur glisserait la clé du fichier d'un
-- autre, et rendrait publique la photo d'un lot réservé aux pros. Il
-- appartient au vendeur de l'annonce (celui d'un compte supprimé, à
-- personne), et le ménage ne l'a pas pris : il va disparaître de chez
-- Cloudflare. Le verrou partagé attend un ménage en cours, puis relit.
create or replace function public.check_photo_upload() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  upload public.photo_uploads%rowtype;
begin
  select * into upload from public.photo_uploads where key = new.storage_path for share;
  if not found then
    -- La clé étrangère refuse, avec son propre message.
    return new;
  end if;
  if upload.owner_id is distinct from (select l.seller_id from public.listings l where l.id = new.listing_id) then
    raise exception 'le fichier % n''appartient pas au vendeur de l''annonce', new.storage_path
      using errcode = '42501';
  end if;
  if upload.purge_started_at is not null then
    raise exception 'le fichier % est en cours de retrait, la photo doit être téléversée de nouveau', new.storage_path
      using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger listing_photos_check_upload before insert or update of storage_path, listing_id on public.listing_photos
  for each row execute function public.check_photo_upload();

-- Un seul passage du ménage à la fois : deux doubleraient le débit envoyé à
-- Cloudflare, qui bloque alors tout le compte cinq minutes — dépôts des
-- vendeurs compris —, et Vercel Cron livre parfois deux fois une échéance.
-- Le premier lot d'un passage prend le bail pour cinq minutes, au-delà de la
-- vie d'une fonction ; release_photo_purge le rend. Un passage tué le garde
-- jusqu'à l'échéance.
create table public.photo_purge_lease (
  singleton boolean primary key default true check (singleton),
  run_id uuid not null,
  expires_at timestamptz not null
);

-- Ce que le ménage retire, lot après lot (purgePhotoFiles,
-- src/lib/photo-purge.ts), avec la clé de service : les fichiers qu'aucune
-- photo n'affiche, passé leur délai de grâce — 7 jours jamais accroché, 1
-- jour décroché : ceux de src/lib/photo-hosting.ts (tests/schema-sync).
-- Chaque fichier rendu est marqué (purge_started_at) : plus rien ne
-- l'accroche, et sa ligne ne part qu'une fois le retrait confirmé
-- (forget_purged_photos). Marqué sans être retiré, il revient en reprise
-- (retry) une heure plus tard — un passage en cours le traite peut-être —,
-- puis repart en fin de file ; les reprises ne gardent que la moitié du lot
-- tant que des fichiers neufs attendent. De 1 à 1 000 fichiers par lot.
create or replace function public.claim_photo_purge(purge_run uuid, batch_size integer default 100)
returns table (file_key text, retry boolean)
language plpgsql security definer set search_path = public as $$
declare
  candidate text;
  reserved integer;
  taken integer := 0;
begin
  -- La relecture sous verrou ne voit une photo accrochée entre-temps qu'avec
  -- un instantané neuf à chaque instruction : celui de read committed.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'le ménage ne tourne qu''au niveau read committed, pas %', current_setting('transaction_isolation')
      using errcode = '55000';
  end if;
  if batch_size is null or batch_size not between 1 and 1000 then
    raise exception 'un lot du ménage compte de 1 à 1 000 fichiers, pas %', coalesce(batch_size::text, 'null')
      using errcode = '22023';
  end if;
  insert into public.photo_purge_lease as lease (singleton, run_id, expires_at)
       values (true, purge_run, now() + interval '5 minutes')
  on conflict (singleton) do update set run_id = excluded.run_id, expires_at = excluded.expires_at
       where lease.expires_at < now();
  if not exists (select 1 from public.photo_purge_lease where run_id = purge_run and expires_at > now()) then
    raise exception 'un autre passage du ménage est en cours' using errcode = '55P03';
  end if;
  select count(*) into reserved
    from (select 1 from public.photo_uploads u
           where u.purge_started_at < now() - interval '1 hour' limit batch_size / 2) stale;
  for candidate in
    select u.key from public.photo_uploads u
     where u.purge_started_at is null
       and not exists (select 1 from public.listing_photos p where p.storage_path = u.key)
       and ((u.detached_at is null and u.created_at < now() - interval '7 days')
            or u.detached_at < now() - interval '1 day')
     order by u.created_at, u.key
     limit batch_size - reserved
     for update of u skip locked
  loop
    -- Relu sous le verrou, avec un instantané neuf : une photo accrochée
    -- entre la sélection et le verrou garde son fichier.
    if not exists (select 1 from public.listing_photos p where p.storage_path = candidate) then
      update public.photo_uploads set purge_started_at = now() where key = candidate;
      file_key := candidate;
      retry := false;
      taken := taken + 1;
      return next;
    end if;
  end loop;
  for candidate in
    select u.key from public.photo_uploads u
     where u.purge_started_at < now() - interval '1 hour'
     order by u.purge_started_at, u.key
     limit batch_size - taken
     for update of u skip locked
  loop
    update public.photo_uploads set purge_started_at = now() where key = candidate;
    file_key := candidate;
    retry := true;
    return next;
  end loop;
end;
$$;

-- La fin d'un passage rend le bail — le sien seulement.
create or replace function public.release_photo_purge(purge_run uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.photo_purge_lease where run_id = purge_run;
$$;

-- Le retrait confirmé par Cloudflare : les lignes des fichiers partis
-- s'effacent en un appel — mille clés dans l'adresse d'une suppression
-- PostgREST (key=in.(…)) dépasseraient ce que les relais acceptent, pas le
-- corps d'un appel de fonction. Seules les lignes marquées par le ménage
-- partent. Rend le nombre de lignes effacées.
create or replace function public.forget_purged_photos(file_keys text[]) returns integer
language sql security definer set search_path = public as $$
  with forgotten as (
    delete from public.photo_uploads
     where key = any (file_keys) and purge_started_at is not null
    returning 1
  )
  select count(*)::integer from forgotten;
$$;

-- ---------------------------------------------------------------------
-- Séries et produits : deux tables de liaison vers les référentiels.
-- ---------------------------------------------------------------------

create table public.listing_editions (
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- « pokemon-ev08 », jamais le code seul : voir public.editions.
  edition_id text not null references public.editions (id),
  -- L'ordre de saisie : un vendeur cite ses séries dans l'ordre où elles lui
  -- viennent, et son annonce les relit ainsi. Douze au plus : au-delà, le
  -- formulaire demande de laisser vide.
  position smallint not null check (position between 0 and 11),
  primary key (listing_id, edition_id),
  unique (listing_id, position)
);

create table public.listing_tags (
  listing_id uuid not null references public.listings (id) on delete cascade,
  tag public.product_tag not null,
  primary key (listing_id, tag)
);

create index listing_editions_by_edition on public.listing_editions (edition_id);
create index listing_tags_by_tag on public.listing_tags (tag);

-- Une série appartient au jeu de son annonce, un produit existe pour ce jeu :
-- « sans ce contrôle, un formulaire trafiqué déposerait une extension Magic
-- sur une annonce Pokémon, et le filtre par série deviendrait faux pour tout
-- le monde » (src/lib/schemas/listing-form.ts). La base le refuse aussi.
create or replace function public.check_listing_edition() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.listings l
                 join public.editions e on e.game_id = l.game_id
                 where l.id = new.listing_id and e.id = new.edition_id) then
    raise exception 'la série % n''appartient pas au jeu de l''annonce', new.edition_id using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listing_editions_match_game before insert or update on public.listing_editions
  for each row execute function public.check_listing_edition();

create or replace function public.check_listing_tag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.listings l
                 join public.product_tag_games p on p.game_id = l.game_id
                 where l.id = new.listing_id and p.tag = new.tag) then
    raise exception 'le produit % n''existe pas pour le jeu de l''annonce', new.tag using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listing_tags_match_game before insert or update on public.listing_tags
  for each row execute function public.check_listing_tag();

-- Changer le jeu d'une annonce laisserait ses séries et ses produits dans
-- l'ancien. La modification remplace les deux listes (supabase/README.md,
-- « Écritures ») : les retirer, changer le jeu, puis réinsérer.
create or replace function public.check_listing_game_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.listing_editions le
             join public.editions e on e.id = le.edition_id
             where le.listing_id = new.id and e.game_id <> new.game_id)
     or exists (select 1 from public.listing_tags lt
                where lt.listing_id = new.id
                  and not exists (select 1 from public.product_tag_games p
                                  where p.tag = lt.tag and p.game_id = new.game_id)) then
    raise exception 'changer de jeu : retirez d''abord les séries et les produits de l''ancien' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listings_game_change before update of game_id on public.listings
  for each row when (old.game_id is distinct from new.game_id)
  execute function public.check_listing_game_change();

-- ---------------------------------------------------------------------
-- Lectures et compteurs appelés en RPC par la couche données.
-- ---------------------------------------------------------------------

-- Les lots en ligne dans un rayon, les plus proches d'abord : c'est
-- getListings({ origin, maxDistanceKm }) sans la pagination, que le client
-- ajoute avec .range(). security invoker : la RLS des annonces s'applique.
create or replace function public.listings_within(
  origin_lat double precision, origin_lon double precision, radius_km integer
) returns setof public.listings
language sql stable as $$
  select l.* from public.listings l
  where l.status <> 'sold'
    -- Pré-filtre sur une boîte englobante, que l'index sait servir, avant le
    -- calcul exact.
    and l.latitude between origin_lat - radius_km / 111.0 and origin_lat + radius_km / 111.0
    and public.distance_km(origin_lat, origin_lon, l.latitude, l.longitude) <= radius_km
  order by public.distance_km(origin_lat, origin_lon, l.latitude, l.longitude);
$$;

-- Ce qu'un particulier a le droit de savoir de l'espace pro : combien de
-- lots y attendent, et de quels jeux — jamais un titre, jamais un prix
-- (getProOnlyCountByGame, src/lib/data/listings.ts). La RLS lui cache ces
-- lignes : compté sous sa session, le total serait zéro, et « 3 autres lots
-- sont réservés aux professionnels » disparaîtrait de l'accueil comme des
-- listes. security definer, et rien ne sort qu'un nombre par jeu.
create or replace function public.pro_only_count_by_game()
returns table (game_id public.game_id, listing_count integer)
language sql stable security definer set search_path = public as $$
  select l.game_id, count(*)::integer
    from public.listings l
   where l.audience = 'pros' and l.status <> 'sold'
   group by l.game_id
   order by l.game_id;
$$;

-- Le compteur de la fiche et du tableau de bord (« 412 vues », « Vues
-- cumulées »). Aucun rôle connecté ne l'écrit — un vendeur gonflerait le sien
-- depuis la console —, et une mise à jour PostgREST ne sait pas incrémenter :
-- le serveur appelle cette fonction avec la clé de service (droits,
-- migration 10).
create or replace function public.record_listing_view(listing uuid) returns void
language sql security definer set search_path = public as $$
  update public.listings set view_count = view_count + 1 where id = listing;
$$;
