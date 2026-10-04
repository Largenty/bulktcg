import "server-only";
import { findConversationForListing, getConversationById } from "@/lib/data/conversations";
import { getListingById, isViewerActivePro } from "@/lib/data/listings";
import { toConversationInsert, toMessageInsert } from "@/lib/data/mappers";
import type { MutationResult } from "@/lib/data/mutation-result";
import type { ConversationInsert } from "@/lib/data/rows";
import { getCurrentUserId } from "@/lib/data/session";
import { getWantedById } from "@/lib/data/wanted";
import { performWrite, performWriteReturning } from "@/lib/data/write-seam";
import { REPLY_BLOCK_REASONS } from "@/lib/conversation-display";
import { isExpired } from "@/lib/listing-lifecycle";
import type { ReplyBlock } from "@/types/conversation";

/* Écritures de la messagerie. Une conversation porte toujours sur un lot :
   c'est ce qui permet d'afficher sa photo, son prix et son statut en tête
   du fil, et de savoir de quoi on parle trois semaines plus tard. */

export type ConversationWriteResult = {
  /* null tant que la conversation n'existe pas en base (démonstration). */
  conversationId: string | null;
  /* Vrai quand on écrit dans un fil déjà ouvert plutôt que d'en créer un. */
  isExisting: boolean;
};

/* Un envoi refusé dit la même phrase que l'écran : REPLY_BLOCK_REASONS. */
function blocked(block: ReplyBlock) {
  return { status: "invalid", fieldErrors: { body: REPLY_BLOCK_REASONS[block] } } as const;
}

/* Un message dans un fil existant, signé de son auteur : la RLS refuse le
   reste — participant, blocage, lot réservé pour un autre, passé « pros ». */
function postMessage(conversationId: string, senderId: string, body: string): Promise<MutationResult<ConversationWriteResult>> {
  const message = toMessageInsert({ conversationId, senderId, body });
  return performWrite("messages.insert", message, { conversationId, isExisting: true }, ({ user }) =>
    user.from("messages").insert(message),
  );
}

/* Une conversation naît avec son premier message, d'un seul bloc
   (open_conversation, migration 11) : sans lui, un message refusé laisserait
   un fil vide dans les deux boîtes. L'identifiant revient de la base. */
function openConversation(conversation: ConversationInsert, senderId: string, body: string): Promise<MutationResult<ConversationWriteResult>> {
  const firstMessage = { sender_id: senderId, body: body.trim() };
  return performWriteReturning<unknown, ConversationWriteResult>(
    "conversations.insert",
    { conversation, firstMessage },
    { conversationId: null, isExisting: false },
    ({ user }) =>
      user.rpc("open_conversation", {
        listing: conversation.listing_id,
        buyer: conversation.buyer_id,
        seller: conversation.seller_id,
        first_message: firstMessage.body,
      }),
    (opened) => ({ conversationId: typeof opened === "string" ? opened : null, isExisting: false }),
  );
}

/* L'acheteur écrit au vendeur depuis la fiche. Écrire à nouveau pour le même
   lot reprend le fil existant. */
