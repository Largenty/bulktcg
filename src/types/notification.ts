export const NOTIFICATION_KINDS = ["listing_available", "deal_closed", "review_received", "wanted_match", "listing_expiring"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/* Une notification, avec ce dont elle parle déjà résolu : la cloche de
   l'en-tête en compte les non lues, la page /notifications les liste. */
export type Notification = {
  id: string;
  kind: NotificationKind;
  createdAt: string;
  readAt: string | null;
  listing: { slug: string; title: string } | null;
  dealId: string | null;
  wanted: { slug: string; title: string } | null;
  /* L'autre personne : le vendeur qui a clôturé, celle qui vous a noté. */
  actorUsername: string | null;
};
