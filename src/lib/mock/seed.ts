import type { GameId } from "@/types/game";
import type { ListingPhotoRow } from "@/lib/data/rows";
import { pickStockPhotos } from "@/lib/photos";
import { hashString } from "@/lib/random";

/* Helpers de génération des données de phase 1.
   Tout est déterministe : deux builds successifs produisent les mêmes
   annonces, seules les dates glissent avec le temps réel. */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const REFERENCE_NOW = Date.now();

export function minutesAgo(minutes: number): string {
  return new Date(REFERENCE_NOW - minutes * MINUTE).toISOString();
}

export function hoursAgo(hours: number): string {
  return new Date(REFERENCE_NOW - hours * HOUR).toISOString();
}

export function daysAgo(days: number): string {
  return new Date(REFERENCE_NOW - days * DAY).toISOString();
}

export function daysFromNow(days: number): string {
  return new Date(REFERENCE_NOW + days * DAY).toISOString();
}

/* Deux lettres tirées du pseudo, comme le fera le trigger SQL en phase 2. */
export function buildInitials(username: string): string {
  const [first, second] = username.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (first !== undefined && second !== undefined) {
    return (first.charAt(0) + second.charAt(0)).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

export function buildPhotoRows(
  listingId: string,
  count: number,
  gameId: GameId,
  rank: number,
): ListingPhotoRow[] {
  /* storage_path porte l'URL Unsplash en phase 1 et portera un chemin de
     bucket en phase 2 : c'est la même colonne, remplie différemment.
     Un jeu sans photo honnête rend un pool vide, donc aucune ligne : des
     lignes sans image faisaient afficher « 4 photos » sur une vignette qui
     n'en montrait aucune. */
  const photos = pickStockPhotos(gameId, hashString(listingId), count, rank);
  return photos.map((photo, index) => ({
    id: `${listingId}-p${index + 1}`,
    listing_id: listingId,
    position: index,
    storage_path: photo.url,
  }));
}

