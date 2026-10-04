import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildReferential,
  parseLegacyCommunes,
  readReferential,
  rowSlug,
  serializeReferential,
  slugify,
  toCommuneRows,
} from "../scripts/communes-update/plan.mjs";
import { slugify as siteSlugify } from "../src/lib/slug.ts";

/* La mise à jour annuelle du référentiel des communes, sans réseau : la
   liste officielle est simulée. Trois promesses : un lien de page ne change
   jamais, les 112 de la migration 2 restent figées, une commune disparue
   reste — retirée, jamais redonnée. */

const official = (code, name, departmentCode, postalCodes, population = 100, departmentName = `Département ${departmentCode}`) => ({
  code,
  nom: name,
  codeDepartement: departmentCode,
  departement: { code: departmentCode, nom: departmentName },
  codesPostaux: postalCodes,
  mairie: { type: "Point", coordinates: [4.8, 43.9] },
  centre: { type: "Point", coordinates: [4.5, 43.5] },
  population,
});

const OFFICIAL = [
  official("84007", "Avignon", "84", ["84140", "84000"], 90000, "Vaucluse"),
  official("26362", "Valence", "26", ["26000"], 64000, "Drôme"),
  official("82186", "Valence", "82", ["82400"], 5000),
  official("16392", "Valence", "16", ["16460"], 300),
  official("01001", "L'Abergement-Clémenciat", "01", ["01400"], 860),
  official("98818", "Nouméa", "988", ["98800"], 94000),
  official("98411", "Îles Saint-Paul", "984", [], 0),
];

const LEGACY = [
  { slug: "avignon", name: "Avignon", postalCode: "84000", departmentCode: "84", departmentName: "Vaucluse", latitude: 43.9493, longitude: 4.8055 },
  { slug: "valence", name: "Valence", postalCode: "26000", departmentCode: "26", departmentName: "Drôme", latitude: 44.9334, longitude: 4.8924 },
];

const first = () => buildReferential({ official: OFFICIAL, previous: null, legacy: LEGACY, today: "2026-10-01" });
const byCode = (communes, code) => communes.find((commune) => commune.insee === code);

test("le slug du script est celui du site, accents, apostrophes et ligatures compris", () => {
  for (const name of ["L'Abergement-Clémenciat", "Œuilly", "Saint-Rémy-de-Provence", "Æther", "Les Trois-Îlets", "Brûlon"]) {
    assert.equal(slugify(name), siteSlugify(name), name);
  }
});

test("les 112 communes de la migration 2 sont lues dans son insert, apostrophes comprises", () => {
  const legacy = parseLegacyCommunes(readFileSync("supabase/migrations/20260929120100_referentials.sql", "utf8"));
  assert.equal(legacy.length, 112);
  assert.deepEqual(legacy[0], { slug: "paris", name: "Paris", postalCode: "75001", departmentCode: "75", departmentName: "Paris", latitude: 48.8566, longitude: 2.3522 });
  assert.ok(legacy.some((row) => row.name === "L'Isle-sur-la-Sorgue"), "une apostrophe doublée en SQL se relit simple");
});

test("une commune de la migration 2 garde son slug, ses coordonnées et son code postal d'origine", () => {
  const { communes } = first();
  const avignon = byCode(communes, "84007");
  assert.equal(avignon.slug, "avignon");
  assert.deepEqual([avignon.latitude, avignon.longitude], [43.9493, 4.8055], "les coordonnées de la base, pas celles de la mairie");
  assert.deepEqual(avignon.postalCodes, ["84000", "84140"], "le code postal d'origine passe en premier");
  assert.equal(avignon.frozen, true);
});

test("un nom unique garde son slug nu, un homonyme prend son département", () => {
  const { communes } = first();
  assert.equal(byCode(communes, "01001").slug, "l-abergement-clemenciat");
  assert.equal(byCode(communes, "26362").slug, "valence", "la Valence d'origine garde son slug");
  assert.equal(byCode(communes, "82186").slug, "valence-82");
  assert.equal(byCode(communes, "16392").slug, "valence-16");
  assert.equal(byCode(communes, "01001").latitude, 43.9, "les autres prennent la mairie");
});

