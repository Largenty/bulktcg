import assert from "node:assert/strict";
import test from "node:test";
import { diagnosticCodesFor } from "./compile.mjs";

/* Un accès indexé — le rang d'un tableau, la clé d'un dictionnaire, le
   groupe d'une expression régulière — peut ne rien trouver.
   noUncheckedIndexedAccess (tsconfig.json) le type « … | undefined », et le
   compilateur oblige à dire quoi faire alors : une liste de longueur fixe,
   une déstructuration qui traite l'absence, un parcours for…of plutôt qu'un
   indice. C'est lui qui a montré moveItem insérant une photo fantôme
   (tests/photo-files.test.mjs).

   Ce test tient l'option elle-même : retirée, les erreurs se tairaient au
   lieu d'être corrigées. Comme tests/deprecations.test.mjs pour le lint, le
   texte d'un vrai fichier, retouché, est compilé avec les options du
   projet ; rien n'est écrit sur le disque. */

const appended = (code) => (text) => `${text}\n${code}\n`;

test("le compilateur refuse un accès indexé dont l'absence n'est pas traitée", () => {
  const file = "src/lib/photo-files.ts";
  assert.deepEqual(diagnosticCodesFor(file), [], `${file} ne compile pas tel quel`);
  const cases = [
    /* L'ancien moveItem : splice ne rend rien pour un rang hors de la liste. */
    [
      "un élément retiré par splice",
      "export function legacyMoveItem<T>(items: T[], from: number, to: number): T[] {\n  const next = [...items];\n  const [item] = next.splice(from, 1);\n  next.splice(to, 0, item);\n  return next;\n}",
      2345,
    ],
    [
      "la clé d'un dictionnaire",
      'const LABELS: Record<string, string> = { lot: "Lot" };\nexport const labelOf = (key: string): string => LABELS[key];',
      2322,
    ],
  ];
  for (const [what, code, expected] of cases) {
    assert.deepEqual(diagnosticCodesFor(file, appended(code)), [expected], what);
  }
});
