import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { openedByRecentEmailLink } from "@/lib/data/auth-outcomes";
import { isSupabaseMode, userClient } from "@/lib/data/source";
import { resolveDemoUserId } from "@/lib/env";
import { routes } from "@/lib/routes";

/* La personne connectée.

   Phase 2, Supabase configuré : la session vient des cookies de la requête,
   lue par auth.getClaims(), qui vérifie la signature du jeton — localement,
   le projet signant ses jetons avec une clé asymétrique. Jamais
   getSession() seul, qui ne revérifie rien. src/proxy.ts a rafraîchi un
   jeton expiré avant le rendu. Une session illisible vaut « pas connecté ».

   Démonstration : un compte est toujours connecté. DEMO_USER_ID le choisit
   — u-01 (particulier) par défaut, u-13 pour voir le site comme une
   boutique au forfait actif : `DEMO_USER_ID=u-13 npm run dev`. Dès que la
   vraie authentification est configurée, ou en production, il n'y a plus de
   compte de démonstration, et la variable restée là fait échouer le build
   (lib/env.ts, resolveDemoUserId). */
const DEMO_USER_ID = resolveDemoUserId(process.env);

export const getCurrentUserId = cache(async (): Promise<string | null> => {
  if (!isSupabaseMode()) return DEMO_USER_ID;
  const supabase = await userClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error) return null;
  return data?.claims.sub ?? null;
});

/* Une session qu'on peut fermer : la vraie authentification. La session de
   démonstration, elle, ne se ferme pas — aucun bouton ne prétend le faire. */
export function canSignOut(): boolean {
  return isSupabaseMode();
}

/* Choisir un nouveau mot de passe sans donner l'ancien : seulement dans
   l'heure qui suit un lien reçu par e-mail (auth-outcomes.ts). Une session
   ouverte par mot de passe ne le peut pas. La démonstration montre le
   formulaire à son compte, comme avant. */
export const canChangePasswordFromLink = cache(async (): Promise<boolean> => {
  if (!isSupabaseMode()) return DEMO_USER_ID !== null;
  const supabase = await userClient();
  const { data } = await supabase.auth.getClaims();
  return openedByRecentEmailLink(data?.claims, Math.floor(Date.now() / 1000));
});

/* Une page réservée renvoie vers la connexion, puis revient là où l'on
   était : `suivant` porte le chemin de retour. */
export async function requireCurrentUserId(returnTo = routes.account): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) redirect(routes.signInThenReturn(returnTo));
  return userId;
}
