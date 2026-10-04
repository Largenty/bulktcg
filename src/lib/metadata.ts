import type { Metadata } from "next";
import type { Listing } from "@/types/listing";
import type { SellerProfile } from "@/types/profile";
import { formatPrice } from "@/lib/format";
import { atCity } from "@/lib/french";
import { GAME_LABELS, LOT_TYPE_LABELS, UNKNOWN_VALUE } from "@/lib/labels";
import { getListingStateLabel, getShownPhotos, getVolumeLabel } from "@/lib/listing-display";
import { LISTING_LIFECYCLE, isExpired } from "@/lib/listing-lifecycle";
import { QUERY_PARAM } from "@/lib/listing-query";
import { hashString } from "@/lib/random";
import { readParam, type SearchParams } from "@/lib/search-params";
import { SITE_NAME } from "@/lib/site";

/* Ce que toutes les pages partagent dans leurs métadonnées, et ce qu'une
   annonce dit d'elle-même quand on la partage.

   Next fusionne les métadonnées superficiellement : une page qui définit
   openGraph remplace celui du gabarit en entier. og:site_name et og:locale
   disparaissaient ainsi des fiches — les seules pages qu'on partage
   vraiment. Chaque page étale donc la base d'ici. */
export const OPEN_GRAPH_BASE = { siteName: SITE_NAME, locale: "fr_FR", type: "website" } as const;

/* Chaque page réécrit robots en entier, pour la même raison. Une page
   indexable autorise la grande image dans les résultats : c'est une
   vitrine de photos. */
export const INDEXABLE = { index: true, follow: true, "max-image-preview": "large" } satisfies Metadata["robots"];
export const NOT_INDEXABLE = { index: false, follow: true } satisfies Metadata["robots"];

/* Une liste de lots : l'adresse nue s'indexe. La page N d'une liste a sa
   propre canonique et son titre — la canoniser vers la page 1, comme avant,
   disait aux moteurs que ses lots n'y étaient pas ; elle reste hors index,
   les lots eux-mêmes sont dans le plan de site. Toute autre combinaison de
   filtres renvoie à l'adresse nue, hors index. */
export function listingListMetadata(
  baseTitle: string,
  basePath: string,
  params: SearchParams,
): Pick<Metadata, "title" | "alternates" | "robots"> {
  const keys = Object.keys(params);
  if (keys.length === 0) return { title: baseTitle, alternates: { canonical: basePath }, robots: INDEXABLE };
  const page = Number(readParam(params, QUERY_PARAM.page));
  if (keys.length === 1 && keys[0] === QUERY_PARAM.page && Number.isInteger(page) && page > 1) {
    return {
      title: `${baseTitle} — page ${page}`,
      alternates: { canonical: `${basePath}?${QUERY_PARAM.page}=${page}` },
      robots: NOT_INDEXABLE,
    };
  }
  return { title: baseTitle, alternates: { canonical: basePath }, robots: NOT_INDEXABLE };
}

/* Une description se coupe entre deux mots, jamais au milieu : « rayures
   de classeur sur une diza » finissait l'aperçu Facebook d'une fiche. */
export function truncateAtWord(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  /* Un seul mot très long : on coupe dans le mot plutôt que de ne rien
     garder. */
  const kept = lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut;
  return `${kept.replace(/[\s,;:.·—–-]+$/u, "")}…`;
}

type ShareListing = Pick<
  Listing,
  | "title"
  | "status"
  | "renewedAt"
  | "priceCents"
  | "city"
  | "postalCode"
  | "gameId"
  | "lotType"
  | "cardCount"
  | "weightKg"
  | "condition"
  | "description"
>;

/* Un lot vendu, réservé ou expiré le dit avant tout le reste : collé dans un
   groupe, son aperçu montrait un lot à 90 € sans rien d'autre. */
function statusPrefix(listing: Pick<Listing, "status" | "renewedAt">, now: number): string {
  const state = getListingStateLabel(listing, now);
  return state === null ? "" : `${state} — `;
}

export function listingShareTitle(listing: ShareListing, now: number): string {
  return `${statusPrefix(listing, now)}${listing.title} — ${formatPrice(listing.priceCents)} ${atCity(listing.city)}`;
}

/* Les faits d'abord — ce que l'aperçu doit dire même tronqué —, puis le
   texte du vendeur. Une valeur absente est omise, jamais écrite 0. */
export function listingShareDescription(listing: ShareListing, now: number): string {
  const volume = getVolumeLabel(listing);
  const lotType = LOT_TYPE_LABELS[listing.lotType];
  const facts = [
    GAME_LABELS[listing.gameId],
    formatPrice(listing.priceCents),
    lotType,
    volume === UNKNOWN_VALUE || volume === lotType ? null : volume,
    `${listing.city} (${listing.postalCode})`,
  ].filter((fact): fact is string => fact !== null);
  return truncateAtWord(`${statusPrefix(listing, now)}${facts.join(" · ")} — ${listing.description}`, 160);
}

