import type { Game, GameId } from "@/types/game";
import { GameDividers } from "@/components/market/GameDividers";
import { SearchBar, listingSearchFields } from "@/components/search/SearchBar";
import { GAME_SCOPED_PARAMS, buildListingHref } from "@/lib/listing-query";
import { routes } from "@/lib/routes";
import type { SearchParams } from "@/lib/search-params";
import { WANTED_PARAM } from "@/lib/wanted-query";

type ListingsToolbarProps = {
  gameId?: GameId;
  /* /annonces ou /pokemon : la recherche y reste. */
  basePath: string;
  rawParams: SearchParams;
  cities: string[];
  query: { search?: string; city?: string };
  games: Game[];
  countByGame: Record<GameId, number>;
  totalCount: number;
};

/* Ce qui ne suit pas un changement de jeu : les critères propres au jeu, et
   la page des demandes, qui repart à 1 comme celle des ventes. */
const DROPPED_ON_GAME_CHANGE = Object.fromEntries([...GAME_SCOPED_PARAMS, WANTED_PARAM.page].map((key) => [key, null]));

/* Sous le titre de la liste : la recherche, sur toute la largeur de sa
   ligne comme à l'accueil — elle était bridée à 920 px —, puis les
   intercalaires des jeux. */
export function ListingsToolbar({ gameId, basePath, rawParams, cities, query, games, countByGame, totalCount }: ListingsToolbarProps) {
  return (
    <>
      <div className="mt-6">
        {/* La recherche part vers la page courante : depuis la page Pokémon,
            taper « classeur » veut dire « classeur Pokémon ». */}
        <SearchBar
          action={basePath}
          submitLabel="Chercher"
          fields={listingSearchFields(cities, { search: query.search, city: query.city })}
        />
      </div>
      <div className="mt-7">
        <GameDividers
          label="Filtrer par jeu"
          games={games}
          countByGame={countByGame}
          totalCount={totalCount}
          activeGameId={gameId ?? null}
          hrefFor={(target) => buildListingHref(routes.listingsFor(target), rawParams, DROPPED_ON_GAME_CHANGE)}
        />
      </div>
    </>
  );
}
