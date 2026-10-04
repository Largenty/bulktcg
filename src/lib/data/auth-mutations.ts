import "server-only";
import { cookies } from "next/headers";
import { after } from "next/server";
import {
  WEAK_PASSWORD_MESSAGE,
  authLogRecord,
  isAddressDependent,
  openedByRecentEmailLink,
  signUpAnswer,
  type AuthFailure,
  type SignUpOutcome,
} from "@/lib/data/auth-outcomes";
import { notPersisted, saved, toMutationFailure, type MutationResult } from "@/lib/data/mutation-result";
import { isSupabaseMode, publicClient, userClient } from "@/lib/data/source";
import { deferWrite } from "@/lib/data/write-seam";
import type { EmailLink } from "@/lib/email-link";
import { routes, safeReturnPath } from "@/lib/routes";
import type {
  NewPasswordValues,
  PasswordResetRequestValues,
  SignInValues,
  SignUpValues,
} from "@/lib/schemas/auth-form";
import { SITE_URL } from "@/lib/site";

/* Le compte : connexion, inscription, mot de passe oublié, nouveau mot de
   passe, déconnexion. Phase 2 : Supabase Auth, appelé côté serveur — les
   cookies de session sont httpOnly (lib/data/supabase.ts). Démonstration :
   la couture, et une réponse qui dit que rien n'est vérifié.

   Trois règles :
   - le mot de passe ne passe par aucune couture ni aucun journal : Supabase
     le reçoit directement, et la charge décrite par deferWrite ne le porte
     jamais ;
   - une connexion refusée dit « adresse ou mot de passe incorrect », sans
     préciser lequel : sinon le formulaire dirait qui a un compte ;
   - la demande de réinitialisation et l'inscription répondent la même
     chose, que l'adresse ait un compte ou non — débit d'envoi, refus du
     SMTP et pannes compris : chacun le trahissait. La vraie issue va au
     journal du serveur, sans l'adresse (authLogRecord).

   Le débit n'est pas encore limité par le site (audit, M7). Supabase Auth
   limite le sien par adresse IP, et toutes ces demandes partent du serveur :
   ses plafonds comptent le site entier, si bien qu'un seul abus épuise le
   quota de tout le monde. Une limitation côté site (checkRateLimit, guide
   § 5) est un préalable à l'ouverture des inscriptions au public. */

/* Où ramène le lien de confirmation : le chemin d'où l'inscription est
   partie, gardé dans un cookie que seule la route de confirmation reçoit —
   le lien, lui, ne porte que son empreinte (§ 3 du guide). Ouvert sur un
   autre appareil, il ramène à l'accueil du compte. */
const RETURN_COOKIE = "bulktcg-return-to";
const RETURN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: SITE_URL.startsWith("https:"),
  sameSite: "lax",
  path: routes.emailConfirmation,
} as const;

export async function signInWithPassword(values: SignInValues): Promise<MutationResult<null>> {
  if (!isSupabaseMode()) {
    await deferWrite("auth.signIn", { email: values.email });
    return notPersisted(null);
  }
  const supabase = await userClient();
  const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
  if (!error) return saved(null);
  const { code } = error;
  if (code === "invalid_credentials") return { status: "invalid", fieldErrors: { password: "Adresse ou mot de passe incorrect." } };
  /* Supabase ne le dit qu'au bon mot de passe : rien n'est révélé. */
  if (code === "email_not_confirmed") {
    return { status: "invalid", fieldErrors: { email: "Confirmez d'abord votre adresse : le lien est dans l'e-mail reçu à l'inscription." } };
  }
  return toMutationFailure(error);
}

export async function signUpWithPassword(values: SignUpValues): Promise<MutationResult<SignUpOutcome>> {
  /* Le pseudo, la commune et le code postal partent en métadonnées : le
     déclencheur on_auth_user_created en fait le profil (migration 3). */
  const metadata = { username: values.username, city: values.city, postal_code: values.postalCode };
  if (!isSupabaseMode()) {
    await deferWrite("auth.signUp", { email: values.email, data: metadata, redirectTo: values.returnTo });
    return notPersisted({ sessionOpened: false });
  }
  /* Un pseudo pris ferait échouer le déclencheur, et Supabase n'en dirait
     qu'« erreur de la base ». Il est public — /profil/<pseudo> — : le
     vérifier d'abord ne révèle rien, et la clé publique suffit. Hors cache :
     un pseudo pris il y a une minute doit se voir. */
  const { data: taken, error: lookupError } = await publicClient().from("profiles").select("id").eq("username", values.username).maybeSingle();
  if (lookupError) return toMutationFailure(lookupError);
  if (taken) return { status: "invalid", fieldErrors: { username: "Ce pseudo est déjà pris." } };

  const supabase = await userClient();
  let error: AuthFailure | null;
  let sessionOpened: boolean;
  try {
    const response = await supabase.auth.signUp({ email: values.email, password: values.password, options: { data: metadata } });
    error = response.error;
    /* « Confirm email » coupé dans le tableau de bord : la session s'ouvre
       tout de suite, sans lien à attendre. */
    sessionOpened = response.data.session !== null;
  } catch (thrown) {
    return toMutationFailure(thrown);
  }
  if (error && isAddressDependent(error)) logAuth(authLogRecord("auth.signUp", values.email, error));
  const answer = signUpAnswer(error, { sessionOpened });
  if (answer.status === "saved") {
    (await cookies()).set(RETURN_COOKIE, safeReturnPath(values.returnTo), { ...RETURN_COOKIE_OPTIONS, maxAge: 60 * 60 * 24 });
  }
  return answer;
}

