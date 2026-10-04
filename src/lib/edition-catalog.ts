import type { Edition } from "@/types/edition";
import type { GameId } from "@/types/game";

/* Les séries proposées pour un jeu, telles que /series les rend et que le
   formulaire de dépôt les coche : groupées par bloc, dans l'ordre du
   référentiel. Le référentiel lui-même reste sur le serveur (lib/editions). */
export type EditionBlock = { block: string; editions: Edition[] };
export type EditionCatalog = { gameId: GameId; blocks: EditionBlock[] };

/* Le libellé du bloc qui garde, en modification, les séries cochées que le
   référentiel ne propose plus : décocher reste possible, recocher non. */
export const RETIRED_EDITIONS_BLOCK = "Plus proposées";
