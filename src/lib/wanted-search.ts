import "server-only";
import type { GameId } from "@/types/game";
import { LOT_TYPES } from "@/types/listing";
import { WANTED_SORTS } from "@/types/wanted";
import { resolveCity } from "@/lib/cities";
import { readGameParam, QUERY_PARAM } from "@/lib/listing-query";
import { oneOf, readParam, type SearchParams } from "@/lib/search-params";
import {
  BUYER_KINDS,
  WANTED_BUDGET_STEPS_EUROS,
  WANTED_PARAM,
  WANTED_PER_PAGE,
  type ResolvedWantedSearch,
} from "@/lib/wanted-query";

/* Des paramètres d'URL à la requête des demandes, comme resolveListingSearch
   pour les lots. Le jeu imposé par la page l'emporte sur l'URL. Une ville
   reconnue ne garde que les demandes dont le rayon la couvre : la question
   d'un vendeur est « qui viendrait jusqu'à moi », pas « qui habite près de
   moi ». Une valeur illisible est ignorée, jamais transformée en filtre. */
export function resolveWantedSearch(params: SearchParams, options: { gameId?: GameId } = {}): ResolvedWantedSearch {
  const cityInput = readParam(params, QUERY_PARAM.city);
  const cityResolution = cityInput ? resolveCity(cityInput) : null;
  const origin = cityResolution?.status === "found" ? cityResolution.city : null;

  const lotType = oneOf(readParam(params, WANTED_PARAM.lotType), LOT_TYPES);
  const budgetEuros = Number(readParam(params, WANTED_PARAM.minBudget));
  const minBudgetCents = WANTED_BUDGET_STEPS_EUROS.includes(budgetEuros) ? budgetEuros * 100 : undefined;
  const buyerParam = readParam(params, WANTED_PARAM.buyer);
  const buyerKind = buyerParam && buyerParam in BUYER_KINDS ? BUYER_KINDS[buyerParam as keyof typeof BUYER_KINDS] : undefined;
  const requestedSort = oneOf(readParam(params, WANTED_PARAM.sort), WANTED_SORTS);
  const sort = requestedSort === "distance" && !origin ? "recent" : (requestedSort ?? (origin ? "distance" : "recent"));
  const pageNumber = Number(readParam(params, WANTED_PARAM.page));
  const page = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;

  return {
    origin,
    cityResolution,
    sort,
    page,
    panelFilterCount: [lotType, minBudgetCents, buyerKind].filter((value) => value !== undefined).length,
    query: {
      gameId: options.gameId ?? readGameParam(params),
      acceptsLotType: lotType,
      minBudgetCents,
      buyerKind,
      origin: origin ? { latitude: origin.latitude, longitude: origin.longitude } : undefined,
      reachableOnly: origin !== null,
      sort,
      offset: (page - 1) * WANTED_PER_PAGE,
      limit: WANTED_PER_PAGE,
    },
  };
}
