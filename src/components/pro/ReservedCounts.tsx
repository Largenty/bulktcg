import type { GameId } from "@/types/game";
import { GAME_IDS } from "@/types/game";
import { countLabel } from "@/lib/french";
import { gameColorVariable } from "@/lib/game-style";
import { GAME_LABELS } from "@/lib/labels";

type ReservedCountsProps = {
  counts: Record<GameId, number>;
  isInverse?: boolean;
};

/* Ce qu'un particulier a le droit de savoir de l'espace pro : combien de
   lots y attendent, et de quels jeux. Jamais un titre ni un prix — le
   vendeur a choisi de ne pas les montrer au public. */
export function ReservedCounts({ counts, isInverse = false }: ReservedCountsProps) {
  const games = GAME_IDS.filter((gameId) => counts[gameId] > 0);
  const total = games.reduce((sum, gameId) => sum + counts[gameId], 0);

  if (total === 0) {
    return <p className={isInverse ? "text-[var(--chalk-soft)]" : "text-[var(--ink-soft)]"}>Aucun lot réservé en ce moment.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-baseline gap-2.5">
        <span className="price text-[length:var(--number-2xl)] font-bold leading-none">{total}</span>
        <span className={isInverse ? "text-[var(--chalk-soft)]" : "text-[var(--ink-soft)]"}>
          {total > 1 ? "lots réservés aux pros en ce moment" : "lot réservé aux pros en ce moment"}
        </span>
      </p>
      <ul aria-label="Par jeu" className="flex list-none flex-wrap gap-x-4 gap-y-1.5">
        {games.map((gameId) => (
          <li key={gameId} className="label inline-flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-3 rounded-[var(--radius-sm)]" style={{ backgroundColor: gameColorVariable(gameId) }} />
            {countLabel(counts[gameId], GAME_LABELS[gameId], GAME_LABELS[gameId])}
          </li>
        ))}
      </ul>
    </div>
  );
}
