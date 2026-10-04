import { Suspense, type ReactNode } from "react";
import type { GameId } from "@/types/game";
import { StickyColumn } from "@/components/layout/StickyColumn";
import { ReservedTeaser } from "@/components/pro/ReservedTeaser";
import { ActiveFilters } from "@/components/filters/ActiveFilters";
import { CityNotice } from "@/components/city/CityNotice";
import { FilterPanel } from "@/components/filters/FilterPanel";
import { FilterSheet } from "@/components/filters/FilterSheet";
import { ListingResults } from "@/components/search/ListingResults";
import { NoListingsState } from "@/components/search/NoListingsState";
import { ResultsHeader } from "@/components/search/ResultsHeader";
import { toEditionOptions, toTagOptions } from "@/components/filters/filter-options";
import {
  countListings,
  countListingsWithoutEditions,
  getEditionFacets,
  getListings,
  getTagFacets,
} from "@/lib/data/listings";
import { getDistancesFromOrigin } from "@/lib/listing-display";
import { QUERY_PARAM } from "@/lib/listing-query";
import { resolveListingSearch } from "@/lib/listing-search";
import { routes } from "@/lib/routes";
import { LISTINGS_PER_PAGE } from "@/lib/site";
import type { SearchParams } from "@/lib/search-params";

type ListingBrowserProps = {
  searchParams: SearchParams;
  /* Où pointe la pagination, et où « Tout effacer » ramène. */
  basePath: string;
  /* Critère imposé par l'URL et non effaçable : le jeu de la page. */
  gameId?: GameId;
  /* Encarts de fin de liste, quand la page en porte. */
  asides?: ReactNode;
  midAdSlotId?: string;
  emptyAction: ReactNode;
};

/* Le critère de rayon ne compte comme filtre que s'il a été choisi : le
   rayon par défaut s'applique à toute ville saisie. */
const PANEL_PARAMS = [
  QUERY_PARAM.lotType,
  QUERY_PARAM.edition,
  QUERY_PARAM.tag,
  QUERY_PARAM.condition,
  QUERY_PARAM.language,
  QUERY_PARAM.minPrice,
  QUERY_PARAM.maxPrice,
  QUERY_PARAM.radius,
];

/* Le parcours de recherche complet — affiner, trier, paginer. En grand
   écran, le panneau suit le défilement à gauche de la grille ; sur
   téléphone, il vit dans une feuille et la grille commence tout de suite. */
export async function ListingBrowser({
  searchParams,
  basePath,
  gameId,
  asides,
  midAdSlotId,
  emptyAction,
}: ListingBrowserProps) {
  const resolved = resolveListingSearch(searchParams, { gameId, perPage: LISTINGS_PER_PAGE });
  const { query, origin, radiusKm, page, activeFilterCount } = resolved;

  const [listings, totalCount, editionFacets, tagFacets, hiddenCount] = await Promise.all([
    getListings(query),
    countListings(query),
    /* Comptées sur la recherche en cours moins le critère qu'elles pilotent :
       sinon, choisir une série ferait disparaître toutes les autres. */
    getEditionFacets(query),
    getTagFacets(query),
    countListingsWithoutEditions(query),
  ]);

  const pageCount = Math.max(1, Math.ceil(totalCount / LISTINGS_PER_PAGE));
  const resetHref = gameId ? routes.game(gameId) : basePath;
  const distanceByListingId = origin ? getDistancesFromOrigin(listings, origin) : undefined;
  const panelFilterCount = PANEL_PARAMS.filter((param) => searchParams[param] !== undefined).length;
  const panel = {
    originLabel: origin?.name ?? null,
    radiusKm,
    editionOptions: toEditionOptions(editionFacets),
    tagOptions: toTagOptions(tagFacets),
    hiddenWithoutEditionCount: hiddenCount,
    hasActiveFilters: panelFilterCount > 0,
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
      {/* La colonne ne porte que le panneau, épinglé. Les encarts y vivaient
          dessous : en défilant, le panneau qui suit la lecture passait
          par-dessus eux, et l'on voyait les filtres recouvrir l'offre « À la
          une ». Ils sont en fin de liste. */}
      <div className="hidden flex-col lg:flex">
        <StickyColumn className="panel p-5">
          <Suspense fallback={<div className="h-96" />}>
            <FilterPanel idPrefix="filtre" {...panel} />
          </Suspense>
        </StickyColumn>
      </div>

      <div className="min-w-0">
        <ResultsHeader totalCount={totalCount} origin={origin} radiusKm={radiusKm} page={page} pageCount={pageCount}>
          <Suspense fallback={null}>
            <FilterSheet panel={panel} activeCount={panelFilterCount} resultCount={totalCount} />
          </Suspense>
        </ResultsHeader>
        <ActiveFilters basePath={basePath} params={searchParams} resolved={resolved} />
        <CityNotice resolution={resolved.cityResolution} basePath={basePath} params={searchParams} />

        {listings.length > 0 ? (
          <ListingResults
            listings={listings}
            page={page}
            pageCount={pageCount}
            distanceByListingId={distanceByListingId}
            searchParams={searchParams}
            basePath={basePath}
            midAdSlotId={midAdSlotId}
          />
        ) : (
          <NoListingsState
            page={page}
            pageCount={pageCount}
            activeFilterCount={activeFilterCount}
            resetHref={resetHref}
            emptyAction={emptyAction}
          />
        )}
        <ReservedTeaser gameId={gameId} />
        {asides ? <div className="mt-12 hidden gap-6 lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-stretch">{asides}</div> : null}
      </div>
    </div>
  );
}
