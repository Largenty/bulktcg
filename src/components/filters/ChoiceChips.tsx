"use client";

import { useListingFilters } from "@/components/filters/useListingFilters";

export type Choice = { value: string; label: string; hint?: string };

type ChoiceChipsProps = {
  /* Paramètre d'URL piloté : « type », « etat », « langue ». */
  param: string;
  label: string;
  choices: Choice[];
  /* Préfixe d'identifiant : le panneau existe deux fois dans la page, en
     colonne sur grand écran et dans la feuille sur mobile. */
  idPrefix: string;
};

/* Un choix parmi cinq se fait mieux d'un coup d'œil que derrière une liste
   déroulante : toutes les valeurs sont visibles, l'active est pleine, et un
   second clic la retire. Boutons à aria-pressed — chaque clic filtre tout
   de suite, rien n'est soumis. */
export function ChoiceChips({ param, label, choices, idPrefix }: ChoiceChipsProps) {
  const { getValue, setValue } = useListingFilters();
  const active = getValue(param);
  const labelId = `${idPrefix}-${param}-label`;

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2.5">
      <p id={labelId} className="text-[length:var(--text-md)] font-semibold">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => {
          const isActive = active === choice.value;
          return (
            <button
              key={choice.value}
              type="button"
              aria-pressed={isActive}
              title={choice.hint}
              onClick={() => setValue(param, isActive ? null : choice.value)}
              className="pill pill-sm"
            >
              {choice.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
