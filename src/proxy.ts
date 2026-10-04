import { NextResponse, type NextRequest } from "next/server";
import { NONCE_HEADER, contentSecurityPolicy, createNonce, policyEnvironment } from "@/lib/csp";
import { refreshSession } from "@/lib/data/supabase";
import { readSupabaseConfig } from "@/lib/env";

const ENVIRONMENT = policyEnvironment();
const SUPABASE = readSupabaseConfig(process.env);

/* La CSP de chaque réponse, avec un nonce neuf (voir lib/csp.ts). Il part
   dans les deux sens : dans la réponse, pour le navigateur ; dans la
   requête, pour le rendu — Next le lit dans l'en-tête Content-Security-Policy
   et le pose sur ses scripts, le gabarit racine le lit dans x-nonce. Une
   valeur que le client aurait envoyée dans l'un ou l'autre est écrasée.

   Phase 2, Supabase configuré : la session d'abord. Un jeton expiré est
   renouvelé une fois, ici, et ses cookies entrent dans la requête que le
   rendu lira, puis dans la réponse. Le proxy ne décide d'aucun droit :
   c'est la couche données et la RLS qui tranchent. */
export async function proxy(request: NextRequest) {
  const session = SUPABASE ? await refreshSession(SUPABASE, ENVIRONMENT.isHttps, request) : null;

  const nonce = createNonce();
  const policy = contentSecurityPolicy(nonce, ENVIRONMENT);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  for (const { name, value, options } of session?.cookies ?? []) response.cookies.set(name, value, options);
  for (const [key, value] of Object.entries(session?.headers ?? {})) response.headers.set(key, value);
  return response;
}

/* Toutes les réponses, sauf deux familles qui ne sont jamais un document :
   les fichiers de /_next/static et l'optimiseur d'images (qui pose sa propre
   CSP), et les préchargements du routeur de Next — du flux RSC, que le
   navigateur n'interprète pas comme une page. Les images de partage, les
   icônes et le plan de site passent par ici, pour une raison : leur page 404
   est un document comme un autre. Rester statiques ne dépend pas de la CSP.

   Un préchargement du routeur se reconnaît à deux en-têtes, « RSC » et
   « Next-Router-Prefetch », valant exactement « 1 » — Next ne tient pas
   autrement une requête pour du flux RSC (server/lib/is-rsc-request.js) ni
   pour un préchargement. Le proxy ne s'écarte que s'il voit les deux : les
   deux filtres ci-dessous s'additionnent, et une valeur de filtre se lit
   comme une expression entière (^1$). Le second en-tête seul, ou « RSC: 0 »,
   « RSC: true », « RSC: 1, 1 » — deux en-têtes que Node joint —, ne changent
   rien au rendu : Next sert la page entière, en HTML, qui partait sans CSP
   et avec le nonce que la requête voulait bien fournir.

   Un préchargement du navigateur (« Purpose: prefetch », « Sec-Purpose:
   prefetch;prerender ») n'est pas écarté, contrairement à l'exemple de la
   documentation de Next : Chrome prérend ainsi une page depuis la barre
   d'adresse, puis l'affiche — elle doit porter sa CSP.

   Le filtre est une constante : Next le lit au build sans l'exécuter. */
export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image).*)",
      missing: [{ type: "header", key: "next-router-prefetch", value: "1" }],
    },
    {
      source: "/((?!_next/static|_next/image).*)",
      missing: [{ type: "header", key: "rsc", value: "1" }],
    },
  ],
};
