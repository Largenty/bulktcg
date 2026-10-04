import "server-only";
import { createHmac } from "node:crypto";
import type { CloudflareImagesConfig } from "@/lib/env";
import { PHOTO_DURATIONS, buildPhotoUrl, type PhotoVariantName } from "@/lib/photo-hosting";

/* Les URL signées des photos privées — celles des annonces réservées aux
   pros —, côté serveur seulement : la clé de signature ne quitte jamais
   le serveur.

   Le format est celui de Cloudflare Images, tel que sa documentation le
   donne en exemple (« Serve private images using signed URL tokens ») :
   `exp`, l'expiration en secondes Unix, s'ajoute à la requête ; `sig` est le
   HMAC-SHA256, en hexadécimal, du chemin suivi de « ? » et de la requête,
   avec la clé de signature du compte (tableau de bord : Images > Clés).
   tests/photo-signing.test.mjs rejoue le code de cet exemple, Web Crypto
   compris, et le compare à celui-ci ; aucun compte Cloudflare n'a servi à
   le vérifier.

   Une URL signée n'apparaît jamais dans une page : la route des photos
   privées la produit à chaque image demandée, après avoir vérifié le
   lecteur, et y redirige (supabase/README.md, § 8). */

/* Une adresse de livraison encore nue — ni exp, ni sig — reçoit sa
   signature. */
export function signPhotoUrl(url: string, signingKey: string, expiresAt: number): string {
  const signed = new URL(url);
  if (signed.search !== "") throw new Error(`Adresse déjà munie d'une requête : ${url}`);
  signed.searchParams.set("exp", String(expiresAt));
  const stringToSign = `${signed.pathname}?${signed.searchParams.toString()}`;
  signed.searchParams.set("sig", createHmac("sha256", signingKey).update(stringToSign).digest("hex"));
  return signed.toString();
}

/* L'expiration, en secondes Unix : au moins la durée décidée, arrondie au
   pas suivant — tous les lecteurs d'un même intervalle reçoivent la même
   adresse, que le navigateur et Cloudflare resservent de leur cache. */
export function privatePhotoExpiry(nowMs: number): number {
  const { privateUrlSeconds, privateUrlStepSeconds } = PHOTO_DURATIONS;
  const earliest = Math.floor(nowMs / 1000) + privateUrlSeconds;
  return Math.ceil(earliest / privateUrlStepSeconds) * privateUrlStepSeconds;
}

export type SignedPhoto = {
  url: string;
  expiresAt: number;
  /* Ce que la redirection annonce au navigateur (Cache-Control: private,
     max-age=…) : jusqu'à une minute avant l'expiration. */
  maxAgeSeconds: number;
};

/* L'URL signée d'une variante d'une photo privée, pour la route qui a déjà
   vérifié le lecteur. */
export function signPrivatePhoto(
  key: string,
  variant: PhotoVariantName,
  { photosUrl, signingKey }: Pick<CloudflareImagesConfig, "photosUrl" | "signingKey">,
  nowMs: number,
): SignedPhoto {
  const expiresAt = privatePhotoExpiry(nowMs);
  return {
    url: signPhotoUrl(buildPhotoUrl(photosUrl, key, variant), signingKey, expiresAt),
    expiresAt,
    maxAgeSeconds: Math.max(0, expiresAt - Math.floor(nowMs / 1000) - PHOTO_DURATIONS.privateRedirectMarginSeconds),
  };
}
