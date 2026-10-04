"use client";

import { ChoiceChips } from "@/components/filters/ChoiceChips";
import { FilterPanelHeading } from "@/components/filters/FilterPanelHeading";
import { useListingFilters } from "@/components/filters/useListingFilters";
import { LOT_TYPE_CHOICES, WANTED_BUDGET_CHOICES, WANTED_BUYER_CHOICES } from "@/components/filters/filter-options";
import { atCity, countLabel } from "@/lib/french";
import { WANTED_PANEL_PARAMS, WANTED_PARAM } from "@/lib/wanted-query";

export type WantedFilterPanelProps = {
  idPrefix: string;
  /* La ville saisie dans la barre de recherche, quand le référentiel la
     connaît : les demandes affichées sont celles dont le rayon la couvre. */
  originLabel: string | null;
  /* Combien de demandes le filtre de budget écarte faute d'en annoncer un. */
  hiddenWithoutBudgetCount: number;
  hasActiveFilters: boolean;
  isTitleHidden?: boolean;
};

/* Le panneau « Affiner » du côté des recherches : le même gabarit que celui
   des ventes, des critères de vendeur. Ce qui compte pour qui a un lot à
   vendre, c'est ce que l'acheteur accepte — un format, un budget — et qui
   il est ; son rayon, lui, se lit depuis la ville de la barre de recherche. */
export function WantedFilterPanel({ idPrefix, originLabel, hiddenWithoutBudgetCount, hasActiveFilters, isTitleHidden = false }: WantedFilterPanelProps) {
  const { getValue, clearKeys } = useListingFilters();

  return (
    <div className="flex flex-col gap-5">
      {isTitleHidden ? null : (
        <FilterPanelHeading hasActiveFilters={hasActiveFilters} onClearAll={() => clearKeys(WANTED_PANEL_PARAMS)} />
      )}

      {originLabel !== null ? (
        <p className="notice text-[length:var(--text-sm)] leading-snug text-[var(--ink-soft)]">
          Seuls les acheteurs prêts à venir jusqu&apos;{atCity(originLabel)} sont affichés : leur rayon couvre la ville.
        </p>
      ) : (
        <p className="rounded-[var(--radius-md)] border-[length:var(--border-width)] border-dashed border-[var(--line-strong)] p-3 text-[length:var(--text-sm)] leading-snug text-[var(--ink-soft)]">
          Indiquez votre ville dans la recherche pour ne garder que les acheteurs prêts à venir jusqu&apos;à vous.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <ChoiceChips param={WANTED_PARAM.lotType} label="Format recherché" choices={LOT_TYPE_CHOICES} idPrefix={idPrefix} />
        <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Les demandes « tout format » restent affichées.</p>
      </div>

      <ChoiceChips param={WANTED_PARAM.minBudget} label="Budget d'au moins" choices={WANTED_BUDGET_CHOICES} idPrefix={idPrefix} />
      {/* Strict, mais il dit ce qu'il écarte : sans ce chiffre, le vendeur
          croirait qu'aucun autre acheteur n'existe. */}
      {getValue(WANTED_PARAM.minBudget) && hiddenWithoutBudgetCount > 0 ? (
        <p className="notice -mt-2 text-[length:var(--text-sm)] leading-snug text-[var(--ink-soft)]">
          {countLabel(hiddenWithoutBudgetCount, "demande")} sans budget annoncé{" "}
          {hiddenWithoutBudgetCount > 1 ? "sont écartées" : "est écartée"} : son auteur n&apos;a pas dit ce qu&apos;il
          mettrait, pas qu&apos;il ne mettrait rien.
        </p>
      ) : null}

      <ChoiceChips param={WANTED_PARAM.buyer} label="Acheteur" choices={WANTED_BUYER_CHOICES} idPrefix={idPrefix} />
    </div>
  );
}
