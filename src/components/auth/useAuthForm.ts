"use client";

import { useActionState, useState, type SubmitEvent } from "react";
import { INITIAL_AUTH_FORM_STATE, type AuthFormState } from "@/lib/auth-form-state";
import { focusFirstError } from "@/lib/form-focus";
import { collectErrors } from "@/lib/schemas/field-errors";
import type { z } from "@/lib/schemas/zod";

type AuthAction = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
type FieldErrors = Partial<Record<string, string>>;

/* La mécanique des formulaires du compte. L'action serveur est branchée sur
   l'attribut action : sans JavaScript, le formulaire part quand même en
   POST — jamais en GET, qui mettrait le mot de passe dans l'adresse et dans
   les journaux. Avec JavaScript, le même schéma répond d'abord dans le
   navigateur, et le premier champ fautif reçoit le focus ; le serveur, qui
   revalide, a le dernier mot.

   Les erreurs affichées se déduisent au rendu : celles du navigateur tant
   qu'un envoi n'est pas parti, puis celles que le serveur a rendues. */
export function useAuthForm(schema: z.ZodType, action: AuthAction, order: readonly string[]) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_AUTH_FORM_STATE);
  const [clientErrors, setClientErrors] = useState<FieldErrors | null>(null);
  const serverErrors: FieldErrors = state.result?.status === "invalid" ? state.result.fieldErrors : {};

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    const parsed = schema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    if (parsed.success) {
      setClientErrors(null);
      return;
    }
    event.preventDefault();
    const errors = collectErrors(parsed.error);
    setClientErrors(errors);
    requestAnimationFrame(() => focusFirstError(errors, { order }));
  }

  return {
    formAction,
    isPending,
    errors: clientErrors ?? serverErrors,
    /* Le compte rendu sous le bouton : un refus de champ s'affiche déjà sous
       le champ, il n'est pas répété. */
    outcome: state.result?.status === "invalid" ? null : state.result,
    values: state.values,
    onSubmit,
  };
}
