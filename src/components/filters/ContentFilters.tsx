"use client";

import { Select, type SelectOption } from "@/components/ui/Select";
import { useListingFilters } from "@/components/filters/useListingFilters";
import { ANY_VALUE as ANY } from "@/components/filters/filter-options";
import { countLabel } from "@/lib/french";
import { QUERY_PARAM } from "@/lib/listing-query";

type ContentFiltersProps = {
  idPrefix: string;
  /* Uniquement les séries et les produits réellement présents dans les
     annonces en ligne. Une liste de quatre-vingts séries dont soixante-quinze
     ne ramènent rien n'est pas un filtre, c'est un piège. */
  editionOptions: SelectOption[];
  tagOptions: SelectOption[];
  /* Combien de lots le filtre par série écarte faute de déclaration. */
  hiddenWithoutEditionCount: number;
};

/* Ce qu'il y a dans le lot : de quelles séries sortent les cartes, et quels
   produits partent avec. Les deux listes sont longues, elles restent donc
   des listes déroulantes. */
export function ContentFilters({
  idPrefix,
  editionOptions,
  tagOptions,
  hiddenWithoutEditionCount,
}: ContentFiltersProps) {
  const { getValue, setValue } = useListingFilters();
  const activeEdition = getValue(QUERY_PARAM.edition);

  return (
    <>
      {/* Sans série à proposer — « Autre », ou aucun lot qui en déclare —, pas
          de liste qui ne contiendrait que « Toutes les séries ». */}
      {editionOptions.length > 1 || activeEdition ? (
        <Select
          id={`${idPrefix}-serie`}
          label="Série"
          hasOptionalHint={false}
          value={activeEdition ?? ANY}
          options={editionOptions}
          onChange={(value) => setValue(QUERY_PARAM.edition, value || null)}
        />
      ) : null}

      {/* Le filtre est strict — on ne peut pas affirmer qu'un carton non
          trié contient EV08 — mais il dit ce qu'il écarte, sinon l'acheteur
          croirait que rien d'autre n'existe. */}
      {activeEdition && hiddenWithoutEditionCount > 0 ? (
        <p className="notice -mt-2 text-[length:var(--text-sm)] leading-snug text-[var(--ink-soft)]">
          {countLabel(hiddenWithoutEditionCount, "lot")} sans série déclarée{" "}
          {hiddenWithoutEditionCount > 1 ? "sont écartés" : "est écarté"} : un carton non trié contient
          peut-être ce que vous cherchez, mais son vendeur ne l&apos;a pas dit.
        </p>
      ) : null}

      <Select
        id={`${idPrefix}-produit`}
        label="Produit inclus"
        hasOptionalHint={false}
        value={getValue(QUERY_PARAM.tag) ?? ANY}
        options={tagOptions}
        onChange={(value) => setValue(QUERY_PARAM.tag, value || null)}
      />
    </>
  );
}
