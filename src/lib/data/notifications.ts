import "server-only";
import { cache } from "react";
import type { Notification } from "@/types/notification";
import type {
  DealRow,
  ListingRowWithRelations,
  NotificationRow,
  NotificationRowWithRelations,
  ProfileRow,
  ReviewRowWithRelations,
  WantedRowWithRelations,
} from "@/lib/data/rows";
import { toNotification } from "@/lib/data/mappers";
import { dealRows, notificationRows, profileRows, readableListingRows, reviewRows, unreadNotificationCount, wantedRows } from "@/lib/data/source";

/* Les notifications n'existent que pour leur destinataire : c'est la
   politique « notifications lues par leur destinataire » de la phase 2. */

/* Ce que la jointure lit, chargé une fois pour toute la liste. */
type NotificationSources = {
  listings: ListingRowWithRelations[];
  wanted: WantedRowWithRelations[];
  deals: DealRow[];
  reviews: ReviewRowWithRelations[];
  profiles: ProfileRow[];
};

async function loadSources(): Promise<NotificationSources> {
  const [listings, wanted, deals, reviews, profiles] = await Promise.all([
    readableListingRows(),
    wantedRows(),
    dealRows(),
    reviewRows(),
    profileRows(),
  ]);
  return { listings, wanted, deals, reviews, profiles };
}

/* La jointure de la requête : le lot et la recherche, et l'autre personne —
   le vendeur qui a clôturé, ou celle qui a laissé l'avis. */
function withRelations(row: NotificationRow, sources: NotificationSources): NotificationRowWithRelations {
  const listing = sources.listings.find((candidate) => candidate.id === row.listing_id);
  const wanted = sources.wanted.find((candidate) => candidate.id === row.wanted_id);
  const deal = sources.deals.find((candidate) => candidate.id === row.deal_id);
  const actorId =
    row.kind === "deal_closed"
      ? deal?.seller_id
      : row.kind === "review_received"
        ? sources.reviews.find((review) => review.deal_id === row.deal_id && review.reviewed_id === row.user_id)?.reviewer_id
        : undefined;
  const actor = sources.profiles.find((candidate) => candidate.id === actorId);
  return {
    ...row,
    listing: listing ? { slug: listing.slug, title: listing.title } : null,
    wanted: wanted ? { slug: wanted.slug, title: wanted.title } : null,
    actor: actor ? { username: actor.username } : null,
  };
}

export const getNotificationsForUser = cache(async (userId: string): Promise<Notification[]> => {
  const sources = await loadSources();
  return (await notificationRows()).filter((row) => row.user_id === userId)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .map((row) => toNotification(withRelations(row, sources)));
});

/* Le chiffre de la cloche, sur chaque page : les non lues, comptées par la
   source — sans charger la liste ni ses jointures (unreadNotificationCount). */
export const getUnreadNotificationCount = cache(async (userId: string): Promise<number> => {
  return unreadNotificationCount(userId);
});
