import type { ListingStatus } from "@/types/listing";
import type {
  ListingEditionInsert,
  ListingInsert,
  ListingPhotoInsert,
  ListingTagInsert,
  ListingUpdate,
} from "@/lib/data/rows";
import { communeOf, toLocationColumns } from "@/lib/data/mappers/shared";
import { getStoredPhotoKey } from "@/lib/photo-refs";
import { toPriceCents, type ListingFormValues } from "@/lib/schemas/listing-form";

/* Sens inverse : du formulaire validé vers les lignes d'une annonce. */

export function toListingInsert(values: ListingFormValues, sellerId: string, slug: string, id: string): ListingInsert {
  return {
    id,
    slug,
    seller_id: sellerId,
    game_id: values.gameId,
    title: values.title,
    description: values.description,
    lot_type: values.lotType,
    card_count: values.cardCount,
    weight_kg: values.weightKg,
    condition: values.condition,
    language: values.language,
    price_cents: toPriceCents(values.priceEuros),
    ...toLocationColumns(communeOf(values.city, values.postalCode)),
    status: "available",
    audience: values.audience,
    /* Une note sans case cochée n'a pas de sens : elle n'est pas envoyée. */
    open_to_trade: values.openToTrade,
    trade_note: values.openToTrade && values.tradeNote !== "" ? values.tradeNote : null,
  };
}

/* La baisse de prix s'affiche sur la vignette (« Baisse 20 % ») : elle se
   calcule contre le prix d'avant. Baisser garde l'ancien prix en mémoire,
   remonter l'efface — afficher une « baisse » par rapport à un prix
   inférieur au prix actuel serait un mensonge. */
export function nextPreviousPriceCents(
  current: { priceCents: number; previousPriceCents: number | null },
  newPriceCents: number,
): number | null {
  if (newPriceCents < current.priceCents) return current.priceCents;
  if (newPriceCents > current.priceCents) return null;
  return current.previousPriceCents;
}

export function toListingUpdate(
  values: ListingFormValues,
  current: { priceCents: number; previousPriceCents: number | null },
): ListingUpdate {
  const { id: _id, slug: _slug, seller_id: _seller, status: _status, ...fields } = toListingInsert(values, "", "", "");
  return {
    ...fields,
    previous_price_cents: nextPreviousPriceCents(current, fields.price_cents),
  };
}

/* L'ordre de saisie est conservé : c'est celui dans lequel la fiche les
   affiche. */
export function toListingEditionInserts(values: Pick<ListingFormValues, "editions">): ListingEditionInsert[] {
  return values.editions.map((editionId, position) => ({ edition_id: editionId, position }));
}

export function toListingTagInserts(values: Pick<ListingFormValues, "tags">): ListingTagInsert[] {
  return values.tags.map((tag) => ({ tag }));
}

/* Les références de photo deviennent des chemins de stockage. Une photo
   restée sur l'appareil (« local: ») n'a pas de chemin : elle doit avoir été
   téléversée avant l'écriture, et l'oublier doit lever plutôt que créer une
   ligne de photo vide. */
export function toListingPhotoInserts(photoRefs: string[]): ListingPhotoInsert[] {
  return photoRefs.map((ref, position) => {
    if (ref.startsWith("local:")) {
      throw new Error("Photo non téléversée : elle doit passer par le stockage avant l'écriture.");
    }
    return { storage_path: getStoredPhotoKey(ref) ?? ref, position };
  });
}

export function toListingStatusUpdate(status: ListingStatus, nowIso: string): ListingUpdate {
  return { status, sold_at: status === "sold" ? nowIso : null };
}