export async function contactSeller(input: {
  listingId: string;
  body: string;
}): Promise<MutationResult<ConversationWriteResult>> {
  const buyerId = await getCurrentUserId();
  if (!buyerId) return { status: "unauthenticated" };

  const listing = await getListingById(input.listingId);
  if (!listing) return { status: "not-found" };
  if (listing.seller.id === buyerId) {
    return { status: "invalid", fieldErrors: { body: "C'est votre propre annonce." } };
  }
  /* Un fil existant suit la règle commune : passé « pros » ou réservé pour
     un autre, il se relit sans se relancer. */
  const existing = await findConversationForListing(listing.id, buyerId);
  if (existing?.replyBlock) return blocked(existing.replyBlock);
  /* Sans fil, une annonce réservée aux pros n'existe pas pour un
     particulier : même avec son identifiant en main, il ne peut pas écrire
     à son sujet. */
  if (!existing && listing.audience === "pros" && !(await isViewerActivePro(buyerId))) {
    return { status: "not-found" };
  }
  if (listing.status === "sold") {
    return { status: "invalid", fieldErrors: { body: "Ce lot est vendu : le vendeur ne reçoit plus de demandes." } };
  }
  /* Expirée : son vendeur ne l'a pas prolongée, et ne la vend peut-être
     plus. Un fil déjà ouvert continue ; un nouveau ne s'ouvre pas — la base
     le refuse aussi (politique d'ouverture des conversations). */
  if (!existing && isExpired(listing, Date.now())) {
    return { status: "invalid", fieldErrors: { body: "Cette annonce n'est plus en ligne : son vendeur ne reçoit plus de demandes à son sujet." } };
  }
  /* Réservé : seule la personne pour qui il l'est continue d'écrire. Les
     autres s'inscrivent sur la liste d'attente plutôt que de relancer. */
  if (listing.status === "reserved" && listing.reservedForId !== buyerId) return blocked("reserved-for-other");

  if (existing) return postMessage(existing.id, buyerId, input.body);
  return openConversation(toConversationInsert({ listingId: listing.id, buyerId, sellerId: listing.seller.id }), buyerId, input.body);
}

/* Le vendeur répond à une demande de recherche en proposant l'un de ses lots.
   Le lot doit être à lui, en ligne, et du jeu demandé : proposer du Magic à
   quelqu'un qui cherche du Pokémon serait du démarchage. */
export async function proposeListing(input: {
  wantedId: string;
  listingId: string;
  body: string;
}): Promise<MutationResult<ConversationWriteResult>> {
  const sellerId = await getCurrentUserId();
  if (!sellerId) return { status: "unauthenticated" };

  const [wanted, listing] = await Promise.all([getWantedById(input.wantedId), getListingById(input.listingId)]);
  if (!wanted || wanted.status !== "open") return { status: "not-found" };
  if (!listing || listing.seller.id !== sellerId) return { status: "not-found" };
  if (wanted.buyer.id === sellerId) {
    return { status: "invalid", fieldErrors: { body: "C'est votre propre demande." } };
  }
  if (listing.status !== "available" || isExpired(listing, Date.now()) || listing.gameId !== wanted.gameId) {
    return { status: "invalid", fieldErrors: { listingId: "Proposez un lot en ligne, du jeu demandé." } };
  }
  /* Un lot réservé aux pros n'existe pas pour un particulier : le lui
     proposer ouvrirait un fil sur une annonce qu'il ne peut pas lire. Le
     formulaire ne le propose pas ; une requête forgée ne passe pas non plus,
     et la base le refuse aussi (politique d'ouverture des conversations). */
  if (listing.audience === "pros" && !(await isViewerActivePro(wanted.buyer.id))) {
    return {
      status: "invalid",
      fieldErrors: { listingId: "Ce lot est réservé aux pros : cet acheteur ne peut pas le voir. Proposez-lui un lot visible de tous." },
    };
  }

  const existing = await findConversationForListing(listing.id, wanted.buyer.id);
  if (existing) return postMessage(existing.id, sellerId, input.body);
  return openConversation(toConversationInsert({ listingId: listing.id, buyerId: wanted.buyer.id, sellerId }), sellerId, input.body);
}

export async function sendMessage(input: {
  conversationId: string;
  body: string;
}): Promise<MutationResult<ConversationWriteResult>> {
  const senderId = await getCurrentUserId();
  if (!senderId) return { status: "unauthenticated" };

  const conversation = await getConversationById(input.conversationId, senderId);
  if (!conversation || (conversation.buyer.id !== senderId && conversation.seller.id !== senderId)) {
    return { status: "not-found" };
  }
  if (conversation.replyBlock) return blocked(conversation.replyBlock);

  return postMessage(conversation.id, senderId, input.body);
}
