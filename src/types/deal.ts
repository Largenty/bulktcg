import type { ConversationListing } from "@/types/conversation";
import type { SellerSummary } from "@/types/profile";
import type { Review } from "@/types/review";

/* Ce que les deux parties ont conclu : une vente, ou un échange de lots. */
export const DEAL_KINDS = ["sale", "trade"] as const;
export type DealKind = (typeof DEAL_KINDS)[number];

/* La vente telle qu'une conversation la connaît. Le vendeur la clôture, seul :
   c'est son lot, il dit quand il est parti et à qui. Clôturée, elle ouvre
   l'avis des deux côtés. */
export type ConversationDeal = {
  id: string;
  kind: DealKind;
  closedAt: string;
  /* Les parties qui ont déjà laissé leur avis : un avis par personne et par
     vente. */
  reviewerIds: string[];
};

/* Le récapitulatif, lu par ses deux parties seulement : le lot, qui l'a
   vendu à qui, la chronologie et les avis échangés. */
export type Deal = ConversationDeal & {
  conversationId: string;
  /* Le premier message de la conversation : le début de l'histoire. */
  startedAt: string;
  listing: ConversationListing & { createdAt: string };
  seller: SellerSummary;
  buyer: SellerSummary;
  reviews: Review[];
};
