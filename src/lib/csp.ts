/* La politique de sécurité du contenu (CSP), écrite une fois : src/proxy.ts
   la pose sur chaque réponse avec un nonce neuf, next.config.ts y lit le
   domaine des photos et le protocole (HSTS), les tests la lisent.

   Aucun script en ligne ne s'exécute s'il ne porte pas le nonce de la
   réponse. Next le pose lui-même sur ses scripts — son amorce et son flux
   RSC (self.__next_f.push) —, qu'il lit dans l'en-tête Content-Security-Policy
   de la requête ; le gabarit racine le pose sur le script de thème. Un
   script injecté ne le connaît pas : c'est tout l'intérêt, et c'est ce que
   'unsafe-inline' laissait passer.

   Le prix : Next ne pose un nonce que sur une page rendue à la demande. Une
   page prérendue a figé ses scripts au build, sans nonce, et la CSP les
   refuserait. Le gabarit racine lit donc l'en-tête de la requête, ce qui
   rend chaque page dynamique — le choix est fait et mesuré dans le README
   (« Sécurité »). Ce qui ne porte aucun script reste statique : images de
   partage, icônes, plan de site, robots.txt.

   'strict-dynamic' : les morceaux que Next charge ensuite héritent de la
   confiance du script qui les insère ; 'self' ne sert plus qu'aux
   navigateurs qui ignorent ce mot-clé. Les styles gardent 'unsafe-inline' :
   React écrit des attributs style, qu'aucun nonce ne couvre. Et jamais de
   nonce dans style-src : sa seule présence y ferait ignorer 'unsafe-inline'. */

import { resolveSiteUrl } from "./site";

/* L'en-tête de requête par lequel le nonce arrive au rendu. */
export const NONCE_HEADER = "x-nonce";

/* Le téléversement direct de Cloudflare Images : le navigateur y envoie la
   photo convertie, avec l'adresse à usage unique que le serveur lui donne. */
export const PHOTO_UPLOAD_ORIGIN = "https://upload.imagedelivery.net";

export type PolicyEnvironment = {
  /* Le serveur de développement : React y reconstruit les piles d'erreur
     avec eval, et le rechargement à chaud passe par une WebSocket. */
  isDev: boolean;
  /* upgrade-insecure-requests, et HSTS dans next.config.ts, ne sont posés
     qu'en HTTPS : le smoke tourne en http://localhost. */
  isHttps: boolean;
  /* Phase 2 : le domaine de diffusion de Cloudflare Images, déduit du gabarit
     NEXT_PUBLIC_PHOTOS_URL (voir lib/env.ts), où {key} et {variant} marquent
     la place de la clé et de la variante ; absent en phase 1, il n'ouvre rien. Le navigateur ne parle jamais
     à Supabase : lectures et écritures passent par le serveur. */
  photosHost: string | null;
};

export function policyEnvironment(env: Record<string, string | undefined> = process.env): PolicyEnvironment {
  const photosUrl = env.NEXT_PUBLIC_PHOTOS_URL;
  return {
    isDev: env.NODE_ENV === "development",
    /* L'adresse publique telle que le site la résout (lib/site.ts) : sans
       NEXT_PUBLIC_SITE_URL, un déploiement Vercel prend son domaine de
       production, en HTTPS — et partait sans HSTS ni
       upgrade-insecure-requests quand seule la variable comptait. */
    isHttps: resolveSiteUrl(env).startsWith("https:"),
    photosHost: photosUrl ? new URL(photosUrl.replace("{key}", "key")).hostname : null,
  };
}

/* 128 bits tirés au sort, en base64 : ce que Next sait extraire de l'en-tête
   ('nonce-…', app-render/get-script-nonce-from-header). */
export function createNonce(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

export function contentSecurityPolicy(nonce: string, { isDev, isHttps, photosHost }: PolicyEnvironment): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    /* Les images passent par /_next/image (même origine) ou par blob:
       (l'aperçu du dépôt). */
    `img-src 'self' data: blob:${photosHost ? ` https://${photosHost}` : ""}`,
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}${photosHost ? ` ${PHOTO_UPLOAD_ORIGIN}` : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isHttps ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
