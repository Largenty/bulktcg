import { Suspense, type ReactNode } from "react";
import type { GameId } from "@/types/game";
import { StickyColumn } from "@/components/layout/StickyColumn";
import { CityNotice } from "@/components/city/CityNotice";
import { Pagination } from "@/components/search/Pagination";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { WantedFilterPanel } from "@/components/filters/WantedFilterPanel";
import { WantedFilterSheet } from "@/components/filters/WantedFilterSheet";
import { WantedGrid } from "@/components/wanted/WantedGrid";
import { WantedSortSelect } from "@/components/filters/WantedSortSelect";
import { countWantedListings, countWantedWithoutBudget, getWantedListings } from "@/lib/data/wanted";
import { countLabel } from "@/lib/french";
import { getDistancesFromOrigin } from "@/lib/listing-display";
import { WANTED_PARAM, WANTED_PER_PAGE } from "@/lib/wanted-query";
import { resolveWantedSearch } from "@/lib/wanted-search";
import type { SearchParams } from "@/lib/search-params";

type WantedBrowserProps = {
  searchParams: SearchParams;
  basePath: string;
  /* Critère imposé par la page : le jeu. */
  gameId?: GameId;
  /* L'onglet qui porte la liste, pour que la pagination y ramène. */
  hash?: string;
  emptyAction: ReactNode;
};

/* Le côté recherches, dans le même gabarit que les ventes : le panneau
   « Affiner » épinglé à gauche, le décompte et le tri au-dessus de la grille,
   la feuille de filtres sur téléphone. Seules les vignettes et les critères
   changent — c'était la demande, et c'est ce qui fait lire les deux côtés du
   marché comme une seule page. */
export async function WantedBrowser({ searchParams, basePath, gameId, hash, emptyAction }: WantedBrowserProps) {
  const resolved = resolveWantedSearch(searchParams, { gameId });
  const { query, origin, sort, page, panelFilterCount } = resolved;

  const [wantedListings, totalCount, withoutBudgetCount] = await Promise.all([
    getWantedListings(query),
    countWantedListings(query),
    query.minBudgetCents !== undefined ? countWantedWithoutBudget(query) : Promise.resolve(0),
  ]);

  const pageCount = Math.max(1, Math.ceil(totalCount / WANTED_PER_PAGE));
  const distances = origin ? getDistancesFromOrigin(wantedListings, origin) : undefined;
  const panel = {
    originLabel: origin?.name ?? null,
    hiddenWithoutBudgetCount: withoutBudgetCount,
    hasActiveFilters: panelFilterCount > 0,
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10">
      <div className="hidden flex-col lg:flex">
        <StickyColumn className="panel p-5">
          <Suspense fallback={<div className="h-96" />}>
            <WantedFilterPanel idPrefix="demande" {...panel} />
          </Suspense>
        </StickyColumn>
      </div>

      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {/* Lu et non montré : les demandes sont des h3, et rien ne les
              séparait du h1 quand le panneau « Affiner » est replié. */}
          <h2 className="sr-only">Demandes</h2>
          <p aria-live="polite" className="min-w-0 text-[length:var(--text-md)] text-[var(--ink-soft)]">
            <strong className="font-semibold text-[var(--ink)]">{countLabel(totalCount, "demande")}</strong>
            {origin ? ` dont le rayon couvre ${origin.name}` : ""}
            {pageCount > 1 ? <span className="text-[var(--muted)]"> · page {page} sur {pageCount}</span> : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Suspense fallback={null}>
              <WantedFilterSheet panel={panel} activeCount={panelFilterCount} resultCount={totalCount} />
            </Suspense>
            <Suspense fallback={null}>
              <WantedSortSelect hasOrigin={origin !== null} value={sort} />
            </Suspense>
          </div>
        </div>
        <CityNotice resolution={resolved.cityResolution} basePath={basePath} params={searchParams} />

        {wantedListings.length > 0 ? (
          <>
            <WantedGrid wantedListings={wantedListings} distanceByWantedId={distances} density="compact" />
            <Pagination basePath={basePath} searchParams={searchParams} currentPage={page} pageCount={pageCount} pageParam={WANTED_PARAM.page} hash={hash} />
          </>
        ) : (
          <EmptyState
            title={page > 1 ? "Cette page n'existe pas" : "Aucune demande ne correspond"}
            reason={
              page > 1
                ? `La liste ne compte que ${countLabel(pageCount, "page")}.`
                : origin
                  ? `Personne ne cherche ce que vous filtrez en acceptant de venir jusqu'à ${origin.name}. Une demande déposée plus loin peut avoir un rayon plus large : retirez la ville pour toutes les voir.`
                  : "Personne ne cherche ce que vous filtrez pour le moment, ou toutes les demandes ont trouvé preneur."
            }
            action={
              page > 1 ? (
                <ButtonLink href={`${basePath}${hash ?? ""}`} variant="secondary">
                  Revenir à la première page
                </ButtonLink>
              ) : (
                emptyAction
              )
            }
          />
        )}
      </div>
    </div>
  );
}