/* La demande part après la réponse (after) : la réponse est la même quoi
   qu'il arrive à l'envoi — Supabase limite à un envoi par minute et par
   adresse inscrite, son SMTP intégré refuse les adresses hors de l'équipe,
   une adresse inconnue reçoit toujours 200 —, et elle ne prend pas plus de
   temps pour une adresse inscrite. Le lien passe par la route de
   confirmation, qui ouvre la session puis mène à /nouveau-mot-de-passe.
   `schedule` n'existe que pour les tests. */
export async function requestPasswordReset(
  values: PasswordResetRequestValues,
  schedule: (task: () => Promise<void>) => void = after,
): Promise<MutationResult<null>> {
  if (!isSupabaseMode()) {
    await deferWrite("auth.passwordReset", { email: values.email, redirectTo: routes.newPassword });
    return notPersisted(null);
  }
  schedule(async () => {
    let error: AuthFailure | null;
    try {
      ({ error } = await publicClient().auth.resetPasswordForEmail(values.email));
    } catch (thrown) {
      error = { name: thrown instanceof Error ? thrown.name : "inconnu" };
    }
    logAuth(authLogRecord("auth.passwordReset", values.email, error));
  });
  return saved(null);
}

/* Une ligne structurée par demande, comme les erreurs du serveur
   (instrumentation.ts) — jamais l'adresse. */
function logAuth(record: ReturnType<typeof authLogRecord>): void {
  const line = JSON.stringify(record);
  if (record.level === "info") console.info(line);
  else if (record.level === "warn") console.warn(line);
  else console.error(line);
}

/* Le nouveau mot de passe, sans l'ancien : seulement pour une session
   ouverte par un lien reçu par e-mail depuis moins d'une heure
   (openedByRecentEmailLink). Une session ouverte par mot de passe — ou
   volée — reçoit la réponse d'un lien expiré (« unauthenticated », que
   l'action change en redirection). La longueur est déjà vérifiée, et la
   valeur ne quitte pas cette fonction. */
export async function setNewPassword(values: NewPasswordValues): Promise<MutationResult<null>> {
  if (!isSupabaseMode()) {
    void values;
    await deferWrite("auth.passwordUpdate", {});
    return notPersisted(null);
  }
  const supabase = await userClient();
  const { data } = await supabase.auth.getClaims();
  if (!openedByRecentEmailLink(data?.claims, Math.floor(Date.now() / 1000))) return { status: "unauthenticated" };
  const { error } = await supabase.auth.updateUser({ password: values.password });
  if (!error) return saved(null);
  const { code } = error;
  if (code === "same_password") return { status: "invalid", fieldErrors: { password: "Choisissez un mot de passe différent de l'ancien." } };
  if (code === "weak_password") return { status: "invalid", fieldErrors: { password: WEAK_PASSWORD_MESSAGE } };
  return toMutationFailure(error);
}

/* Fermer la session de cet appareil, et d'aucun autre. La démonstration
   n'en a pas à fermer : aucun bouton ne s'y affiche (canSignOut). */
export async function signOut(): Promise<void> {
  if (!isSupabaseMode()) return;
  const supabase = await userClient();
  await supabase.auth.signOut({ scope: "local" });
}

/* Le lien reçu par e-mail : il ouvre la session du compte, puis mène là où
   il doit — le nouveau mot de passe, ou le chemin d'où l'inscription est
   partie. null : le lien a servi, a expiré, ou n'en est pas un. */
export async function confirmEmailLink(link: EmailLink): Promise<string | null> {
  if (!isSupabaseMode()) return null;
  const supabase = await userClient();
  const { error } = await supabase.auth.verifyOtp({ type: link.type, token_hash: link.tokenHash });
  if (error) return null;
  if (link.type === "recovery") return routes.newPassword;
  const store = await cookies();
  const returnTo = safeReturnPath(store.get(RETURN_COOKIE)?.value);
  store.set(RETURN_COOKIE, "", { ...RETURN_COOKIE_OPTIONS, maxAge: 0 });
  return returnTo;
}
