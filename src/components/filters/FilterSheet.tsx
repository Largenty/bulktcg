"use client";

import { FilterPanel, type FilterPanelProps } from "@/components/filters/FilterPanel";
import { FilterSheetFrame } from "@/components/filters/FilterSheetFrame";
import { useListingFilters } from "@/components/filters/useListingFilters";
import { countLabel } from "@/lib/french";
import { QUERY_PARAM } from "@/lib/listing-query";

type FilterSheetProps = {
  panel: Omit<FilterPanelProps, "idPrefix" | "isTitleHidden">;
  activeCount: number;
  resultCount: number;
};

/* La feuille de filtres des ventes. « Tout effacer » garde le jeu, qui
   porte le titre de la page, ainsi que le tri. */
export function FilterSheet({ panel, activeCount, resultCount }: FilterSheetProps) {
  const { clearAll } = useListingFilters();

  return (
    <FilterSheetFrame
      activeCount={activeCount}
      hasActiveFilters={panel.hasActiveFilters}
      onClearAll={() => clearAll([QUERY_PARAM.game, QUERY_PARAM.sort])}
      resultLabel={countLabel(resultCount, "annonce")}
    >
      <FilterPanel {...panel} idPrefix="filtre-mobile" isTitleHidden />
    </FilterSheetFrame>
  );
}
