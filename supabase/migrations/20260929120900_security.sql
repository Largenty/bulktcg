-- BulkTCG — migration 10 sur 10 : sécurité au niveau des lignes et droits.
--
-- Supabase accorde par défaut tous les droits sur le schéma public aux rôles
-- de l'API (anon, authenticated) : c'est la RLS qui fait le tri, ligne par
-- ligne. Là où une politique laisse quelqu'un modifier sa ligne, des droits
-- de colonnes disent lesquelles : sinon le vendeur se mettrait « À la une »
-- depuis la console du navigateur.

-- Un pro au forfait actif. security definer : la politique de lecture des
-- annonces l'appelle ligne à ligne ; elle ne révèle rien que le profil,
-- public, ne dise déjà.
create or replace function public.is_active_pro(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = uid and account_type = 'pro' and pro_until > now()
  );
$$;

alter table public.communes enable row level security;
alter table public.editions enable row level security;
alter table public.product_tag_games enable row level security;
alter table public.profiles enable row level security;
alter table public.account_settings enable row level security;
alter table public.listings enable row level security;
alter table public.photo_uploads enable row level security;
alter table public.photo_purge_lease enable row level security;
alter table public.listing_photos enable row level security;
alter table public.listing_editions enable row level security;
alter table public.listing_tags enable row level security;
alter table public.wanted_listings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.deals enable row level security;
alter table public.reviews enable row level security;
alter table public.listing_waitlist enable row level security;
alter table public.notifications enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- Référentiels : lisibles par tous, écrits par les seuls imports (clé de
-- service). Un appel direct à l'API n'invente ni une commune, ni une série.
create policy "communes lisibles par tous" on public.communes for select using (true);
create policy "séries lisibles par tous" on public.editions for select using (true);
create policy "produits par jeu lisibles par tous" on public.product_tag_games for select using (true);
revoke insert, update, delete on public.communes, public.editions, public.product_tag_games from anon, authenticated;

-- Profils : publics en lecture ; chacun ne modifie que le sien.
create policy "profils lisibles par tous" on public.profiles for select using (true);
create policy "profil modifiable par son titulaire" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profil créé par son titulaire" on public.profiles
  for insert with check (id = auth.uid());

-- La politique ci-dessus laisse chacun modifier sa ligne : sans restriction
-- de colonnes, n'importe qui se passerait pro et prolongerait son forfait
-- depuis la console du navigateur. Le type de compte, la fin du forfait et
-- les compteurs ne s'écrivent qu'avec la clé service_role — le service de
-- paiement et les déclencheurs.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, username, city, postal_code, avatar_initials, bio) on public.profiles to authenticated;
grant update (username, city, postal_code, avatar_initials, bio, company_name, shop_address, shop_hours, shop_website) on public.profiles to authenticated;

-- Réglages : lus et modifiés par leur titulaire seul. Ils naissent avec le
-- profil (create_account_settings) et partent avec lui.
create policy "réglages lus par leur titulaire" on public.account_settings for select using (user_id = auth.uid());
create policy "réglages modifiés par leur titulaire" on public.account_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.account_settings from anon, authenticated;
grant update (alert_matches, alert_messages) on public.account_settings to authenticated;

-- Annonces : lisibles selon leur audience — une annonce vendue reste servie,
-- son lien a été partagé ; une annonce réservée ne l'est qu'à son vendeur et
-- aux pros au forfait actif. Qui en a déjà parlé la garde aussi : passée
-- « pros » après coup, elle reste lisible depuis sa conversation, qui sinon
-- renverrait vers une annonce disparue (getListingForViewer en est le
-- miroir). Photos, séries et produits suivent, leurs politiques lisant
-- l'annonce sous cette même règle. Écriture réservée au vendeur.
create policy "annonces lisibles selon leur audience" on public.listings for select using (
  audience = 'everyone' or seller_id = auth.uid() or public.is_active_pro(auth.uid())
  or exists (select 1 from public.conversations c
             where c.listing_id = listings.id and auth.uid() in (c.buyer_id, c.seller_id))
);
create policy "annonce déposée par son vendeur" on public.listings
  for insert with check (seller_id = auth.uid());
create policy "annonce modifiée par son vendeur" on public.listings
  for update using (seller_id = auth.uid()) with check (seller_id = auth.uid());

