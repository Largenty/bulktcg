import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { GAME_IDS } from "../src/types/game.ts";
import { TAG_LABELS } from "../src/lib/labels.ts";
import { getProductTagsByGame, isTagAllowedForGame } from "../src/lib/product-tags.ts";

/* « Cartes à l'unité » : des cartes choisies qui partent avec un lot. Le site
   vend des lots, jamais la carte seule — le produit se lit comme un contenu
   du lot, pas comme un format d'annonce. */

const ROOT = path.resolve(import.meta.dirname, "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");

test("« Cartes à l'unité » se propose pour tous les jeux, « Autre » compris", () => {
  for (const gameId of GAME_IDS) {
    assert.ok(isTagAllowedForGame("singles", gameId), `singles absent pour ${gameId}`);
    assert.ok(getProductTagsByGame(gameId).some((tag) => tag.id === "singles"));
  }
  assert.equal(TAG_LABELS.singles, "Cartes à l'unité");
});

test("son indication dit qu'elles accompagnent le lot", () => {
  const singles = getProductTagsByGame("pokemon").find((tag) => tag.id === "singles");
  assert.ok(singles?.hint, "pas d'indication : le libellé seul ferait croire qu'on vend une carte seule");
  assert.match(singles.hint, /avec le lot/);
});

let PGlite = null;
try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  PGlite = null;
}
const SKIP = PGlite === null ? "PGlite n'est pas installé : npm install --no-save @electric-sql/pglite" : false;

/* Une base déjà créée — les onze premières migrations passées — reçoit la
   valeur et ses jeux en deux exécutions : PostgreSQL refuse d'employer une
   valeur d'énumération dans la transaction qui l'ajoute, et l'éditeur SQL de
   Supabase joue un fichier collé en une seule transaction. setup.sql, lui,
   passe d'un bloc : l'énumération y naît dans la même transaction, où la
   règle ne s'applique pas. */
test("une base existante reçoit la valeur, puis ses jeux, en deux exécutions", { skip: SKIP }, async () => {
  const files = readdirSync(MIGRATIONS).filter((file) => file.endsWith(".sql")).sort();
  const addValue = files.findIndex((file) => /^alter type public\.product_tag add value/m.test(readFileSync(path.join(MIGRATIONS, file), "utf8")));
  assert.ok(addValue > 0, "aucune migration n'ajoute de valeur d'énumération");
  const read = (file) => readFileSync(path.join(MIGRATIONS, file), "utf8");
  const valueFile = read(files[addValue]);
  assert.doesNotMatch(valueFile, /\binsert\b/i, "la valeur et son emploi doivent vivre dans deux migrations");
  const usage = read(files[addValue + 1]);

  async function existingBase() {
    const db = new PGlite();
    await db.exec(readFileSync(path.join(ROOT, "supabase", "tests", "prelude.sql"), "utf8"));
    for (const file of files.slice(0, addValue)) await db.exec(read(file));
    return db;
  }

  const together = await existingBase();
  await assert.rejects(together.exec(`begin;\n${valueFile}\n${usage}\ncommit;`), /unsafe use of new value/);

  const apart = await existingBase();
  await apart.exec(`begin;\n${valueFile}\ncommit;`);
  await apart.exec(`begin;\n${usage}\ncommit;`);
  const { rows } = await apart.query("select count(*)::int as n from public.product_tag_games where tag = 'singles'");
  assert.equal(rows[0].n, GAME_IDS.length);
});

test("setup.sql passe d'un seul bloc, comme l'éditeur SQL le joue", { skip: SKIP }, async () => {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(ROOT, "supabase", "tests", "prelude.sql"), "utf8"));
  await db.exec(`begin;\n${readFileSync(path.join(ROOT, "supabase", "setup.sql"), "utf8")}\ncommit;`);
  const { rows } = await db.query("select count(*)::int as n from public.product_tag_games where tag = 'singles'");
  assert.equal(rows[0].n, GAME_IDS.length);
});
