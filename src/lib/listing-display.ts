import type { CardCondition, Listing, ListingCardData, ListingPhoto } from "@/types/listing";
import {
  CONDITION_LABELS,
  CONDITION_SHORT_LABELS,
  EXPIRED_LABEL,
  LANGUAGE_LABELS,
  LANGUAGE_SHORT_LABELS,
  LOT_TYPE_LABELS,
  STATUS_LABELS,
  UNKNOWN_VALUE,
} from "@/lib/labels";
import { formatCardCount, formatWeight } from "@/lib/format";
import { getDistanceKm, type Coordinates } from "@/lib/geo";
import { isArchived, isExpired } from "@/lib/listing-lifecycle";

/* Tout ce qui se déduit d'une annonce vit ici, pas dans les composants. */

/* `now` est obligatoire, comme dans lib/format : une valeur par défaut lisait
   l'horloge en cachette, et la vignette, rendue aussi dans l'aperçu client
   du dépôt, pouvait décider « À la une » autrement au build et à
   l'hydratation (React #418). */
export function isListingFeatured(listing: Pick<Listing, "featuredUntil" | "status">, now: number): boolean {
  if (!listing.featuredUntil) return false;
  if (listing.status === "sold") return false;
  return new Date(listing.featuredUntil).getTime() > now;
}

/* « Urgent » s'éteint avec la vente, comme la mise à la une : un lot vendu
   n'a plus rien d'urgent. */
export function isListingUrgent(listing: Pick<Listing, "urgentUntil" | "status">, now: number): boolean {
  if (!listing.urgentUntil) return false;
  if (listing.status === "sold") return false;
  return new Date(listing.urgentUntil).getTime() > now;
}

/* Ce que dit l'état d'une annonce à qui la regarde : rien quand elle est en
   ligne et disponible, son statut sinon — « Expirée » quand son vendeur ne
   l'a pas prolongée, quel que soit son statut en base. */
export function getListingStateLabel(listing: Pick<Listing, "status" | "renewedAt">, now: number): string | null {
  if (isExpired(listing, now)) return EXPIRED_LABEL;
  return listing.status === "available" ? null : STATUS_LABELS[listing.status];
}

/* Les photos qu'une annonce montre : aucune une fois archivée. La tâche
   quotidienne les retire en base ; d'ici là, aucune page ne les montre plus
   — ni la fiche, ni son image de partage. */
export function getShownPhotos(listing: Pick<Listing, "photos" | "status" | "renewedAt" | "soldAt">, now: number): ListingPhoto[] {
  return isArchived(listing, now) ? [] : listing.photos;
}

export function hasPriceDrop(listing: Pick<Listing, "priceCents" | "previousPriceCents">): boolean {
  return listing.previousPriceCents !== null && listing.previousPriceCents > listing.priceCents;
}

/* Le volume est ce que l'acheteur veut savoir en premier : combien de cartes,
   ou à défaut combien ça pèse. Faute des deux, le type de lot informe encore
   un peu — sauf s'il répète l'état affiché juste à côté, auquel cas on assume
   le tiret : rien n'a été mesuré, et le dire deux fois n'ajoute rien. */
export function getVolumeLabel(listing: Pick<ListingCardData, "cardCount" | "weightKg" | "lotType" | "condition">): string {
  if (listing.cardCount !== null) return formatCardCount(listing.cardCount);
  if (listing.weightKg !== null) return formatWeight(listing.weightKg);
  if (listing.lotType === "sealed" && listing.condition !== "sealed") {
    return LOT_TYPE_LABELS.sealed;
  }
  return UNKNOWN_VALUE;
}

/* Sur la fiche, le nom complet d'abord et le code ensuite : « Near Mint
   (NM) ». Le code seul se lit pour un joueur, pas pour la grand-mère qui
   vend le classeur de son petit-fils — ni pour son acheteur débutant. */
export function getConditionLabel(listing: Listing): string {
  return listing.condition === "sealed" || listing.condition === "mixed"
    ? CONDITION_LABELS[listing.condition]
    : `${CONDITION_LABELS[listing.condition]} (${listing.condition})`;
}

/* La jauge d'état de la vignette : cinq crans, de Très joué à Near Mint. Elle
   rend « EX » lisible à qui ne connaît pas les codes. Rien pour « Scellé »
   ni « États mêlés », qui ne sont pas des degrés : une jauge y inventerait
   une mesure. */
export const CONDITION_GRADE_MAX = 5;

const CONDITION_GRADES: Partial<Record<CardCondition, number>> = { NM: 5, EX: 4, LP: 3, MP: 2, HP: 1 };

export function getConditionGrade(listing: Pick<ListingCardData, "condition">): number | null {
  return listing.condition === null ? null : (CONDITION_GRADES[listing.condition] ?? null);
}

/* Formes courtes de la vignette. Un état ou une langue pas encore choisis —
   l'aperçu d'un dépôt en cours — s'écrivent « — », comme toute absence. */
export function getShortConditionLabel(listing: Pick<ListingCardData, "condition">): string {
  return listing.condition === null ? UNKNOWN_VALUE : CONDITION_SHORT_LABELS[listing.condition];
}

export function getShortLanguageLabel(listing: Pick<ListingCardData, "language">): string {
  return listing.language === null ? UNKNOWN_VALUE : LANGUAGE_SHORT_LABELS[listing.language];
}

export function getLanguageLabel(listing: Listing): string {
  return listing.language === "mixed"
    ? LANGUAGE_LABELS.mixed
    : `${LANGUAGE_LABELS[listing.language]} (${listing.language})`;
}

/* Distances depuis un point d'origine, indexées par identifiant.
   Calculées une fois par la page, jamais dans la vignette.
   La forme minimale suffit : une demande de recherche a elle aussi un
   identifiant et des coordonnées, et se place sur la même carte. */
export function getDistancesFromOrigin(
  items: Array<{ id: string; latitude: number; longitude: number }>,
  origin: Coordinates,
): Map<string, number> {
  return new Map(
    items.map((item) => [
      item.id,
      getDistanceKm(origin, { latitude: item.latitude, longitude: item.longitude }),
    ]),
  );
}
