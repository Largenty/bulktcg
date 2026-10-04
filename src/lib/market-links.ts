import type { GameId } from "@/types/game";
import type { ListingQuery } from "@/types/listing";
import type { City } from "@/lib/cities";
import { DEFAULT_RADIUS_KM, QUERY_PARAM, buildListingHref } from "@/lib/listing-query";
import { MARKET_FRAGMENT, routes } from "@/lib/routes";
import { CITY_PAGE_NEARBY_KM } from "@/lib/seo";

/* Depuis /recherches, l'autre côté du marché. Le lien et le compteur se
   décident ensemble : un chiffre qui ne correspondrait pas à ce que la page
   de destination affiche serait un mensonge, et les deux vues ne filtrent
   pas de la même façon — une page de ville compte la commune et ses
   voisines à moins de CITY_PAGE_NEARBY_KM, /annonces un rayon autour de la
   ville. On compte donc comme comptera la page visée. */
export function getSellView(gameId: GameId | undefined, origin: City | null): { href: string; query: ListingQuery } {
  const around = origin ? { latitude: origin.latitude, longitude: origin.longitude } : undefined;
  if (gameId && origin) {
    return { href: `${routes.gameCity(gameId, origin.slug)}#${MARKET_FRAGMENT.sell}`, query: { gameId, origin: around, maxDistanceKm: CITY_PAGE_NEARBY_KM } };
  }
  if (gameId) return { href: `${routes.game(gameId)}#${MARKET_FRAGMENT.sell}`, query: { gameId } };
  if (origin) {
    return {
      href: buildListingHref(routes.listings, {}, { [QUERY_PARAM.city]: origin.name }),
      query: { origin: around, maxDistanceKm: DEFAULT_RADIUS_KM },
    };
  }
  return { href: routes.listings, query: {} };
}
