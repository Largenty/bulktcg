"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";

type FilterSheetFrameProps = {
  activeCount: number;
  hasActiveFilters: boolean;
  onClearAll: () => void;
  /* Ce qu'on verra en refermant : « 12 annonces », « 3 demandes ». */
  resultLabel: string;
  children: ReactNode;
};

/* Sur téléphone, le panneau de filtres ne précède plus la grille : il
   poussait la première annonce à 1 866 px, plus de deux écrans sous le
   titre. Il vit dans une feuille qu'un bouton ouvre, et les critères
   s'appliquent en direct derrière elle — le pied dit combien de résultats
   on va voir en la refermant. La même feuille sert les ventes et les
   demandes ; seuls le panneau et ce qu'efface « Tout effacer » changent. */
export function FilterSheetFrame({ activeCount, hasActiveFilters, onClearAll, resultLabel, children }: FilterSheetFrameProps) {
  return (
    <Sheet
      title="Filtres"
      triggerClassName="btn btn-secondary btn-sm lg:hidden"
      trigger={
        <>
          <Icon name="sliders" size={17} />
          Filtres
          {activeCount > 0 ? (
            <span className="mono grid h-5 min-w-5 place-items-center rounded-[var(--radius-sm)] bg-[var(--ink)] px-1.5 text-[length:var(--text-xs)] text-[var(--on-ink)]">
              {activeCount}
              <span className="sr-only"> actifs</span>
            </span>
          ) : null}
        </>
      }
      footer={(close) => (
        <div className="flex items-center gap-3">
          {hasActiveFilters ? (
            <Button variant="quiet" onClick={onClearAll}>
              Tout effacer
            </Button>
          ) : null}
          <Button className="flex-1" onClick={close}>
            Voir {resultLabel}
          </Button>
        </div>
      )}
    >
      <div className="p-5">{children}</div>
    </Sheet>
  );
}
