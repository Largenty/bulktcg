import { GAME_IDS } from "@/types/game";
import { LOT_TYPES } from "@/types/listing";
import { WANTED_STATUSES, type WantedListing, type WantedStatus } from "@/types/wanted";
import type { WantedInsert, WantedRowWithRelations, WantedUpdate } from "@/lib/data/rows";
import { buildReference, communeOf, narrow, toLocationColumns } from "@/lib/data/mappers/shared";
import { toSellerSummary } from "@/lib/data/mappers/profiles";
import { toPriceCents } from "@/lib/schemas/listing-form";
import type { WantedFormValues } from "@/lib/schemas/wanted-form";

export function toWantedListing(row: WantedRowWithRelations): WantedListing {
  return {
    id: row.id,
    slug: row.slug,
    reference: buildReference("RC", row.id),
    buyer: toSellerSummary(row.buyer),
    gameId: narrow(row.game_id, GAME_IDS, "wanted_listings.game_id"),
    title: row.title,
    description: row.description,
    lotType: row.lot_type === null ? null : narrow(row.lot_type, LOT_TYPES, "wanted_listings.lot_type"),
    maxPriceCents: row.max_price_cents,
    minCardCount: row.min_card_count,
    city: row.city,
    postalCode: row.postal_code,
    departmentCode: row.department_code,
    latitude: row.latitude,
    longitude: row.longitude,
    maxDistanceKm: row.max_distance_km,
    status: narrow(row.status, WANTED_STATUSES, "wanted_listings.status"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fulfilledAt: row.fulfilled_at,
  };
}

export function toWantedInsert(values: WantedFormValues, buyerId: string, slug: string, id: string): WantedInsert {
  return {
    id,
    slug,
    buyer_id: buyerId,
    game_id: values.gameId,
    title: values.title,
    description: values.description,
    lot_type: values.lotType === "" ? null : values.lotType,
    max_price_cents: values.maxPriceEuros === null ? null : toPriceCents(values.maxPriceEuros),
    min_card_count: values.minCardCount,
    ...toLocationColumns(communeOf(values.city, values.postalCode)),
    max_distance_km: values.maxDistanceKm,
    status: "open",
  };
}

export function toWantedUpdate(values: WantedFormValues): WantedUpdate {
  const { id: _id, slug: _slug, buyer_id: _buyer, status: _status, ...fields } = toWantedInsert(values, "", "", "");
  return fields;
}

/* « Trouvé » est daté : c'est la seule mesure honnête de l'utilité du
   croisement. « Abandonnée » ne l'est pas. */
export function toWantedStatusUpdate(status: WantedStatus, nowIso: string): WantedUpdate {
  return { status, fulfilled_at: status === "fulfilled" ? nowIso : null };
}
