"use client";

import { useState } from "react";
import { useMutation } from "@/components/ui/useMutation";
import { isAccepted, type MutationResult } from "@/lib/data/mutation-result";
import { focusFirstError, type FocusPlan } from "@/lib/form-focus";

/* Un dépôt accepté : les valeurs validées, et ce que la couche données en a
   fait — enregistré, ou, en phase 1, validé sans rien écrire. */
export type Published<Values, Result> = { values: Values; result: MutationResult<Result> };

type FieldErrors = Partial<Record<string, string>>;

/* La mécanique commune aux deux dépôts, annonce et recherche. Un refus
   affiche les erreurs et place le focus sur le premier champ fautif ; un
   dépôt accepté remonte en haut de page sur son récapitulatif ; « Revenir
   au formulaire » rend la main au titre. L'action serveur est appelée à la
   main et non par l'attribut action du formulaire : React viderait sinon
   les champs après l'envoi, et un refus effacerait la saisie. */
export function useDepositSubmit<Values, Result, Errors extends FieldErrors>(focus: FocusPlan) {
  const [errors, setErrors] = useState<Errors>({} as Errors);
  const [published, setPublished] = useState<Published<Values, Result> | null>(null);
  const [failure, setFailure] = useState<MutationResult<Result> | null>(null);
  const { isPending, run } = useMutation<Result>();

  function reject(fieldErrors: Errors) {
    setErrors(fieldErrors);
    requestAnimationFrame(() => focusFirstError(fieldErrors, focus));
  }

  /* Les valeurs ont passé le schéma dans le navigateur : l'écriture part, et
     le serveur, qui revalide avec le même schéma, a le dernier mot. */
  function send(values: Values, write: () => Promise<MutationResult<Result>>) {
    setErrors({} as Errors);
    run(write, (result) => {
      if (result.status === "invalid" && Object.keys(result.fieldErrors).some((field) => focus.order.includes(field))) {
        reject(result.fieldErrors as Errors);
      } else if (isAccepted(result)) {
        setFailure(null);
        setPublished({ values, result });
        /* Sans animation pour qui l'a demandé au système (WCAG 2.3.3). */
        const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: isReduced ? "auto" : "smooth" });
      } else {
        /* Session expirée, élément disparu, envoi perdu en route, ou refus
           qui ne vise aucun champ — la vente a été clôturée pendant la
           saisie : la phrase s'affiche sous le bouton, et la saisie reste.
           Le bandeau renverrait à un champ qui n'existe pas. */
        setFailure(result);
      }
    });
  }

  function backToForm() {
    setPublished(null);
    requestAnimationFrame(() => document.getElementById("title")?.focus());
  }

  return { errors, published, failure, isPending, reject, send, backToForm };
}
