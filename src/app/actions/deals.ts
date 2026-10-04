"use server";

import { routes } from "@/lib/routes";
import { z } from "@/lib/schemas/zod";
import { revalidateDealPaths, revalidateListingPaths } from "@/app/actions/revalidate";
import { getConversationById } from "@/lib/data/conversations";
import { closeDeal, reviewDeal } from "@/lib/data/deal-mutations";
import { getDealById } from "@/lib/data/deals";
import { getListingById } from "@/lib/data/listings";
import type { MutationResult } from "@/lib/data/mutation-result";
import { getCurrentUserId } from "@/lib/data/session";
import { collectErrors } from "@/lib/schemas/field-errors";
import { recordIdSchema } from "@/lib/schemas/record-id";
import { reviewSchema } from "@/lib/schemas/review-form";
import { DEAL_KINDS } from "@/types/deal";

const kindSchema = z.enum(DEAL_KINDS);

/* Clôturer passe le lot en « Vendu » — sa fiche, sa page de jeu et de
   commune, l'accueil — et ajoute une vente à l'historique du vendeur. */
async function revalidateClosedDeal(conversationId: string) {
  const viewerId = await getCurrentUserId();
  const conversation = viewerId ? await getConversationById(conversationId, viewerId) : null;
  if (!conversation) return;
  const listing = await getListingById(conversation.listing.id);
  revalidateListingPaths(routes.listing(conversation.listing.slug), listing ? [listing] : []);
  revalidateDealPaths([conversation.seller.username]);
}

/* Un avis change la note de la personne notée, et d'elle seule. */
async function revalidateReviewedDeal(dealId: string) {
  const viewerId = await getCurrentUserId();
  const deal = viewerId ? await getDealById(dealId, viewerId) : null;
  if (!deal) return;
  revalidateDealPaths([deal.seller.id === viewerId ? deal.buyer.username : deal.seller.username]);
}

/* Actions minces : elles revalident l'entrée, délèguent à la couche
   données, et rafraîchissent le compte, la messagerie et les profils quand
   une écriture a vraiment eu lieu. */
export async function closeDealAction(conversationId: unknown, kind: unknown): Promise<MutationResult<null>> {
  const id = recordIdSchema.safeParse(conversationId);
  const dealKind = kindSchema.safeParse(kind);
  if (!id.success) return { status: "not-found" };
  if (!dealKind.success) return { status: "invalid", fieldErrors: { deal: "Vente ou échange ?" } };
  const result = await closeDeal(id.data, dealKind.data);
  if (result.status === "saved") await revalidateClosedDeal(id.data);
  return result;
}

export async function reviewDealAction(formData: FormData): Promise<MutationResult<null>> {
  const parsed = reviewSchema.safeParse({
    dealId: formData.get("dealId"),
    punctuality: formData.get("punctuality"),
    responsiveness: formData.get("responsiveness"),
    reliability: formData.get("reliability"),
    comment: formData.get("comment") ?? "",
  });
  if (!parsed.success) return { status: "invalid", fieldErrors: collectErrors(parsed.error) };
  const { dealId, comment, ...scores } = parsed.data;
  const result = await reviewDeal({ dealId, scores, comment });
  if (result.status === "saved") await revalidateReviewedDeal(dealId);
  return result;
}
