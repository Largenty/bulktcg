import type { ListingWaitlistRow } from "@/lib/data/rows";
import { daysAgo, hoursAgo } from "@/lib/mock/seed";

/* Qui attend quoi. l-21 est le lot du compte de démonstration, réservé pour
   bastien26 : deux personnes attendent, et il n'en voit que le nombre. Le
   compte de démonstration attend lui-même l-16 ; sur l-27, réservé pour un
   autre, il n'est pas encore inscrit — le bouton s'affiche dans son fil. */
export const MOCK_WAITLIST_ROWS: ListingWaitlistRow[] = [
  { listing_id: "l-21", user_id: "u-06", created_at: hoursAgo(20) },
  { listing_id: "l-21", user_id: "u-02", created_at: hoursAgo(9) },
  { listing_id: "l-16", user_id: "u-01", created_at: daysAgo(2) },
  { listing_id: "l-27", user_id: "u-05", created_at: daysAgo(1) },
];
