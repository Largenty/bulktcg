import "server-only";
import { cache } from "react";
import type { Deal } from "@/types/deal";
import type { ConversationRow, DealRow, DealRowWithRelations, ListingRowWithRelations, ProfileRow, ReviewRowWithRelations } from "@/lib/data/rows";
import { toDeal } from "@/lib/data/mappers";
import {
  conversationRows,
  conversationStartRows,
  dealRows,
  joinListing,
  profileRowById,
  profileRows,
  readableListingRows,
  reviewRows,
} from "@/lib/data/source";

/* Une vente n'existe que pour ses deux parties : toutes les lectures de ce
   fichier portent le lecteur, et c'est la même signature qui portera la
   politique « vente lue par ses parties » en phase 2. */

/* Ce que la jointure lit : le lot, les deux parties, le premier message et
   les avis — chargés une fois pour toutes les ventes d'une lecture. En
   phase 2, la RLS ne rend déjà que les ventes du lecteur. */
type DealSources = {
  listings: ListingRowWithRelations[];
  profiles: ProfileRow[];
  conversations: ConversationRow[];
  conversationStarts: ReadonlyMap<string, string>;
  reviews: ReviewRowWithRelations[];
};

async function loadSources(): Promise<DealSources> {
  const [listings, profiles, conversations, conversationStarts, reviews] = await Promise.all([
    readableListingRows(),
    profileRows(),
    conversationRows(),
    conversationStartRows(),
    reviewRows(),
  ]);
  return { listings, profiles, conversations, conversationStarts, reviews };
}

/* Une partie de la vente. La liste des profils vient du cache des pages
   publiques, où un compte né hors du site — script de démonstration, Studio
   — n'entre qu'à son expiration : absente de la liste, elle se lit à la
   base, plutôt que de faire passer la vente pour incomplète. */
async function party(id: string, profiles: ProfileRow[]): Promise<ProfileRow | null> {
  return profiles.find((candidate) => candidate.id === id) ?? (await profileRowById(id));
}

async function withRelations(row: DealRow, sources: DealSources): Promise<DealRowWithRelations> {
  const listing = sources.listings.find((candidate) => candidate.id === row.listing_id);
  const [seller, buyer] = await Promise.all([party(row.seller_id, sources.profiles), party(row.buyer_id, sources.profiles)]);
  const startedAt =
    sources.conversations.find((candidate) => candidate.id === row.conversation_id)?.created_at ??
    sources.conversationStarts.get(row.conversation_id);
  if (!listing || !seller || !buyer || !startedAt) throw new Error(`Vente ${row.id} incomplète : lot, parties ou conversation introuvables.`);
  return {
    ...row,
    listing: { ...joinListing(listing), created_at: listing.created_at },
    seller,
    buyer,
    conversation: { created_at: startedAt },
    reviews: sources.reviews.filter((review) => review.deal_id === row.id),
  };
}

const isParty = (row: DealRow, userId: string) => row.seller_id === userId || row.buyer_id === userId;

/* Les ventes et les achats d'un compte, les plus récents d'abord. */
export const getDealsForUser = cache(async (userId: string): Promise<Deal[]> => {
  const sources = await loadSources();
  const rows = (await dealRows()).filter((row) => isParty(row, userId))
    .sort((left, right) => new Date(right.closed_at).getTime() - new Date(left.closed_at).getTime());
  return (await Promise.all(rows.map((row) => withRelations(row, sources)))).map(toDeal);
});

/* Introuvable pour qui n'en est pas partie : dire « interdit » confirmerait
   qu'elle existe. */
export const getDealById = cache(async (dealId: string, viewerId: string): Promise<Deal | null> => {
  const row = (await dealRows()).find((candidate) => candidate.id === dealId);
  return row && isParty(row, viewerId) ? toDeal(await withRelations(row, await loadSources())) : null;
});

/* Un lot ne se vend qu'une fois : la contrainte unique de deals.listing_id. */
export const hasClosedDeal = cache(async (listingId: string): Promise<boolean> => {
  return (await dealRows()).some((row) => row.listing_id === listingId);
});
