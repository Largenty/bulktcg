import type { Metadata } from "next";
import { GameDividers } from "@/components/market/GameDividers";
import { MarketNav } from "@/components/market/MarketNav";
import { ButtonLink } from "@/components/ui/Button";
import { WantedBrowser } from "@/components/wanted/WantedBrowser";
import { routes } from "@/lib/routes";
import { WANTED_PARAM } from "@/lib/wanted-query";
import { resolveWantedSearch } from "@/lib/wanted-search";
import { WantedToolbar } from "@/components/wanted/WantedToolbar";
import { resolveCity } from "@/lib/cities";
import { getSellView } from "@/lib/market-links";
import { getGames } from "@/lib/data/games";
import { countListings, getActiveCityNames } from "@/lib/data/listings";
import { countWantedListings, getWantedCountByGame } from "@/lib/data/wanted";
import { QUERY_PARAM, buildListingHref, gameParamValue, parseListingSearchParams } from "@/lib/listing-query";
import type { SearchParams } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Demandes de recherche",
  description:
    "Ce que les acheteurs cherchent près de chez vous : jeu, format, budget et distance. Si vous avez le lot, vous savez à qui l'écrire.",
  alternates: { canonical: routes.wantedListings },
};

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function WantedListingsPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const { gameId, city } = parseListingSearchParams(rawParams);

  /* Une ville reconnue devient un point de vue de vendeur. La question n'est
     alors pas « qui habite près de moi » mais « qui viendrait jusqu'à moi » :
     c'est le rayon de l'acheteur qui décide, pas le mien. Une ville non
     reconnue ne filtre rien plutôt que de filtrer sur la commune exacte —
     ici, contrairement aux annonces, la commune ne veut rien dire. */
  const cityResolution = city ? resolveCity(city) : null;
  const origin = cityResolution?.status === "found" ? cityResolution.city : null;
  const query = {
    reachableOnly: origin !== null,
    origin: origin ? { latitude: origin.latitude, longitude: origin.longitude } : undefined,
  };

  const sellView = getSellView(gameId, origin);

  /* Les compteurs suivent les critères du panneau : l'onglet et les
     intercalaires disent combien de demandes on verra, pas combien il en
     existe en tout. */
  const { query: filtered } = resolveWantedSearch(rawParams);
  const [games, countByGame, totalCount, cities, sellCount] = await Promise.all([
    getGames(),
    getWantedCountByGame({ ...query, ...filtered, gameId: undefined }),
    countWantedListings(filtered),
    getActiveCityNames(),
    countListings(sellView.query),
  ]);

  /* La vue courante garde ses deux critères : cliquer dessus ne doit pas
     défaire le filtre de ville en passant. */
  const buyParams = new URLSearchParams();
  if (gameId) buyParams.set(QUERY_PARAM.game, gameParamValue(gameId));
  if (origin) buyParams.set(QUERY_PARAM.city, origin.name);
  const buyHref = buyParams.size > 0 ? `${routes.wantedListings}?${buyParams}` : routes.wantedListings;

  return (
    <div className="container pb-[var(--section-gap)] pt-7 lg:pt-10">
      {/* Même tête que la liste des annonces : la manchette, et sur sa ligne
          la bascule vers l'autre côté du marché. Elle arrivait sous la
          recherche et le décompte, au milieu de la page. */}
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="eyebrow text-[var(--muted)]">Côté acheteur</p>
          <h1 className="display display-h2 mt-3">Demandes de recherche</h1>
          <p className="mt-2 hidden text-[length:var(--text-body)] text-[var(--ink-soft)] sm:block">
            Ce que les gens cherchent, et jusqu&apos;où ils se déplacent pour l&apos;obtenir. Si vous avez
            le lot dans un placard, vous savez à qui écrire.
          </p>
        </div>
        <MarketNav
          label="Ventes ou recherches"
          items={[
            { href: sellView.href, label: "Ventes", count: sellCount },
            { href: buyHref, label: "Recherches", count: totalCount, isCurrent: true },
          ]}
        />
      </div>

      <WantedToolbar gameId={gameId} city={city} cities={cities} />

      <div className="mt-7">
        {/* Ici le jeu reste un critère de la liste des demandes, pas une
            page : l'intercalaire change le paramètre, et la liste repart de
            sa première page. */}
        <GameDividers
          label="Filtrer par jeu"
          games={games}
          countByGame={countByGame}
          totalCount={totalCount}
          activeGameId={gameId ?? null}
          hrefFor={(target) =>
            buildListingHref(routes.wantedListings, rawParams, { [QUERY_PARAM.game]: target && gameParamValue(target), [WANTED_PARAM.page]: null })
          }
        />
      </div>

      {/* Le même gabarit que la liste des ventes : panneau « Affiner » à
          gauche, décompte et tri au-dessus de la grille. */}
      <div className="mt-8">
        <WantedBrowser
          searchParams={rawParams}
          basePath={routes.wantedListings}
          emptyAction={
            <div className="flex flex-wrap gap-3">
              {origin ? (
                <ButtonLink href={routes.wantedListings} variant="secondary">
                  Voir toutes les demandes
                </ButtonLink>
              ) : null}
              <ButtonLink href={routes.depositWanted}>Déposer la vôtre</ButtonLink>
            </div>
          }
        />
      </div>
    </div>
  );
}
