-- Migration 14 : une sorte de notification de plus, « listing_expiring » —
-- une annonce arrive à expiration, et son vendeur la prolonge en un clic
-- (migration 15).
--
-- Seule dans son fichier, comme la migration 12 : PostgreSQL refuse
-- d'utiliser une valeur ajoutée à une énumération dans la transaction qui
-- l'ajoute, et l'éditeur SQL de Supabase joue un fichier collé en une seule
-- transaction. La migration 15, qui l'emploie, se colle ensuite, à part.

alter type public.notification_kind add value if not exists 'listing_expiring';
