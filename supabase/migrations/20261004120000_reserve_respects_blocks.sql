-- Migration 17 : réserver respecte les blocages.
--
-- Bloquer empêche d'écrire dans les deux sens, et close_deal() refuse déjà
-- de clôturer une vente entre deux comptes qui se sont bloqués. Réserver ne
-- le vérifiait pas (audit du front, suite, point 4) : un vendeur pouvait
-- réserver son lot pour quelqu'un qu'il avait bloqué — ou qui l'avait bloqué
-- —, et le lot restait « Réservé » pour une personne qui ne pouvait plus
-- écrire dans le fil. Même refus, même code que close_deal() : 42501, que le
-- site lit comme « introuvable » (src/lib/data/mutation-result.ts).
--
-- Seule la vérification s'ajoute : la fonction reste celle de la migration
-- 8, qu'elle remplace.

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
  if public.is_blocked_between(thread.seller_id, thread.buyer_id) then
    raise exception 'conversation bloquée' using errcode = '42501';
  end if;
  update public.listings set status = 'reserved', reserved_for = thread.buyer_id
   where id = thread.listing_id and status <> 'sold';
end;
$$;
