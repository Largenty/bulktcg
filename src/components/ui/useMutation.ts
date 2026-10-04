"use client";

import { useState, useTransition } from "react";
import type { MutationResult } from "@/lib/data/mutation-result";

/* L'appel d'une action serveur depuis le navigateur, écrit une fois.

   Le même motif — un compte rendu en état, une transition, l'action
   attendue — était recopié dans onze composants, et aucun ne rattrapait
   rien. Or une action serveur est une requête réseau : elle peut échouer
   sans rendre de MutationResult — coupure, délai dépassé, serveur redéployé
   entre deux clics, qui ne connaît plus l'action sous cet identifiant. Le
   rejet remontait jusqu'à error.tsx, qui remplaçait la page entière : le
   dépôt qu'on venait de saisir disparaissait avec elle.

   Ici, un rejet devient un compte rendu « failed » affiché à l'endroit du
   geste, et la saisie reste. Les actions de ce site ne redirigent jamais —
   elles rendent « unauthenticated » —, si bien que rien de ce qui est
   rattrapé n'est une navigation que Next attendait. */

export async function settle<T>(call: () => Promise<MutationResult<T>>): Promise<MutationResult<T>> {
  try {
    return await call();
  } catch (error) {
    /* Rattrapée, pas avalée : la console garde la trace, en attendant la
       supervision de la phase 2. */
    console.error(error);
    return { status: "failed", retryable: true };
  }
}

export function useMutation<T>() {
  const [result, setResult] = useState<MutationResult<T> | null>(null);
  const [isPending, startTransition] = useTransition();

  /* `onSettled` reçoit le compte rendu, échecs compris : c'est là qu'un
     écran avance (statut posé, récapitulatif ouvert) ou revient en arrière. */
  function run(call: () => Promise<MutationResult<T>>, onSettled?: (outcome: MutationResult<T>) => void) {
    startTransition(async () => {
      const outcome = await settle(call);
      setResult(outcome);
      onSettled?.(outcome);
    });
  }

  return { result, isPending, run, setResult };
}
