"use client";

import { useState, type ChangeEvent } from "react";
import { CheckboxGroup, type CheckboxSection } from "@/components/ui/CheckboxGroup";
import { EditionSearchBar } from "@/components/deposit/EditionSearchBar";
import { useHydrated } from "@/components/ui/useHydrated";
import type { EditionBlock } from "@/lib/edition-catalog";
import { filterEditions } from "@/lib/edition-search";

type EditionPickerProps = {
  blocks: EditionBlock[];
  /* Le texte d'explication, selon que la recherche est offerte ou non. */
  description: (canSearch: boolean) => string;
  defaultEditions?: string[];
  error?: string;
  emptyLabel: string;
};

/* La liste des séries d'un jeu, et sa recherche. Le formulaire la remonte
   à chaque changement de jeu (sa clé) : la recherche repart vide, et les
   cases cochées sont celles du nouveau jeu.

   Une série cochée reste toujours visible, quelle que soit la recherche :
   on ne coche pas une case pour la voir disparaître. Les autres sont
   masquées par l'attribut hidden, jamais démontées — leur case reste dans
   le formulaire, et tout ce qui est coché part avec lui. Sans JavaScript,
   la recherche ne servirait à rien : elle n'est pas rendue. */
export function EditionPicker({ blocks, description, defaultEditions = [], error, emptyLabel }: EditionPickerProps) {
  const canSearch = useHydrated();
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(defaultEditions));

  const { hidden, matching, total } = filterEditions(blocks, query, checked);

  const sections: CheckboxSection[] = blocks.map((block) => ({
    title: block.block,
    options: block.editions.map((edition) => ({
      value: edition.id,
      hidden: hidden.has(edition.id),
      /* Le code en mono : à cette taille, le point de « EV08.5 » disparaît
         dans la graisse du texte courant, et « EV085 » ne veut rien dire. */
      label: (
        <>
          <span className="mono font-semibold">{edition.code}</span>{" "}
          <span className="text-[var(--ink-soft)]">{edition.name}</span>
        </>
      ),
    })),
  }));

  /* La vérité des cases vit dans le DOM ; on n'en garde ici que ce qui
     décide de leur visibilité. */
  const followCheckbox = (event: ChangeEvent<HTMLDivElement>) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name !== "editions") return;
    setChecked((current) => {
      const next = new Set(current);
      if (input.checked) next.add(input.value);
      else next.delete(input.value);
      return next;
    });
  };

  return (
    <div onChange={followCheckbox}>
      <CheckboxGroup
        name="editions"
        legend="Séries présentes dans le lot"
        description={description(canSearch && total > 0)}
        sections={sections}
        defaultSelected={defaultEditions}
        error={error}
        isScrollable
        emptyLabel={emptyLabel}
        toolbar={canSearch && total > 0 ? <EditionSearchBar query={query} onQueryChange={setQuery} matching={matching} total={total} /> : undefined}
      />
    </div>
  );
}
