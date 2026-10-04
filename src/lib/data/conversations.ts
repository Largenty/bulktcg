import "server-only";
import { cache } from "react";
import type { Conversation, Message } from "@/types/conversation";
import { isViewerActivePro } from "@/lib/data/listings";
import { toConversation, toMessage } from "@/lib/data/mappers";
import type { ConversationRow } from "@/lib/data/rows";
import { conversationRows, unreadThreadRows } from "@/lib/data/source";

/* Toutes les lectures de ce fichier portent le lecteur : une conversation
   n'existe que pour ses deux participants, et son compteur de non-lus n'a
   de sens que rapporté à l'un d'eux. En phase 2, la RLS ne rend déjà que
   les conversations du lecteur (source.ts), et ces filtres la doublent. */

/* Retirée de sa boîte, une conversation y revient au premier message plus
   récent que sa suppression : l'autre partie ne sait pas qu'on l'a retirée,
   et sa réponse ne doit pas se perdre. */
function isHiddenFor(
  row: Pick<ConversationRow, "buyer_id" | "buyer_deleted_at" | "seller_deleted_at" | "last_message_at">,
  userId: string,
): boolean {
  const deletedAt = row.buyer_id === userId ? row.buyer_deleted_at : row.seller_deleted_at;
  return deletedAt !== null && new Date(deletedAt).getTime() >= new Date(row.last_message_at).getTime();
}

export const getConversationsForUser = cache(
  async (userId: string): Promise<Conversation[]> => {
    const isActivePro = await isViewerActivePro(userId);
    return (await conversationRows()).filter(
      (row) => (row.buyer_id === userId || row.seller_id === userId) && !isHiddenFor(row, userId),
    )
      .sort(
        (left, right) =>
          new Date(right.last_message_at).getTime() - new Date(left.last_message_at).getTime(),
      )
      .map((row) => toConversation(row, userId, isActivePro));
  },
);

export const getConversationById = cache(
  async (conversationId: string, viewerId: string): Promise<Conversation | null> => {
    const row = (await conversationRows()).find((candidate) => candidate.id === conversationId);
    return row ? toConversation(row, viewerId, await isViewerActivePro(viewerId)) : null;
  },
);

export const getMessages = cache(async (conversationId: string): Promise<Message[]> => {
  const row = (await conversationRows()).find((candidate) => candidate.id === conversationId);
  if (!row) return [];
  return [...row.messages]
    .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime())
    .map(toMessage);
});

/* La conversation qu'un acheteur a déjà ouverte sur une annonce. Écrire deux
   fois au même vendeur pour le même lot doit reprendre le fil, pas en
   ouvrir un second. */
export const findConversationForListing = cache(
  async (listingId: string, buyerId: string): Promise<Conversation | null> => {
    const row = (await conversationRows()).find(
      (candidate) => candidate.listing_id === listingId && candidate.buyer_id === buyerId,
    );
    return row ? toConversation(row, buyerId, await isViewerActivePro(buyerId)) : null;
  },
);

/* Le compteur de la pastille d'en-tête : les fils de la boîte qui ont un
   message reçu non lu — les mêmes que ceux dont la liste affiche un
   unreadCount, sans relire toute la messagerie à chaque page
   (unreadThreadRows). Un message que l'on a soi-même envoyé n'y compte
   pas : l'ancienne version se trompait dès qu'un aller-retour laissait un
   message reçu non lu sous sa propre réponse. */
export const getUnreadConversationCount = cache(async (userId: string): Promise<number> => {
  return (await unreadThreadRows(userId)).filter(
    (row) => (row.buyer_id === userId || row.seller_id === userId) && !isHiddenFor(row, userId),
  ).length;
});
