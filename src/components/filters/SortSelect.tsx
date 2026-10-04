"use client";

import { Select } from "@/components/ui/Select";
import { useListingFilters } from "@/components/filters/useListingFilters";
import { SORT_OPTIONS } from "@/components/filters/filter-options";
import { QUERY_PARAM } from "@/lib/listing-query";

/* Le tri règle l'ordre de la liste, il ne la réduit pas : sa place est
   au-dessus des résultats, pas au milieu des critères. Sans ville reconnue,
   « les plus proches » n'a pas d'ordre à proposer et disparaît. */
export function SortSelect({ hasOrigin }: { hasOrigin: boolean }) {
  const { getValue, setValue } = useListingFilters();
  const options = hasOrigin ? SORT_OPTIONS : SORT_OPTIONS.filter((option) => option.value !== "distance");
  const requested = getValue(QUERY_PARAM.sort) ?? "recent";
  const value = options.some((option) => option.value === requested) ? requested : "recent";

  return (
    <div className="w-[200px]">
      <Select
        id="filtre-tri"
        label="Trier par"
        isLabelHidden
        size="compact"
        hasOptionalHint={false}
        value={value}
        options={options}
        onChange={(next) => setValue(QUERY_PARAM.sort, next === "recent" ? null : next)}
      />
    </div>
  );
}
