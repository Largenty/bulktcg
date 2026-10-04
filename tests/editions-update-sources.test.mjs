import assert from "node:assert/strict";
import test from "node:test";
import { SOURCES, USER_AGENT, fetchRaw } from "../scripts/editions-update/sources.mjs";

/* Les appels aux API des séries, avec un fetch simulé : jamais de réseau
   dans npm test. Scryfall exige un User-Agent qui nomme l'application et un
   Accept ; toutes demandent qu'on s'arrête sur un 429. */

function stubFetch(respond) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return respond(String(url));
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}

test("chaque appel nomme l'application, demande du JSON, a son délai et refuse une redirection", async () => {
  const stub = stubFetch(() => Response.json({ data: [] }));
  try {
    await fetchRaw("magic");
  } finally {
    stub.restore();
  }
  assert.equal(stub.calls.length, 1);
  const { url, init } = stub.calls[0];
  assert.equal(url, SOURCES.magic);
  assert.match(init.headers["User-Agent"], /^BulkTCG\/\d+\.\d+\.\d+ \(editions-update\)$/);
  assert.equal(init.headers["User-Agent"], USER_AGENT);
  assert.equal(init.headers.Accept, "application/json");
  assert.ok(init.signal instanceof AbortSignal, "sans délai, une API muette bloquerait le script");
  assert.equal(init.redirect, "error");
});

test("un 429 arrête le jeu au lieu d'insister, une erreur aussi", async () => {
  for (const status of [429, 500]) {
    const stub = stubFetch(() => new Response("non", { status }));
    try {
      /* Un 429 se distingue d'une panne : le script dit qu'on lui demande de
         ralentir, et n'insiste pas. */
      await assert.rejects(fetchRaw("yugioh"), status === 429 ? /demande de ralentir \(429\) : arrêt/ : /a répondu 500/);
    } finally {
      stub.restore();
    }
  }
});

test("Pokémon : la fiche de chaque set récent, et seulement d'eux", async () => {
  const series = { me: ["me01", "mep"], sv: ["sv08", "svp", "sve"], swsh: ["swsh9tg", "swsh9", "cel25"] };
  const stub = stubFetch((url) => {
    const seriesId = url.match(/\/series\/(\w+)$/)?.[1];
    if (seriesId) return Response.json({ id: seriesId, name: seriesId, sets: series[seriesId].map((id) => ({ id, name: id })) });
    const setId = decodeURIComponent(url.split("/sets/")[1]);
    return Response.json({ id: setId, name: `Nom ${setId}`, releaseDate: "2024-01-01" });
  });
  let raw;
  try {
    raw = await fetchRaw("pokemon");
  } finally {
    stub.restore();
  }
  assert.deepEqual(Object.keys(raw.sets).sort(), ["cel25", "me01", "sv08", "swsh9"]);
  assert.ok(stub.calls.every((call) => call.url.startsWith(SOURCES.pokemon)));
});
