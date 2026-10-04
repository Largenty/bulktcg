"use client";

import { useState } from "react";
import type { MutationResult } from "@/lib/data/mutation-result";

/* L'identité d'un dépôt dans son formulaire. Une annonce ou une demande qui
   existe se modifie par son identifiant ; une nouvelle porte celui que la
   page a tiré à l'affichage (`draftId`), si bien qu'un double envoi retombe
   sur la même ligne. Une fois enregistrée, elle existe : revenir au
   formulaire et renvoyer la modifie, au lieu de rejouer un dépôt que la
   base ignorerait — la saisie corrigée serait perdue sans que rien le dise. */
export function useDraftIdentity(existingId: string | undefined, draftId: string | undefined) {
  const [savedId, setSavedId] = useState<string | null>(null);
  const editId = existingId ?? savedId ?? undefined;
  return {
    editId,
    draftId: editId === undefined ? draftId : undefined,
    remember(result: MutationResult<unknown>) {
      if (existingId === undefined && draftId !== undefined && result.status === "saved") setSavedId(draftId);
    },
  };
}