-- Comme pour les profils : la politique ci-dessus laisse le vendeur modifier
-- sa ligne, et sans restriction de colonnes il se mettrait « À la une » ou
-- « Urgent » sans payer, ou gonflerait son compteur de vues, depuis la console
-- du navigateur. Les options payantes et les compteurs ne s'écrivent qu'avec
-- la clé service_role. Ces deux listes sont celles de ListingInsert et de
-- ListingUpdate (src/lib/data/rows.ts) : tests/schema-security.test.mjs les compare.
revoke insert, update on public.listings from anon, authenticated;
grant insert (slug, seller_id, game_id, title, description, lot_type, card_count, weight_kg, condition, language, price_cents, city, postal_code, department_code, latitude, longitude, status, audience, open_to_trade, trade_note) on public.listings to authenticated;
grant update (game_id, title, description, lot_type, card_count, weight_kg, condition, language, price_cents, previous_price_cents, city, postal_code, department_code, latitude, longitude, status, audience, open_to_trade, trade_note, sold_at) on public.listings to authenticated;
create policy "annonce supprimée par son vendeur" on public.listings
  for delete using (seller_id = auth.uid());

-- Les compteurs et les décomptes publics passent par des fonctions : le
-- compteur de vues n'est incrémenté que par le serveur, avec la clé de
-- service ; le décompte des lots réservés est ouvert à tous, il ne rend
-- qu'un nombre par jeu.
revoke execute on function public.record_listing_view(uuid) from public, anon, authenticated;
grant execute on function public.record_listing_view(uuid) to service_role;

-- Tables de liaison : suivent l'annonce. La sous-requête sur listings est
-- elle-même soumise à la politique ci-dessus : ce qu'on ne voit pas de
-- l'annonce, on ne le voit pas non plus de ses photos, séries et produits.
create policy "photos lisibles avec leur annonce" on public.listing_photos for select using (
  exists (select 1 from public.listings l where l.id = listing_id)
);
-- Une photo vient des téléversements de son vendeur, jamais de ceux d'un
-- autre : une photo reprise porterait le pseudo d'un autre dans son
-- filigrane, et c'est précisément ce que le filigrane promet de rendre
-- visible. Le registre en tranche — un préfixe de chemin ne le pourrait
-- pas, voir photo_uploads (migration 4).
create policy "photos écrites par le vendeur" on public.listing_photos for all
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
    and exists (select 1 from public.photo_uploads u where u.key = storage_path and u.owner_id = auth.uid())
  );

-- Le registre des téléversements : écrit par le serveur seul, avec la clé
-- de service, au moment où il délivre l'adresse de dépôt — un compte qui
-- s'y inscrirait lui-même pourrait y déclarer l'image d'un autre. Chacun y
-- lit ses propres fichiers : c'est ce que consulte la politique ci-dessus.
create policy "téléversements lus par leur propriétaire" on public.photo_uploads
  for select using (owner_id = auth.uid());
revoke all on public.photo_uploads from anon;
revoke insert, update, delete on public.photo_uploads from authenticated;
-- Le ménage rend les fichiers de tous les comptes, les promet au retrait,
-- puis efface leur registre : il ne se lance qu'avec la clé de service,
-- depuis la tâche planifiée, et son bail n'est à personne d'autre.
revoke execute on function public.claim_photo_purge(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_photo_purge(uuid, integer) to service_role;
revoke execute on function public.release_photo_purge(uuid) from public, anon, authenticated;
grant execute on function public.release_photo_purge(uuid) to service_role;
revoke execute on function public.forget_purged_photos(text[]) from public, anon, authenticated;
grant execute on function public.forget_purged_photos(text[]) to service_role;
revoke all on public.photo_purge_lease from anon, authenticated;
create policy "séries lisibles avec leur annonce" on public.listing_editions for select using (
  exists (select 1 from public.listings l where l.id = listing_id)
);
create policy "séries écrites par le vendeur" on public.listing_editions for all
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "produits lisibles avec leur annonce" on public.listing_tags for select using (
  exists (select 1 from public.listings l where l.id = listing_id)
);
create policy "produits écrits par le vendeur" on public.listing_tags for all
  using (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()))
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));

