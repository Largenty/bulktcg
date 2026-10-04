import type { CSSProperties } from "react";
import type { Game, GameId } from "@/types/game";
import { HashPreservingLink } from "@/components/market/HashPreservingLink";
import { formatCount } from "@/lib/format";
import { gameColorVariable, gameInkVariable } from "@/lib/game-style";

type GameDividersProps = {
  label: string;
  games: Game[];
  countByGame: Record<GameId, number>;
  totalCount: number;
  /* L'intercalaire ouvert ; null pour « Tous les jeux ». */
  activeGameId: GameId | null;
  /* L'adresse de chaque intercalaire, null pour « Tous les jeux » : une page
     par jeu pour les ventes (/pokemon), un paramètre pour les demandes. */
  hrefFor: (gameId: GameId | null) => string;
  /* L'accueil montre les mêmes intercalaires sans être la page d'un jeu :
     l'onglet ouvert y est marqué, pas désigné comme page courante. */
  isCurrentPage?: boolean;
};

/* Les jeux comme les intercalaires d'une boîte de rangement : un onglet par
   jeu, bordé de sa couleur — la rangée est la légende des couleurs qu'on
   retrouve sur chaque vignette —, posé sur un filet d'encre. L'onglet ouvert
   prend l'aplat de sa couleur, sans que rien ne bouge.

   Des liens et non des boutons : changer de jeu change de page — l'adresse,
   le titre, la balise canonique —, et un lien se suit sans JavaScript. */
export function GameDividers({ label, games, countByGame, totalCount, activeGameId, hrefFor, isCurrentPage = true }: GameDividersProps) {
  const marker = (isActive: boolean) =>
    !isActive ? {} : isCurrentPage ? { "aria-current": "page" as const } : { "data-active": "" };

  return (
    <nav aria-label={label}>
      <ul className="dividers scroll-row -mx-[var(--container-pad)] list-none px-[var(--container-pad)] sm:mx-0 sm:px-0">
        <li>
          <HashPreservingLink href={hrefFor(null)} className="divider" {...marker(activeGameId === null)}>
            Tous les jeux
            <span className="divider-count">{formatCount(totalCount)}</span>
          </HashPreservingLink>
        </li>
        {games.map((game) => (
          <li key={game.id}>
            <HashPreservingLink
              href={hrefFor(game.id)}
              className="divider"
              style={{ "--divider-color": gameColorVariable(game.id), "--divider-ink": gameInkVariable(game.id) } as CSSProperties}
              {...marker(activeGameId === game.id)}
            >
              {game.label}
              <span className="divider-count">{formatCount(countByGame[game.id])}</span>
            </HashPreservingLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
