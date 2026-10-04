/* La liste des jeux, écrite une fois. Elle était recopiée dans onze fichiers
   — schémas, requêtes, mappers, filtres, tranche — et Riftbound manquait
   partout sans que rien ne le signale. Tout ce qui énumère les jeux importe
   désormais ce tableau ; tests/games.test.mjs refuse qu'on le recopie.

   L'ordre est celui de l'affichage : menus, tuiles, tranche.

   Lorcana a rejoint les jeux nommés en septembre 2026, entre One Piece et
   Riftbound. « Autre » ferme la liste : Digimon, Flesh and Blood, Star Wars
   Unlimited… tous les jeux qui n'ont pas leur intercalaire. Sans lui, leurs
   lots n'avaient nulle part où aller. */
export const GAME_IDS = ["pokemon", "magic", "onepiece", "lorcana", "riftbound", "yugioh", "naruto", "other"] as const;

export type GameId = (typeof GAME_IDS)[number];

/* « Autre » n'est pas un jeu : il n'a ni couleur vive ni référentiel de
   séries, et il n'entre ni dans la tranche ni dans le logo, qui signent le
   site avec les jeux qu'il nomme. Les jeux nommés, pour ces usages-là. */
export const OTHER_GAME_ID = "other" satisfies GameId;
export const NAMED_GAME_IDS = GAME_IDS.filter((gameId) => gameId !== OTHER_GAME_ID);

export function isGameId(value: string): value is GameId {
  return (GAME_IDS as readonly string[]).includes(value);
}

export type Game = {
  id: GameId;
  label: string;
  /* Nom du token CSS, pas une valeur hex : les composants écrivent
     var(--pokemon) et ne connaissent jamais la couleur elle-même. */
  colorToken: `--${GameId}`;
  sortOrder: number;
};
