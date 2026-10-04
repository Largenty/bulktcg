import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { CORRECTIONS } from "../scripts/editions-update/curated.mjs";
import {
  API_GAMES,
  buildReferential,
  parseLegacyEditions,
  readEditions,
  selectCandidates,
  serializeEditions,
  slugify,
} from "../scripts/editions-update/plan.mjs";
import { slugify as siteSlugify } from "../src/lib/slug.ts";

/* Le référentiel des séries (src/lib/editions/editions.json) : généré par
   scripts/editions-update.mjs depuis les API de chaque jeu, rejoué ici sur
   leurs réponses enregistrées (tests/fixtures/editions/, --save), sans
   réseau. */

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW_FILE = readFileSync(path.join(ROOT, "src", "lib", "editions", "editions.json"), "utf8");
const FILE = JSON.parse(RAW_FILE);
const EDITIONS = readEditions(FILE);
const LEGACY = parseLegacyEditions(readFileSync(path.join(ROOT, "supabase", "migrations", "20260929120100_referentials.sql"), "utf8"));
const fixture = (gameId) => JSON.parse(readFileSync(path.join(ROOT, "tests", "fixtures", "editions", `${gameId}.json`), "utf8"));
const candidatesFrom = (today) => Object.fromEntries(API_GAMES.map((gameId) => [gameId, selectCandidates(gameId, fixture(gameId), today).candidates]));
const byGame = (gameId) => EDITIONS.filter((edition) => edition.gameId === gameId);

test("le fichier est exactement ce que le script écrit depuis les réponses enregistrées", () => {
  const previous = new Map(EDITIONS.map((edition) => [edition.id, edition]));
  const { editions } = buildReferential({ legacy: LEGACY, previous, candidatesByGame: candidatesFrom(FILE.updatedOn), today: FILE.updatedOn });
  assert.equal(serializeEditions(editions, { updatedOn: FILE.updatedOn, sources: FILE.sources }), RAW_FILE);
});

test("les 98 séries de la migration 2 y sont, et rien ne les retire", () => {
  assert.equal(LEGACY.length, 98);
  const ids = new Set(EDITIONS.filter((edition) => !edition.retiredOn).map((edition) => edition.id));
  assert.deepEqual(LEGACY.filter((row) => !ids.has(row.id)).map((row) => row.id), []);
  assert.equal(EDITIONS.find((edition) => edition.id === "pokemon-eb07-5")?.code, CORRECTIONS["pokemon-eb07-5"].code, "Destinées Radieuses est EB04.5");
});

test("chaque série a un identifiant que la base accepte, porté par son jeu, et un code unique dans son jeu", () => {
  for (const edition of EDITIONS) {
    assert.match(edition.id, /^[a-z]+-[a-z0-9]+(-[a-z0-9]+)*$/, edition.id);
    assert.ok(edition.id.startsWith(`${edition.gameId}-`), edition.id);
  }
  assert.equal(new Set(EDITIONS.map((edition) => edition.id)).size, EDITIONS.length);
  assert.equal(new Set(EDITIONS.map((edition) => `${edition.gameId}|${edition.code}`)).size, EDITIONS.length);
  for (const gameId of new Set(EDITIONS.map((edition) => edition.gameId))) {
    const orders = byGame(gameId).map((edition) => edition.sortOrder);
    assert.deepEqual(orders, orders.map((_, index) => index + 1), `${gameId} : l'ordre n'est pas 1, 2, 3…`);
  }
});

test("le découpage des identifiants est celui du site", () => {
  for (const value of ["EV08.5", "OP-09", "2X2", "Ère Pendule", "KY-T4", "EV10.5B"]) assert.equal(slugify(value), siteSlugify(value), value);
});

test("seuls les boosters entrent : ni promo, ni jeton, ni deck, ni numérique, ni série pas encore sortie", () => {
  const codes = (gameId) => byGame(gameId).map((edition) => edition.code);
  /* Magic : aucun set que Scryfall classe jeton, promo, Commander, objet de
     collection ou numérique, ni rattaché à un autre (parent_set_code). */
  const legacyIds = new Set(LEGACY.map((row) => row.id));
  const notBoosters = new Set(
    fixture("magic")
      .data.filter((set) => set.digital || set.parent_set_code || ["token", "promo", "commander", "memorabilia", "alchemy", "box"].includes(set.set_type) || set.code === "plst")
      .map((set) => set.code.toUpperCase()),
  );
  const leaked = byGame("magic").filter((edition) => !legacyIds.has(edition.id) && !/^Bloc /.test(edition.name) && notBoosters.has(edition.code));
  assert.deepEqual(leaked.map((edition) => edition.code), []);
  assert.ok(notBoosters.size > 400, "l'échantillon contient bien jetons, promos et Commander");
  assert.ok(codes("magic").includes("MH3") && codes("magic").includes("FDN") && codes("magic").includes("THS"));
  assert.ok(!codes("pokemon").some((code) => /TG|GG|SVP|SVE|TCGP/.test(code)));
  assert.ok(codes("pokemon").includes("ME01") && codes("pokemon").includes("EV10.5B"));
  assert.ok(!codes("onepiece").some((code) => code.startsWith("ST")), "aucun deck de démarrage");
  assert.ok(!codes("riftbound").includes("OPP"), "les promos de tournoi ne sont pas une extension");
  assert.ok(byGame("lorcana").every((edition) => /^CH\d+$/.test(edition.code)));
  assert.ok(byGame("yugioh").every((edition) => /^[A-Z]{4}$/.test(edition.code) || /^(Ère|Bloc) /.test(edition.name)));
  assert.ok(EDITIONS.every((edition) => !edition.releasedOn || edition.releasedOn <= FILE.updatedOn), "une série pas encore sortie");
});

