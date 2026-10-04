-- Migration 13 : « Cartes à l'unité » existe pour tous les jeux, « Autre »
-- compris. À coller après la migration 12, dans une exécution à part : la
-- valeur 'singles' doit être validée avant d'être employée ici.

insert into public.product_tag_games (tag, game_id) values
  ('singles', 'pokemon'), ('singles', 'magic'), ('singles', 'onepiece'), ('singles', 'lorcana'), ('singles', 'riftbound'), ('singles', 'yugioh'), ('singles', 'naruto'), ('singles', 'other')
on conflict do nothing;
