import type { Conversation, Message } from "@/types/conversation";
import type { BlockInsert, ConversationInsert, ConversationRowWithRelations, MessageInsert, MessageRow } from "@/lib/data/rows";
import { byCreationDate } from "@/lib/data/mappers/shared";
import { toConversationDeal } from "@/lib/data/mappers/deals";
import { toConversationListing } from "@/lib/data/mappers/listings";
import { toSellerSummary } from "@/lib/data/mappers/profiles";
import { getReplyBlock } from "@/lib/conversation-display";

/* La messagerie, dans les deux sens : fils, messages, blocages. */

export function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

/* viewerId n'est pas un ornement : « non lu » n'existe pas dans l'absolu.
   Un message qu'on vient d'envoyer est non lu tant que l'autre ne l'a pas
   ouvert, et le compter comme sien ferait clignoter sa propre boîte. Le
   lecteur est donc un argument du mapper, comme il sera un argument du
   `where` en phase 2 (sender_id <> auth.uid()). Son forfait pro aussi :
   c'est lui qui décide s'il écrit encore sur un lot passé « pros ». */
export function toConversation(
  row: ConversationRowWithRelations,
  viewerId: string,
  viewerIsActivePro = false,
): Conversation {
  const messages = byCreationDate(row.messages);
  const lastMessage = messages.at(-1);
  const listing = toConversationListing(row.listing);

  return {
    id: row.id,
    listing,
    buyer: toSellerSummary(row.buyer),
    seller: toSellerSummary(row.seller),
    lastMessage: lastMessage ? toMessage(lastMessage) : null,
    unreadCount: messages.filter(
      (message) => message.read_at === null && message.sender_id !== viewerId,
    ).length,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    deal: row.deal ? toConversationDeal(row.deal, row.deal.reviews) : null,
    replyBlock: getReplyBlock({ sellerId: row.seller_id, listing }, { id: viewerId, isActivePro: viewerIsActivePro }),
  };
}

export function toConversationInsert(input: {
  listingId: string;
  buyerId: string;
  sellerId: string;
}): ConversationInsert {
  return { listing_id: input.listingId, buyer_id: input.buyerId, seller_id: input.sellerId };
}

export function toMessageInsert(input: {
  conversationId: string;
  senderId: string;
  body: string;
}): MessageInsert {
  return { conversation_id: input.conversationId, sender_id: input.senderId, body: input.body.trim() };
}

export function toBlockInsert(blockerId: string, blockedId: string): BlockInsert {
  return { blocker_id: blockerId, blocked_id: blockedId };
}
