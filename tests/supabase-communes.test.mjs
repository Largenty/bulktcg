import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { readReferential, toCommuneRows } from "../scripts/communes-update/plan.mjs";
import { BATCH_SIZE, batches, planCommuneLoad } from "../scripts/supabase-communes/plan.mjs";
import { seedRows } from "./schema.mjs";

/* Le chargement des communes (scripts/supabase-communes.mjs) n'ajoute que
   ce qui manque, et s'arrête avant toute écriture plutôt que de changer une
   ligne qu'une annonce peut citer. */

const ROOT = path.resolve(import.meta.dirname, "..");
const row = (slug, name, postalCode, latitude = 44.9333, longitude = 4.8924) => ({
  slug,
  name,
  postal_code: postalCode,
  department_code: "26",
  department_name: "Drôme",
  latitude,
  longitude,
});

test("seuls les couples absents sont à écrire ; une ligne identique est laissée", () => {
  const present = row("valence", "Valence", "26000");
  const plan = planCommuneLoad([present, row("valence-26500", "Valence", "26500")], [{ ...present }]);
  assert.deepEqual(plan.missing.map((candidate) => candidate.slug), ["valence-26500"]);
  assert.equal(plan.unchanged, 1);
  assert.deepEqual(plan.conflicts, []);
});

test("les coordonnées se comparent en nombres : un double rendu par la base reste identique", () => {
  const plan = planCommuneLoad([row("valence", "Valence", "26000", 44.9333, 4.8924)], [{ ...row("valence", "Valence", "26000"), latitude: "44.9333" }]);
  assert.equal(plan.unchanged, 1);
  assert.deepEqual(plan.conflicts, []);
});

test("un couple déjà en base avec d'autres valeurs arrête le passage, sans rien écrire", () => {
  const plan = planCommuneLoad([row("valence", "Valence", "26000", 44.9333)], [row("valence", "Valence", "26000", 45.1)]);
  assert.deepEqual(plan.missing, []);
  assert.equal(plan.conflicts.length, 1);
  assert.match(plan.conflicts[0].reason, /latitude/);
});

test("un slug pris par un autre couple arrête le passage", () => {
  const plan = planCommuneLoad([row("valence", "Valence", "26000")], [row("valence", "Valence-d'Albigeois", "81340")]);
  assert.deepEqual(plan.missing, []);
  assert.match(plan.conflicts[0].reason, /déjà pris par Valence-d'Albigeois \(81340\)/);
});

test("une ligne de la base absente du référentiel reste : une clé étrangère peut la viser", () => {
  const legacy = row("ancienne", "Ancienne", "26999");
  const plan = planCommuneLoad([row("valence", "Valence", "26000")], [legacy]);
  assert.deepEqual(plan.extra, [legacy]);
  assert.equal(plan.missing.length, 1);
});

test("les lots font au plus 1 000 lignes, dans l'ordre", () => {
  const rows = Array.from({ length: 2 * BATCH_SIZE + 3 }, (_, index) => index);
  const chunks = batches(rows);
  assert.deepEqual(chunks.map((chunk) => chunk.length), [BATCH_SIZE, BATCH_SIZE, 3]);
  assert.deepEqual(chunks.flat(), rows);
});

test("sur la base de la migration 2, le référentiel ajoute tout le reste sans conflit", () => {
  /* Les 112 lignes posées par la migration 2, telles que la base les tient :
     le référentiel les retrouve à l'identique, et n'ajoute que les autres. */
  const columns = ["slug", "name", "postal_code", "department_code", "department_name", "latitude", "longitude"];
  const existing = seedRows("communes").map((values) => Object.fromEntries(columns.map((column, index) => [column, values[index]])));
  const wanted = toCommuneRows(readReferential(JSON.parse(readFileSync(path.join(ROOT, "src", "lib", "communes", "communes.json"), "utf8"))));
  const plan = planCommuneLoad(wanted, existing);
  assert.ok(existing.length > 100, `seulement ${existing.length} communes dans la migration 2`);
  assert.equal(plan.unchanged, existing.length);
  assert.deepEqual(plan.conflicts, []);
  assert.deepEqual(plan.extra, []);
  assert.equal(plan.missing.length + plan.unchanged, wanted.length);
});