-- Demandes : publiques en lecture, écriture réservée à l'acheteur.
create policy "demandes lisibles par tous" on public.wanted_listings for select using (true);
create policy "demande déposée par son acheteur" on public.wanted_listings
  for insert with check (buyer_id = auth.uid());
create policy "demande modifiée par son acheteur" on public.wanted_listings
  for update using (buyer_id = auth.uid()) with check (buyer_id = auth.uid());
create policy "demande supprimée par son acheteur" on public.wanted_listings
  for delete using (buyer_id = auth.uid());

-- Les écritures directes n'ont que les colonnes que l'application envoie :
-- celles de WantedInsert, WantedUpdate, ConversationInsert, MessageInsert,
-- BlockInsert et ReportInsert (src/lib/data/rows.ts), que
-- tests/schema-security.test.mjs compare à ces droits. Sans elles, un acheteur
-- rajeunirait sa demande (created_at) pour repasser en tête des « Plus
-- récentes », changerait son lien permanent (slug), et un signalement se
-- déposerait déjà « traité » (resolved_at, qui est à la modération).
revoke insert, update on public.wanted_listings from anon, authenticated;
grant insert (slug, buyer_id, game_id, title, description, lot_type, max_price_cents, min_card_count, city, postal_code, department_code, latitude, longitude, max_distance_km, status) on public.wanted_listings to authenticated;
grant update (game_id, title, description, lot_type, max_price_cents, min_card_count, city, postal_code, department_code, latitude, longitude, max_distance_km, status, fulfilled_at) on public.wanted_listings to authenticated;

-- Conversations : visibles de leurs deux participants, et d'eux seuls.
create policy "conversation lue par ses participants" on public.conversations
  for select using (auth.uid() in (buyer_id, seller_id));
-- Une conversation ne s'ouvre que sur un lot disponible : réservé, il ne
-- reçoit plus de nouvelle demande — on s'inscrit sur sa liste d'attente.
-- Le vendeur désigné est celui de l'annonce : sans ce contrôle, n'importe
-- qui ouvrirait un fil au nom d'un tiers. Et le vendeur n'écrit le premier
-- qu'à quelqu'un qui cherche ce jeu (proposeListing,
-- src/lib/data/message-mutations.ts) : proposer du Magic à qui cherche du
-- Pokémon serait du démarchage. Un lot réservé aux pros ne se discute
-- qu'avec un pro au forfait actif : un particulier ne le lit pas, et son
-- vendeur ne le lui propose pas non plus.
create policy "conversation ouverte par un participant" on public.conversations
  for insert with check (
    auth.uid() in (buyer_id, seller_id)
    and not public.is_blocked_between(buyer_id, seller_id)
    and exists (select 1 from public.listings l
                where l.id = listing_id and l.status = 'available' and l.seller_id = conversations.seller_id
                  and (l.audience = 'everyone' or public.is_active_pro(conversations.buyer_id)))
    and (auth.uid() = buyer_id
         or exists (select 1 from public.wanted_listings w
                    join public.listings l on l.id = conversations.listing_id
                    where w.buyer_id = conversations.buyer_id and w.status = 'open' and w.game_id = l.game_id))
  );
-- Aucune mise à jour directe : se retirer d'une conversation passe par
-- hide_conversation(), qui ne touche que sa propre colonne. Et une
-- conversation ne naît pas déjà « supprimée » d'un côté, ni antidatée.
revoke insert, update on public.conversations from anon, authenticated;
grant insert (listing_id, buyer_id, seller_id) on public.conversations to authenticated;

