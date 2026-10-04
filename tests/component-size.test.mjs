import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* Règle 7 : 150 lignes au plus par composant — un composant fait une chose.
   Elle était écrite et rien ne la tenait : une liste déroulante en comptait
   164, la page d'une ville 193, et six fichiers de page dépassaient. Les
   fichiers de page sont des composants comme les autres ; quand ils
   grossissent, c'est qu'une section veut son propre composant. */

const MAX_LINES = 150;

test(`aucun composant ne dépasse ${MAX_LINES} lignes`, () => {
  const oversized = collectFiles(SOURCE_ROOT, /\.tsx$/)
    .map((file) => ({ file: path.relative(SOURCE_ROOT, file), lines: readFileSync(file, "utf8").trimEnd().split("\n").length }))
    .filter(({ lines }) => lines > MAX_LINES)
    .map(({ file, lines }) => `${file} : ${lines} lignes`);
  assert.deepEqual(oversized, [], `\n  ${oversized.join("\n  ")}\n`);
});
