import "server-only";
import { cache } from "react";
import { readableListingRows, waitlistCountsFor, waitlistRows } from "@/lib/data/source";

/* La liste d'attente d'un lot réservé. Chacun ne lit que sa propre
   inscription ; le vendeur n'en lit que le nombre, jamais les noms. */

export const isOnWaitlist = cache(async (listingId: string, userId: string): Promise<boolean> => {
  return (await waitlistRows()).some((row) => row.listing_id === listingId && row.user_id === userId);
});

/* Par annonce, pour les lots du vendeur seulement : waitlist_count() rend 0
   à qui n'est pas le vendeur, comme cette lecture. */
export const getWaitlistCountsForSeller = cache(async (sellerId: string): Promise<Map<string, number>> => {
  return waitlistCountsFor((await readableListingRows()).filter((row) => row.seller_id === sellerId));
});
