import type { ConversationDeal } from "@/types/deal";
import type { GameId } from "@/types/game";
import type { ListingAudience, ListingStatus } from "@/types/listing";
import type { SellerSummary } from "@/types/profile";

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type ConversationListing = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  status: ListingStatus;
  reservedForId: string | null;
  /* Passée « pros » après coup, l'annonce reste lisible par ceux qui en
     parlaient déjà, mais un particulier ne peut plus y répondre. */
  audience: ListingAudience;
  /* Première photo de l'annonce : la graine dessine l'emplacement, l'URL
     l'image quand elle existe. */
  photoSeed: number;
  photoUrl: string | null;
  /* Rétréci comme n'importe quelle énumération venue de la base : le laisser
     en `string` obligeait les deux pages messages à le recaster en GameId,
     c'est-à-dire à affirmer sans vérifier ce que le mapper est justement là
     pour vérifier. */
  gameId: GameId;
};

export type Conversation = {
  id: string;
  listing: ConversationListing;
  buyer: SellerSummary;
  seller: SellerSummary;
  lastMessage: Message | null;
  /* Messages reçus et non lus, du point de vue du lecteur passé au mapper.
     Un compteur de non-lus n'a de sens que rapporté à quelqu'un : les
     messages qu'on a soi-même envoyés sont non lus pour l'autre, jamais
     pour soi. */
  unreadCount: number;
  createdAt: string;
  lastMessageAt: string;
  /* null tant que le vendeur n'a pas clôturé la vente. */
  deal: ConversationDeal | null;
  /* Pourquoi le lecteur ne peut plus écrire dans ce fil, ou null s'il le
     peut. Calculé pour lui, comme unreadCount, par la règle unique de
     lib/conversation-display (getReplyBlock). */
  replyBlock: ReplyBlock | null;
};

/* Un lot réservé pour quelqu'un d'autre, ou passé « pros » quand on n'est
   pas une boutique au forfait actif : le fil se relit, il ne se relance
   plus. */
export type ReplyBlock = "reserved-for-other" | "pros-only";
