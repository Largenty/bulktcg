import "server-only";
import type { GameId } from "@/types/game";
import type { City, CityResolution } from "@/lib/city-label";
import {
  citiesNearIn,
  findPair,
  isKnownPair,
  resolveCityIn,
  resolveCommuneInputIn,
  type CommuneInput,
} from "@/lib/communes/lookup";
import { searchCommunes, suggestCommunes } from "@/lib/communes/search";
import { COMMUNE_INDEX, toCity } from "@/lib/communes/store";
import { routes } from "@/lib/routes";

/* Le référentiel des communes françaises, côté serveur : toutes les
   communes de métropole, de Corse et des départements d'outre-mer, tirées de
   la liste officielle (lib/communes/). Un composant client n'en reçoit que
   ce qu'il affiche — par la route de suggestions ou en props — et importe
   les types de lib/city-label.ts.

   Une commune a une page (/pokemon/avignon), à son slug ; une annonce, une
   demande ou un profil enregistre un couple commune et code postal, que la
   clé étrangère de la base vérifie. Les règles vivent dans lib/communes/
   lookup.ts, testées sur un petit référentiel ; ce module les applique à
   celui du site. */

export type { City, CityResolution } from "@/lib/city-label";
export type { CommuneInput } from "@/lib/communes/lookup";
export { formatCityLabel } from "@/lib/city-label";

/* Les 112 communes de la migration 2, dans son ordre, à leur code postal
   d'origine : celles qui ont toujours eu une page, et que la base portait
   avant le référentiel complet. */
export const CITIES: City[] = COMMUNE_INDEX.frozenCodes.flatMap((code) => {
  const commune = COMMUNE_INDEX.byCode.get(code);
  return commune ? [toCity(commune)] : [];
});

/* La commune d'une page, à son code postal principal. Une commune retirée
   garde sa page : des annonces la citent encore. */
export function getCityBySlug(slug: string): City | null {
  const commune = COMMUNE_INDEX.bySlug.get(slug);
  return commune ? toCity(commune) : null;
}

/* Le couple qu'une annonce, une demande ou un profil a enregistré : le nom
   seul ne suffit plus, trois communes s'appellent Valence. Les communes
   retirées se lisent encore. */
export function getCityByPair(name: string, postalCode: string): City | null {
  const commune = findPair(COMMUNE_INDEX, name, postalCode);
  return commune ? toCity(commune, postalCode.trim()) : null;
}

/* La page d'un jeu dans la commune d'une annonce ou d'une demande, par le
   couple qu'elle a enregistré — jamais par le nom seul : l'adresse d'une
   commune sur neuf n'est pas son nom (/magic/valence-82, /pokemon/apremont-01),
   et le nom seul menait à la page d'un homonyme, ou à une 404. null pour un
   couple que le référentiel ne connaît pas. */
export function communePagePath(gameId: GameId, place: { city: string; postalCode: string }): string | null {
  const city = getCityByPair(place.city, place.postalCode);
  return city ? routes.gameCity(gameId, city.slug) : null;
}

/* Une commune retirée par une mise à jour (fusion) : affichée encore, mais
   jamais proposée ni acceptée à la saisie. */
export function isRetiredCommune(city: Pick<City, "communeCode">): boolean {
  return COMMUNE_INDEX.byCode.get(city.communeCode)?.isRetired ?? false;
}

/* Une commune dont le nom en désigne d'autres, encore actives : trois
   communes s'appellent Valence. */
export function hasHomonym(city: Pick<City, "communeCode">): boolean {
  const commune = COMMUNE_INDEX.byCode.get(city.communeCode);
  if (!commune) return false;
  return (COMMUNE_INDEX.byKey.get(commune.key) ?? []).some((other) => other !== commune && !other.isRetired);
}

/* Le nom sous lequel une page parle de sa commune : avec son département
   quand le nom seul en désignerait une autre — « Valence (Drôme) » et
   « Valence (Tarn-et-Garonne) » —, le nom seul sinon. */
export function distinguishedName(city: Pick<City, "communeCode" | "name" | "departmentName">): string {
  return hasHomonym(city) ? `${city.name} (${city.departmentName})` : city.name;
}

/* Une commune existe pour une nouvelle saisie si son nom et son code postal
   vont ensemble, et qu'elle n'a pas disparu. */
export function isKnownCommune(name: string, postalCode: string): boolean {
  return isKnownPair(COMMUNE_INDEX, name, postalCode);
}

/* Le champ « Où » (lib/communes/lookup.ts). */
export function resolveCity(input: string): CityResolution {
  return resolveCityIn(COMMUNE_INDEX, input);
}

/* La commune d'un formulaire, ramenée à un couple du référentiel
   (schemas/commune.ts). */
export function resolveCommuneInput(cityInput: string, postalCodeInput = ""): CommuneInput {
  return resolveCommuneInputIn(COMMUNE_INDEX, cityInput, postalCodeInput);
}

/* Suggestions du champ commune pendant la frappe. */
export function searchCities(query: string, limit = 8): City[] {
  return searchCommunes(COMMUNE_INDEX, query, limit);
}

/* Des pistes pour une saisie qui ne correspond à rien. */
export function suggestCities(input: string, limit = 4): City[] {
  return suggestCommunes(COMMUNE_INDEX, input, limit);
}

/* Les communes à moins de `radiusKm` d'un point, la plus proche d'abord —
   pour les villes voisines d'une page et la carte du secteur, qui retiennent
   ensuite les plus peuplées. */
export function citiesNear(origin: { latitude: number; longitude: number }, radiusKm: number): Array<{ city: City; distanceKm: number }> {
  return citiesNearIn(COMMUNE_INDEX, origin, radiusKm);
}

/* Toutes les communes qu'on peut proposer, à leur code postal principal :
   pour le plan du site et les pages, filtrées ensuite sur celles qui ont des
   annonces. */
export function listCities(): City[] {
  return COMMUNE_INDEX.active.map((commune) => toCity(commune));
}
