"use server";

import { refresh } from "next/cache";
import { revalidateListingPaths, revalidateMessagePaths } from "@/app/actions/revalidate";
import { getConversationById } from "@/lib/data/conversations";
import { getListingById } from "@/lib/data/listings";
import type { MutationResult } from "@/lib/data/mutation-result";
import { getCurrentUserId } from "@/lib/data/session";
import { joinWaitlist, leaveWaitlist, markNotificationsRead, reserveForBuyer } from "@/lib/data/waitlist-mutations";
import { routes } from "@/lib/routes";
import { recordIdSchema } from "@/lib/schemas/record-id";

/* Actions minces : elles revalident l'identifiant, délèguent à la couche
   données, et rafraîchissent ce qui l'affiche quand une écriture a eu lieu.

   Une inscription sur une liste d'attente et une notification lue ne
   changent que ce que voit la personne qui les fait : refresh() rafraîchit
   son écran, sans toucher au cache des pages publiques. Elles rendaient
   périmées toutes les fiches, ou tout le site — un compte quelconque
   pouvait le faire en boucle (audit de sécurité, M5). */
export async function joinWaitlistAction(listingId: unknown): Promise<MutationResult<null>> {
  const id = recordIdSchema.safeParse(listingId);
  if (!id.success) return { status: "not-found" };
  const result = await joinWaitlist(id.data);
  if (result.status === "saved") refresh();
  return result;
}

export async function leaveWaitlistAction(listingId: unknown): Promise<MutationResult<null>> {
  const id = recordIdSchema.safeParse(listingId);
  if (!id.success) return { status: "not-found" };
  const result = await leaveWaitlist(id.data);
  if (result.status === "saved") refresh();
  return result;
}

export async function reserveForBuyerAction(conversationId: unknown): Promise<MutationResult<null>> {
  const id = recordIdSchema.safeParse(conversationId);
  if (!id.success) return { status: "not-found" };
  const result = await reserveForBuyer(id.data);
  if (result.status === "saved") await revalidateReservation(id.data);
  return result;
}

export async function markNotificationsReadAction(): Promise<MutationResult<null>> {
  const result = await markNotificationsRead();
  if (result.status === "saved") refresh();
  return result;
}

/* Réserver passe le lot en « Réservé » : sa fiche et ses pages publiques,
   et les fils qui en parlent — les autres acheteurs n'y écrivent plus. */
async function revalidateReservation(conversationId: string) {
  const viewerId = await getCurrentUserId();
  const conversation = viewerId ? await getConversationById(conversationId, viewerId) : null;
  if (!conversation) return;
  const listing = await getListingById(conversation.listing.id);
  revalidateListingPaths(routes.listing(conversation.listing.slug), listing ? [listing] : []);
  revalidateMessagePaths(conversationId);
}
