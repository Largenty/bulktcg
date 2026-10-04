import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { SupabaseConfig } from "@/lib/env";

/* Les clients Supabase — le seul module du projet qui importe @supabase/*.
   source.ts les distribue à la couche données ; src/proxy.ts n'en prend que
   le rafraîchissement de la session (tests/conventions). Aucun client ne
   vit au-delà d'une requête : celui de l'utilisateur porte ses cookies, et
   les deux autres ne coûtent rien à créer. */

export type { SupabaseClient };

/* Les cookies de session ne se lisent que côté serveur (httpOnly) : le
   navigateur ne parle jamais à Supabase, et une régie publicitaire ou une
   XSS ne lirait pas la session (docs/securite/audit-front.md, E1). Secure
   dès que le site est en HTTPS ; en http://localhost, tous les navigateurs
   ne gardent pas un cookie Secure, et la connexion locale échouerait. */
export function sessionCookieOptions(isHttps: boolean) {
  return { httpOnly: true, secure: isHttps, sameSite: "lax", path: "/" } as const;
}

/* Aucune session dans les clients sans cookies : rien à garder, rien à
   rafraîchir, aucune adresse à lire. */
const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/* Une lecture publique mise en cache dans le cache de données de Next, par
   les options de fetch : `tags` pour l'invalider à l'écriture, `revalidate`
   (secondes) pour l'expirer d'elle-même. Une entrée de plus de 2 Mo n'est
   pas gardée : une lecture qui grossit se découpe. */
export type PublicReadCache = { tags: string[]; revalidate?: number };

export const PUBLIC_READ_TTL_SECONDS = 3600;

/* Ce qu'un visiteur anonyme voit : clé publique, sans cookies. La RLS le
   traite en anon — une annonce réservée aux pros n'en sort jamais. */
export function createPublicClient(config: SupabaseConfig, cache?: PublicReadCache): SupabaseClient {
  const cachedFetch: typeof fetch = (input, init) =>
    fetch(input, { ...init, next: { revalidate: cache?.revalidate ?? PUBLIC_READ_TTL_SECONDS, tags: cache?.tags ?? [] } });
  return createClient(config.url, config.publishableKey, { auth: NO_SESSION, global: cache ? { fetch: cachedFetch } : {} });
}

/* Ce qui dépend de la personne : les cookies de la requête, et la RLS qui
   tranche. Un composant serveur ne peut pas poser de cookie — le proxy,
   passé avant lui, a déjà rafraîchi la session ; une action ou un
   gestionnaire de route, eux, posent ceux d'une connexion ou d'une
   déconnexion. */
export async function createUserClient(config: SupabaseConfig, isHttps: boolean): Promise<SupabaseClient> {
  const store = await cookies();
  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: sessionCookieOptions(isHttps),
    cookies: {
      getAll: () => store.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
        } catch {
          /* Rendu d'un composant serveur : le proxy a déjà écrit ces cookies. */
        }
      },
    },
  });
}

/* La clé secrète, serveur seulement : elle passe outre la RLS. Pour ce
   qu'aucun rôle connecté n'a le droit d'écrire — notifications de
   croisement, vues, suppression de compte —, jamais pour lire à la place
   d'un visiteur. */
export function createAdminClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.secretKey, { auth: NO_SESSION });
}

export type SessionRefresh = {
  cookies: { name: string; value: string; options: CookieOptions }[];
  /* Les en-têtes que Supabase demande sur une réponse qui pose un cookie de
     session : jamais en cache partagé. */
  headers: Record<string, string>;
};

/* Le rafraîchissement de la session, avant le rendu (src/proxy.ts). Un jeton
   expiré est renouvelé ici, une fois par navigation, et les nouveaux
   cookies partent dans les deux sens : dans la requête, pour que le rendu
   lise la session à jour, et dans la réponse, pour le navigateur. Rien n'est
   décidé ici : c'est la couche données et la RLS qui tranchent.

   Sans cookie de session — un visiteur anonyme —, rien à rafraîchir : aucun
   client n'est créé. */
export async function refreshSession(config: SupabaseConfig, isHttps: boolean, request: NextRequest): Promise<SessionRefresh> {
  const refresh: SessionRefresh = { cookies: [], headers: {} };
  if (!request.cookies.getAll().some(({ name }) => name.startsWith("sb-"))) return refresh;
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookieOptions: sessionCookieOptions(isHttps),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          if (value) request.cookies.set(name, value);
          else request.cookies.delete(name);
        }
        refresh.cookies.push(...cookiesToSet);
        Object.assign(refresh.headers, headers);
      },
    },
  });
  /* Une panne d'Auth ne fait pas tomber la page : elle relira la session
     elle-même, et une session illisible vaut « pas connecté ». */
  try {
    await supabase.auth.getClaims();
  } catch {
    return { cookies: [], headers: {} };
  }
  return refresh;
}
