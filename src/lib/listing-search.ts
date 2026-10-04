import "server-only";
import type { GameId } from "@/types/game";
import { resolveCity } from "@/lib/cities";
import { getEditionById } from "@/lib/editions";
import {
  DEFAULT_RADIUS_KM,
  countActiveFilters,
  parseListingSearchParams,
  parsePageNumber,
  type ResolvedListingSearch,
} from "@/lib/listing-query";
import type { SearchParams } from "@/lib/search-params";

/* Des paramètres d'URL à la requête que la couche données comprend, point
   final. Deux pages s'en servent — la liste complète et chaque page de jeu —
   et il n'existe qu'une lecture de ces paramètres.

   `gameId` est le critère imposé par la page : il l'emporte sur l'URL, pour
   qu'un paramètre trafiqué ne puisse pas afficher du Magic sous le titre
   « Cartes Pokémon ».

   Une ville reconnue devient un point d'origine : chercher « Avignon » doit
   ramener ce qui se vend autour d'Avignon, et « 84000 » la même chose. Une
   ville inconnue ne filtre rien plutôt que de vider la liste — elle revient
   avec des suggestions, et la page dit clairement qu'elle n'a pas filtré. */
export function resolveListingSearch(
  params: SearchParams,
  options: { gameId?: GameId; perPage: number },
): ResolvedListingSearch {
  const parsed = parseListingSearchParams(params);
  /* Une série inconnue ne filtre rien, plutôt que de vider la liste : un
     lien d'avant une mise à jour du référentiel garde ses autres critères. */
  const baseQuery = parsed.editionId && !getEditionById(parsed.editionId) ? { ...parsed, editionId: undefined } : parsed;
  const page = parsePageNumber(params);

  const cityResolution = baseQuery.city ? resolveCity(baseQuery.city) : null;
  const origin = cityResolution?.status === "found" ? cityResolution.city : null;
  const radiusKm = origin ? (baseQuery.maxDistanceKm ?? DEFAULT_RADIUS_KM) : null;

  return {
    origin,
    cityResolution,
    radiusKm,
    page,
    activeFilterCount: countActiveFilters(baseQuery, {
      imposedGameId: options.gameId,
      hasOrigin: origin !== null,
    }),
    query: {
      ...baseQuery,
      gameId: options.gameId ?? baseQuery.gameId,
      city: undefined,
      origin: origin ? { latitude: origin.latitude, longitude: origin.longitude } : undefined,
      maxDistanceKm: radiusKm ?? undefined,
      offset: (page - 1) * options.perPage,
      limit: options.perPage,
    },
  };
}
