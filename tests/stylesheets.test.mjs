import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* Les classes de base vivaient dans un seul fichier de 1 848 lignes. Elles
   sont réparties en feuilles thématiques, que globals.css importe dans
   l'ordre de la cascade. Une feuille ajoutée sans son import ne produirait
   aucune erreur : ses classes ne s'appliqueraient simplement pas, et rien à
   l'écran ne dirait pourquoi. */

const GLOBALS = path.join(SOURCE_ROOT, "app", "globals.css");
const IMPORTS = [...readFileSync(GLOBALS, "utf8").matchAll(/^@import "(\.[^"]+)";/gm)].map((match) =>
  path.resolve(path.dirname(GLOBALS), match[1]),
);

test("chaque feuille de src/styles est importée par globals.css, une seule fois", () => {
  const sheets = collectFiles(path.join(SOURCE_ROOT, "styles"), /\.css$/);
  assert.ok(sheets.length > 5, `seulement ${sheets.length} feuilles trouvées — le test ne vérifie rien`);
  const missing = sheets.filter((sheet) => !IMPORTS.includes(sheet)).map((sheet) => path.relative(SOURCE_ROOT, sheet));
  assert.deepEqual(missing, [], "feuilles jamais importées");
  assert.equal(new Set(IMPORTS).size, IMPORTS.length, "une feuille est importée deux fois");
});

test("chaque import de globals.css désigne une feuille qui existe", () => {
  const broken = IMPORTS.filter((file) => !existsSync(file)).map((file) => path.relative(SOURCE_ROOT, file));
  assert.deepEqual(broken, []);
});
