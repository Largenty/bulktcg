import type { Listing } from "@/types/listing";
import type { WantedListing } from "@/types/wanted";
import { getCityByPair, type City } from "@/lib/cities";
import type { DraftPhoto } from "@/lib/listing-draft";
import type { ListingFormValues } from "@/lib/schemas/listing-form";
import type { WantedFormValues } from "@/lib/schemas/wanted-form";

/* Le chemin inverse de lib/format : du domaine vers ce qu'un champ de
   formulaire attend, c'est-à-dire des chaînes. Un formulaire de modification
   pré-rempli ne doit pas dériver de l'objet qu'il modifie — c'est ici, à un
   seul endroit, que la correspondance est tenue.

   Une valeur absente donne une chaîne vide, jamais « 0 » : sans ça, un
   aller-retour d'édition transformerait « je n'ai pas compté » en
   « il y a zéro carte ». */

/* Les champs multivalués sortent en tableaux, pas en chaînes : ce sont des
   cases à cocher, pas des champs texte. */
export type ListingFormDefaults = Partial<
  Record<Exclude<keyof ListingFormValues, "editions" | "tags" | "photos">, string>
> & {
  editions?: string[];
  tags?: string[];
  /* Les photos déjà publiées reviennent telles quelles : leur référence est
     leur URL, et la modification peut les réordonner ou les retirer. */
  photos?: DraftPhoto[];
  /* La commune enregistrée, résolue ici, côté serveur : son nom ne suffit
     pas — trois communes s'appellent Valence —, et le référentiel ne part pas
     dans le navigateur. */
  place?: City | null;
};
export type WantedFormDefaults = Partial<Record<keyof WantedFormValues, string>> & { place?: City | null };

/* La virgule est la séparatrice décimale française et les schémas
   l'acceptent : on rend le champ tel qu'il aurait été tapé. */
function decimalField(value: number | null): string {
  return value === null ? "" : String(value).replace(".", ",");
}

function integerField(value: number | null): string {
  return value === null ? "" : String(value);
}

export function toListingFormDefaults(listing: Listing): ListingFormDefaults {
  return {
    title: listing.title,
    gameId: listing.gameId,
    lotType: listing.lotType,
    condition: listing.condition,
    language: listing.language,
    cardCount: integerField(listing.cardCount),
    weightKg: decimalField(listing.weightKg),
    priceEuros: decimalField(listing.priceCents / 100),
    city: listing.city,
    postalCode: listing.postalCode,
    place: getCityByPair(listing.city, listing.postalCode),
    description: listing.description,
    editions: listing.editions.map((edition) => edition.id),
    tags: [...listing.tags],
    audience: listing.audience,
    openToTrade: listing.openToTrade ? "on" : "",
    tradeNote: listing.tradeNote ?? "",
    /* Payée une fois pour toutes : la modification la retrouve acquise. */
    extraPhotos: listing.hasExtraPhotos ? "on" : "",
    photos: listing.photos.flatMap((photo, index) =>
      photo.url ? [{ ref: photo.url, previewUrl: photo.url, name: `Photo ${index + 1}` }] : [],
    ),
  };
}

/* Déposer un lot en réponse à une demande de recherche : le jeu et le format
   demandés sont déjà choisis. Rien d'autre n'est supposé — ni l'état, ni le
   prix, que seul le vendeur connaît. */
export function toListingDefaultsFromWanted(wanted: WantedListing): ListingFormDefaults {
  return {
    gameId: wanted.gameId,
    lotType: wanted.lotType ?? undefined,
  };
}

export function toWantedFormDefaults(wanted: WantedListing): WantedFormDefaults {
  return {
    title: wanted.title,
    gameId: wanted.gameId,
    /* Chaîne vide et non « — » : ici la valeur vide est une vraie réponse,
       « n'importe quel format ». */
    lotType: wanted.lotType ?? "",
    maxPriceEuros: wanted.maxPriceCents === null ? "" : decimalField(wanted.maxPriceCents / 100),
    minCardCount: integerField(wanted.minCardCount),
    city: wanted.city,
    postalCode: wanted.postalCode,
    place: getCityByPair(wanted.city, wanted.postalCode),
    maxDistanceKm: String(wanted.maxDistanceKm),
    description: wanted.description,
  };
}
