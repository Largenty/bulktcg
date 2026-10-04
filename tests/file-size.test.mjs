import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* Aucun fichier de code n'atteint 500 lignes. Les classes de base en
   comptaient 1 848 dans une seule feuille, les annonces de démonstration 938,
   les tests de composants 647 : au-delà, un fichier ne se relit plus d'un
   tenant, et ce qu'il mélange ne se voit plus. Celui qui grossit se découpe
   par domaine, comme lib/data/mappers/, styles/base/ ou lib/mock/listings/. */

const MAX_LINES = 499;
const PROJECT_ROOT = path.dirname(SOURCE_ROOT);
/* Le SQL compte aussi : les migrations et les scénarios rejoués sur
   PostgreSQL se relisent comme le reste. La migration initiale en faisait
   902 lignes avant d'être découpée en onze. */
const CODE = /\.(tsx?|mjs|css|sql)$/;
/* Un seul fichier y échappe : supabase/setup.sql, qu'on ne relit ni ne
   modifie. Il met bout à bout les migrations, chacune sous la limite, pour
   qu'on le colle en une fois dans l'éditeur SQL de Supabase, et
   tests/supabase-setup.test.mjs exige qu'il ne soit que cela. */
const GENERATED = new Set(["supabase/setup.sql"]);

test(`aucun fichier de code ne dépasse ${MAX_LINES} lignes`, () => {
  const files = ["src", "tests", "scripts", "supabase"].flatMap((folder) => collectFiles(path.join(PROJECT_ROOT, folder), CODE));
  assert.ok(files.length > 200, `seulement ${files.length} fichiers lus — le test ne vérifie rien`);
  assert.ok(
    files.some((file) => file.endsWith(".sql")),
    "aucune migration lue : le SQL échapperait à la règle",
  );
  const relative = files.map((file) => path.relative(PROJECT_ROOT, file));
  for (const file of GENERATED) assert.ok(relative.includes(file), `${file} n'existe plus : son exemption non plus`);
  const oversized = files
    .map((file) => ({ file: path.relative(PROJECT_ROOT, file), lines: readFileSync(file, "utf8").trimEnd().split("\n").length }))
    .filter(({ file, lines }) => lines > MAX_LINES && !GENERATED.has(file))
    .map(({ file, lines }) => `${file} : ${lines} lignes`);
  assert.deepEqual(oversized, [], `\n  ${oversized.join("\n  ")}\n`);
});
