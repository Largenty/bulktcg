import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { collectSources, findGaps } from "../scripts/french-spacing.mjs";

/* En français, « ? », « ! », « ; » et « : » prennent une espace insécable
   avant eux, et les guillemets une à l'intérieur. Avec une espace ordinaire,
   le navigateur peut couper la ligne juste avant : on a vu « Professionnels
   uniquement » finir avec son « » » seul en tête de la ligne suivante. Le
   site n'en posait qu'une, sur « grenier ? ».

   Seuls les textes sont examinés, par l'arbre syntaxique TypeScript : le code
   n'est jamais touché. `node scripts/french-spacing.mjs --write` corrige. */
test("les textes du site portent les espaces insécables du français", () => {
  const root = path.resolve(import.meta.dirname, "..", "src");
  const gaps = collectSources().flatMap((file) =>
    findGaps(file).edits.map((edit) => `${path.relative(root, file)}:${edit.line}  ${edit.raw.trim().slice(0, 60)}`),
  );
  assert.deepEqual(gaps, [], "Lancez node scripts/french-spacing.mjs --write");
});
