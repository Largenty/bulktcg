import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../src/app/series/route.ts";
import { reachableFromClients, SOURCES } from "./client-graph.mjs";

/* La route qui donne au formulaire de dépôt les séries du jeu choisi, et la
   frontière qui la rend nécessaire : le référentiel ne part jamais dans le
   navigateur. */

async function ask(game) {
  const response = GET(new Request(`http://localhost/series?jeu=${encodeURIComponent(game)}`));
  return { response, body: await response.json() };
}

test("les séries d'un jeu, groupées par bloc, dans l'ordre du référentiel, sans série retirée", async () => {
  const { response, body } = await ask("pokemon");
  assert.equal(response.status, 200);
  assert.equal(body.gameId, "pokemon");
  assert.equal(body.blocks[0].block, "Méga-Évolution");
  assert.equal(body.blocks[0].editions[0].code, "ME", "le bloc entier en tête");
  const ids = body.blocks.flatMap((block) => block.editions.map((edition) => edition.id));
  assert.ok(ids.includes("pokemon-ev08") && ids.every((id) => id.startsWith("pokemon-")));
  assert.equal((await ask("one-piece")).body.gameId, "onepiece", "le jeu se nomme par son segment d'adresse");
});

test("un jeu inconnu répond 404 ; « Autre » n'a pas de séries", async () => {
  assert.equal((await ask("belote")).response.status, 404);
  assert.equal((await ask("")).response.status, 404);
  assert.deepEqual((await ask("autres-jeux")).body.blocks, []);
});

test("la réponse ne dit rien de personnel : elle se garde, et ne s'indexe pas", async () => {
  const { response } = await ask("magic");
  assert.match(response.headers.get("cache-control") ?? "", /^public, max-age=\d+$/);
  assert.equal(response.headers.get("x-robots-tag"), "noindex");
});

test("aucun module qui s'exécute dans le navigateur n'importe le référentiel des séries", () => {
  const valueImport = /^import\s+(?!type\b)[^;]*from\s+["']@\/lib\/(editions|editions\/[\w.-]+|schemas\/editions)["']/m;
  const offenders = [...reachableFromClients()].filter((file) => valueImport.test(SOURCES.get(file) ?? ""));
  assert.deepEqual(offenders, []);
  assert.ok(valueImport.test('import { getEditionById } from "@/lib/editions";'), "le motif reconnaît un import de valeur");
  assert.ok(!valueImport.test('import type { Edition } from "@/lib/editions";'));
});

test("le serveur refuse une série inconnue, d'un autre jeu, ou retirée — sauf si l'annonce la portait déjà", async () => {
  const { editionIssue, UNKNOWN_EDITION_ERROR } = await import("../src/lib/schemas/editions.ts");
  const lookup = {
    find: (id) => ({ "pokemon-ev08": { id, code: "EV08", gameId: "pokemon" }, "pokemon-old": { id, code: "OLD", gameId: "pokemon" }, "magic-mh3": { id, code: "MH3", gameId: "magic" } })[id] ?? null,
    isRetired: (id) => id === "pokemon-old",
  };
  assert.equal(editionIssue("pokemon", ["pokemon-ev08"], [], lookup), null);
  assert.equal(editionIssue("pokemon", ["pokemon-ev99"], [], lookup), UNKNOWN_EDITION_ERROR);
  assert.equal(editionIssue("pokemon", ["magic-mh3"], [], lookup), UNKNOWN_EDITION_ERROR);
  assert.match(editionIssue("pokemon", ["pokemon-old"], [], lookup) ?? "", /OLD n'est plus proposée/);
  assert.equal(editionIssue("pokemon", ["pokemon-old"], ["pokemon-old"], lookup), null, "une modification garde ce que l'annonce portait");
});

test("en modification, une série retirée que l'annonce porte reste proposée, à part ; les autres retirées non", async () => {
  const { catalogOf } = await import("../src/lib/editions.ts");
  const { RETIRED_EDITIONS_BLOCK } = await import("../src/lib/edition-catalog.ts");
  const edition = (id, sortOrder, isRetired = false) => ({ id, code: id, gameId: "lorcana", name: id, year: 2024, block: "Chapitres", sortOrder, isRetired });
  const stored = [edition("lorcana-ch2", 1), edition("lorcana-ch1", 2, true), edition("lorcana-ch0", 3, true)];
  assert.deepEqual(catalogOf(stored, "lorcana").blocks.map((block) => block.editions.map((item) => item.id)), [["lorcana-ch2"]]);
  const kept = catalogOf(stored, "lorcana", ["lorcana-ch1"]).blocks;
  assert.deepEqual(kept.map((block) => [block.block, block.editions.map((item) => item.id)]), [["Chapitres", ["lorcana-ch2"]], [RETIRED_EDITIONS_BLOCK, ["lorcana-ch1"]]]);
});

test("l'action du dépôt vérifie les séries contre le référentiel, en gardant celles que l'annonce portait", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../src/app/actions/listings.ts", import.meta.url), "utf8");
  assert.match(source, /withKnownEditions\(\s*withKnownCommune\(/);
  assert.match(source, /existing\?\.editions\.map\(\(edition\) => edition\.id\)/);
});

test("une série inconnue dans l'adresse ne filtre rien : le serveur l'écarte avant toute lecture", async () => {
  const { resolveListingSearch } = await import("../src/lib/listing-search.ts");
  const { QUERY_PARAM } = await import("../src/lib/listing-query.ts");
  const known = resolveListingSearch({ [QUERY_PARAM.edition]: "pokemon-ev08" }, { perPage: 18 });
  assert.equal(known.query.editionId, "pokemon-ev08");
  const unknown = resolveListingSearch({ [QUERY_PARAM.edition]: "pokemon-ev99" }, { perPage: 18 });
  assert.equal(unknown.query.editionId, undefined);
});
