import type { GameId } from "@/types/game";
import type { WantedQuery, WantedSort } from "@/types/wanted";
import type { City, CityResolution } from "@/lib/city-label";
import { QUERY_PARAM, gameParamValue } from "@/lib/listing-query";
import { routes } from "@/lib/routes";

/* Les paramètres des filtres de demandes. Ils ne reprennent pas ceux des
   ventes : sur /annonces, les deux onglets vivent dans la même URL, et un
   « type=binder » posé côté ventes ne doit pas filtrer les recherches — ni
   la page 2 des ventes paginer les demandes. Seuls le jeu et la ville sont
   partagés : ils décrivent le marché, pas un côté. */
export const WANTED_PARAM = {
  lotType: "format-demande",
  minBudget: "budget-min",
  buyer: "acheteur",
  sort: "tri-demandes",
  page: "page-demandes",
} as const;

/* Les critères du panneau : « Tout effacer » ne touche qu'à eux. */
export const WANTED_PANEL_PARAMS = [WANTED_PARAM.lotType, WANTED_PARAM.minBudget, WANTED_PARAM.buyer];

export const WANTED_PER_PAGE = 24;

/* Les demandes ouvertes d'un jeu, sur le hub des recherches. */
export function getWantedListingsUrl(gameId: GameId): string {
  return `${routes.wantedListings}?${new URLSearchParams({ [QUERY_PARAM.game]: gameParamValue(gameId) })}`;
}

/* Des paliers plutôt qu'un champ libre : un vendeur se demande « qui met au
   moins 50 € », pas « qui met au moins 47 € ». */
export const WANTED_BUDGET_STEPS_EUROS = [20, 50, 100, 200];

export const BUYER_KINDS = { pro: "pro", particulier: "private" } as const;

export type ResolvedWantedSearch = {
  query: WantedQuery;
  origin: City | null;
  cityResolution: CityResolution | null;
  sort: WantedSort;
  page: number;
  /* Les critères choisis dans le panneau, pour « Tout effacer » et la
     pastille du bouton « Filtres ». La ville n'en fait pas partie : elle a
     été tapée dans la barre de recherche. */
  panelFilterCount: number;
};
