"use client";

import type { WantedSort } from "@/types/wanted";
import { Select } from "@/components/ui/Select";
import { useListingFilters } from "@/components/filters/useListingFilters";
import { WANTED_SORT_OPTIONS } from "@/components/filters/filter-options";
import { WANTED_PARAM } from "@/lib/wanted-query";

/* L'ordre des demandes, au-dessus d'elles comme celui des ventes. Le tri
   appliqué vient du serveur : sans ville, « les plus proches » n'a pas
   d'ordre à proposer, disparaît, et la liste retombe sur les plus récentes.
   Avec une ville, c'est l'ordre par défaut — la question d'un vendeur est
   « qui viendrait jusqu'à moi ». */
export function WantedSortSelect({ hasOrigin, value }: { hasOrigin: boolean; value: WantedSort }) {
  const { setValue } = useListingFilters();
  const options = hasOrigin ? WANTED_SORT_OPTIONS : WANTED_SORT_OPTIONS.filter((option) => option.value !== "distance");
  const defaultSort = hasOrigin ? "distance" : "recent";

  return (
    <div className="w-[210px]">
      <Select
        id="demandes-tri"
        label="Trier les demandes par"
        isLabelHidden
        size="compact"
        hasOptionalHint={false}
        value={value}
        options={options}
        onChange={(next) => setValue(WANTED_PARAM.sort, next === defaultSort ? null : next)}
      />
    </div>
  );
}
