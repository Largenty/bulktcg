"use client";

import type { KeyboardEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { countLabel } from "@/lib/french";

type EditionSearchBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  /* Les séries qui répondent à la recherche, sur toutes celles du jeu. */
  matching: number;
  total: number;
};

/* Le champ de recherche en tête de la liste des séries. Entrée ne publie
   pas l'annonce — on cherche, on ne valide pas —, et Échap efface. */
export function EditionSearchBar({ query, onQueryChange, matching, total }: EditionSearchBarProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.preventDefault();
    if (event.key === "Escape" && query !== "") {
      event.preventDefault();
      onQueryChange("");
    }
  };

  const status =
    query.trim() === ""
      ? ""
      : matching === 0
        ? `Aucune série ne correspond à « ${query.trim()} ».`
        : `${countLabel(matching, "série")} sur ${total}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Icon
          name="search"
          size={18}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
        <input
          type="search"
          className="field pl-10"
          aria-label="Rechercher une série"
          placeholder="Code ou nom — MH3, Bloomburrow…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p aria-live="polite" className="text-[length:var(--text-sm)] text-[var(--muted)]">
          {status}
        </p>
        {matching === 0 && query.trim() !== "" ? (
          <button
            type="button"
            className="text-[length:var(--text-sm)] font-semibold text-[var(--ink)] underline underline-offset-2"
            onClick={() => onQueryChange("")}
          >
            Effacer la recherche
          </button>
        ) : null}
      </div>
    </div>
  );
}
