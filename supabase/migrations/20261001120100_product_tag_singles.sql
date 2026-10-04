-- Migration 12 : un produit de plus, « Cartes à l'unité » (singles) — des
-- cartes choisies qui partent avec le lot, jamais une annonce pour une seule
-- carte. La valeur prend sa place après « graded », dans l'ordre du code
-- (src/lib/product-tags.ts).
--
-- Seule dans son fichier : PostgreSQL refuse d'utiliser une valeur ajoutée à
-- une énumération dans la transaction qui l'ajoute, et l'éditeur SQL de
-- Supabase joue un fichier collé en une seule transaction. Les jeux qui la
-- proposent arrivent donc par la migration suivante, collée après celle-ci.

alter type public.product_tag add value if not exists 'singles' after 'graded';
