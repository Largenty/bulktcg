import type { ConversationRowWithRelations, MessageRow } from "@/lib/data/rows";
import { MOCK_DEAL_ROWS } from "@/lib/mock/deals.mock";
import { MOCK_LISTING_ROWS, toJoinedListingRow } from "@/lib/mock/listings.mock";
import { MOCK_REVIEW_ROWS } from "@/lib/mock/reviews.mock";
import { mockProfileRow } from "@/lib/mock/profiles.mock";
import { hoursAgo, minutesAgo } from "@/lib/mock/seed";

const LISTING_ROWS_BY_ID = new Map(MOCK_LISTING_ROWS.map((row) => [row.id, row]));

type ConversationInput = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  messages: Array<{ senderId: string; body: string; createdAt: string; isRead: boolean }>;
};

const CONVERSATION_INPUTS: ConversationInput[] = [
  {
    id: "c-01",
    listingId: "l-01",
    buyerId: "u-06",
    sellerId: "u-01",
    messages: [
      {
        senderId: "u-06",
        body: "Bonjour, le lot est toujours dispo ?",
        createdAt: hoursAgo(4),
        isRead: true,
      },
      {
        senderId: "u-01",
        body: "Oui, toujours là. Le statut de l'annonce est à jour, quand ça part je le passe en réservé.",
        createdAt: hoursAgo(3),
        isRead: true,
      },
      {
        senderId: "u-06",
        body: "Parfait. Je peux passer jeudi vers 18 h 30 vers la gare TGV ? Je viens de Cavaillon.",
        createdAt: minutesAgo(52),
        isRead: false,
      },
    ],
  },
  {
    id: "c-02",
    listingId: "l-21",
    buyerId: "u-04",
    sellerId: "u-01",
    messages: [
      {
        senderId: "u-04",
        body: "Les 900 cartes sont triées par couleur mais est-ce qu'il y a des terrains dedans ?",
        createdAt: hoursAgo(28),
        isRead: true,
      },
      {
        senderId: "u-01",
        body: "Une centaine de terrains de base, oui, dans la boîte grise. Pas de terrains non-basiques.",
        createdAt: hoursAgo(26),
        isRead: true,
      },
      {
        senderId: "u-04",
        body: "Ok, ça me va. Je descends sur Avignon samedi, je vous redis vendredi soir.",
        createdAt: hoursAgo(25),
        isRead: true,
      },
    ],
  },
  {
    id: "c-03",
    listingId: "l-07",
    buyerId: "u-02",
    sellerId: "u-01",
    messages: [
      {
        senderId: "u-02",
        body: "Bonjour, vous auriez encore le display 151 ?",
        createdAt: hoursAgo(1340),
        isRead: true,
      },
      {
        senderId: "u-01",
        body: "Vendu la semaine dernière, désolé. J'en récupère peut-être un autre en fin de mois.",
        createdAt: hoursAgo(1332),
        isRead: true,
      },
    ],
  },
  {
    id: "c-04",
    listingId: "l-27",
    buyerId: "u-01",
    sellerId: "u-09",
    messages: [
      {
        senderId: "u-01",
        body: "Bonjour, est-ce que la liste détaillée est dispo ? Je cherche surtout des cartes Modern jouables.",
        createdAt: hoursAgo(9),
        isRead: true,
      },
      {
        senderId: "u-09",
        body: "Je vous envoie la photo du tableau ce soir. Il y a de quoi faire côté Modern, notamment plusieurs rares du set.",
        createdAt: hoursAgo(7),
        isRead: false,
      },
    ],
  },
  {
    id: "c-05",
    listingId: "l-13",
    buyerId: "u-01",
    sellerId: "u-04",
    messages: [
      {
        senderId: "u-01",
        body: "Les 8 kg tiennent dans un coffre de citadine ou il faut un break ?",
        createdAt: hoursAgo(50),
        isRead: true,
      },
      {
        senderId: "u-04",
        body: "Citadine ça passe, c'est un carton de déménagement standard. Prévoyez juste d'être deux pour le porter.",
        createdAt: hoursAgo(49),
        isRead: true,
      },
      {
        senderId: "u-01",
        body: "Noté, merci. Je vous confirme dans la semaine.",
        createdAt: hoursAgo(48),
        isRead: true,
      },
    ],
  },
  {
    /* Le compte de démonstration avait écrit à julie_cartes à propos de ses
       trois classeurs, qu'elle a ensuite réservés aux professionnels. Il
       garde l'accès à la fiche et relit son fil, mais n'y écrit plus : c'est
       ce que la messagerie montre d'une annonce passée « pros » après
       coup. */
    id: "c-06",
    listingId: "l-35",
    buyerId: "u-01",
    sellerId: "u-02",
    messages: [
      {
        senderId: "u-01",
        body: "Bonjour, les trois classeurs sont-ils complets ? Je cherche surtout les éditions de base.",
        createdAt: hoursAgo(20),
        isRead: true,
      },
      {
        senderId: "u-02",
        body: "Bonjour, tout y est. Je pense les proposer à une boutique, qui viendra estimer la collection sur place.",
        createdAt: hoursAgo(18),
        isRead: true,
      },
    ],
  },
];

function toMessageRows(input: ConversationInput): MessageRow[] {
  return input.messages.map((message, index) => ({
    id: `${input.id}-m${index + 1}`,
    conversation_id: input.id,
    sender_id: message.senderId,
    body: message.body,
    read_at: message.isRead ? message.createdAt : null,
    created_at: message.createdAt,
  }));
}

/* La vente clôturée sur cette conversation, et qui l'a déjà notée. */
function dealOf(conversationId: string): ConversationRowWithRelations["deal"] {
  const deal = MOCK_DEAL_ROWS.find((candidate) => candidate.conversation_id === conversationId);
  if (!deal) return null;
  return {
    ...deal,
    reviews: MOCK_REVIEW_ROWS.filter((review) => review.deal_id === deal.id).map((review) => ({
      reviewer_id: review.reviewer_id,
    })),
  };
}

function toConversationRow(input: ConversationInput): ConversationRowWithRelations {
  const listing = LISTING_ROWS_BY_ID.get(input.listingId);
  if (!listing) throw new Error(`Mock incohérent : annonce ${input.listingId} introuvable.`);

  const messages = toMessageRows(input);
  const [firstMessage] = messages;
  const lastMessage = messages.at(-1);
  if (!firstMessage || !lastMessage) throw new Error(`Mock incohérent : conversation ${input.id} sans message.`);

  return {
    id: input.id,
    listing_id: listing.id,
    buyer_id: input.buyerId,
    seller_id: input.sellerId,
    created_at: firstMessage.created_at,
    last_message_at: lastMessage.created_at,
    buyer_deleted_at: null,
    seller_deleted_at: null,
    listing: toJoinedListingRow(listing),
    buyer: mockProfileRow(input.buyerId),
    seller: mockProfileRow(input.sellerId),
    messages,
    deal: dealOf(input.id),
  };
}

export const MOCK_CONVERSATION_ROWS: ConversationRowWithRelations[] =
  CONVERSATION_INPUTS.map(toConversationRow);
