import type { GameId } from "@/types/game";
import { gameColorVariable, gameInkVariable } from "@/lib/game-style";
import { GAME_LABELS } from "@/lib/labels";

type GameBadgeProps = {
  gameId: GameId;
  size?: "sm" | "md";
};

/* Pastille pleine aux couleurs du jeu. La couleur du texte vient du token
   compagnon, mesuré pour tenir le 4,5:1 sur chacun des six fonds. Le nom
   est toujours écrit : la couleur seule ne dirait rien à qui la distingue
   mal. */
export function GameBadge({ gameId, size = "sm" }: GameBadgeProps) {
  return (
    <span
      className={`label inline-flex items-center whitespace-nowrap rounded-[var(--radius-sm)] font-semibold ${
        size === "md" ? "min-h-[30px] px-3" : "min-h-[26px] px-2.5"
      }`}
      style={{
        backgroundColor: gameColorVariable(gameId),
        color: gameInkVariable(gameId),
      }}
    >
      {GAME_LABELS[gameId]}
    </span>
  );
}
