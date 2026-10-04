import "server-only";
import { parseCityLabel, type City, type CityResolution } from "@/lib/city-label";
import { suggestCommunes } from "@/lib/communes/search";
import { byPopulation, pairKey, searchKey, toCity, type Commune, type CommuneIndex } from "@/lib/communes/store";

/* Retrouver une commune dans un index : les règles, séparées des données
   pour se tester sur un petit référentiel — homonymes, codes postaux
   partagés, communes retirées. lib/cities.ts les applique au référentiel
   du site. */

const active = (communes: readonly Commune[] | undefined) => (communes ?? []).filter((commune) => !commune.isRetired);

export function findPair(index: CommuneIndex, name: string, postalCode: string): Commune | null {
  return index.byPair.get(pairKey(name, postalCode)) ?? null;
}

/* Une commune existe pour une nouvelle saisie si son nom et son code postal
   vont ensemble, et qu'elle n'a pas disparu. */
export function isKnownPair(index: CommuneIndex, name: string, postalCode: string): boolean {
  const commune = findPair(index, name, postalCode);
  return commune !== null && !commune.isRetired;
}

/* La commune qu'un nom désigne quand on cherche autour de lui : celle qui
   porte le slug nu — Valence (Drôme), Saint-Denis (Seine-Saint-Denis) —,
   sinon la plus peuplée. */
function communeForName(index: CommuneIndex, name: string): Commune | null {
  const key = searchKey(name);
  const bare = index.bySlug.get(key);
  if (bare && !bare.isRetired) return bare;
  return active(index.byKey.get(key)).sort(byPopulation)[0] ?? null;
}

/* Le champ « Où » : un nom, avec ou sans accents, un code postal, ou
   « Avignon (84000) ». Un code postal partagé désigne sa commune la plus
   peuplée — on cherche autour, le secteur est le même. Un homonyme désigne
   la commune du slug nu, et les autres sont rendues pour être proposées. */
export function resolveCityIn(index: CommuneIndex, input: string): CityResolution {
  const value = input.trim();

  const label = parseCityLabel(value);
  const labelled = label ? findPair(index, label.name, label.postalCode) : null;
  if (label && labelled && !labelled.isRetired) return { status: "found", city: toCity(labelled, label.postalCode), via: "name", homonyms: [] };

  if (/^\d{5}$/.test(value)) {
    const [commune] = active(index.byPostalCode.get(value)).sort(byPopulation);
    if (commune) return { status: "found", city: toCity(commune, value), via: "postal-code", homonyms: [] };
  }

  const byName = communeForName(index, label?.name ?? value);
  if (byName) {
    const homonyms = active(index.byKey.get(byName.key)).filter((other) => other !== byName).sort(byPopulation);
    return { status: "found", city: toCity(byName), via: "name", homonyms: homonyms.map((other) => toCity(other)) };
  }

  return { status: "unknown", input: value, suggestions: suggestCommunes(index, value, 4) };
}

/* Ce qu'un formulaire envoie — le nom tapé ou choisi, et le code postal que
   le choix a posé — ramené à un couple du référentiel. Sans JavaScript, le
   code postal manque : un nom unique, un code postal d'une seule commune ou
   « Nom (code) » suffisent ; un homonyme demande de choisir. Une commune
   retirée n'est plus acceptée. */
export type CommuneInput =
  | { status: "found"; city: City }
  | { status: "ambiguous"; candidates: City[] }
  | { status: "unknown"; suggestions: City[] };

export function resolveCommuneInputIn(index: CommuneIndex, cityInput: string, postalCodeInput = ""): CommuneInput {
  const name = cityInput.trim();
  const postalCode = postalCodeInput.trim();

  const pair = postalCode ? findPair(index, name, postalCode) : null;
  if (pair && !pair.isRetired) return { status: "found", city: toCity(pair, postalCode) };

  const label = parseCityLabel(name);
  const labelled = label ? findPair(index, label.name, label.postalCode) : null;
  if (label && labelled && !labelled.isRetired) return { status: "found", city: toCity(labelled, label.postalCode) };

  if (/^\d{5}$/.test(name)) return pickOne(index, active(index.byPostalCode.get(name)), (commune) => toCity(commune, name), name);
  return pickOne(index, active(index.byKey.get(searchKey(name))), (commune) => toCity(commune), name);
}

function pickOne(index: CommuneIndex, communes: Commune[], view: (commune: Commune) => City, input: string): CommuneInput {
  const [only] = communes;
  if (communes.length === 1 && only) return { status: "found", city: view(only) };
  if (communes.length > 1) return { status: "ambiguous", candidates: communes.sort(byPopulation).map(view) };
  return { status: "unknown", suggestions: suggestCommunes(index, input, 4) };
}

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_OF_LATITUDE = 111;

function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const radians = Math.PI / 180;
  const deltaLatitude = (to.latitude - from.latitude) * radians;
  const deltaLongitude = (to.longitude - from.longitude) * radians;
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 + Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(haversine));
}

/* Les communes à moins de `radiusKm` d'un point, la plus proche d'abord,
   sans les retirées. */
export function citiesNearIn(index: CommuneIndex, origin: { latitude: number; longitude: number }, radiusKm: number): Array<{ city: City; distanceKm: number }> {
  const latitudeSpan = radiusKm / KM_PER_DEGREE_OF_LATITUDE;
  const near: Array<{ city: City; distanceKm: number }> = [];
  for (const commune of index.active) {
    if (Math.abs(commune.latitude - origin.latitude) > latitudeSpan) continue;
    const distance = distanceKm(origin, commune);
    if (distance <= radiusKm) near.push({ city: toCity(commune), distanceKm: distance });
  }
  return near.sort((left, right) => left.distanceKm - right.distanceKm);
}
