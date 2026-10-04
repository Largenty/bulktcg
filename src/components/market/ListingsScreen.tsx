import type { Game } from "@/types/game";
import { CityLinks } from "@/components/market/CityLinks";
import { GameOverview } from "@/components/market/GameOverview";
import { ListingsSellPanel } from "@/components/market/ListingsSellPanel";
import { ListingsToolbar } from "@/components/search/ListingsToolbar";
import { MarketTabs } from "@/components/market/MarketTabs";
import { WantedBrowser } from "@/components/wanted/WantedBrowser";
import { ButtonLink } from "@/components/ui/Button";
import { getGames } from "@/lib/data/games";
import { countListings, getActiveCityNames, getListingCountByGame, getListings } from "@/lib/data/listings";
import { countWantedListings } from "@/lib/data/wanted";
import { capitalize } from "@/lib/french";
import { gamePhrases } from "@/lib/labels";
import { parseListingSearchParams } from "@/lib/listing-query";
import { MARKET_FRAGMENT, routes } from "@/lib/routes";
import type { SearchParams } from "@/lib/search-params";
import { getPopulatedCities } from "@/lib/seo";
import { resolveWantedSearch } from "@/lib/wanted-search";

/* Assez pour mailler les pages de ville d'un jeu, jamais une liste de cent
   pastilles. */
const MAX_CITY_LINKS = 24;

type ListingsScreenProps = {
  /* null sur /annonces, tous jeux confondus ; le jeu de l'adresse sur
     /pokemon. Il vient du chemin, jamais d'un paramètre : c'est lui qui
     porte le titre, la balise canonique et les filtres imposés. */
  game: Game | null;
  rawParams: SearchParams;
};

/* La liste des annonces, d'un jeu ou de tous : le même écran sert /annonces
   et /pokemon. Deux onglets — ce qui se vend, ce qu'on cherche — et, pour un
   jeu, le texte et les liens de ville qui donnent à sa page quelque chose à
   dire aux moteurs de recherche. */
export async function ListingsScreen({ game, rawParams }: ListingsScreenProps) {
  const gameId = game?.id;
  const basePath = routes.listingsFor(gameId);
  const query = { ...parseListingSearchParams(rawParams), gameId };

  const [games, countByGame, cities, scopedListings, wantedCount, gameWantedCount, sellCount] = await Promise.all([
    getGames(),
    getListingCountByGame(),
    getActiveCityNames(),
    /* Sans les filtres : ce décompte décrit le marché, là où la liste
       affiche le sien, filtré. */
    getListings({ gameId, limit: 500 }),
    /* Le compteur de l'onglet suit les filtres des demandes ; celui du texte
       de référencement décrit le marché du jeu, sans filtre. */
    countWantedListings(resolveWantedSearch(rawParams, { gameId }).query),
    countWantedListings({ gameId }),
    countListings({ gameId }),
  ]);

  const gamesTotal = Object.values(countByGame).reduce((sum, count) => sum + count, 0);
  /* Les communes du jeu qui ont des lots, la plus fournie d'abord : les
     liens en montrent au plus MAX_CITY_LINKS, le texte les compte toutes. */
  const scopedCities = getPopulatedCities(scopedListings);
  const cardsLabel = game ? capitalize(gamePhrases(game.id).cards) : null;

  return (
    <div className="pb-[var(--section-gap)]">
      <div className="container pt-7 lg:pt-10">
        {/* Il y avait ici un leaderboard 728×90, entre la recherche et les
            résultats : il coupait la page en deux au moment précis où l'on
            cherche, et repoussait la première annonce de 130 px. La grille
            garde sa bannière intercalée et la colonne son pavé. */}
        <MarketTabs
          label={cardsLabel ? `${cardsLabel} : ventes ou recherches` : "Ventes ou recherches"}
          counts={{ sell: sellCount, buy: wantedCount }}
          lead={
            <div className="min-w-0">
              <h1 className="display display-h2">{cardsLabel ? `${cardsLabel} d'occasion` : "Toutes les annonces"}</h1>
              {/* Pas sur téléphone : la première annonce doit tenir dans le
                  premier écran, et la manchette dit déjà où l'on est. */}
              <p className="mt-2 hidden text-[length:var(--text-body)] text-[var(--ink-soft)] sm:block">
                Lots, vrac, classeurs et scellé, à récupérer en main propre près de chez vous.
              </p>
            </div>
          }
          between={
            <ListingsToolbar
              gameId={gameId}
              basePath={basePath}
              rawParams={rawParams}
              cities={cities}
              query={query}
              games={games}
              countByGame={countByGame}
              totalCount={gamesTotal}
            />
          }
          panels={{
            sell: <ListingsSellPanel searchParams={rawParams} basePath={basePath} gameId={gameId} />,
            buy: (
              <WantedBrowser
                searchParams={rawParams}
                basePath={basePath}
                gameId={gameId}
                hash={`#${MARKET_FRAGMENT.buy}`}
                emptyAction={<ButtonLink href={routes.depositWanted}>Déposer une recherche</ButtonLink>}
              />
            ),
          }}
        />

        {game ? (
          <>
            <GameOverview game={game} listings={scopedListings} cityCount={scopedCities.length} wantedCount={gameWantedCount} />
            <CityLinks
              gameId={game.id}
              title={`Où trouver ${gamePhrases(game.id).some}`}
              cities={scopedCities.slice(0, MAX_CITY_LINKS).map(({ city, label }) => ({ slug: city.slug, label }))}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
