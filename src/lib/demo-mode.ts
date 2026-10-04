/* Pourquoi rien n'est enregistré : sans les variables de Supabase, le site
   tourne sur ses données de démonstration (lib/data/source.ts), et chaque
   écriture rend « not-persisted ». La raison s'écrit une fois, ici : quinze
   comptes rendus parlaient encore d'une base « qui arrive en phase 2 » une
   fois la base branchée — un mot de l'équipe, que le visiteur n'a aucune
   raison de connaître. tests/interface-copy.test.mjs refuse qu'il revienne. */
export const DEMO_MODE_REASON = "le site tourne sur des données de démonstration";
