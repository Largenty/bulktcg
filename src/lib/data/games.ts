import "server-only";
import { cache } from "react";
import { GAME_IDS, isGameId, type Game } from "@/types/game";
import { GAME_LABELS } from "@/lib/labels";
import { gameFromSegment } from "@/lib/routes";

/* Dérivée de GAME_IDS, en phase 1 comme en phase 2 : le jeu est un type
   énuméré en base (game_id), pas une table — une table games serait une
   copie de plus de la liste, et les libellés comme les couleurs n'y
   auraient rien à faire (lib/labels.ts, styles/tokens.css). L'énumération
   garde l'ordre d'affichage ; tests/schema-sync.test.mjs la compare à
   GAME_IDS. Voir docs/donnees/MLD.md. */
const GAMES: Game[] = GAME_IDS.map((id, index) => ({
  id,
  label: GAME_LABELS[id],
  colorToken: `--${id}`,
  sortOrder: index + 1,
}));

const GAMES_BY_ID = new Map(GAMES.map((game) => [game.id, game]));

export const getGames = cache(async (): Promise<Game[]> => {
  return GAMES.toSorted((left, right) => left.sortOrder - right.sortOrder);
});

/* Le jeu d'une page, par le segment de son adresse (/one-piece, pas
   /onepiece). */
export const getGameBySegment = cache(async (segment: string): Promise<Game | null> => {
  const gameId = gameFromSegment(segment);
  return gameId ? (GAMES_BY_ID.get(gameId) ?? null) : null;
});

export { isGameId };
