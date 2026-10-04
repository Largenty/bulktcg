import type { Deal } from "@/types/deal";
import type { SellerSummary } from "@/types/profile";
import type { Review } from "@/types/review";
import { routes } from "@/lib/routes";
import { firstParam, oneOf, type ParamValue } from "@/lib/search-params";

/* Une vente vue par l'une de ses parties : qui est l'autre, et où en sont
   les deux avis. Calculé à la lecture, jamais stocké. */
export type DealPerspective = {
  isSeller: boolean;
  other: SellerSummary;
  myReview: Review | null;
  theirReview: Review | null;
};

export function getDealPerspective(deal: Deal, viewerId: string): DealPerspective {
  const isSeller = deal.seller.id === viewerId;
  const other = isSeller ? deal.buyer : deal.seller;
  return {
    isSeller,
    other,
    myReview: deal.reviews.find((review) => review.reviewerId === viewerId) ?? null,
    theirReview: deal.reviews.find((review) => review.reviewerId === other.id) ?? null,
  };
}

/* « Vendu à julie_cartes », « Acheté à bastien26 », « Échangé avec … ». */
export function describeDeal(deal: Deal, perspective: DealPerspective): string {
  if (deal.kind === "trade") return `Échangé avec ${perspective.other.username}`;
  return perspective.isSeller ? `Vendu à ${perspective.other.username}` : `Acheté à ${perspective.other.username}`;
}

/* Les vues de la liste « Ventes et achats », en français dans l'URL comme
   les autres filtres. */
export const DEAL_VIEW_PARAM = "vue";
const DEAL_VIEWS = ["ventes", "achats", "a-noter"] as const;
export type DealView = (typeof DEAL_VIEWS)[number];

export function resolveDealView(value: ParamValue): DealView | null {
  return oneOf(firstParam(value), DEAL_VIEWS) ?? null;
}

export function getDealViewUrl(view: DealView): string {
  return `${routes.accountDeals}?${new URLSearchParams({ [DEAL_VIEW_PARAM]: view })}`;
}

export function matchesDealView(deal: Deal, viewerId: string, view: DealView | null): boolean {
  if (view === null) return true;
  const perspective = getDealPerspective(deal, viewerId);
  if (view === "ventes") return perspective.isSeller;
  if (view === "achats") return !perspective.isSeller;
  return perspective.myReview === null;
}
