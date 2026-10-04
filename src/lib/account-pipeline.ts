import type { PipelineRow } from "@/components/account/PipelineBoard";
import type { Conversation } from "@/types/conversation";
import type { Deal } from "@/types/deal";
import { LISTING_STATUSES, type Listing } from "@/types/listing";
import { WANTED_STATUSES, type WantedListing, type WantedStatus } from "@/types/wanted";
import { getListingStageUrl, getWantedStageUrl, groupListingsByStage, listingStageLabel } from "@/lib/account-stages";
import { getDealViewUrl } from "@/lib/deal-display";
import { WANTED_STATUS_LABELS } from "@/lib/labels";
import { routes } from "@/lib/routes";

type PipelineInput = {
  userId: string;
  listings: Listing[];
  wantedListings: WantedListing[];
  deals: Deal[];
  conversations: Conversation[];
  /* L'instant de la page : une annonce expirée sort de « Disponible ». */
  now: number;
};

/* Les trois lignes du suivi, comptées sur les listes réelles à chaque
   visite : un compteur stocké finirait par contredire la liste vers laquelle
   il mène. Chaque étape pointe vers cette liste, filtrée. */
export function buildPipelineRows({ userId, listings, wantedListings, deals, conversations, now }: PipelineInput): PipelineRow[] {
  const listingsByStage = groupListingsByStage(listings, now);
  const countWanted = (status: WantedStatus) => wantedListings.filter((wanted) => wanted.status === status).length;
  const hasMyReview = (deal: Deal) => deal.reviews.some((review) => review.reviewerId === userId);
  const sales = deals.filter((deal) => deal.seller.id === userId);
  const purchases = deals.filter((deal) => deal.buyer.id === userId);
  const closedConversations = new Set(deals.map((deal) => deal.conversationId));
  const openBuying = conversations.filter(
    (conversation) => conversation.buyer.id === userId && !closedConversations.has(conversation.id),
  );

  return [
    {
      title: "Mes annonces",
      stages: [
        ...LISTING_STATUSES.map((status) => ({
          label: listingStageLabel(status),
          count: listingsByStage[status].length,
          href: getListingStageUrl(status),
        })),
        /* Une autre fin : l'annonce que son vendeur n'a pas prolongée. */
        {
          label: listingStageLabel("expired"),
          count: listingsByStage.expired.length,
          href: getListingStageUrl("expired"),
          isAlternative: true,
        },
        {
          label: "Acheteur à noter",
          count: sales.filter((deal) => !hasMyReview(deal)).length,
          href: getDealViewUrl("a-noter"),
          needsAction: true,
        },
      ],
    },
    {
      title: "Mes achats",
      stages: [
        { label: "En discussion", count: openBuying.length, href: routes.inbox },
        { label: "Achetés", count: purchases.length, href: getDealViewUrl("achats") },
        {
          label: "Vendeur à noter",
          count: purchases.filter((deal) => !hasMyReview(deal)).length,
          href: getDealViewUrl("a-noter"),
          needsAction: true,
        },
      ],
    },
    {
      title: "Mes recherches",
      stages: WANTED_STATUSES.map((status) => ({
        label: WANTED_STATUS_LABELS[status],
        count: countWanted(status),
        href: getWantedStageUrl(status),
        isAlternative: status === "closed",
      })),
    },
  ];
}
