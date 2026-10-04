import assert from "node:assert/strict";
import test from "node:test";
import { SORT_ORDER_SHIFT, planEditionLoad } from "../scripts/supabase-editions/plan.mjs";

/* Le plan du chargement des séries en base, sans réseau. */

const row = (id, sortOrder, extra = {}) => ({ id, game_id: id.split("-")[0], code: id.split("-")[1].toUpperCase(), name: id, year: 2024, block: "B", sort_order: sortOrder, ...extra });

test("une base à jour n'écrit rien", () => {
  const rows = [row("lorcana-ch1", 2), row("lorcana-ch2", 1)];
  const plan = planEditionLoad(rows, rows);
  assert.deepEqual([plan.inserts, plan.updates, plan.steps], [[], [], []]);
  assert.equal(plan.unchanged, 2);
});

test("une nouvelle série décale d'abord l'ordre du jeu, puis écrit l'ordre final : unique (game_id, sort_order) n'est pas différable", () => {
  const existing = [row("lorcana-ch1", 1), row("magic-mh3", 1)];
  const wanted = [row("lorcana-ch2", 1), row("lorcana-ch1", 2), row("magic-mh3", 1)];
  const plan = planEditionLoad(wanted, existing);
  assert.deepEqual(plan.inserts.map((item) => item.id), ["lorcana-ch2"]);
  assert.deepEqual(plan.steps.map((step) => `${step.gameId}:${step.phase}`), ["lorcana:shift", "lorcana:final"], "Magic, inchangé, n'est pas touché");
  assert.deepEqual(plan.steps[0].rows.map((item) => [item.id, item.sort_order]), [["lorcana-ch1", SORT_ORDER_SHIFT + 2]]);
  assert.deepEqual(plan.steps[1].rows.map((item) => [item.id, item.sort_order]), [["lorcana-ch2", 1], ["lorcana-ch1", 2]]);
});

test("un code qui change s'arrête avant toute écriture, sauf correction listée", () => {
  const existing = [row("pokemon-eb07-5", 1, { code: "EB07.5" })];
  const changed = [row("pokemon-eb07-5", 1, { code: "EB04.5" })];
  assert.equal(planEditionLoad(changed, existing).conflicts.length, 1);
  assert.deepEqual(planEditionLoad(changed, existing).steps, []);
  const corrected = planEditionLoad(changed, existing, { "pokemon-eb07-5": { code: "EB04.5" } });
  assert.deepEqual(corrected.conflicts, []);
  assert.deepEqual(corrected.updates.map((item) => item.code), ["EB04.5"]);
});

test("une série qui changerait de jeu, ou un code déjà porté, arrête tout", () => {
  assert.match(planEditionLoad([row("magic-neo", 1, { game_id: "pokemon" })], [row("magic-neo", 1)]).conflicts[0].reason, /jeu/);
  assert.match(planEditionLoad([row("lorcana-chx", 2, { code: "CH1" })], [row("lorcana-ch1", 1)]).conflicts[0].reason, /CH1/);
});

test("une ligne de la base absente du référentiel n'est jamais supprimée, seulement poussée hors de l'ordre", () => {
  const existing = [row("lorcana-ch1", 1), row("lorcana-old", 2)];
  const plan = planEditionLoad([row("lorcana-ch2", 1), row("lorcana-ch1", 2)], existing);
  assert.deepEqual(plan.extra.map((item) => item.id), ["lorcana-old"]);
  const shifted = plan.steps[0].rows.find((item) => item.id === "lorcana-old");
  assert.ok(shifted && shifted.sort_order > 2 * SORT_ORDER_SHIFT && shifted.sort_order <= 32_767, "smallint");
  assert.ok(!plan.steps[1].rows.some((item) => item.id === "lorcana-old"));
});
