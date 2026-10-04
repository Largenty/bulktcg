import type { GameId } from "@/types/game";

/* Ce qu'on sait d'une série sans le référentiel, qui reste sur le serveur
   (lib/editions.ts) : son identifiant porte son jeu — « pokemon-ev08 » —, et
   la base le tient (editions_id_carries_game). Assez pour qu'un formulaire
   écarte une série d'un autre jeu ; que la série existe, seul le serveur le
   dit. */
export const EDITION_ID_PATTERN = /^[a-z]+-[a-z0-9]+(-[a-z0-9]+)*$/;

export function isEditionOfGame(editionId: string, gameId: GameId | string): boolean {
  return EDITION_ID_PATTERN.test(editionId) && editionId.startsWith(`${gameId}-`);
}