test("deux homonymes d'un même département prennent leur code INSEE", () => {
  const { communes } = buildReferential({
    official: [official("50001", "Saint-Pierre", "50", ["50100"]), official("50002", "Saint-Pierre", "50", ["50200"])],
    previous: null,
    legacy: [],
    today: "2026-10-01",
  });
  assert.deepEqual(communes.map((commune) => commune.slug), ["saint-pierre-50001", "saint-pierre-50002"]);
});

test("les collectivités hors du check SQL et les communes sans code postal sont écartées", () => {
  const { communes } = first();
  assert.equal(byCode(communes, "98818"), undefined);
  assert.equal(byCode(communes, "98411"), undefined);
});

test("un second passage rend le même fichier, octet pour octet", () => {
  const once = first();
  const file = serializeReferential(once.communes, { updatedOn: "2026-10-01", frozenOrder: once.frozenOrder });
  const twice = buildReferential({ official: OFFICIAL, previous: readReferential(JSON.parse(file)), legacy: LEGACY, today: "2026-10-01" });
  assert.equal(serializeReferential(twice.communes, { updatedOn: "2026-10-01", frozenOrder: twice.frozenOrder }), file);
  assert.deepEqual(twice.report, { added: [], retired: [], renamed: [] });
});

test("une commune renommée garde son slug : le lien de sa page ne change pas", () => {
  const previous = readReferential(JSON.parse(serializeReferential(first().communes, { updatedOn: "2026-10-01", frozenOrder: first().frozenOrder })));
  const renamed = OFFICIAL.map((commune) => (commune.code === "01001" ? { ...commune, nom: "Abergement-Clémenciat" } : commune));
  const next = buildReferential({ official: renamed, previous, legacy: LEGACY, today: "2027-01-01" });
  assert.equal(byCode(next.communes, "01001").slug, "l-abergement-clemenciat");
  assert.equal(byCode(next.communes, "01001").name, "Abergement-Clémenciat");
  assert.equal(next.report.renamed.length, 1);
});

test("une commune disparue reste, retirée, et son slug n'est jamais redonné", () => {
  const once = first();
  const previous = readReferential(JSON.parse(serializeReferential(once.communes, { updatedOn: "2026-10-01", frozenOrder: once.frozenOrder })));
  /* L'Abergement-Clémenciat fusionne ; une nouvelle commune prend son nom
     ailleurs. */
  const merged = [...OFFICIAL.filter((commune) => commune.code !== "01001"), official("02999", "L'Abergement-Clémenciat", "02", ["02100"])];
  const next = buildReferential({ official: merged, previous, legacy: LEGACY, today: "2027-01-01" });
  const gone = byCode(next.communes, "01001");
  assert.equal(gone.retiredOn, "2027-01-01");
  assert.equal(gone.slug, "l-abergement-clemenciat");
  assert.equal(byCode(next.communes, "02999").slug, "l-abergement-clemenciat-02", "le slug de la commune retirée reste à elle");
  assert.deepEqual(next.report.retired, ["01001"]);

  /* L'année suivante, elle garde la date de son retrait. */
  const later = buildReferential({
    official: merged,
    previous: readReferential(JSON.parse(serializeReferential(next.communes, { updatedOn: "2027-01-01", frozenOrder: next.frozenOrder }))),
    legacy: LEGACY,
    today: "2028-01-01",
  });
  assert.equal(byCode(later.communes, "01001").retiredOn, "2027-01-01");
  assert.deepEqual(later.report.retired, []);
});

test("une ligne de la migration 2 introuvable arrête tout", () => {
  assert.throws(
    () => buildReferential({ official: OFFICIAL, previous: null, legacy: [{ ...LEGACY[0], postalCode: "84999" }], today: "2026-10-01" }),
    /Commune de la migration 2 introuvable/,
  );
});

test("chaque couple a sa ligne en base : le principal au slug de la commune, les autres suffixés", () => {
  const { communes } = first();
  const avignon = byCode(communes, "84007");
  assert.equal(rowSlug(avignon, "84000"), "avignon");
  assert.equal(rowSlug(avignon, "84140"), "avignon-84140");
  const rows = toCommuneRows(communes);
  assert.equal(rows.length, communes.reduce((count, commune) => count + commune.postalCodes.length, 0));
  assert.equal(new Set(rows.map((row) => row.slug)).size, rows.length);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["department_code", "department_name", "latitude", "longitude", "name", "postal_code", "slug"]);
});
