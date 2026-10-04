import assert from "node:assert/strict";
import test from "node:test";
import { isKnownCommune, resolveCity, resolveCommuneInput, searchCities, suggestCities } from "../src/lib/cities.ts";

/* Taper « 84000 » rendait zéro résultat et le panneau répondait
   « indiquez une ville ». Ces tests tiennent la résolution de ce qu'un
   acheteur tape vraiment. */

test("une ville se retrouve sans accent ni majuscule", () => {
  const resolution = resolveCity("saint etienne");
  assert.equal(resolution.status, "found");
  assert.equal(resolution.city.name, "Saint-Étienne");
});

test("un code postal du référentiel donne sa commune", () => {
  const resolution = resolveCity("84000");
  assert.equal(resolution.status, "found");
  assert.equal(resolution.city.name, "Avignon");
  assert.equal(resolution.via, "postal-code");
});

test("la forme « Commune (code) » des suggestions se relit", () => {
  const resolution = resolveCity("Carpentras (84200)");
  assert.equal(resolution.status, "found");
  assert.equal(resolution.city.name, "Carpentras");
});

test("une faute de frappe ne résout rien mais propose la bonne commune", () => {
  const resolution = resolveCity("Avigon");
  assert.equal(resolution.status, "unknown");
  assert.ok(resolution.suggestions.some((city) => city.name === "Avignon"));
});

test("un code postal inconnu propose les communes de son département", () => {
  const resolution = resolveCity("84999");
  assert.equal(resolution.status, "unknown");
  assert.ok(resolution.suggestions.length > 0);
  assert.ok(resolution.suggestions.every((city) => city.postalCode.startsWith("84")));
});

test("une suggestion n'est jamais appliquée à la place de l'acheteur", () => {
  /* « Avigon » ne devient pas Avignon en silence : la liste resterait
     filtrée sur une ville que personne n'a choisie. */
  assert.equal(resolveCity("Avigon").status, "unknown");
});

test("les suggestions de saisie trouvent un mot au milieu du nom et le début d'un code", () => {
  assert.ok(searchCities("sorgue").some((city) => city.name === "L'Isle-sur-la-Sorgue"));
  assert.ok(searchCities("842").every((city) => city.postalCode.startsWith("842")));
  assert.deepEqual(searchCities(""), []);
});

test("une commune existe quand son nom et son code postal vont ensemble", () => {
  assert.equal(isKnownCommune("Avignon", "84000"), true);
  assert.equal(isKnownCommune("avignon", "84000"), true);
  assert.equal(isKnownCommune("Avignon", "26000"), false);
  assert.equal(isKnownCommune("Nulle-part", "84000"), false);
});

test("une saisie trop courte ne propose rien plutôt que n'importe quoi", () => {
  assert.deepEqual(suggestCities("av"), []);
});

/* Le référentiel complet : toutes les communes de France, homonymes
   compris. */

test("un homonyme cherché par son nom donne la commune d'origine, et propose les autres", () => {
  const resolution = resolveCity("Valence");
  assert.equal(resolution.status, "found");
  assert.deepEqual([resolution.city.departmentCode, resolution.city.postalCode], ["26", "26000"]);
  assert.ok(resolution.homonyms.some((city) => city.departmentCode === "82"), "Valence (Tarn-et-Garonne) est proposée");

  const saintDenis = resolveCity("saint denis");
  assert.equal(saintDenis.city.departmentCode, "93", "le slug nu reste à la page d'origine, même si une autre est plus peuplée");
  assert.ok(saintDenis.homonyms.some((city) => city.slug === "saint-denis-974"));
});

test("« Nom (code) » et « Nom code » désignent un homonyme précis", () => {
  for (const typed of ["Valence (82400)", "Valence 82400"]) {
    const resolution = resolveCity(typed);
    assert.equal(resolution.status, "found", typed);
    assert.equal(resolution.city.departmentCode, "82", typed);
  }
});

test("toute commune se trouve, pas seulement les 112 d'origine", () => {
  assert.equal(resolveCity("Montfavet").status, "unknown", "Montfavet est un quartier d'Avignon, pas une commune");
  assert.equal(resolveCity("84140").city.name, "Avignon", "mais son code postal est celui d'Avignon");
  assert.equal(resolveCity("Bédoin").city.postalCode, "84410");
  assert.ok(searchCities("Saint-Rémy-de-Pro").some((city) => city.name === "Saint-Rémy-de-Provence"));
  assert.ok(searchCities("st remy de pro").some((city) => city.name === "Saint-Rémy-de-Provence"), "« St » vaut « Saint »");
  assert.deepEqual(searchCities("7501", 3).map((city) => city.postalCode), ["75010", "75011", "75012"]);
});

test("une saisie de formulaire homonyme demande de choisir, un couple exact passe", () => {
  assert.equal(resolveCommuneInput("Valence").status, "ambiguous");
  assert.equal(resolveCommuneInput("Valence", "82400").city.departmentCode, "82");
  assert.equal(resolveCommuneInput("Paris", "75015").city.postalCode, "75015");
  assert.equal(isKnownCommune("Paris", "75015"), true);
});
