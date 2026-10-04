import { GAME_IDS } from "@/types/game";
import { LISTING_AUDIENCES, LOT_TYPES, type ListingAudience } from "@/types/listing";
import { NOTIFICATION_KINDS, type Notification } from "@/types/notification";
import type { ListingRow, NotificationInsert, NotificationRowWithRelations } from "@/lib/data/rows";
import { narrow } from "@/lib/data/mappers/shared";
import type { MatchableListing, WantedMatch } from "@/lib/matching";

export function toNotification(row: NotificationRowWithRelations): Notification {
  return {
    id: row.id,
    kind: narrow(row.kind, NOTIFICATION_KINDS, "notifications.kind"),
    createdAt: row.created_at,
    readAt: row.read_at,
    listing: row.listing ? { slug: row.listing.slug, title: row.listing.title } : null,
    dealId: row.deal_id,
    wanted: row.wanted ? { slug: row.wanted.slug, title: row.wanted.title } : null,
    actorUsername: row.actor?.username ?? null,
  };
}

/* Un lot déposé qui répond à des recherches : une notification par
   acheteur, jamais au vendeur lui-même. Un lot réservé aux pros n'existe
   que pour les boutiques au forfait actif : il ne se signale qu'à elles.
   `listing` est l'annonce telle que la base l'a enregistrée, jamais un
   envoi — un dépôt rejoué avec un autre jeu, un autre prix ou une autre
   audience aurait prévenu d'autres acheteurs. */
export function toWantedMatchNotifications(
  listing: { id: string; sellerId: string; audience: ListingAudience },
  matches: { wantedId: string; buyerId: string; buyerHasProPlan: boolean }[],
): NotificationInsert[] {
  return matches
    .filter((match) => match.buyerId !== listing.sellerId)
    .filter((match) => listing.audience === "everyone" || match.buyerHasProPlan)
    .map((match) => ({ user_id: match.buyerId, kind: "wanted_match", listing_id: listing.id, deal_id: null, wanted_id: match.wantedId }));
}

/* Les colonnes d'une annonce enregistrée que lit son croisement. */
export const STORED_MATCH_COLUMNS = "id, seller_id, game_id, lot_type, card_count, price_cents, latitude, longitude, audience";

export type StoredListingForMatch = Pick<
  ListingRow,
  "id" | "seller_id" | "game_id" | "lot_type" | "card_count" | "price_cents" | "latitude" | "longitude" | "audience"
>;

/* L'annonce enregistrée, sous les deux formes que lisent le croisement et
   ses notifications. Une valeur d'énumération inconnue lève, comme partout
   ailleurs : une dérive du schéma doit se voir. */
export function toStoredMatchSubject(row: StoredListingForMatch): {
  listing: { id: string; sellerId: string; audience: ListingAudience };
  matchable: MatchableListing;
} {
  return {
    listing: { id: row.id, sellerId: row.seller_id, audience: narrow(row.audience, LISTING_AUDIENCES, "listings.audience") },
    matchable: {
      gameId: narrow(row.game_id, GAME_IDS, "listings.game_id"),
      lotType: narrow(row.lot_type, LOT_TYPES, "listings.lot_type"),
      cardCount: row.card_count,
      priceCents: row.price_cents,
      latitude: row.latitude,
      longitude: row.longitude,
      seller: { id: row.seller_id },
    },
  };
}

/* L'acheteur d'un croisement, et ce qui décide s'il peut voir le lot : le
   forfait en cours, pas le statut — une boutique au forfait expiré ne voit
   plus les lots réservés. */
export function toMatchRecipient(match: WantedMatch): { wantedId: string; buyerId: string; buyerHasProPlan: boolean } {
  return { wantedId: match.wanted.id, buyerId: match.wanted.buyer.id, buyerHasProPlan: match.wanted.buyer.hasProPlan };
}
