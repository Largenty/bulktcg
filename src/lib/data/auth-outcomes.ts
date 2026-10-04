import { saved, toMutationFailure, type MutationResult } from "@/lib/data/mutation-result";
import { routes } from "@/lib/routes";

/* Ce que Supabase Auth répond, ramené à ce que la personne voit et à ce que
   le serveur consigne. Rien ici n'appelle la base : tout se teste sans elle
   (tests/auth-outcomes.test.mjs). */

export type AuthFailure = { code?: string | undefined; status?: number | undefined; name?: string | undefined };

/* Les réponses d'une inscription qui dépendent de l'adresse saisie :
   déjà inscrite (Supabase le dit quand la confirmation est coupée), un
   lien déjà renvoyé à une adresse non confirmée depuis moins d'une minute,
   un envoi que le SMTP intégré refuse — il n'écrit qu'à l'équipe du
   projet — ou qui échoue (une erreur 5xx). Les montrer dirait qui a un
   compte : elles reçoivent la réponse d'une adresse neuve, et le serveur
   consigne la vraie. */
const ADDRESS_DEPENDENT_SIGN_UP = new Set(["user_already_exists", "email_exists", "over_email_send_rate_limit", "email_address_not_authorized"]);

export const WEAK_PASSWORD_MESSAGE = "Ce mot de passe est refusé : trop court, ou déjà paru dans une fuite connue.";

/* Ce que l'inscription répond. Restent dites les erreurs qui tiennent au
   formulaire et pas à l'existence d'un compte : un mot de passe refusé,
   une adresse que Supabase n'accepte pas, le réseau, et le débit de tout
   le site (over_request_rate_limit, compté sur l'adresse IP du serveur). */
export function signUpAnswer<T>(error: AuthFailure | null, data: T): MutationResult<T> {
  if (error === null) return saved(data);
  if (error.code === "weak_password") return { status: "invalid", fieldErrors: { password: WEAK_PASSWORD_MESSAGE } };
  if (error.code === "email_address_invalid") return { status: "invalid", fieldErrors: { email: "Cette adresse n'est pas acceptée." } };
  if (isAddressDependent(error)) return saved(data);
  return toMutationFailure(error);
}

/* Ce qu'une inscription acceptée sait d'elle-même : Supabase ouvre la
   session tout de suite quand la confirmation d'adresse est coupée dans
   le tableau de bord. */
export type SignUpOutcome = { sessionOpened: boolean };

/* Où mène une inscription acceptée : là où l'on allait si la session est
   déjà ouverte, sinon la page qui dit qu'un lien part — y compris quand
   rien n'est parti, la réponse ne disant jamais si l'adresse a un compte. */
export function signUpDestination(outcome: SignUpOutcome, returnTo: string): string {
  return outcome.sessionOpened ? returnTo : routes.signUpSent;
}

export function isAddressDependent(error: AuthFailure): boolean {
  return ADDRESS_DEPENDENT_SIGN_UP.has(error.code ?? "") || (error.status ?? 0) >= 500;
}

/* Ce que le serveur consigne d'une demande au service d'authentification :
   l'issue réelle, et le domaine de l'adresse — de quoi voir qu'un
   fournisseur de messagerie refuse les envois —, jamais l'adresse. */
export type AuthLogRecord = { level: "info" | "warn" | "error"; event: string; outcome: string; domain: string };

export function authLogRecord(event: string, email: string, error: AuthFailure | null): AuthLogRecord {
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  if (error === null) return { level: "info", event, outcome: "ok", domain };
  const outcome = error.code ?? (error.status ? `http-${error.status}` : (error.name ?? "inconnu"));
  return { level: (error.status ?? 0) >= 500 || !error.status ? "error" : "warn", event, outcome, domain };
}

/* Une session ouverte par un lien reçu par e-mail. Supabase l'inscrit
   « otp » dans la revendication amr — pour le lien de récupération comme
   pour celui de l'inscription (mesuré sur le projet), « password » pour une
   connexion par mot de passe. Les liens magiques et les invitations ne sont
   pas activés : une telle session prouve qu'on lit la boîte de l'adresse. */
export const EMAIL_LINK_WINDOW_SECONDS = 3600;

/* Une entrée d'amr : la méthode et son heure. L'ancienne forme, un simple
   nom de méthode sans heure, ne prouve rien de récent. */
type AmrEntry = string | { method: string; timestamp: number };

/* Changer le mot de passe sans donner l'ancien : seulement dans l'heure qui
   suit un lien reçu par e-mail — la durée de validité du lien. Une session
   ouverte par mot de passe, ou volée, ne le peut pas. */
export function openedByRecentEmailLink(claims: { amr?: readonly AmrEntry[] | undefined } | null | undefined, nowSeconds: number): boolean {
  return (claims?.amr ?? []).some(
    (entry) =>
      typeof entry !== "string" &&
      entry.method === "otp" &&
      entry.timestamp <= nowSeconds + 60 &&
      nowSeconds - entry.timestamp <= EMAIL_LINK_WINDOW_SECONDS,
  );
}
