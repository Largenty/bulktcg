import type { City } from "@/lib/cities";
import type { Game } from "@/types/game";
import type { Listing } from "@/types/listing";
import { citiesNear, distinguishedName, getCityByPair, isRetiredCommune } from "@/lib/cities";
import { formatPrice } from "@/lib/format";
import { atCity, capitalize, countLabel } from "@/lib/french";
import { LOT_TYPE_LABELS, gamePhrases, withGame } from "@/lib/labels";

/* Le SEO programmatique est le canal d'acquisition principal, mais une page
   sans annonce est une page vide : elle est générée (quelqu'un peut arriver
   dessus par un lien) et servie proprement, avec noindex tant qu'il n'y a
   rien à y voir. Tout ce qui est affirmé ci-dessous vient des données. */

/* Rayon des « lots à côté » d'une page de ville : une demi-heure de voiture,
   ce qu'on fait pour un carton de six kilos. Plus loin, on n'est plus à
   côté. */
export const CITY_PAGE_NEARBY_KM = 30;

export type CityPageContent = {
  title: string;
  description: string;
  heading: string;
  paragraphs: string[];
  isIndexable: boolean;
};

function priceRangeSentence(listings: Listing[]): string | null {
  if (listings.length === 0) return null;
  const prices = listings.map((listing) => listing.priceCents);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `Les lots en ligne sont tous à ${formatPrice(min)}.`;
  return `Les lots en ligne vont de ${formatPrice(min)} à ${formatPrice(max)}.`;
}

function lotTypeSentence(listings: Listing[]): string | null {
  if (listings.length === 0) return null;
  const counts = new Map<string, number>();
  for (const listing of listings) {
    counts.set(listing.lotType, (counts.get(listing.lotType) ?? 0) + 1);
  }
  const parts = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([lotType, count]) => `${count} en ${LOT_TYPE_LABELS[lotType as keyof typeof LOT_TYPE_LABELS].toLowerCase()}`);
  return `Répartition actuelle : ${parts.join(", ")}.`;
}

/* Les communes d'à côté, pour les liens d'une page de ville : d'abord celles
   qui ont des lots (`populatedSlugs`), de la plus proche à la plus lointaine,
   puis les plus peuplées du rayon. Prises dans les 34 879 communes, les plus
   proches seraient des hameaux ; bornées, elles ne font jamais une liste de
   mille liens. */
export function getNearbyCities(city: City, populatedSlugs: ReadonlySet<string> = new Set(), limit = 6): City[] {
  const around = citiesNear(city, CITY_PAGE_NEARBY_KM).filter(({ city: candidate }) => candidate.communeCode !== city.communeCode);
  const populated = around.filter(({ city: candidate }) => populatedSlugs.has(candidate.slug));
  const others = around
    .filter(({ city: candidate }) => !populatedSlugs.has(candidate.slug))
    .toSorted(
      (left, right) =>
        right.city.population - left.city.population || left.distanceKm - right.distanceKm || left.city.slug.localeCompare(right.city.slug),
    );
  return [...populated, ...others].slice(0, limit).map((entry) => entry.city);
}

/* Les communes qui ont des lots, et ces lots, pour les liens « Où
   trouver… » d'une page de jeu et pour le plan de site : la plus fournie
   d'abord, puis par ordre alphabétique. Retrouvées par le couple (commune,
   code postal) de chaque annonce — par le nom seul, les lots de Valence (82)
   menaient à la page de Valence (26) —, nommées avec leur département quand
   c'est le cas, et sans les communes retirées, dont la page reste hors de
   l'index. */