create policy "messages lus par les participants" on public.messages for select using (
  exists (select 1 from public.conversations c
          where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
);
-- Un compte bloqué n'écrit plus : ni dans le fil existant, ni dans un
-- nouveau (voir la politique d'ouverture ci-dessus).
-- Sur un lot réservé, seuls le vendeur et la personne pour qui il l'est
-- continuent d'écrire : les autres lisent leur fil, mais ne relancent plus.
create policy "message écrit par un participant, en son nom" on public.messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c
              where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id)
                and not public.is_blocked_between(c.buyer_id, c.seller_id))
  and not exists (select 1 from public.conversations c
                  join public.listings l on l.id = c.listing_id
                  where c.id = conversation_id and l.status = 'reserved'
                    and auth.uid() <> c.seller_id and auth.uid() is distinct from l.reserved_for)
  -- Passée « pros » après coup : un particulier relit son fil, il n'y écrit
  -- plus ; le vendeur, lui, peut encore expliquer (getReplyBlock).
  and not exists (select 1 from public.conversations c
                  join public.listings l on l.id = c.listing_id
                  where c.id = conversation_id and l.audience = 'pros'
                    and auth.uid() <> c.seller_id and not public.is_active_pro(auth.uid()))
);
-- Seul le destinataire marque un message comme lu, et c'est tout ce qu'il
-- touche : sans droits de colonnes, la politique le laisserait réécrire le
-- texte qu'on lui a envoyé.
create policy "message marqué lu par son destinataire" on public.messages for update
  using (
    sender_id <> auth.uid()
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
  )
  with check (sender_id <> auth.uid());
-- Un message ne naît ni lu, ni antidaté.
revoke insert, update on public.messages from anon, authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

-- Avis : publics ; écrits par une partie d'une vente clôturée, sur l'autre.
-- Une conversation seule ne suffisait pas : n'importe qui ayant écrit un
-- message pouvait noter un vendeur. La personne notée, son rôle et l'annonce
-- sont posés par stamp_review ; le navigateur ne fournit que la vente et les
-- notes, et un avis ne se modifie pas.
create policy "avis lisibles par tous" on public.reviews for select using (true);
create policy "avis laissé par une partie de la vente" on public.reviews for insert with check (
  reviewer_id = auth.uid()
  and exists (select 1 from public.deals d
              where d.id = reviews.deal_id
                and auth.uid() in (d.buyer_id, d.seller_id)
                and reviews.reviewed_id in (d.buyer_id, d.seller_id))
);
revoke insert, update on public.reviews from anon, authenticated;
grant insert (deal_id, reviewer_id, punctuality, responsiveness, reliability, comment) on public.reviews to authenticated;

-- Ventes : lues par leurs deux parties. Aucune écriture directe : la
-- clôture passe par close_deal(), qui déduit tout de la conversation et
-- n'admet que son vendeur.
create policy "vente lue par ses parties" on public.deals for select using (auth.uid() in (seller_id, buyer_id));
revoke insert, update, delete on public.deals from anon, authenticated;

-- Liste d'attente : chacun ne voit, ne pose et ne retire que son
-- inscription, sur le lot réservé d'un autre. Le vendeur n'en lit que le
-- nombre, par waitlist_count().
create policy "inscription lue par son auteur" on public.listing_waitlist for select using (user_id = auth.uid());
create policy "inscription sur le lot réservé d'un autre" on public.listing_waitlist for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.listings l
              where l.id = listing_id and l.status = 'reserved' and l.seller_id <> auth.uid())
);
create policy "inscription retirée par son auteur" on public.listing_waitlist for delete using (user_id = auth.uid());

-- Notifications : lues et marquées lues par leur destinataire seul. Elles
-- s'écrivent par déclencheur ou avec la clé de service, jamais depuis le
-- navigateur ; la seule colonne modifiable est read_at.
create policy "notifications lues par leur destinataire" on public.notifications for select using (user_id = auth.uid());
create policy "notifications marquées lues par leur destinataire" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Blocages : chacun ne voit, ne pose et ne lève que les siens. Le bloqué
-- n'apprend rien : aucune ligne ne lui est lisible.
create policy "blocages lus par leur auteur" on public.blocks for select using (blocker_id = auth.uid());
create policy "blocage posé par son auteur" on public.blocks for insert with check (blocker_id = auth.uid());
create policy "blocage levé par son auteur" on public.blocks for delete using (blocker_id = auth.uid());
revoke insert, update on public.blocks from anon, authenticated;
grant insert (blocker_id, blocked_id) on public.blocks to authenticated;

-- Signalements : déposés en son nom, lus par la modération seule (clé
-- service_role) — aucune politique de lecture pour le rôle connecté.
create policy "signalement déposé en son nom" on public.reports for insert with check (reporter_id = auth.uid());
revoke insert, update, delete on public.reports from anon, authenticated;
grant insert (reporter_id, target_type, target_id, reason, details) on public.reports to authenticated;
