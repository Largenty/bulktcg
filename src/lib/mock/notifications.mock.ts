import type { NotificationRow } from "@/lib/data/rows";
import { MOCK_DEAL_ROWS } from "@/lib/mock/deals.mock";
import { MOCK_REVIEW_ROWS } from "@/lib/mock/reviews.mock";
import { daysAgo, hoursAgo } from "@/lib/mock/seed";

const dealClosedAt = (dealId: string) => MOCK_DEAL_ROWS.find((deal) => deal.id === dealId)?.closed_at ?? daysAgo(1);
const reviewedAt = (reviewId: string) => MOCK_REVIEW_ROWS.find((review) => review.id === reviewId)?.created_at ?? daysAgo(1);

/* Une notification de chaque sorte pour le compte de démonstration, deux
   non lues : la cloche de l'en-tête affiche 2. Chacune est cohérente avec
   le reste du mock — la vente d-02 clôturée par bastien26, l'avis r-08, le
   lot l-37 qui répond à la recherche w-01, le lot l-40 qui expire dans
   quatre jours, signalé à sept jours de l'échéance. */
export const MOCK_NOTIFICATION_ROWS: NotificationRow[] = [
  {
    id: "n-01",
    user_id: "u-01",
    kind: "listing_available",
    listing_id: "l-24",
    deal_id: null,
    wanted_id: null,
    created_at: hoursAgo(3),
    read_at: null,
  },
  {
    id: "n-02",
    user_id: "u-01",
    kind: "deal_closed",
    listing_id: "l-13",
    deal_id: "d-02",
    wanted_id: null,
    created_at: dealClosedAt("d-02"),
    read_at: null,
  },
  {
    id: "n-03",
    user_id: "u-01",
    kind: "wanted_match",
    listing_id: "l-37",
    deal_id: null,
    wanted_id: "w-01",
    created_at: daysAgo(3),
    read_at: daysAgo(3),
  },
  {
    id: "n-04",
    user_id: "u-01",
    kind: "review_received",
    listing_id: "l-19",
    deal_id: "d-03",
    wanted_id: null,
    created_at: reviewedAt("r-08"),
    read_at: reviewedAt("r-08"),
  },
  {
    id: "n-05",
    user_id: "u-01",
    kind: "listing_expiring",
    listing_id: "l-40",
    deal_id: null,
    wanted_id: null,
    created_at: daysAgo(3),
    read_at: daysAgo(2),
  },
];
