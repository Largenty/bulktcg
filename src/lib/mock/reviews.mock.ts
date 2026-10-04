import type { ReviewRowWithRelations } from "@/lib/data/rows";
import { MOCK_DEAL_ROWS } from "@/lib/mock/deals.mock";
import { MOCK_LISTING_ROWS } from "@/lib/mock/listings.mock";
import { MOCK_PROFILE_ROWS } from "@/lib/mock/profiles.mock";
import { daysAgo } from "@/lib/mock/seed";

type ReviewInput = {
  id: string;
  dealId: string;
  reviewerId: string;
  /* Ponctualité, délai de réponse, fiabilité. */
  scores: [number, number, number];
  comment: string | null;
  hoursAfterClose: number;
};

/* Les deux sens sont présents : des acheteurs qui notent un vendeur, et des
   vendeurs qui notent leur acheteur. La personne notée et son rôle ne sont
   pas écrits ici : ils se déduisent de la vente, comme le fait
   public.stamp_review. */
const REVIEW_INPUTS: ReviewInput[] = [
  {
    id: "r-01",
    dealId: "d-04",
    reviewerId: "u-04",
    scores: [5, 5, 5],
    comment: "Lot conforme, tri déjà fait par couleur. Rendez-vous à l'heure devant la gare.",
    hoursAfterClose: 20,
  },
  {
    id: "r-02",
    dealId: "d-05",
    reviewerId: "u-12",
    scores: [5, 5, 5],
    comment: "Très bon échange, le carton était même plus rempli que sur la photo.",
    hoursAfterClose: 30,
  },
  {
    id: "r-03",
    dealId: "d-03",
    reviewerId: "u-01",
    scores: [5, 4, 3],
    comment: "Deck complet mais deux cartes plus abîmées qu'annoncé. Vendeur arrangeant sur le prix.",
    hoursAfterClose: 26,
  },
  { id: "r-04", dealId: "d-01", reviewerId: "u-02", scores: [5, 5, 5], comment: null, hoursAfterClose: 5 },
  {
    id: "r-05",
    dealId: "d-06",
    reviewerId: "u-09",
    scores: [2, 4, 4],
    comment: "Correct mais le vendeur a annulé deux fois avant de venir.",
    hoursAfterClose: 48,
  },
  {
    id: "r-06",
    dealId: "d-07",
    reviewerId: "u-11",
    scores: [5, 5, 5],
    comment: "Pesé devant moi, exactement le poids annoncé. Je recommande.",
    hoursAfterClose: 3,
  },
  {
    id: "r-07",
    dealId: "d-04",
    reviewerId: "u-09",
    scores: [5, 5, 5],
    comment: "Acheteur à l'heure, a payé le prix convenu sans discuter.",
    hoursAfterClose: 22,
  },
  {
    id: "r-08",
    dealId: "d-03",
    reviewerId: "u-03",
    scores: [5, 5, 5],
    comment: "Venu à l'heure dite, paiement sans renégocier. Je revends volontiers à ce compte.",
    hoursAfterClose: 30,
  },
];

/* Un avis dont l'auteur a supprimé son compte : le vendeur est parti, avec
   son annonce et la vente ; l'avis qu'il avait laissé à son acheteur reste
   à ce dernier (on delete set null). Il se lit « Compte supprimé », sur « un
   lot retiré depuis ». */
const ORPHAN_REVIEW: ReviewRowWithRelations = {
  id: "r-09",
  deal_id: null,
  listing_id: null,
  reviewer_id: null,
  reviewed_id: "u-06",
  reviewed_role: "buyer",
  punctuality: 4,
  responsiveness: 4,
  reliability: 5,
  comment: "Arrivée avec dix minutes d'avance, et le prix convenu sans discuter.",
  created_at: daysAgo(61),
  listing: null,
  reviewer: null,
};

const DEALS_BY_ID = new Map(MOCK_DEAL_ROWS.map((deal) => [deal.id, deal]));
const PROFILES_BY_ID = new Map(MOCK_PROFILE_ROWS.map((profile) => [profile.id, profile]));
const LISTINGS_BY_ID = new Map(MOCK_LISTING_ROWS.map((listing) => [listing.id, listing]));
const HOUR_MS = 60 * 60 * 1000;

const REVIEWS_OF_EXISTING_DEALS: ReviewRowWithRelations[] = REVIEW_INPUTS.map((input) => {
  const deal = DEALS_BY_ID.get(input.dealId);
  const reviewer = PROFILES_BY_ID.get(input.reviewerId);
  if (!deal || !reviewer) throw new Error(`Mock incohérent : avis ${input.id}.`);
  if (input.reviewerId !== deal.seller_id && input.reviewerId !== deal.buyer_id) {
    throw new Error(`Mock incohérent : ${input.reviewerId} n'est pas partie de la vente ${deal.id}.`);
  }
  const isSellerReviewing = input.reviewerId === deal.seller_id;
  const listing = LISTINGS_BY_ID.get(deal.listing_id);
  const [punctuality, responsiveness, reliability] = input.scores;
  return {
    id: input.id,
    deal_id: deal.id,
    listing_id: deal.listing_id,
    reviewer_id: input.reviewerId,
    reviewed_id: isSellerReviewing ? deal.buyer_id : deal.seller_id,
    reviewed_role: isSellerReviewing ? "buyer" : "seller",
    punctuality,
    responsiveness,
    reliability,
    comment: input.comment,
    created_at: new Date(new Date(deal.closed_at).getTime() + input.hoursAfterClose * HOUR_MS).toISOString(),
    /* La jointure suit la RLS des annonces : le titre d'un lot réservé aux
       pros ne sort pas par un avis public. */
    listing: listing && listing.audience === "everyone" ? { slug: listing.slug, title: listing.title } : null,
    reviewer: { username: reviewer.username, avatar_initials: reviewer.avatar_initials },
  };
});

export const MOCK_REVIEW_ROWS: ReviewRowWithRelations[] = [...REVIEWS_OF_EXISTING_DEALS, ORPHAN_REVIEW];
