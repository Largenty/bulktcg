import type { Conversation, ReplyBlock } from "@/types/conversation";
import type { ListingAudience, ListingStatus } from "@/types/listing";

/* Qui peut encore écrire à propos d'un lot : une seule règle, lue par le
   mapper des conversations, la couche données, la fiche et la messagerie —
   et tenue en base par la politique d'écriture des messages. Elle était
   recodée à quatre endroits.

   Le vendeur écrit toujours : c'est son lot, il peut expliquer. Un lot
   passé « pros » après coup se relit mais ne se relance plus, sauf par une
   boutique au forfait actif. Un lot réservé ne se relance que par la
   personne pour qui il l'est. */
export function getReplyBlock(
  thread: { sellerId: string; listing: { status: ListingStatus; reservedForId: string | null; audience: ListingAudience } },
  viewer: { id: string; isActivePro: boolean },
): ReplyBlock | null {
  if (viewer.id === thread.sellerId) return null;
  if (thread.listing.audience === "pros" && !viewer.isActivePro) return "pros-only";
  if (thread.listing.status === "reserved" && thread.listing.reservedForId !== viewer.id) return "reserved-for-other";
  return null;
}

/* Ce que le lecteur lit à la place du champ de réponse, et ce que la couche
   données répond à un envoi refusé : la même phrase aux deux endroits. */
export const REPLY_BLOCK_REASONS: Record<ReplyBlock, string> = {
  "reserved-for-other":
    "Ce lot est réservé pour un autre acheteur : inscrivez-vous sur la liste d'attente, une notification vous préviendra s'il redevient disponible.",
  "pros-only":
    "Le vendeur a réservé ce lot aux professionnels : vous pouvez relire la conversation, mais plus y répondre.",
};

export function canReply(conversation: Conversation): boolean {
  return conversation.replyBlock === null;
}

/* Ce que « Réservé » veut dire pour le lecteur de la liste des fils : le mot
   seul ne disait pas si c'était pour lui, pour ce contact ou pour un autre. */
export function describeReservation(conversation: Conversation, viewerId: string): string | null {
  const { listing } = conversation;
  if (listing.status !== "reserved") return null;
  if (listing.reservedForId === viewerId) return "Réservé pour vous";
  /* Côté vendeur, réservé pour la personne de ce fil : « ici ». */
  if (viewerId === conversation.seller.id && listing.reservedForId === conversation.buyer.id) return "Réservé ici";
  return "Réservé ailleurs";
}

/* La ligne sous le lot, en tête d'un fil : ce que la réservation ou le
   passage aux pros change pour le lecteur. null quand rien ne change. */
export function describeThreadState(conversation: Conversation, viewerId: string): string | null {
  const { listing, buyer } = conversation;
  const isSeller = viewerId === conversation.seller.id;
  if (listing.audience === "pros" && isSeller) {
    return "Réservée aux pros : seules les boutiques au forfait actif vous écrivent encore à son sujet.";
  }
  if (listing.status !== "reserved") return null;
  if (listing.reservedForId === buyer.id) {
    return isSeller
      ? `Réservé pour ${buyer.username} : ses messages sont les seuls que vous recevez à son sujet.`
      : "Ce lot vous est réservé : le vendeur ne lit plus que vos messages à son sujet.";
  }
  return isSeller ? "Réservé pour quelqu'un d'autre : cette personne ne peut plus vous écrire à son sujet." : null;
}

/* Le résumé de la boîte : ce qui attend une réponse, puis ce qu'on peut
   seulement relire. Un fil verrouillé n'attend rien de vous. */
export function countInbox(conversations: Conversation[]): { awaiting: number; unreadLocked: number } {
  const unread = conversations.filter((conversation) => conversation.unreadCount > 0);
  const awaiting = unread.filter(canReply).length;
  return { awaiting, unreadLocked: unread.length - awaiting };
}
