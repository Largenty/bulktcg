"use client";

import { useEffect, useMemo, useState } from "react";
import { OTHER_GAME_ID, isGameId, type GameId } from "@/types/game";
import type { Edition } from "@/types/edition";
import type { EditionBlock, EditionCatalog } from "@/lib/edition-catalog";
import { routes } from "@/lib/routes";

/* Les séries du jeu choisi, demandées au serveur (/series) quand le vendeur
   change de jeu : le référentiel — plus de deux cents séries — ne part pas
   dans le navigateur. Celles d'un jeu déjà demandé sont gardées : revenir à
   Pokémon ne redemande rien. Le serveur rend celles du jeu déjà choisi avec
   la page (modification, dépôt en réponse à une demande), séries retirées
   que l'annonce porte comprises.

   blocks vaut null pendant la demande, et « failed » dit qu'elle a échoué :
   le formulaire l'écrit au lieu d'une liste vide qui ferait croire que le
   jeu n'a pas de séries. */
export type GameEditions = {
  blocks: EditionBlock[] | null;
  failed: boolean;
  /* Toutes les séries reçues : l'aperçu et le récapitulatif y lisent les
     codes des séries cochées. */
  byId: ReadonlyMap<string, Edition>;
};

export function useGameEditions(gameId: string, initial: EditionCatalog | null | undefined): GameEditions {
  const [loaded, setLoaded] = useState<Partial<Record<GameId, EditionBlock[]>>>(() =>
    initial ? { [initial.gameId]: initial.blocks } : {},
  );
  const [failedGame, setFailedGame] = useState<GameId | null>(null);
  const game = isGameId(gameId) && gameId !== OTHER_GAME_ID ? gameId : null;
  const needsFetch = game !== null && loaded[game] === undefined;

  useEffect(() => {
    if (!game || !needsFetch) return;
    const controller = new AbortController();
    fetch(routes.gameEditions(game), { signal: controller.signal, headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const catalog = (await response.json()) as EditionCatalog;
        setLoaded((current) => ({ ...current, [game]: catalog.blocks }));
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailedGame(game);
      });
    return () => controller.abort();
  }, [game, needsFetch]);

  const byId = useMemo(
    () => new Map(Object.values(loaded).flatMap((blocks) => blocks.flatMap((block) => block.editions)).map((edition) => [edition.id, edition])),
    [loaded],
  );

  if (game === null) return { blocks: [], failed: false, byId };
  return { blocks: loaded[game] ?? null, failed: failedGame === game && loaded[game] === undefined, byId };
}
