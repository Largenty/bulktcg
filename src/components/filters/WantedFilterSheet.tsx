"use client";

import { FilterSheetFrame } from "@/components/filters/FilterSheetFrame";
import { useListingFilters } from "@/components/filters/useListingFilters";
import { WantedFilterPanel, type WantedFilterPanelProps } from "@/components/filters/WantedFilterPanel";
import { countLabel } from "@/lib/french";
import { WANTED_PANEL_PARAMS } from "@/lib/wanted-query";

type WantedFilterSheetProps = {
  panel: Omit<WantedFilterPanelProps, "idPrefix" | "isTitleHidden">;
  activeCount: number;
  resultCount: number;
};

/* La même feuille que celle des ventes, sur téléphone : les critères
   s'appliquent en direct derrière elle, et le pied dit combien de demandes
   on verra en la refermant. */
export function WantedFilterSheet({ panel, activeCount, resultCount }: WantedFilterSheetProps) {
  const { clearKeys } = useListingFilters();

  return (
    <FilterSheetFrame
      activeCount={activeCount}
      hasActiveFilters={panel.hasActiveFilters}
      onClearAll={() => clearKeys(WANTED_PANEL_PARAMS)}
      resultLabel={countLabel(resultCount, "demande")}
    >
      <WantedFilterPanel {...panel} idPrefix="demande-mobile" isTitleHidden />
    </FilterSheetFrame>
  );
}
