import "server-only";
import { getConversationById } from "@/lib/data/conversations";
import { getListingById, isViewerActivePro } from "@/lib/data/listings";
import type { MutationResult } from "@/lib/data/mutation-result";
import { getCurrentUserId } from "@/lib/data/session";
import { performWrite } from "@/lib/data/write-seam";

/* S'inscrire sur la liste d'attente d'un lot réservé : on sera prévenu,
   avec tous les autres inscrits, s'il redevient disponible. Rien à
   attendre sur un lot en ligne — on écrit —, ni sur un lot vendu, ni sur
   le sien. */
export async function joinWaitlist(listingId: string): Promise<MutationResult<null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "unauthenticated" };
  const listing = await getListingById(listingId);
  if (!listing) return { status: "not-found" };
  if (listing.audience === "pros" && listing.seller.id !== userId && !(await isViewerActivePro(userId))) {
    return { status: "not-found" };
  }
  if (listing.seller.id === userId) {
    return { status: "invalid", fieldErrors: { waitlist: "C'est votre propre annonce." } };
  }
  if (listing.status !== "reserved") {
    return {
      status: "invalid",
      fieldErrors: {
        waitlist: listing.status === "sold" ? "Ce lot est vendu : il n'y a plus rien à attendre." : "Ce lot est disponible : écrivez au vendeur.",
      },
    };
  }
  const entry = { listing_id: listing.id, user_id: userId };
  return performWrite("waitlist.insert", entry, null, ({ user }) => user.from("listing_waitlist").insert(entry), waitlistFieldErrors);
}

/* S'inscrire deux fois : on l'est déjà. */
function waitlistFieldErrors(code: string) {
  return code === "23505" ? { waitlist: "Vous êtes déjà inscrit : vous serez prévenu s'il redevient disponible." } : null;
}

export async function leaveWaitlist(listingId: string): Promise<MutationResult<null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "unauthenticated" };
  /* Sa propre ligne seulement : la RLS écarte celles des autres. Ne plus
     être inscrit n'est pas une erreur. */
  return performWrite("waitlist.delete", { listing_id: listingId, user_id: userId }, null, ({ user }) =>
    user.from("listing_waitlist").delete().eq("listing_id", listingId).eq("user_id", userId),
  );
}

/* Réserver pour quelqu'un : l'autre partie d'une conversation du vendeur,
   jamais un pseudo tapé ni un identifiant fourni par le navigateur. */
export async function reserveForBuyer(conversationId: string): Promise<MutationResult<null>> {
  const sellerId = await getCurrentUserId();
  if (!sellerId) return { status: "unauthenticated" };
  const conversation = await getConversationById(conversationId, sellerId);
  if (!conversation || conversation.seller.id !== sellerId) return { status: "not-found" };
  if (conversation.listing.status === "sold") {
    return { status: "invalid", fieldErrors: { status: "Ce lot est vendu : il ne se réserve plus." } };
  }
  /* La personne désignée est l'autre partie de la conversation : la base
     la déduit, le navigateur ne la nomme pas. */
  return performWrite("listings.reserve", { rpc: "reserve_listing", conversation: conversation.id }, null, ({ user }) =>
    user.rpc("reserve_listing", { conversation: conversation.id }),
  );
}

/* Tout marquer comme lu : la seule colonne que le destinataire modifie. */
export async function markNotificationsRead(): Promise<MutationResult<null>> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "unauthenticated" };
  /* Celles qui ne le sont pas encore : une date de lecture ne se réécrit
     pas. La RLS ne laisse toucher que les siennes. */
  return performWrite("notifications.read", { user_id: userId, read_at: "now()" }, null, ({ user }) =>
    user.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null),
  );
}
