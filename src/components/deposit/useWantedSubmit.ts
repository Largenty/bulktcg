"use client";

import { submitWanted } from "@/app/actions/wanted";
import { useDepositSubmit } from "@/components/deposit/useDepositSubmit";
import type { MutationResult } from "@/lib/data/mutation-result";
import type { WantedWriteResult } from "@/lib/data/wanted-mutations";
import { collectWantedFieldErrors, wantedFormSchema, type WantedFormErrors, type WantedFormValues } from "@/lib/schemas/wanted-form";

/* L'ordre visuel du formulaire, pour placer le focus sur le premier champ
   fautif. Le code postal suit la commune choisie. */
const FOCUS = {
  order: ["title", "gameId", "lotType", "maxPriceEuros", "minCardCount", "city", "postalCode", "maxDistanceKm", "description"],
  targets: { postalCode: "city" },
};

/* Même mécanique que le dépôt d'annonce, sans photos à téléverser :
   validation dans le navigateur, puis action serveur. `onResult` reçoit sa
   réponse, pour retenir qu'une demande est enregistrée. */
export function useWantedSubmit(onResult: (result: MutationResult<WantedWriteResult>) => void) {
  const { reject, send, ...state } = useDepositSubmit<WantedFormValues, WantedWriteResult, WantedFormErrors>(FOCUS);

  function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parsed = wantedFormSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      reject(collectWantedFieldErrors(parsed.error));
      return;
    }
    send(parsed.data, async () => {
      const result = await submitWanted(formData);
      onResult(result);
      return result;
    });
  }

  return { ...state, handleSubmit };
}
