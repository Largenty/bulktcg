import assert from "node:assert/strict";
import test from "node:test";
import { citiesNearIn, findPair, isKnownPair, resolveCityIn, resolveCommuneInputIn } from "../src/lib/communes/lookup.ts";
import { searchCommunes, suggestCommunes } from "../src/lib/communes/search.ts";
import { indexReferential } from "../src/lib/communes/store.ts";

/* Les règles du référentiel, sur un référentiel de poche : des homonymes,
   un code postal partagé, une commune retirée. Le vrai n'a encore aucune
   commune retirée — la première fusion viendra avec une mise à jour —, la
   règle doit tenir avant. */

const INDEX = indexReferential({
  departments: { 26: "Drôme", 82: "Tarn-et-Garonne", 16: "Charente", 51: "Marne", 13: "Bouches-du-Rhône" },
  frozen: ["26362"],
  retired: { "51999": "2027-01-01" },
  communes: [
    ["26362", "valence", "Valence", "26", "26000", 44.93, 4.89, 64000],
    ["82186", "valence-82", "Valence", "82", "82400", 44.11, 0.89, 5000],
    ["16392", "valence-16", "Valence", "16", "16460", 45.89, 0.32, 300],
    ["51001", "beaulieu-51", "Beaulieu", "51", "51300", 48.72, 4.58, 900],
    ["13001", "beaulieu-13", "Beaulieu", "13", "13300", 43.5, 5.1, 2000],
    ["51002", "vitry", "Vitry", "51", "51300", 48.72, 4.59, 12000],
    /* Fusionnée : son nom et son code postal se lisent encore. */
    ["51999", "ancienne", "Ancienne", "51", "51310", 48.73, 4.6, 400],
  ],
});

test("un homonyme cherché par son nom donne la commune du slug nu, et propose les autres", () => {
  const resolution = resolveCityIn(INDEX, "valence");
  assert.equal(resolution.status, "found");
  assert.equal(resolution.city.communeCode, "26362");
  assert.deepEqual(resolution.homonyms.map((city) => city.communeCode), ["82186", "16392"], "les autres, la plus peuplée d'abord");
});

test("sans slug nu, un homonyme donne la commune la plus peuplée", () => {
  const resolution = resolveCityIn(INDEX, "Beaulieu");
  assert.equal(resolution.status, "found");
  assert.equal(resolution.city.communeCode, "13001");
  assert.deepEqual(resolution.homonyms.map((city) => city.communeCode), ["51001"]);
});

test("« Nom (code) » désigne un homonyme précis, sans en proposer d'autre", () => {
  const resolution = resolveCityIn(INDEX, "Valence (82400)");
  assert.equal(resolution.status, "found");
  assert.equal(resolution.city.communeCode, "82186");
  assert.deepEqual(resolution.homonyms, []);
});

test("un code postal partagé cherche autour de sa commune la plus peuplée", () => {
  const resolution = resolveCityIn(INDEX, "51300");
  assert.equal(resolution.status, "found");
  assert.equal(resolution.city.name, "Vitry");
  assert.equal(resolution.via, "postal-code");
});

test("à la saisie, un homonyme ou un code postal partagé demandent de choisir", () => {
  const byName = resolveCommuneInputIn(INDEX, "Valence");
  assert.equal(byName.status, "ambiguous");
  assert.deepEqual(byName.candidates.map((city) => city.postalCode), ["26000", "82400", "16460"]);
  assert.equal(resolveCommuneInputIn(INDEX, "51300").status, "ambiguous");
  assert.equal(resolveCommuneInputIn(INDEX, "Valence", "82400").city.communeCode, "82186");
  assert.equal(resolveCommuneInputIn(INDEX, "Vitry").city.postalCode, "51300", "un nom unique suffit, sans code postal");
});

test("une commune retirée se lit encore, mais ne se propose ni ne s'accepte", () => {
  assert.equal(findPair(INDEX, "Ancienne", "51310")?.communeCode, "51999", "une annonce qui la cite s'affiche encore");
  assert.equal(isKnownPair(INDEX, "Ancienne", "51310"), false);
  assert.equal(resolveCommuneInputIn(INDEX, "Ancienne", "51310").status, "unknown");
  assert.equal(resolveCommuneInputIn(INDEX, "Ancienne (51310)").status, "unknown");
  assert.equal(resolveCityIn(INDEX, "Ancienne").status, "unknown");
  assert.equal(resolveCityIn(INDEX, "51310").status, "unknown");
  assert.deepEqual(searchCommunes(INDEX, "ancien", 6), []);
  assert.deepEqual(searchCommunes(INDEX, "5131", 6), []);
  assert.ok(suggestCommunes(INDEX, "Ancienn", 6).every((city) => city.communeCode !== "51999"));
  assert.ok(citiesNearIn(INDEX, { latitude: 48.73, longitude: 4.6 }, 5).every(({ city }) => city.communeCode !== "51999"));
});

test("un nom se retrouve sans accent, sans tiret, avec « St » pour « Saint »", () => {
  const index = indexReferential({
    departments: { 13: "Bouches-du-Rhône" },
    frozen: [],
    retired: {},
    communes: [["13100", "saint-remy-de-provence", "Saint-Rémy-de-Provence", "13", "13210", 43.79, 4.83, 10000]],
  });
  for (const typed of ["saint remy de provence", "St-Rémy-de-Provence", "st remy"]) {
    assert.equal(searchCommunes(index, typed, 6)[0]?.slug, "saint-remy-de-provence", typed);
  }
});

test("un nombre propose chaque couple dont le code postal commence ainsi", () => {
  assert.deepEqual(
    searchCommunes(INDEX, "513", 6).map((city) => `${city.name} ${city.postalCode}`),
    ["Vitry 51300", "Beaulieu 51300"],
    "la plus peuplée d'abord à code égal, jamais la commune retirée",
  );
});

test("les communes voisines sont triées par distance, dans le rayon", () => {
  const near = citiesNearIn(INDEX, { latitude: 48.72, longitude: 4.58 }, 3);
  assert.deepEqual(near.map(({ city }) => city.communeCode), ["51001", "51002"]);
  assert.ok(near.every(({ distanceKm }) => distanceKm <= 3));
});
