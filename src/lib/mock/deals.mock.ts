import type { DealRow } from "@/lib/data/rows";
import { MOCK_LISTING_ROWS } from "@/lib/mock/listings.mock";

type DealInput = {
  id: string;
  conversationId: string;
  listingId: string;
  buyerId: string;
  kind: "sale" | "trade";
  /* Le premier message, pour les conversations antérieures au mock des
     messages : leurs deux parties seules les liraient. */
  startedDaysBeforeClose?: number;
};

/* Une vente par lot vendu dont le vendeur a désigné l'acheteur. Le compte
   de démonstration u-01 en a trois, une par état du suivi : une vente dont
   il n'a pas encore noté l'acheteur (l-07), un achat clôturé il y a vingt
   heures qu'il doit noter (l-13), et un achat noté des deux côtés (l-19). */
const DEAL_INPUTS: DealInput[] = [
  { id: "d-01", conversationId: "c-03", listingId: "l-07", buyerId: "u-02", kind: "sale" },
  { id: "d-02", conversationId: "c-05", listingId: "l-13", buyerId: "u-01", kind: "sale" },
  { id: "d-03", conversationId: "c-h03", listingId: "l-19", buyerId: "u-01", kind: "sale", startedDaysBeforeClose: 4 },
  { id: "d-04", conversationId: "c-h04", listingId: "l-04", buyerId: "u-04", kind: "sale", startedDaysBeforeClose: 2 },
  { id: "d-05", conversationId: "c-h05", listingId: "l-11", buyerId: "u-12", kind: "trade", startedDaysBeforeClose: 6 },
  { id: "d-06", conversationId: "c-h06", listingId: "l-23", buyerId: "u-09", kind: "sale", startedDaysBeforeClose: 9 },
  { id: "d-07", conversationId: "c-h07", listingId: "l-02", buyerId: "u-11", kind: "sale", startedDaysBeforeClose: 1 },
];

const LISTING_ROWS_BY_ID = new Map(MOCK_LISTING_ROWS.map((row) => [row.id, row]));
const DAY_MS = 24 * 60 * 60 * 1000;

/* Clôturer passe le lot en « Vendu » : la vente date de son passage en
   « Vendu », et un lot qui n'y est pas ne peut pas en porter une. */
export const MOCK_DEAL_ROWS: DealRow[] = DEAL_INPUTS.map((input) => {
  const listing = LISTING_ROWS_BY_ID.get(input.listingId);
  if (!listing || listing.status !== "sold" || !listing.sold_at) {
    throw new Error(`Mock incohérent : ${input.listingId} n'est pas vendu.`);
  }
  return {
    id: input.id,
    conversation_id: input.conversationId,
    listing_id: listing.id,
    seller_id: listing.seller_id,
    buyer_id: input.buyerId,
    kind: input.kind,
    closed_at: listing.sold_at,
  };
});

/* Le premier message des conversations antérieures au mock des messages,
   par identifiant de conversation. Les autres le portent elles-mêmes. */
export const MOCK_EARLIER_CONVERSATION_STARTS = new Map(
  DEAL_INPUTS.flatMap((input) => {
    const soldAt = LISTING_ROWS_BY_ID.get(input.listingId)?.sold_at;
    if (input.startedDaysBeforeClose === undefined || !soldAt) return [];
    return [[input.conversationId, new Date(new Date(soldAt).getTime() - input.startedDaysBeforeClose * DAY_MS).toISOString()] as const];
  }),
);
