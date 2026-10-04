import { GAME_IDS, type GameId } from "@/types/game";
import { CARD_CONDITIONS, CARD_LANGUAGES, LISTING_SORTS, LOT_TYPES, type ListingQuery } from "@/types/listing";
import type { City, CityResolution } from "@/lib/city-label";
import { parseDecimal } from "@/lib/decimal";
import { EDITION_ID_PATTERN } from "@/lib/edition-id";
import { PRODUCT_TAG_IDS } from "@/lib/product-tags";
import { GAME_SEGMENT, gameFromSegment } from "@/lib/routes";
import { firstParam, oneOf, readParam, type SearchParams } from "@/lib/search-params";

/* Les paramètres d'URL sont en français : ils sont visibles par l'utilisateur
   et se partagent. La traduction vers ListingQuery, en anglais, se fait ici
   et nulle part ailleurs. */
export const QUERY_PARAM = {
  search: "q",
  game: "jeu",
  city: "ville",
  lotType: "type",
  edition: "serie",
  tag: "produit",
  condition: "etat",
  language: "langue",
  minPrice: "prix-min",
  maxPrice: "prix-max",
  sort: "tri",
  page: "page",
  radius: "rayon",
  trade: "echange",
} as const;

/* Un prix saisi en euros dans l'URL, converti en centimes pour la couche
   données. Une valeur illisible est ignorée, jamais transformée en 0 :
   « prix-min=abc » ne doit pas filtrer silencieusement. */
function euroToCents(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const euros = parseDecimal(value);
  if (!Number.isFinite(euros) || euros < 0) return undefined;
  return Math.round(euros * 100);
}

/* La forme seulement : ce module sert aussi dans le navigateur, où le
   référentiel ne vit pas. Le serveur écarte une série inconnue
   (listing-search.ts) avant toute lecture. */
function editionParam(value: string | undefined): string | undefined {
  return value && EDITION_ID_PATTERN.test(value) ? value : undefined;
}

function positiveNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

/* Le jeu d'un ?jeu=, écrit avec le segment d'adresse du jeu (one-piece,
   autres-jeux). L'ancien identifiant (onepiece, other) reste compris : un
   filtre partagé avant le changement garde son sens. */
export function readGameParam(params: SearchParams): GameId | undefined {
  const value = readParam(params, QUERY_PARAM.game);
  return gameFromSegment(value) ?? oneOf(value, GAME_IDS);
}

/* La valeur de ?jeu= pour un jeu : le segment de son adresse. */
export function gameParamValue(gameId: GameId): string {
  return GAME_SEGMENT[gameId];
}

export function parseListingSearchParams(params: SearchParams): ListingQuery {
  return {
    search: readParam(params, QUERY_PARAM.search),
    gameId: readGameParam(params),
    city: readParam(params, QUERY_PARAM.city),
    lotType: oneOf(readParam(params, QUERY_PARAM.lotType), LOT_TYPES),
    /* L'identifiant d'édition est validé contre le référentiel plutôt que
       contre une liste écrite ici : quatre-vingts valeurs recopiées à la
       main finiraient par diverger du référentiel lui-même. */
    editionId: editionParam(readParam(params, QUERY_PARAM.edition)),
    tag: oneOf(readParam(params, QUERY_PARAM.tag), PRODUCT_TAG_IDS),
    condition: oneOf(readParam(params, QUERY_PARAM.condition), CARD_CONDITIONS),
    language: oneOf(readParam(params, QUERY_PARAM.language), CARD_LANGUAGES),
    minPriceCents: euroToCents(readParam(params, QUERY_PARAM.minPrice)),
    maxPriceCents: euroToCents(readParam(params, QUERY_PARAM.maxPrice)),
    maxDistanceKm: positiveNumber(readParam(params, QUERY_PARAM.radius)),
    sort: oneOf(readParam(params, QUERY_PARAM.sort), LISTING_SORTS) ?? "recent",
    /* « echange=1 » ou rien : toute autre valeur ne filtre pas. */
    openToTrade: readParam(params, QUERY_PARAM.trade) === "1" ? true : undefined,
  };
}

/* Rayons proposés, en kilomètres. Au-delà de 100 km on n'est plus dans la
   promesse « à moins d'une heure », alors le filtre s'arrête là. */
export const RADIUS_OPTIONS_KM = [10, 25, 50, 100];

/* Rayon appliqué quand l'acheteur a nommé une ville sans préciser de
   distance. Indiquer « Avignon » veut dire « autour d'Avignon », pas
   « strictement dans Avignon » : un carton se récupère à vingt minutes de
   voiture, et se limiter à la commune viderait le produit de sa promesse. */
export const DEFAULT_RADIUS_KM = 50;

/* Le numéro de page est lu à part : il ne fait pas partie des critères de
   recherche, il ne compte donc pas comme un filtre actif. */
export function parsePageNumber(params: SearchParams): number {
  const raw = readParam(params, QUERY_PARAM.page);
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/* Les critères que l'acheteur a choisis lui-même. Le jeu imposé par la page
   n'en fait pas partie — on ne l'a pas choisi dans le panneau, on est arrivé
   par là — pas plus qu'une ville que le référentiel ne reconnaît pas : elle
   ne filtre rien, elle ne compte donc pas. */
export function countActiveFilters(query: ListingQuery, options: { imposedGameId?: GameId; hasOrigin: boolean }): number {
  return [
    options.imposedGameId ? undefined : query.gameId,
    options.hasOrigin ? query.city : undefined,
    query.lotType,
    query.editionId,
    query.tag,
    query.condition,
    query.language,
    query.minPriceCents,
    query.maxPriceCents,
    query.openToTrade,
    query.search,
  ].filter((value) => value !== undefined).length;
}

export type ResolvedListingSearch = {
  query: ListingQuery;
  /* Non nul seulement quand la ville saisie est au référentiel : sans
     coordonnées, il n'y a ni tri par distance ni rayon, et on n'en invente
     pas. */
  origin: City | null;
  /* Ce que la saisie « Où » est devenue : trouvée par son nom ou son code
     postal, ou inconnue — et alors avec des pistes. null sans saisie. */
  cityResolution: CityResolution | null;
  radiusKm: number | null;
  page: number;
  activeFilterCount: number;
};

/* Une adresse de liste, avec des paramètres en moins ou en plus : c'est ce
   que fait chaque pastille de filtre actif (« Classeur × »), et chaque
   suggestion de ville. Des liens et non des boutons : ils marchent sans
   JavaScript, et le retour arrière les défait. La page repart toujours à 1 :
   changer un critère change le nombre de pages. */
export function buildListingHref(
  basePath: string,
  params: SearchParams,
  changes: Record<string, string | null>,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || key === QUERY_PARAM.page) continue;
    const first = firstParam(value);
    if (first) next.set(key, first);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  }
  const queryString = next.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

/* Changer de jeu garde les critères communs — prix, état, ville, tri — mais
   pas ceux qui appartiennent à un jeu : une série Pokémon sur la page Magic
   viderait la liste. La page repart à 1 (buildListingHref). */
export const GAME_SCOPED_PARAMS = [QUERY_PARAM.game, QUERY_PARAM.edition, QUERY_PARAM.tag] as const;
