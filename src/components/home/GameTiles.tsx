import type { Game, GameId } from "@/types/game";
import { Icon } from "@/components/ui/Icon";
import { IntentLink } from "@/components/ui/IntentLink";
import { countLabel } from "@/lib/french";
import { gameColorVariable } from "@/lib/game-style";
import { routes } from "@/lib/routes";

type GameTilesProps = {
  games: Game[];
  listingCountByGame: Record<GameId, number>;
  wantedCountByGame: Record<GameId, number>;
};

/* Les jeux en fiches d'intercalaire : une étiquette blanche, bordée en tête
   de la couleur du jeu, et les deux côtés du marché comptés — combien de
   lots, combien de gens qui cherchent. Les anciennes tuiles en aplat saturé
   faisaient un damier de couleurs criardes au milieu de la page ; la couleur
   ne sert plus ici qu'à ce qu'elle veut dire, « ce jeu-là ». */
export function GameTiles({ games, listingCountByGame, wantedCountByGame }: GameTilesProps) {
  return (
    <ul className="scroll-row -mx-[var(--container-pad)] list-none px-[var(--container-pad)] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:px-0 xl:grid-cols-6">
      {games.map((game) => (
        <li key={game.id} className="w-[168px] min-w-0 sm:w-auto">
          <IntentLink
            href={routes.game(game.id)}
            className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line-strong)] bg-[var(--card)] px-4 pb-4 pt-6 transition-[transform,border-color] duration-150 hover:-translate-y-1 hover:border-[var(--ink)]"
          >
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[6px]" style={{ backgroundColor: gameColorVariable(game.id) }} />
            <span className="flex items-center justify-between gap-2">
              <span className="display text-[length:var(--text-h3)]">{game.label}</span>
              <Icon name="arrowRight" size={18} className="shrink-0 transition-transform group-hover:translate-x-1" />
            </span>
            {/* Deux segments insécables : dans une tuile étroite, le second
                passe à la ligne entier plutôt que de déborder. */}
            <span className="mono flex flex-wrap gap-x-1.5 text-[length:var(--text-xs)] text-[var(--muted)]">
              <span className="whitespace-nowrap">
                {countLabel(listingCountByGame[game.id], "lot")}
                <span aria-hidden="true"> ·</span>
                <span className="sr-only">,</span>
              </span>
              <span className="whitespace-nowrap">{countLabel(wantedCountByGame[game.id], "recherche")}</span>
            </span>
          </IntentLink>
        </li>
      ))}
    </ul>
  );
}
