import "server-only";
import type { DealKind } from "@/types/deal";
import type { ReviewScores } from "@/types/review";
import { getConversationById } from "@/lib/data/conversations";
import { getDealById, hasClosedDeal } from "@/lib/data/deals";
import { toCloseDealArgs, toReviewInsert } from "@/lib/data/mappers";
import type { MutationResult } from "@/lib/data/mutation-result";
import { getCurrentUserId } from "@/lib/data/session";
import { performWrite } from "@/lib/data/write-seam";

/* Le vendeur clôture, seul : c'est son lot, il dit quand il est parti et à
   qui. L'acheteur est l'autre partie de la conversation, jamais un
   identifiant fourni par le navigateur. Pour l'acheteur, la conversation
   n'a rien à clôturer : introuvable, comme le répond close_deal(). */
export async function closeDeal(conversationId: string, kind: DealKind): Promise<MutationResult<null>> {
  const sellerId = await getCurrentUserId();
  if (!sellerId) return { status: "unauthenticated" };
  const conversation = await getConversationById(conversationId, sellerId);
  if (!conversation || conversation.seller.id !== sellerId) return { status: "not-found" };
  if (conversation.deal || (await hasClosedDeal(conversation.listing.id))) {
    return { status: "invalid", fieldErrors: { deal: "Cette vente est déjà clôturée." } };
  }
  /* close_deal passe le lot en « Vendu » et prévient l'acheteur. */
  const args = toCloseDealArgs(conversation.id, kind);
  return performWrite("deals.close", { rpc: "close_deal", ...args }, null, ({ user }) => user.rpc("close_deal", args));
}

/* Un avis par personne et par vente, sur l'autre partie : la base la
   désigne à partir de la vente. */
export async function reviewDeal(input: {
  dealId: string;
  scores: ReviewScores;
  comment: string;
}): Promise<MutationResult<null>> {
  const reviewerId = await getCurrentUserId();
  if (!reviewerId) return { status: "unauthenticated" };
  const deal = await getDealById(input.dealId, reviewerId);
  if (!deal) return { status: "not-found" };
  if (deal.reviewerIds.includes(reviewerId)) {
    return { status: "invalid", fieldErrors: { comment: "Vous avez déjà noté cette vente." } };
  }
  /* stamp_review pose la personne notée, son rôle et l'annonce. */
  const review = toReviewInsert({ dealId: deal.id, reviewerId, scores: input.scores, comment: input.comment });
  return performWrite("reviews.insert", review, null, ({ user }) => user.from("reviews").insert(review), reviewFieldErrors);
}

/* Un second avis sur la même vente : l'unicité de la base le refuse aussi. */
function reviewFieldErrors(code: string) {
  return code === "23505" ? { comment: "Vous avez déjà noté cette vente." } : null;
}