export function getPopulatedCities<T extends Pick<Listing, "city" | "postalCode">>(
  listings: readonly T[],
): Array<{ city: City; label: string; count: number; listings: T[] }> {
  const byCity = new Map<string, { city: City; listings: T[] }>();
  for (const listing of listings) {
    const city = getCityByPair(listing.city, listing.postalCode);
    if (!city || isRetiredCommune(city)) continue;
    const entry = byCity.get(city.slug) ?? { city, listings: [] };
    entry.listings.push(listing);
    byCity.set(city.slug, entry);
  }
  return [...byCity.values()]
    .map(({ city, listings: cityListings }) => ({ city, label: distinguishedName(city), count: cityListings.length, listings: cityListings }))
    .toSorted((left, right) => right.count - left.count || left.label.localeCompare(right.label, "fr") || left.city.slug.localeCompare(right.city.slug));
}

/* `placeName` : le nom sous lequel la page parle de sa commune — avec son
   département pour un homonyme (cities.ts, distinguishedName). Une commune
   retirée garde sa page, lisible pour les annonces qui la citent encore,
   mais hors de l'index : on n'amène personne vers une commune qui n'existe
   plus sous ce nom. */
export function buildCityPageContent(
  game: Game,
  city: City,
  listings: Listing[],
  nearbyCount = 0,
  { placeName = city.name, isRetired = false }: { placeName?: string; isRetired?: boolean } = {},
): CityPageContent {
  const hasListings = listings.length > 0;
  const count = listings.length;
  const { cards } = gamePhrases(game.id);
  const heading = `${capitalize(cards)} d'occasion ${atCity(placeName)}`;

  const title = hasListings
    ? `${heading} — ${countLabel(count, "lot")}`
    : heading;

  const description = hasListings
    ? `${countLabel(count, "lot")} de ${cards} à récupérer en main propre ${atCity(city.name)} (${city.postalCode}). Vrac, classeurs, decks et scellé entre particuliers.`
    : `Lots de ${cards} en main propre ${atCity(city.name)} (${city.postalCode}). Aucune annonce en ligne pour l'instant : soyez le premier à en déposer une.`;

  const paragraphs: string[] = [];

  if (hasListings) {
    paragraphs.push(
      `${countLabel(count, "lot")} de ${cards} ${count > 1 ? "sont disponibles" : "est disponible"} ${atCity(city.name)} et se ${count > 1 ? "récupèrent" : "récupère"} en main propre. Ici on ne vend pas la carte à l'unité : le classeur entier, le carton de vrac, le deck monté ou le display scellé.`,
    );
    const priceSentence = priceRangeSentence(listings);
    const lotSentence = lotTypeSentence(listings);
    paragraphs.push([priceSentence, lotSentence].filter(Boolean).join(" "));
    paragraphs.push(
      `Le rendez-vous se fixe directement avec le vendeur, ${atCity(city.name)} ou alentour (${city.departmentName}, ${city.departmentCode}) : sans envoi postal, sans acompte et sans commission prélevée sur la vente.`,
    );
  } else {
    paragraphs.push(
      `Aucun lot de ${cards} n'est en ligne ${atCity(city.name)} même aujourd'hui. La page existe pour le jour où il y en aura un — et pour que la vôtre soit trouvable si vous la déposez maintenant.`,
    );
    paragraphs.push(
      `${city.name} (${city.departmentName}, ${city.departmentCode}) : les lots se déplacent mal, mais une demi-heure de voiture reste raisonnable pour un carton de six kilos.`,
    );
  }
  if (isRetired) {
    paragraphs.push(
      `${city.name} a rejoint une commune nouvelle : cette page reste pour les annonces qui la citent encore.`,
    );
  }
  if (nearbyCount > 0) {
    paragraphs.push(
      `À moins de ${CITY_PAGE_NEARBY_KM} km, ${countLabel(nearbyCount, withGame("autre lot", game.id), withGame("autres lots", game.id))} ${nearbyCount > 1 ? "attendent" : "attend"} preneur.`,
    );
  }

  return {
    title,
    description,
    heading,
    paragraphs: paragraphs.filter(Boolean),
    isIndexable: hasListings && !isRetired,
  };
}
