-- BulkTCG — migration 5 sur 10 : les demandes de recherche.
--
-- L'annonce vue de l'autre côté, volontairement plus pauvre : ni photo, ni
-- état, ni prix ferme. Un acheteur décrit un besoin — un jeu, un budget
-- plafond, un rayon —, pas un objet qu'il possède.

create table public.wanted_listings (
  id uuid primary key default gen_random_uuid(),
  -- Même lien permanent que les annonces, même forme (src/lib/slug.ts).
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  game_id public.game_id not null,
  title text not null check (char_length(title) between 12 and 90),
  description text not null check (char_length(description) between 30 and 2000),
  -- null = n'importe quel format, n'importe quel budget, n'importe quel volume.
  lot_type public.lot_type,
  max_price_cents integer check (max_price_cents is null or max_price_cents > 0),
  min_card_count integer check (min_card_count is null or min_card_count > 0),
  -- Le point de départ de l'acheteur, centre de son rayon : même référentiel
  -- et même recopie que pour les annonces (stamp_commune, migration 4).
  city text not null,
  postal_code text not null check (postal_code ~ '^\d{5}$'),
  department_code text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  -- Toujours renseignée : sans elle, une demande n'est croisable avec rien.
  max_distance_km integer not null check (max_distance_km between 5 and 200),
  status public.wanted_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- « Trouvé » est daté : c'est la seule mesure honnête de l'utilité du
  -- croisement. « Abandonnée » ne l'est pas.
  fulfilled_at timestamptz,
  constraint wanted_fulfilled_at_matches_status check ((status = 'fulfilled') = (fulfilled_at is not null)),
  constraint wanted_commune_fkey foreign key (city, postal_code) references public.communes (name, postal_code)
);

create index wanted_open_by_game on public.wanted_listings (status, game_id, created_at desc);
create index wanted_by_buyer on public.wanted_listings (buyer_id, created_at desc);

create trigger wanted_updated_at before update on public.wanted_listings
  for each row execute function public.set_updated_at();

create trigger wanted_stamp_commune before insert or update of city, postal_code, department_code, latitude, longitude on public.wanted_listings
  for each row execute function public.stamp_commune();

-- « Qui viendrait jusqu'à moi » : les demandes ouvertes dont le rayon de
-- l'acheteur couvre le point donné. C'est le rayon de l'acheteur qui décide,
-- jamais celui du vendeur.
create or replace function public.wanted_reaching(
  origin_lat double precision, origin_lon double precision
) returns setof public.wanted_listings
language sql stable as $$
  select w.* from public.wanted_listings w
  where w.status = 'open'
    and public.distance_km(origin_lat, origin_lon, w.latitude, w.longitude) <= w.max_distance_km
  order by public.distance_km(origin_lat, origin_lon, w.latitude, w.longitude);
$$;
