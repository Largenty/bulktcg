-- BulkTCG — migration 9 sur 10 : bloquer et signaler.

-- ---------------------------------------------------------------------
-- Blocages : bloquer empêche d'écrire dans les deux sens, dans le fil
-- existant comme dans un nouveau. On ne bloque que quelqu'un avec qui l'on
-- a parlé (src/lib/data/conversation-mutations.ts).
-- ---------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- L'autre sens du contrôle, et la suppression du compte bloqué.
create index blocks_by_blocked on public.blocks (blocked_id);

-- security definer : la RLS ne montre à chacun que ses propres blocages, or
-- les politiques d'écriture doivent aussi voir celui que l'autre a posé.
-- Seulement pour une paire dont l'appelant fait partie : sans cette garde,
-- la fonction, appelable par tous en RPC, dirait qui bloque qui entre deux
-- autres comptes — et « le bloqué n'apprend rien ». Les politiques et
-- close_deal() l'appellent toujours avec l'appelant parmi les deux.
create or replace function public.is_blocked_between(first_user uuid, second_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(auth.uid() in (first_user, second_user), false)
     and exists (
       select 1 from public.blocks
        where (blocker_id = first_user and blocked_id = second_user)
           or (blocker_id = second_user and blocked_id = first_user)
     );
$$;

-- ---------------------------------------------------------------------
-- Signalements : un motif dans une liste fermée, un détail facultatif, lus
-- par la modération seule. La cible est désignée par son type et son
-- identifiant, sans clé étrangère : elle peut être une annonce, un compte,
-- une conversation ou une demande, et le signalement doit survivre à sa
-- disparition pour que la modération garde la trace.
-- ---------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target not null,
  target_id uuid not null,
  reason public.report_reason not null,
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- Signaler deux fois la même chose ne compte qu'une fois.
  unique (reporter_id, target_type, target_id)
);

-- On ne signale ni ce qu'on ne peut pas lire — une annonce réservée aux pros
-- pour un particulier, la conversation des autres —, ni soi-même
-- (src/lib/data/report-mutations.ts). La couche données résout la cible
-- côté serveur ; la base refuse en dernier recours. security invoker, le
-- défaut : ces lectures passent par la RLS de celui qui signale, et c'est
-- elle qui dit ce qu'il peut lire.
create or replace function public.check_report_target() returns trigger
language plpgsql set search_path = public as $$
declare
  owner_id uuid;
begin
  case new.target_type
    when 'listing' then
      select seller_id into owner_id from public.listings where id = new.target_id;
    when 'wanted' then
      select buyer_id into owner_id from public.wanted_listings where id = new.target_id;
    when 'profile' then
      select id into owner_id from public.profiles where id = new.target_id;
    when 'conversation' then
      select case when buyer_id = new.reporter_id then seller_id else buyer_id end into owner_id
        from public.conversations where id = new.target_id;
  end case;
  if owner_id is null then
    raise exception 'cible du signalement introuvable' using errcode = 'P0002';
  end if;
  if owner_id = new.reporter_id then
    raise exception 'on ne se signale pas soi-même' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger reports_check_target before insert on public.reports
  for each row execute function public.check_report_target();
