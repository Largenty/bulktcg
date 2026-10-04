import type { GameId } from "@/types/game";
import type { LotType } from "@/types/listing";
import type { SellerSummary } from "@/types/profile";

/* Demande de recherche : l'annonce vue de l'autre côté.

   Volontairement plus pauvre qu'une annonce — ni photo, ni état, ni prix
   ferme. Un acheteur ne décrit pas un objet qu'il possède, il décrit un
   besoin : un jeu, un budget plafond, un rayon. Tout champ supplémentaire
   serait une invitation à inventer une précision qu'il n'a pas. */

export const WANTED_STATUSES = ["open", "fulfilled", "closed"] as const;
export type WantedStatus = (typeof WANTED_STATUSES)[number];

export type WantedListing = {
  id: string;
  slug: string;
  reference: string;
  buyer: SellerSummary;
  gameId: GameId;
  title: string;
  description: string;
  /* null quand l'acheteur prend n'importe quel format. */
  lotType: LotType | null;
  /* Budget plafond. null quand il n'en annonce pas — et on n'en invente pas. */
  maxPriceCents: number | null;
  minCardCount: number | null;
  city: string;
  postalCode: string;
  departmentCode: string;
  latitude: number;
  longitude: number;
  /* Distance que l'acheteur accepte de parcourir. Toujours renseignée :
     sans elle, une demande de recherche n'est croisable avec rien. */
  maxDistanceKm: number;
  status: WantedStatus;
  createdAt: string;
  updatedAt: string;
  fulfilledAt: string | null;
};

/* La carte d'une demande dessinée pendant sa saisie : le jeu peut y manquer,
   et s'affiche alors en emplacement vide. Une demande publiée l'a toujours :
   WantedListing en est un cas particulier. */
export type WantedCardData = Omit<WantedListing, "gameId"> & { gameId: GameId | null };

/* L'ordre d'une liste de demandes : les plus récentes, les budgets les plus
   hauts, ou les acheteurs les plus proches — ce dernier seulement quand une
   ville a été saisie. */
export const WANTED_SORTS = ["recent", "budget-desc", "distance"] as const;
export type WantedSort = (typeof WANTED_SORTS)[number];

export type WantedQuery = {
  gameId?: GameId;
  buyerId?: string;
  city?: string;
  departmentCode?: string;
  lotType?: LotType;
  status?: WantedStatus;
  includeClosed?: boolean;
  /* Point de vue du visiteur. Sert au tri par proximité, et au filtrage
     quand l'un des deux drapeaux ci-dessous est posé. */
  origin?: { latitude: number; longitude: number };
  /* Ne garde que les demandes dont le rayon couvre `origin`. C'est la
     question que se pose un vendeur — « qui viendrait jusqu'à moi » — et
     elle ne se confond pas avec « qui habite près de moi » : un acheteur à
     60 km prêt à en faire 100 est atteignable, un voisin qui ne bouge pas de
     10 km ne l'est pas. */
  reachableOnly?: boolean;
  /* Rayon autour de `origin`, dans l'autre sens : où habitent les acheteurs. */
  maxDistanceKm?: number;
  /* Les demandes qui accepteraient ce format : celles qui le demandent, et
     celles qui prennent tout format — un classeur répond à « peu importe ».
     À ne pas confondre avec `lotType`, qui ne garde que le format exact. */
  acceptsLotType?: LotType;
  /* Budget annoncé d'au moins ce montant. Une demande sans budget est
     écartée — on ne peut pas affirmer qu'elle paierait autant — et
     countWantedWithoutBudget dit combien le sont. */
  minBudgetCents?: number;
  buyerKind?: "pro" | "private";
  /* Sans précision : les plus proches quand une origine existe, les plus
     récentes sinon. */
  sort?: WantedSort;
  limit?: number;
  offset?: number;
};
