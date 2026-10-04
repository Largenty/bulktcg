-- BulkTCG — migration 6 sur 10 : la messagerie.
--
-- Une conversation porte toujours sur un lot : c'est ce qui permet
-- d'afficher sa photo, son prix et son statut en tête du fil, et de savoir
-- de quoi on parle trois semaines plus tard. Elle naît avec son premier
-- message — celui de l'acheteur depuis la fiche, ou celui du vendeur qui
-- propose son lot à une demande de recherche.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  -- Le vendeur de l'annonce, jamais un tiers : la politique d'ouverture le
  -- vérifie (migration 10).
  seller_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  -- Supprimer une conversation ne la retire que de sa propre boîte : l'autre
  -- partie garde son fil, et un nouveau message la fait revenir (la lecture
  -- compare cette date à last_message_at). Posées par hide_conversation().
  buyer_deleted_at timestamptz,
  seller_deleted_at timestamptz,
  -- Écrire deux fois au même vendeur pour le même lot reprend le fil.
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);

create index conversations_by_buyer on public.conversations (buyer_id, last_message_at desc);
create index conversations_by_seller on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 2 and 2000),
  -- Posée par le destinataire seul, et c'est la seule colonne qu'il modifie
  -- (droits, migration 10).
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_by_conversation on public.messages (conversation_id, created_at);
-- Le compteur de non-lus ne compte que les messages reçus.
create index messages_unread on public.messages (conversation_id) where read_at is null;
-- La suppression d'un compte emporte ses messages.
create index messages_by_sender on public.messages (sender_id);

create or replace function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation after insert on public.messages
  for each row execute function public.touch_conversation();

-- Se retirer d'une conversation : seule sa propre colonne bouge. Aucune
-- mise à jour directe n'est permise sur conversations (migration 10).
create or replace function public.hide_conversation(conversation uuid) returns void
language sql security definer set search_path = public as $$
  update public.conversations
     set buyer_deleted_at = case when buyer_id = auth.uid() then now() else buyer_deleted_at end,
         seller_deleted_at = case when seller_id = auth.uid() then now() else seller_deleted_at end
   where id = conversation and auth.uid() in (buyer_id, seller_id);
$$;
