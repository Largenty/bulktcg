import { LISTING_STATUSES, type Listing } from "@/types/listing";
import type { WantedStatus } from "@/types/wanted";
import { EXPIRED_LABEL, STATUS_LABELS } from "@/lib/labels";
import { isExpired } from "@/lib/listing-lifecycle";
import { routes } from "@/lib/routes";
import { firstParam, type ParamValue } from "@/lib/search-params";

/* Les étapes du suivi, en français dans l'URL comme les autres filtres :
   « /mon-compte/annonces?etape=reserve » se lit, et le retour arrière
   défait le dernier choix. Le nom et les valeurs vivent ici, pour le lien
   qui les écrit comme pour la page qui les lit. */
export const STAGE_PARAM = "etape";

/* Les étapes d'une annonce pour son vendeur : ses trois statuts, plus
   « Expirée » — une annonce qu'il n'a pas prolongée, disponible ou réservée
   en base, mais sortie des listes (lib/listing-lifecycle). */
export const LISTING_STAGES = [...LISTING_STATUSES, "expired"] as const;
export type ListingStage = (typeof LISTING_STAGES)[number];

/* L'étape d'une annonce : son statut, sauf si elle a expiré. Le suivi de la
   vue d'ensemble et la liste « Mes annonces » la lisent ici tous les deux —
   chacun la recalculait, et une étape doit compter exactement les lignes de
   la liste vers laquelle elle mène. */
export function getListingStage(listing: Pick<Listing, "status" | "renewedAt">, now: number): ListingStage {
  return isExpired(listing, now) ? "expired" : listing.status;
}

/* Les annonces rangées par étape, chaque groupe dans l'ordre reçu. */
export function groupListingsByStage<T extends Pick<Listing, "status" | "renewedAt">>(listings: readonly T[], now: number): Record<ListingStage, T[]> {
  const groups = Object.fromEntries(LISTING_STAGES.map((stage) => [stage, [] as T[]])) as Record<ListingStage, T[]>;
  for (const listing of listings) groups[getListingStage(listing, now)].push(listing);
  return groups;
}

export function listingStageLabel(stage: ListingStage): string {
  return stage === "expired" ? EXPIRED_LABEL : STATUS_LABELS[stage];
}

const LISTING_STAGE_VALUES: Record<ListingStage, string> = {
  available: "disponible",
  reserved: "reserve",
  sold: "vendu",
  expired: "expiree",
};

const WANTED_STAGE_VALUES: Record<WantedStatus, string> = {
  open: "ouverte",
  fulfilled: "trouvee",
  closed: "abandonnee",
};

function resolve<T extends string>(map: Record<T, string>, value: ParamValue): T | null {
  const first = firstParam(value);
  const entry = (Object.entries(map) as [T, string][]).find(([, param]) => param === first);
  return entry ? entry[0] : null;
}

export function resolveListingStage(value: ParamValue): ListingStage | null {
  return resolve(LISTING_STAGE_VALUES, value);
}

export function resolveWantedStage(value: ParamValue): WantedStatus | null {
  return resolve(WANTED_STAGE_VALUES, value);
}

export function getListingStageUrl(stage: ListingStage): string {
  return `${routes.accountListings}?${new URLSearchParams({ [STAGE_PARAM]: LISTING_STAGE_VALUES[stage] })}`;
}

export function getWantedStageUrl(status: WantedStatus): string {
  return `${routes.accountWanted}?${new URLSearchParams({ [STAGE_PARAM]: WANTED_STAGE_VALUES[status] })}`;
}
