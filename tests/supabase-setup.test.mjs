import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { SETUP_PATH, buildSetupSql } from "../scripts/supabase-setup.mjs";
import { MIGRATIONS, migrationsDir } from "./schema.mjs";

/* supabase/setup.sql — toute la base en un seul fichier, qu'on colle dans
   l'éditeur SQL d'un projet neuf — se déduit des migrations. Retouché à la
   main, ou oublié après une migration, il créerait une base que les tests
   n'ont jamais relue. */

test("supabase/setup.sql est exactement ce que produit le script", () => {
  assert.equal(readFileSync(SETUP_PATH, "utf8"), buildSetupSql(), "supabase/setup.sql est périmé : node scripts/supabase-setup.mjs");
});

test("supabase/setup.sql contient chaque migration entière, dans l'ordre où db push les applique", () => {
  /* Indépendant du script : un script qui sauterait une migration ou en
     changerait l'ordre passerait le test précédent. */
  const setup = readFileSync(SETUP_PATH, "utf8");
  let from = 0;
  for (const file of MIGRATIONS) {
    const body = readFileSync(path.join(migrationsDir, file), "utf8").trimEnd();
    const at = setup.indexOf(body, from);
    assert.ok(at >= from, `${file} manque dans supabase/setup.sql, ou n'est pas à sa place`);
    from = at + body.length;
  }
});