test("un bloc entier ou une époque ouvre la liste de son bloc", () => {
  for (const gameId of ["pokemon", "yugioh"]) {
    const firsts = new Map();
    for (const edition of byGame(gameId)) if (!firsts.has(edition.block)) firsts.set(edition.block, edition);
    for (const [block, edition] of firsts) {
      const hasEntry = byGame(gameId).some((other) => other.block === block && /^(Bloc|Ère) /.test(other.name));
      if (hasEntry) assert.match(edition.name, /^(Bloc|Ère) /, `${gameId}, ${block} : ${edition.code} passe avant le bloc entier`);
    }
  }
  assert.ok(byGame("yugioh").some((edition) => edition.name === "Ère Pendule") && byGame("yugioh").some((edition) => edition.name === "Ère Link"));
});

/* Un petit référentiel, pour suivre une série d'une passe à l'autre. */
const LEGACY_SAMPLE = [{ id: "lorcana-ch1", gameId: "lorcana", code: "CH1", name: "The First Chapter", year: 2023, block: "Chapitres", sortOrder: 1 }];
const chapter = (number, releasedOn) => ({ apiId: String(number), code: `CH${number}`, name: `Chapitre ${number}`, releasedOn, block: "Chapitres" });

test("une série que l'API ne donne plus est gardée, marquée retirée, et revient si l'API la redonne", () => {
  const first = buildReferential({ legacy: LEGACY_SAMPLE, previous: null, candidatesByGame: { lorcana: [chapter(1, "2023-08-18"), chapter(2, "2023-11-17")] }, today: "2026-01-01" });
  const previous = new Map(first.editions.map((edition) => [edition.id, edition]));
  const second = buildReferential({ legacy: LEGACY_SAMPLE, previous, candidatesByGame: { lorcana: [chapter(1, "2023-08-18")] }, today: "2026-02-01" });
  const retired = second.editions.find((edition) => edition.id === "lorcana-ch2");
  assert.equal(retired?.retiredOn, "2026-02-01");
  assert.deepEqual(second.report.retired, ["lorcana-ch2"]);
  const third = buildReferential({
    legacy: LEGACY_SAMPLE,
    previous: new Map(second.editions.map((edition) => [edition.id, edition])),
    candidatesByGame: { lorcana: [chapter(1, "2023-08-18"), chapter(2, "2023-11-17")] },
    today: "2026-03-01",
  });
  assert.equal(third.editions.find((edition) => edition.id === "lorcana-ch2")?.retiredOn, null);
});

test("une API en échec garde la liste précédente de son jeu, rien n'est retiré", () => {
  const first = buildReferential({ legacy: LEGACY_SAMPLE, previous: null, candidatesByGame: { lorcana: [chapter(1, "2023-08-18"), chapter(2, "2023-11-17")] }, today: "2026-01-01" });
  const previous = new Map(first.editions.map((edition) => [edition.id, edition]));
  const failed = buildReferential({ legacy: LEGACY_SAMPLE, previous, candidatesByGame: {}, today: "2026-02-01" });
  assert.equal(failed.editions.find((edition) => edition.id === "lorcana-ch2")?.retiredOn, null);
  assert.deepEqual(failed.report.kept, ["lorcana-ch2"]);
});

test("une ligne de la migration 2 garde son identifiant, son nom et son bloc, même quand l'API la nomme autrement", () => {
  const renamed = { ...chapter(1, "2023-08-18"), name: "Chapter One" };
  const { editions } = buildReferential({ legacy: LEGACY_SAMPLE, previous: null, candidatesByGame: { lorcana: [renamed] }, today: "2026-01-01" });
  assert.equal(editions.find((edition) => edition.id === "lorcana-ch1")?.name, "The First Chapter");
  assert.throws(() => buildReferential({ legacy: [...LEGACY_SAMPLE, { ...LEGACY_SAMPLE[0], id: "lorcana-ch1b", code: "CH1" }], previous: null, candidatesByGame: {}, today: "2026-01-01" }), /même code/);
});

test("une réponse d'API mal formée ou tronquée est refusée avant toute écriture", () => {
  assert.throws(() => selectCandidates("lorcana", { results: [{ code: "1" }] }, "2026-01-01"));
  assert.throws(() => selectCandidates("magic", { data: fixture("magic").data.slice(0, 10) }, "2026-01-01"), /100|too_small|Too small/i);
  assert.throws(() => selectCandidates("riftbound", { data: [{ code: "ogn", name: "Origins", release_date: "pas une date", card_count: 300 }] }, "2026-01-01"));
});

test("One Piece : une série sans année connue attend qu'on l'écrive, au lieu d'une année inventée", () => {
  const { candidates, skipped } = selectCandidates(
    "onepiece",
    [...fixture("onepiece"), { set_id: "OP-99", set_name: "Future" }],
    "2026-01-01",
  );
  assert.deepEqual(skipped, ["OP-99"]);
  assert.ok(candidates.some((candidate) => candidate.code === "OP-14"), "« OP14-EB04 » devient OP-14");
});

test("Pokémon : une galerie de dresseurs, une promo ou une énergie n'est pas une extension", () => {
  const set = (id) => ({ id, name: `Nom ${id}`, releaseDate: "2022-01-01" });
  const ids = ["swsh9", "swsh9tg", "swsh12.5gg", "swshp", "sve", "svp", "sv03.5", "swsh4.5sv"];
  const raw = { series: { swsh: { id: "swsh", sets: ids.map((id) => ({ id, name: id })) } }, sets: Object.fromEntries(ids.map((id) => [id, set(id)])) };
  assert.deepEqual(selectCandidates("pokemon", raw, "2026-01-01").candidates.map((candidate) => candidate.code), ["EB09", "EV03.5"]);
});
