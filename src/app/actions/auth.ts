"use server";

import { redirect } from "next/navigation";
import { updateCachedReads } from "@/app/actions/revalidate";
import { CACHE_TAGS } from "@/lib/data/cache-tags";
import { signUpDestination } from "@/lib/data/auth-outcomes";
import { isAccepted, type MutationResult } from "@/lib/data/mutation-result";
import { requestPasswordReset, setNewPassword, signInWithPassword, signOut, signUpWithPassword } from "@/lib/data/auth-mutations";
import { rememberEmailSentTo } from "@/lib/email-sent";
import { routes } from "@/lib/routes";
import { newPasswordSchema, passwordResetRequestSchema, signInSchema, signUpSchema } from "@/lib/schemas/auth-form";
import { withKnownCommune } from "@/lib/schemas/commune";
import { COMMUNE_ERROR } from "@/lib/schemas/profile-form";
import { collectErrors } from "@/lib/schemas/field-errors";
import type { z } from "@/lib/schemas/zod";
import type { AuthFormState } from "@/lib/auth-form-state";

/* Actions serveur du compte, branchées sur l'attribut action des
   formulaires : elles relisent l'entrée avec le même schéma que le
   navigateur — un formulaire se trafique —, puis délèguent à la couche
   données. Chacune rend l'état du formulaire (lib/auth-form-state). */

/* Les champs que le formulaire retrouve après l'envoi : React le vide après
   une action. Jamais le mot de passe. Bornés comme leurs schémas, pour
   qu'un envoi démesuré ne revienne pas tel quel dans la page. */
const RETURNED_FIELDS = ["email", "username", "city", "postalCode"];

function returnedValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    RETURNED_FIELDS.flatMap((field) => {
      const value = formData.get(field);
      return typeof value === "string" ? [[field, value.slice(0, 254)]] : [];
    }),
  );
}

type Accepted<Data> = Extract<MutationResult<Data>, { data: Data }>;

/* Relit l'entrée, écrit, puis laisse l'action décider de la suite quand la
   demande est acceptée — enregistrée, ou validée en démonstration :
   `onAccepted` redirige, ou laisse le formulaire dire le compte rendu. */
async function submit<Values, Data>(
  schema: z.ZodType<Values>,
  formData: FormData,
  write: (values: Values) => Promise<MutationResult<Data>>,
  onAccepted?: (values: Values, result: Accepted<Data>) => void | Promise<void>,
): Promise<AuthFormState> {
  const values = returnedValues(formData);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { result: { status: "invalid", fieldErrors: collectErrors(parsed.error) }, values };
  const result = await write(parsed.data);
  if (!isAccepted(result)) return { result, values };
  await onAccepted?.(parsed.data, result);
  return { result: { status: result.status, data: null }, values };
}

/* Connecté, on revient là où l'on était : un chemin que le schéma a déjà
   filtré (safeReturnPath), jamais une autre adresse. En démonstration, rien
   n'est vérifié, et le formulaire le dit. */
export async function signInAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return submit(signInSchema, formData, signInWithPassword, (values, result) => {
    if (result.status === "saved") redirect(values.returnTo);
  });
}

/* Une inscription acceptée mène à la page qui dit qu'un lien part et quoi
   faire s'il n'arrive pas — la réponse sous le bouton laissait croire que
   rien ne s'était passé. Elle y mène quoi qu'il soit arrivé à l'envoi : la
   réponse ne dit jamais si l'adresse a un compte. La démonstration aussi,
   où la page dit que rien n'est créé. Session déjà ouverte (« Confirm
   email » coupé) : là où l'on allait.

   Le profil naît avec le compte (handle_new_user) : la liste des profils en
   cache ne le connaît pas encore, et sa page répondrait 404 jusqu'à une
   heure. Invalidée aussi quand l'adresse était déjà inscrite — la réponse
   est la même dans les deux cas, l'invalidation aussi. */
export async function signUpAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return submit(withKnownCommune(signUpSchema, COMMUNE_ERROR), formData, signUpWithPassword, async (values, result) => {
    if (result.status === "saved") {
      updateCachedReads(CACHE_TAGS.profiles);
      await rememberEmailSentTo(values.email, routes.signUpSent);
    }
    redirect(signUpDestination(result.data, values.returnTo));
  });
}

/* Même parcours pour un nouveau mot de passe : la page qui suit dit qu'un
   lien part si un compte existe, sans dire s'il en existe un. */
export async function passwordResetRequestAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  return submit(passwordResetRequestSchema, formData, requestPasswordReset, async (values, result) => {
    if (result.status === "saved") await rememberEmailSentTo(values.email, routes.passwordResetSent);
    redirect(routes.passwordResetSent);
  });
}

/* Le mot de passe changé, la session ouverte par le lien reste : on entre
   dans son compte. Une session qui ne vient pas d'un lien reçu par e-mail
   — ou plus — est traitée comme un lien expiré. */
export async function newPasswordAction(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const state = await submit(newPasswordSchema, formData, setNewPassword, (_values, result) => {
    if (result.status === "saved") redirect(routes.account);
  });
  if (state.result?.status === "unauthenticated") redirect(routes.expiredLink);
  return state;
}

/* La déconnexion : un formulaire sans état, qui part en POST même sans
   JavaScript, puis l'accueil. */
export async function signOutAction(): Promise<void> {
  await signOut();
  redirect(routes.home);
}