/* La version d'une image de partage : un court condensé de ce qu'elle
   dessine, et de rien d'autre. */
export function contentVersion(parts: ReadonlyArray<string | number | boolean | null | undefined>): string {
  return hashString(parts.map((part) => String(part ?? "")).join("|")).toString(36);
}

/* L'image de partage se cache selon son adresse : Facebook et WhatsApp
   gardaient l'ancienne après une baisse de prix ou une vente. La version
   change dès que ce que l'image montre change, et avec elle l'adresse.

   Elle se calcule sur ce que l'image dessine, et sur rien d'autre — pas sur
   updatedAt : retoucher la description ne change pas l'image, et la page
   comme la route de l'image, rendues séparément, doivent tomber sur la même
   version. */
export function shareImageVersion(
  listing: Pick<
    Listing,
    | "status"
    | "renewedAt"
    | "soldAt"
    | "priceCents"
    | "title"
    | "photos"
    | "reference"
    | "city"
    | "postalCode"
    | "gameId"
    | "lotType"
    | "cardCount"
    | "weightKg"
    | "condition"
  > & {
    seller: Pick<Listing["seller"], "username" | "isPro" | "companyName">;
  },
  /* L'instant du rendu : expirée, l'image porte son tampon ; archivée, elle
     perd sa photo — et l'adresse change avec. */
  now: number,
): string {
  return contentVersion([
    listing.status,
    getListingStateLabel(listing, now) ?? "",
    listing.priceCents,
    listing.title,
    listing.gameId,
    listing.lotType,
    getVolumeLabel(listing),
    listing.city,
    listing.postalCode,
    listing.reference,
    getShownPhotos(listing, now)[0]?.url ?? "",
    listing.seller.username,
    listing.seller.isPro,
    listing.seller.companyName,
  ]);
}

/* Une annonce vendue reste servie : son lien a circulé, et les avis s'y
   rattachent. Elle reste indexée trente jours — le temps que les moteurs
   voient « vendu » —, puis sort de l'index et du plan de site, le jour même
   où elle est archivée et perd ses photos (lib/listing-lifecycle). */
export const SOLD_LISTING_INDEXED_DAYS = LISTING_LIFECYCLE.archiveAfterDays;
const DAY_MS = 24 * 60 * 60 * 1000;

export function soldListingIndexedUntil(listing: Pick<Listing, "status" | "soldAt" | "updatedAt">): Date | null {
  if (listing.status !== "sold") return null;
  return new Date(new Date(listing.soldAt ?? listing.updatedAt).getTime() + SOLD_LISTING_INDEXED_DAYS * DAY_MS);
}

export function isListingIndexable(
  listing: Pick<Listing, "status" | "soldAt" | "updatedAt" | "audience" | "renewedAt">,
  now: Date,
): boolean {
  if (listing.audience !== "everyone") return false;
  /* Expirée : son vendeur ne l'a pas prolongée, elle n'est peut-être plus à
     vendre. Sa page répond encore, hors de l'index. */
  if (isExpired(listing, now.getTime())) return false;
  const until = soldListingIndexedUntil(listing);
  return until === null || now < until;
}

export function listingRobots(
  listing: Pick<Listing, "status" | "soldAt" | "updatedAt" | "audience" | "renewedAt">,
  now: Date,
): Metadata["robots"] {
  /* Réservée aux pros : ni index ni suivi, elle n'existe pour personne
     d'autre. */
  if (listing.audience !== "everyone") return { index: false, follow: false };
  if (!isListingIndexable(listing, now)) return NOT_INDEXABLE;
  const until = soldListingIndexedUntil(listing);
  return until ? { ...INDEXABLE, unavailable_after: until.toISOString() } : INDEXABLE;
}

/* Un profil sans rien de public — ni annonce en ligne, ni avis, ni fiche
   boutique — n'a rien à montrer à un moteur : il reste servi, hors index.
   Le plan de site publiait jusqu'ici le pseudo de chaque compte (audit de
   sécurité, F10). */
export function isProfileIndexable(
  profile: Pick<SellerProfile, "activeListingCount" | "ratingCount" | "shop">,
): boolean {
  return profile.activeListingCount > 0 || profile.ratingCount > 0 || profile.shop !== null;
}

/* La date de dernière modification que voient les moteurs : celle de la
   vente quand elle est plus récente que la dernière retouche. */
export function listingLastModified(listing: Pick<Listing, "updatedAt" | "soldAt">): Date {
  const updated = new Date(listing.updatedAt).getTime();
  const sold = listing.soldAt ? new Date(listing.soldAt).getTime() : 0;
  return new Date(Math.max(updated, sold));
}
