"use client";

import { useListingFilters } from "@/components/filters/useListingFilters";
import { QUERY_PARAM } from "@/lib/listing-query";

/* Deux champs plutôt qu'un curseur : on tape un budget, on ne le glisse pas.
   La valeur part à Entrée — le petit formulaire se soumet — ou quand on
   quitte le champ ; pas à chaque frappe, sinon chaque chiffre écrirait une
   entrée dans l'historique du navigateur.

   Les champs restent non contrôlés, et c'est l'URL qui décide de leur valeur
   de départ. D'où la clé posée par PriceRange : quand l'URL change sans que
   le champ ait été touché — « Tout effacer », retour arrière —, le composant
   est remonté et le champ ne peut plus afficher 50 € pendant que la liste
   n'en filtre plus aucun. C'est exactement le bug qu'il y avait. */
function PriceRangeFields({ idPrefix, min, max }: { idPrefix: string; min: string; max: string }) {
  const { setValues } = useListingFilters();

  function apply(form: HTMLFormElement) {
    const data = new FormData(form);
    const nextMin = String(data.get("min") ?? "").trim();
    const nextMax = String(data.get("max") ?? "").trim();
    if (nextMin === min && nextMax === max) return;
    setValues({ [QUERY_PARAM.minPrice]: nextMin || null, [QUERY_PARAM.maxPrice]: nextMax || null });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply(event.currentTarget);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) apply(event.currentTarget);
      }}
      className="flex flex-col gap-2.5"
    >
      <p className="text-[length:var(--text-md)] font-semibold">Prix</p>
      <div className="flex items-center gap-2">
        <label htmlFor={`${idPrefix}-prix-min`} className="sr-only">
          Prix minimum en euros
        </label>
        <input
          id={`${idPrefix}-prix-min`}
          name="min"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="Min €"
          defaultValue={min}
          className="field min-h-[42px] py-2"
        />
        <span aria-hidden="true" className="text-[var(--muted)]">
          –
        </span>
        <label htmlFor={`${idPrefix}-prix-max`} className="sr-only">
          Prix maximum en euros
        </label>
        <input
          id={`${idPrefix}-prix-max`}
          name="max"
          type="number"
          min={0}
          inputMode="numeric"
          placeholder="Max €"
          defaultValue={max}
          className="field min-h-[42px] py-2"
        />
        <button type="submit" className="btn btn-secondary btn-sm shrink-0 px-3">
          OK
        </button>
      </div>
    </form>
  );
}

export function PriceRangeFilter({ idPrefix }: { idPrefix: string }) {
  const { getValue } = useListingFilters();
  const min = getValue(QUERY_PARAM.minPrice) ?? "";
  const max = getValue(QUERY_PARAM.maxPrice) ?? "";
  return <PriceRangeFields key={`${min}|${max}`} idPrefix={idPrefix} min={min} max={max} />;
}
