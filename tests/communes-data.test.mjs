import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseLegacyCommunes, readReferential, serializeReferential, toCommuneRows } from "../scripts/communes-update/plan.mjs";
import { CITIES } from "../src/lib/cities.ts";

/* Le fichier du référentiel tel qu'il est versionné : ce que la base doit
   pouvoir charger, et ce que les pages promettent. Il est généré
   (scripts/communes-update.mjs) ; ces tests refusent qu'on le retouche à la
   main d'une façon que le script ne reproduirait pas. */

const RAW = readFileSync("src/lib/communes/communes.json", "utf8");
const FILE = JSON.parse(RAW);
const COMMUNES = readReferential(FILE);
const LEGACY = parseLegacyCommunes(readFileSync("supabase/migrations/20260929120100_referentials.sql", "utf8"));

test("le fichier est exactement ce que le script écrirait", () => {
  const frozenOrder = FILE.frozen;
  assert.equal(serializeReferential(COMMUNES, { updatedOn: FILE.updatedOn, frozenOrder }), RAW);
});

test("toutes les communes de France que la base accepte y sont, et rien d'autre", () => {
  const active = COMMUNES.filter((commune) => !commune.retiredOn);
  assert.ok(active.length > 34_000, `seulement ${active.length} communes`);
  assert.ok(COMMUNES.every((commune) => /^(\d{2}|2[AB]|97\d)$/.test(commune.departmentCode)), "un département hors du check SQL");
  assert.ok(COMMUNES.every((commune) => commune.postalCodes.length > 0 && commune.postalCodes.every((code) => /^\d{5}$/.test(code))));
  assert.ok(COMMUNES.every((commune) => commune.departmentName !== ""), "un département sans nom");
  assert.ok(COMMUNES.every((commune) => Math.abs(commune.latitude) <= 90 && Math.abs(commune.longitude) <= 180));
  for (const name of ["Paris", "Marseille", "Saint-Denis", "Valence", "Les Trois-Îlets", "Ajaccio"]) {
    assert.ok(COMMUNES.some((commune) => commune.name === name), `${name} manque`);
  }
});

test("chaque page a son slug, et chaque ligne de la table le sien", () => {
  assert.equal(new Set(COMMUNES.map((commune) => commune.slug)).size, COMMUNES.length);
  assert.ok(COMMUNES.every((commune) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(commune.slug)), "un slug hors du check SQL");
  const rows = toCommuneRows(COMMUNES);
  assert.equal(new Set(rows.map((row) => row.slug)).size, rows.length);
});

test("un couple nom et code postal ne désigne qu'une commune : la clé étrangère de la base en dépend", () => {
  const rows = toCommuneRows(COMMUNES);
  const pairs = new Set(rows.map((row) => `${row.name}|${row.postal_code}`));
  assert.equal(pairs.size, rows.length);
});

test("les 112 communes de la migration 2 y sont telles que la base les porte, dans son ordre", () => {
  assert.equal(FILE.frozen.length, LEGACY.length);
  assert.deepEqual(
    CITIES.map((city) => [city.slug, city.name, city.postalCode, city.departmentCode, city.departmentName, city.latitude, city.longitude]),
    LEGACY.map((row) => [row.slug, row.name, row.postalCode, row.departmentCode, row.departmentName, row.latitude, row.longitude]),
  );
  const frozen = new Set(FILE.frozen);
  assert.ok(COMMUNES.filter((commune) => frozen.has(commune.insee)).every((commune) => !commune.retiredOn), "une commune d'origine retirée");
});
