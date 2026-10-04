import type { MutationResult } from "@/lib/data/mutation-result";

/* L'état d'un formulaire du compte après un envoi : ce que l'écriture a
   donné, et les champs à lui rendre — jamais un mot de passe. Hors du
   fichier des actions : un module "use server" n'exporte que des
   fonctions, et le formulaire a besoin de l'état de départ. */
export type AuthFormState = {
  result: MutationResult<null> | null;
  values: Record<string, string>;
};

export const INITIAL_AUTH_FORM_STATE: AuthFormState = { result: null, values: {} };
