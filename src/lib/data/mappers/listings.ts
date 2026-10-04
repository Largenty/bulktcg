import { GAME_IDS } from "@/types/game";
import type { ConversationListing } from "@/types/conversation";
import type { Edition } from "@/types/edition";
import {
  CARD_CONDITIONS,
  CARD_LANGUAGES,
  LISTING_AUDIENCES,
  LISTING_STATUSES,
  LOT_TYPES,
  type Listing,
  type ListingPhoto,
} from "@/types/listing";
import type { ConversationRowWithRelations, ListingEditionRow, ListingPhotoRow, ListingRowWithRelations } from "@/lib/data/rows";
import { buildReference, byPosition, narrow, resolvePhotoUrl } from "@/lib/data/mappers/shared";
import { toSellerSummary } from "@/lib/data/mappers/profiles";
import { getEditionById } from "@/lib/editions";
import { PRODUCT_TAG_IDS } from "@/lib/product-tags";
import { hashString } from "@/lib/random";

/* Une édition inconnue lève, comme n'importe quelle énumération inconnue :
   si le référentiel et la base divergent, il faut le voir tout de suite et
   non découvrir une annonce dont la série s'affiche « undefined ». */
function resolveEditions(rows: ListingEditionRow[]): Edition[] {
  return byPosition(rows).map((row) => {
    const edition = getEditionById(row.edition_id);
    if (!edition) {
      throw new Error(`Édition inconnue en base : « ${row.edition_id} ».`);
    }
    return edition;
  });
}

function toListingPhoto(row: ListingPhotoRow): ListingPhoto {
  return {
    id: row.id,
    position: row.position,
    /* La graine est dérivée de l'identifiant, jamais stockée : elle donne le
       même motif au serveur et au client, en phase 1 comme en phase 2. */
    seed: hashString(row.id),
    url: resolvePhotoUrl(row.storage_path),
  };
}

export function toListing(row: ListingRowWithRelations): Listing {
  return {
    id: row.id,
    slug: row.slug,
    reference: buildReference("BK", row.id),
    seller: toSellerSummary(row.seller),
    gameId: narrow(row.game_id, GAME_IDS, "listings.game_id"),
    title: row.title,
    description: row.description,
    lotType: narrow(row.lot_type, LOT_TYPES, "listings.lot_type"),
    cardCount: row.card_count,
    weightKg: row.weight_kg,
    condition: narrow(row.condition, CARD_CONDITIONS, "listings.condition"),
    language: narrow(row.language, CARD_LANGUAGES, "listings.language"),
    priceCents: row.price_cents,
    previousPriceCents: row.previous_price_cents,
    city: row.city,
    postalCode: row.postal_code,
    departmentCode: row.department_code,
    latitude: row.latitude,
    longitude: row.longitude,
    status: narrow(row.status, LISTING_STATUSES, "listings.status"),
    reservedForId: row.reserved_for,
    audience: narrow(row.audience, LISTING_AUDIENCES, "listings.audience"),
    openToTrade: row.open_to_trade,
    tradeNote: row.trade_note,
    featuredUntil: row.featured_until,
    urgentUntil: row.urgent_until,
    hasExtraPhotos: row.extra_photos,
    bumpStartedAt: row.bump_started_at,
    bumpUntil: row.bump_until,
    renewedAt: row.renewed_at,
    viewCount: row.view_count,
    photos: byPosition(row.photos).map(toListingPhoto),
    editions: resolveEditions(row.editions),
    tags: row.tags.map((tag) => narrow(tag.tag, PRODUCT_TAG_IDS, "listing_tags.tag")),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    soldAt: row.sold_at,
  };
}

/* Le lot d'une conversation ou d'une vente : sa première photo, la graine
   qui dessine l'emplacement quand il n'y en a pas. */
export function toConversationListing(
  listing: ConversationRowWithRelations["listing"],
): ConversationListing {
  const firstPhoto = byPosition(listing.photos)[0];
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    priceCents: listing.price_cents,
    status: narrow(listing.status, LISTING_STATUSES, "listings.status"),
    reservedForId: listing.reserved_for,
    audience: narrow(listing.audience, LISTING_AUDIENCES, "listings.audience"),
    photoSeed: firstPhoto ? hashString(firstPhoto.id) : 0,
    photoUrl: firstPhoto ? resolvePhotoUrl(firstPhoto.storage_path) : null,
    gameId: narrow(listing.game_id, GAME_IDS, "listings.game_id"),
  };
}
