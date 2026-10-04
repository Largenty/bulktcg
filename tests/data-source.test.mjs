import assert from "node:assert/strict";
import test from "node:test";
import { DataSourceError, TABLES, unwrap } from "../src/lib/data/source.ts";

/* La source des lectures, en un seul fichier : les tables de la phase 1, et
   l'outil qui lira les réponses de la base en phase 2. */

test("une lecture en panne lève, une ligne introuvable rend null", () => {
  /* null veut dire « introuvable » et fait répondre 404 : une panne rendue
     comme null figerait un 404 pendant une régénération, et la fiche serait
     désindexée. */
  assert.deepEqual(unwrap("listings.bySlug", { data: { slug: "vrac" }, error: null }), { slug: "vrac" });
  assert.equal(unwrap("listings.bySlug", { data: null, error: null }), null);
  assert.throws(
    () => unwrap("listings.bySlug", { data: null, error: { message: "connexion refusée", code: "08006" } }),
    (error) => error instanceof DataSourceError && error.code === "08006" && /^listings\.bySlug : connexion refusée$/.test(error.message),
  );
});

test("les tables de la phase 1 ont déjà la forme des lignes SQL", () => {
  /* snake_case, comme la base : le filtrage de lib/data se traduira mot à
     mot en requête. */
  for (const [name, rows] of Object.entries(TABLES)) {
    if (!Array.isArray(rows)) continue;
    assert.ok(rows.length > 0, `la table ${name} est vide`);
    for (const key of Object.keys(rows[0])) assert.doesNotMatch(key, /[A-Z]/, `${name}.${key} n'est pas en snake_case`);
  }
});
