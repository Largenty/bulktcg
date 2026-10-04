import { DEAL_KINDS, type ConversationDeal, type Deal, type DealKind } from "@/types/deal";
import { REVIEW_CRITERIA, REVIEW_ROLES, type Review, type ReviewScores } from "@/types/review";
import type { CloseDealArgs, DealRow, DealRowWithRelations, ReviewInsert, ReviewRowWithRelations } from "@/lib/data/rows";
import { byCreationDate, narrow } from "@/lib/data/mappers/shared";
import { toConversationListing } from "@/lib/data/mappers/listings";
import { toSellerSummary } from "@/lib/data/mappers/profiles";

/* Les ventes et leurs avis, dans les deux sens. */

export function toConversationDeal(row: DealRow, reviews: { reviewer_id: string | null }[]): ConversationDeal {
  return {
    id: row.id,
    kind: narrow(row.kind, DEAL_KINDS, "deals.kind"),
    closedAt: row.closed_at,
    /* Une vente qui existe encore a ses deux parties : l'auteur d'un de ses
       avis n'est jamais nul. Le filtre ne sert que le type. */
    reviewerIds: reviews.flatMap((review) => (review.reviewer_id ? [review.reviewer_id] : [])),
  };
}

export function toDeal(row: DealRowWithRelations): Deal {
  return {
    ...toConversationDeal(row, row.reviews),
    conversationId: row.conversation_id,
    startedAt: row.conversation.created_at,
    listing: { ...toConversationListing(row.listing), createdAt: row.listing.created_at },
    seller: toSellerSummary(row.seller),
    buyer: toSellerSummary(row.buyer),
    reviews: byCreationDate(row.reviews).map(toReview),
  };
}

/* La note d'un avis est la moyenne de ses trois critères, à une décimale :
   c'est la même règle que public.refresh_rating pour la note du profil. */
function averageScore(scores: ReviewScores): number {
  const total = REVIEW_CRITERIA.reduce((sum, criterion) => sum + scores[criterion], 0);
  return Math.round((total / REVIEW_CRITERIA.length) * 10) / 10;
}

export function toReview(row: ReviewRowWithRelations): Review {
  const scores: ReviewScores = {
    punctuality: row.punctuality,
    responsiveness: row.responsiveness,
    reliability: row.reliability,
  };
  return {
    id: row.id,
    dealId: row.deal_id,
    reviewerId: row.reviewer_id,
    reviewerUsername: row.reviewer?.username ?? null,
    reviewerInitials: row.reviewer?.avatar_initials ?? null,
    reviewedId: row.reviewed_id,
    reviewedRole: narrow(row.reviewed_role, REVIEW_ROLES, "reviews.reviewed_role"),
    scores,
    rating: averageScore(scores),
    comment: row.comment,
    createdAt: row.created_at,
    /* Une annonce qui existe encore mais ne se lit pas est réservée aux
       pros : la RLS a vidé la jointure. Sans annonce du tout, elle est
       partie avec le compte de son vendeur. */
    listing: row.listing
      ? { slug: row.listing.slug, title: row.listing.title }
      : { unavailable: row.listing_id === null ? "deleted" : "pro-only" },
  };
}

export function toCloseDealArgs(conversationId: string, kind: DealKind): CloseDealArgs {
  return { conversation: conversationId, deal_kind: kind };
}

/* Un commentaire vide n'est pas un commentaire : null, pas une chaîne vide. */
export function toReviewInsert(input: {
  dealId: string;
  reviewerId: string;
  scores: ReviewScores;
  comment: string;
}): ReviewInsert {
  const comment = input.comment.trim();
  return {
    deal_id: input.dealId,
    reviewer_id: input.reviewerId,
    punctuality: input.scores.punctuality,
    responsiveness: input.scores.responsiveness,
    reliability: input.scores.reliability,
    comment: comment === "" ? null : comment,
  };
}
