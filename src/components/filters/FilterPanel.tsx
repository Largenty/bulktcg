"use client";

import { Checkbox } from "@/components/ui/Checkbox";
import { Select, type SelectOption } from "@/components/ui/Select";
import { ChoiceChips } from "@/components/filters/ChoiceChips";
import { ContentFilters } from "@/components/filters/ContentFilters";
import { FilterPanelHeading } from "@/components/filters/FilterPanelHeading";
import { PriceRangeFilter } from "@/components/filters/PriceRangeFilter";
import { useListingFilters } from "@/components/filters/useListingFilters";
import {
  CONDITION_CHOICES,
  LANGUAGE_CHOICES,
  LOT_TYPE_CHOICES,
  RADIUS_OPTIONS,
} from "@/components/filters/filter-options";
import { fromCity } from "@/lib/french";
import { QUERY_PARAM } from "@/lib/listing-query";

export type FilterPanelProps = {
  /* « filtre » en colonne, « filtre-mobile » dans la feuille : le panneau
     existe deux fois dans la page, ses identifiants ne doivent pas se
     croiser. */
  idPrefix: string;
  /* Renseignés seulement quand la ville saisie a été reconnue. Sans point
     d'origine, filtrer par rayon n'a aucun sens : on retire le contrôle
     plutôt que de l'afficher inerte. */
  originLabel: string | null;
  /* Rayon réellement appliqué, valeur par défaut comprise. */
  radiusKm: number | null;
  editionOptions: SelectOption[];
  tagOptions: SelectOption[];
  hiddenWithoutEditionCount: number;
  /* Le panneau ne montre « Tout effacer » que s'il y a quelque chose à
     effacer. */
  hasActiveFilters: boolean;
  /* Dans la feuille mobile, le titre est déjà porté par l'en-tête de la
     feuille. */
  isTitleHidden?: boolean;
};

/* Les critères du panneau, du plus discriminant au plus fin. Le tri n'y est
   plus : c'est un réglage de la liste, il vit au-dessus d'elle. */
export function FilterPanel({
  idPrefix,
  originLabel,
  radiusKm,
  editionOptions,
  tagOptions,
  hiddenWithoutEditionCount,
  hasActiveFilters,
  isTitleHidden = false,
}: FilterPanelProps) {
  const { getValue, setValue, clearAll } = useListingFilters();

  return (
    <div className="flex flex-col gap-5">
      {isTitleHidden ? null : (
        <FilterPanelHeading hasActiveFilters={hasActiveFilters} onClearAll={() => clearAll([QUERY_PARAM.game, QUERY_PARAM.sort])} />
      )}

      {originLabel !== null ? (
        <Select
          id={`${idPrefix}-rayon`}
          label="Distance"
          hasOptionalHint={false}
          hint={`À vol d'oiseau depuis le centre ${fromCity(originLabel)}.`}
          value={radiusKm === null ? "" : String(radiusKm)}
          options={RADIUS_OPTIONS}
          onChange={(value) => setValue(QUERY_PARAM.radius, value || null)}
        />
      ) : (
        <p className="rounded-[var(--radius-md)] border-[length:var(--border-width)] border-dashed border-[var(--line-strong)] p-3 text-[length:var(--text-sm)] leading-snug text-[var(--ink-soft)]">
          Indiquez une ville dans la recherche pour trier par distance et filtrer sur un rayon.
        </p>
      )}

      <ChoiceChips param={QUERY_PARAM.lotType} label="Format du lot" choices={LOT_TYPE_CHOICES} idPrefix={idPrefix} />

      <ContentFilters
        idPrefix={idPrefix}
        editionOptions={editionOptions}
        tagOptions={tagOptions}
        hiddenWithoutEditionCount={hiddenWithoutEditionCount}
      />

      <ChoiceChips param={QUERY_PARAM.condition} label="État des cartes" choices={CONDITION_CHOICES} idPrefix={idPrefix} />
      <ChoiceChips param={QUERY_PARAM.language} label="Langue" choices={LANGUAGE_CHOICES} idPrefix={idPrefix} />

      <Checkbox
        id={`${idPrefix}-echange`}
        label="Ouvert à l'échange"
        description="Le vendeur accepte aussi des cartes contre son lot."
        checked={getValue(QUERY_PARAM.trade) === "1"}
        onChange={(event) => setValue(QUERY_PARAM.trade, event.currentTarget.checked ? "1" : null)}
      />

      <PriceRangeFilter idPrefix={idPrefix} />
    </div>
  );
}
