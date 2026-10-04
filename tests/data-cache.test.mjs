import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* CLAUDE.md : une lecture de lib/data/ à clé scalaire est enveloppée dans
   cache(). generateMetadata et la page demandent la même chose, l'en-tête
   et l'accueil aussi — le compte des annonces par jeu était lu deux fois
   dans le même rendu de l'accueil, et le serait par deux requêtes en
   phase 2. La règle était écrite et rien ne la tenait.

   Est « à clé scalaire » une lecture exportée — asynchrone — dont tous les
   paramètres sont des chaînes, des nombres, des booléens ou null, ou qui
   n'en a aucun. Celles qui prennent un objet de requête en sont exemptes :
   leur argument change d'identité à chaque appel, la mémoïsation ne
   prendrait jamais. C'est le typeur qui le dit, pas le nom du type : un
   GameId est une chaîne, un ListingQuery un objet. */

const DATA_ROOT = path.join(SOURCE_ROOT, "lib", "data");

/* Les modules de lecture : tout lib/data sauf les écritures. */
const READ_MODULES = collectFiles(DATA_ROOT, /\.ts$/).filter(
  (file) => path.dirname(file) === DATA_ROOT && !file.endsWith("-mutations.ts"),
);

/* Exemptions, chacune avec sa raison. */
const EXEMPT = new Map([
  ["session.ts#requireCurrentUserId", "ne lit rien : délègue à getCurrentUserId, déjà en cache, puis redirige"],
]);

const SCALAR = ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined;
const isScalar = (type) => (type.isUnion() ? type.types.every(isScalar) : (type.flags & SCALAR) !== 0);

function findUncachedReads() {
  const program = ts.createProgram(READ_MODULES, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
    /* Sans baseUrl, que TypeScript 6 déprécie : un chemin absolu ne dépend
       d'aucune base. */
    paths: { "@/*": [path.join(SOURCE_ROOT, "*")] },
  });
  const checker = program.getTypeChecker();
  const findings = [];

  for (const file of READ_MODULES) {
    const source = program.getSourceFile(file);
    for (const statement of source.statements) {
      const isExported = ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export;
      if (!isExported || !ts.isFunctionDeclaration(statement) || !statement.name) continue;
      const signature = checker.getSignatureFromDeclaration(statement);
      const returned = checker.typeToString(checker.getReturnTypeOfSignature(signature));
      if (!returned.startsWith("Promise<")) continue;

      const key = `${path.basename(file)}#${statement.name.text}`;
      if (EXEMPT.has(key)) continue;
      const scalarKeyed = statement.parameters.every((parameter) => isScalar(checker.getTypeAtLocation(parameter)));
      if (scalarKeyed) findings.push(key);
    }
  }
  return findings;
}

test("les modules de lecture de lib/data sont bien trouvés", () => {
  const names = READ_MODULES.map((file) => path.basename(file));
  for (const expected of ["listings.ts", "wanted.ts", "profiles.ts", "deals.ts", "conversations.ts"]) {
    assert.ok(names.includes(expected), `${expected} n'est pas lu : le test ne vérifierait rien`);
  }
});

test("toute lecture de lib/data à clé scalaire passe par cache()", () => {
  const findings = findUncachedReads();
  assert.deepEqual(
    findings,
    [],
    `\n  Enveloppez-les : export const lecture = cache(async (…) => …)\n  ${findings.join("\n  ")}\n`,
  );
});
