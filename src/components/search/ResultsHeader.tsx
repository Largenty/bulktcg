import type { ReactNode } from "react";
import { Suspense } from "react";
import type { City } from "@/lib/cities";
import { SortSelect } from "@/components/filters/SortSelect";
import { countLabel, fromCity } from "@/lib/french";

type ResultsHeaderProps = {
  totalCount: number;
  origin: City | null;
  radiusKm: number | null;
  page: number;
  pageCount: number;
  /* Le déclencheur des filtres sur mobile. */
  children?: ReactNode;
};

/* Au-dessus de la grille : combien, où, et dans quel ordre. Le nombre est
   annoncé aux lecteurs d'écran quand un filtre le change.

   Le titre, lu et non montré, ouvre la grille : les vignettes sont des h3,
   et sur téléphone, le panneau « Affiner » replié dans sa feuille, rien ne
   séparait plus le h1 de la page de la première vignette. */
export function ResultsHeader({ totalCount, origin, radiusKm, page, pageCount, children }: ResultsHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="sr-only">Annonces</h2>
      <p aria-live="polite" className="min-w-0 text-[length:var(--text-md)] text-[var(--ink-soft)]">
        <strong className="font-semibold text-[var(--ink)]">{countLabel(totalCount, "annonce")}</strong>
        {origin && radiusKm ? ` à moins de ${radiusKm} km ${fromCity(origin.name)}` : ""}
        {pageCount > 1 ? <span className="text-[var(--muted)]"> · page {page} sur {pageCount}</span> : null}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Suspense fallback={null}>
          <SortSelect hasOrigin={origin !== null} />
        </Suspense>
      </div>
    </div>
  );
}
