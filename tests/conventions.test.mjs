import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { SOURCE_ROOT, collectFiles, stringsIn } from "./sources.mjs";

/* Les deux premières règles de CLAUDE.md, qu'aucun test ne tenait. Elles
   étaient respectées : c'est justement le moment de les tenir, avant que la
   première exception passe inaperçue — celle des tailles en dur, écrite et
   jamais vérifiée, avait fini démentie 162 fois. */

const CODE_FILES = collectFiles(SOURCE_ROOT, /\.tsx?$/);
const MOCK_ROOT = path.join(SOURCE_ROOT, "lib", "mock");
const DATA_ROOT = path.join(SOURCE_ROOT, "lib", "data");
const isUnder = (file, root) => file.startsWith(`${root}${path.sep}`) || file === root;
const relative = (file) => path.relative(SOURCE_ROOT, file);

const parse = (file, text = readFileSync(file, "utf8")) => ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

/* Ce qu'un fichier importe, tel qu'il l'écrit : imports, réexports et
   import() dynamiques. */
function importSpecifiers(file, text) {
  const specifiers = [];
  const visit = (node) => {
    const target = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier : null;
    if (target && ts.isStringLiteral(target)) specifiers.push(target.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const [argument] = node.arguments;
      if (argument && ts.isStringLiteral(argument)) specifiers.push(argument.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(file, text));
  return specifiers;
}

/* Les modules du projet qu'un fichier importe, résolus en chemins : l'alias
   @/ et les chemins relatifs. */
function importedPaths(file, text) {
  return importSpecifiers(file, text).flatMap((specifier) => {
    if (specifier.startsWith("@/")) return [path.join(SOURCE_ROOT, specifier.slice(2))];
    if (specifier.startsWith(".")) return [path.resolve(path.dirname(file), specifier)];
    return [];
  });
}

test("règle 1 : seul lib/data/source.ts lit les données de démonstration", () => {
  /* Un composant, une page ou une action qui importerait lib/mock
     contournerait la seule frontière avec la source de données : le jour
     de la bascule, il continuerait de lire les données factices. Et dans
     lib/data même, un seul fichier sait d'où viennent les lignes : c'est
     là que la base se branche, et nulle part ailleurs. */
  const source = path.join(DATA_ROOT, "source.ts");
  const offenders = CODE_FILES.filter((file) => file !== source && !isUnder(file, MOCK_ROOT))
    .filter((file) => importedPaths(file).some((imported) => isUnder(imported, MOCK_ROOT)))
    .map(relative);
  assert.deepEqual(offenders, []);
});

test("le détecteur d'imports voit l'alias, le relatif, le réexport et l'import dynamique", () => {
  const sample = path.join(SOURCE_ROOT, "components", "listing", "Sample.tsx");
  const imported = importedPaths(
    sample,
    `import { a } from "@/lib/mock/listings.mock";
     export { b } from "../../lib/mock/seed";
     const c = await import("@/lib/mock/profiles.mock");
     import { d } from "@/lib/data/listings";`,
  );
  assert.equal(imported.length, 4);
  assert.equal(imported.filter((file) => isUnder(file, MOCK_ROOT)).length, 3);
});

/* Le client Supabase : un module le crée, lib/data/supabase.ts, et deux
   seulement le prennent — source.ts, qui le distribue à la couche données,
   et le proxy, qui rafraîchit la session. Un composant ou une page qui
   importerait @supabase/* lirait la base sans passer par la frontière. */
const SUPABASE_CLIENTS = path.join(DATA_ROOT, "supabase.ts");
const SUPABASE_IMPORTERS = new Set([path.join(DATA_ROOT, "source.ts"), path.join(SOURCE_ROOT, "proxy.ts")]);

function supabaseOffenders(files, read = (file) => readFileSync(file, "utf8")) {
  return files.flatMap((file) => {
    const text = read(file);
    const importsPackage = file !== SUPABASE_CLIENTS && importSpecifiers(file, text).some((specifier) => specifier.startsWith("@supabase/"));
    const importsClients = !SUPABASE_IMPORTERS.has(file) && importedPaths(file, text).includes(SUPABASE_CLIENTS.replace(/\.ts$/, ""));
    return importsPackage || importsClients ? [relative(file)] : [];
  });
}

test("règle 1 : seul lib/data/supabase.ts importe @supabase/*, et seuls source.ts et le proxy l'importent", () => {
  assert.deepEqual(supabaseOffenders(CODE_FILES), []);
});

test("le détecteur voit un client Supabase importé hors de la frontière", () => {
  const samples = new Map([
    [path.join(SOURCE_ROOT, "components", "listing", "Sample.tsx"), `import { createClient } from "@supabase/supabase-js";`],
    [path.join(SOURCE_ROOT, "app", "sample", "page.tsx"), `const { createAdminClient } = await import("@/lib/data/supabase");`],
    [path.join(DATA_ROOT, "listings-sample.ts"), `export { createServerClient } from "@supabase/ssr";`],
    [path.join(DATA_ROOT, "source.ts"), `import { createUserClient } from "@/lib/data/supabase";`],
    [path.join(SOURCE_ROOT, "proxy.ts"), `import { refreshSession } from "./lib/data/supabase";`],
  ]);
  assert.deepEqual(supabaseOffenders([...samples.keys()], (file) => samples.get(file)), [
    "components/listing/Sample.tsx",
    "app/sample/page.tsx",
    "lib/data/listings-sample.ts",
  ]);
});

/* Les lectures : un module de lib/data lit ses lignes par les chargeurs de
   source.ts, jamais par un client. Une requête écrite dans un module lirait
   la base sans passer par la démonstration — les tests ne la verraient plus —
   et sans les tris de visibilité qui doublent la RLS. Les écritures, elles,
   reçoivent leur client de performWrite (write-seam.ts).

   La liste se déduit du dossier, pour qu'un module ajouté y entre de
   lui-même : écrite à la main, elle avait laissé passer account-settings.ts.
   Sont écartés ceux dont c'est le rôle de tenir un client — la source, les
   clients et la conversion de leurs réponses, la couture des écritures et
   les écritures, la session, qui lit les jetons d'Auth et non des lignes —,
   et deux fichiers sans lecture : le résultat d'une écriture et les
   étiquettes du cache. */
const NOT_READ_MODULES = [/^source\.ts$/, /^supabase.*\.ts$/, /^write-seam\.ts$/, /^mutation-result\.ts$/, /^cache-tags\.ts$/, /-mutations\.ts$/, /^session\.ts$/];

function readModules(files) {
  return files.filter(
    (file) => isUnder(file, DATA_ROOT) && !NOT_READ_MODULES.some((pattern) => pattern.test(path.relative(DATA_ROOT, file).split(path.sep).join("/"))),
  );
}

const READ_MODULES = readModules(CODE_FILES);
const CLIENTS = new Set(["publicClient", "userClient", "adminClient"]);

function queriesIn(file, text) {
  const found = [];
  const visit = (node) => {
    if (ts.isIdentifier(node) && CLIENTS.has(node.text)) found.push(node.text);
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["from", "rpc"].includes(node.expression.name.text) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push(`.${node.expression.name.text}("${node.arguments[0].text}")`);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(file, text));
  return found;
}

test("règle 1 : un module de lecture lit par les chargeurs de source.ts, jamais par un client", () => {
  for (const name of ["listings.ts", "account-settings.ts", "mappers/listings.ts"]) {
    assert.ok(READ_MODULES.includes(path.join(DATA_ROOT, name)), `${name} échappe à la règle`);
  }
  assert.deepEqual(READ_MODULES.flatMap((file) => queriesIn(file).map((query) => `${relative(file)} : ${query}`)), []);
});

test("un module de lecture ajouté entre dans la règle ; la source, les clients et les écritures non", () => {
  const added = ["favorites.ts", "favorite-mutations.ts", "supabase-cache.ts"].map((name) => path.join(DATA_ROOT, name));
  const modules = readModules([...CODE_FILES, ...added]);
  assert.ok(modules.includes(path.join(DATA_ROOT, "favorites.ts")), "un module de lecture ajouté échappe à la règle");
  for (const name of ["favorite-mutations.ts", "supabase-cache.ts", "source.ts", "write-seam.ts", "session.ts"]) {
    assert.ok(!modules.includes(path.join(DATA_ROOT, name)), `${name} est pris pour un module de lecture`);
  }
});

test("le détecteur voit un client et une requête, pas un Array.from", () => {
  const sample = `import { userClient } from "@/lib/data/source";
    const rows = await (await userClient()).from("listings").select("*");
    const counts = await client.rpc("pro_only_count_by_game");
    const copy = Array.from(rows);`;
  assert.deepEqual(queriesIn(path.join(DATA_ROOT, "listings.ts"), sample), [
    "userClient",
    '.from("listings")',
    "userClient",
    '.rpc("pro_only_count_by_game")',
  ]);
});

/* La conversion des réponses de Supabase fait partie de la frontière : seul
   source.ts la prend. */
const ROW_CONVERSIONS = path.join(DATA_ROOT, "supabase-rows");

function conversionOffenders(files, read = (file) => readFileSync(file, "utf8")) {
  return files
    .filter((file) => file !== path.join(DATA_ROOT, "source.ts") && importedPaths(file, read(file)).includes(ROW_CONVERSIONS))
    .map(relative);
}

test("règle 1 : seul source.ts convertit les réponses de Supabase", () => {
  assert.deepEqual(conversionOffenders(CODE_FILES), []);
});

test("le détecteur voit une conversion importée hors de source.ts", () => {
  const samples = new Map([
    [path.join(DATA_ROOT, "listings.ts"), `import { toListingRowWithRelations } from "@/lib/data/supabase-rows";`],
    [path.join(DATA_ROOT, "source.ts"), `import { toListingRowWithRelations } from "@/lib/data/supabase-rows";`],
  ]);
  assert.deepEqual(conversionOffenders([...samples.keys()], (file) => samples.get(file)), ["lib/data/listings.ts"]);
});

/* Règle 2 : aucune valeur hexadécimale hors des tokens. Les deux
   exceptions documentées : Satori ne lit pas les variables CSS, et les
   couleurs d'une marque tierce ne suivent pas notre palette. */
const HEX_COLOR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z])/i;
const DOCUMENTED_EXCEPTIONS = new Set(["lib/og-colors.ts", "lib/brand-colors.ts"]);

test("règle 2 : aucune couleur hexadécimale dans le code, hors des deux exceptions documentées", () => {
  /* Les chaînes seulement, lues dans l'arbre syntaxique : un commentaire
     qui cite « React #418 » n'est pas une couleur. */
  const offenders = CODE_FILES.filter((file) => !DOCUMENTED_EXCEPTIONS.has(relative(file).split(path.sep).join("/")))
    .filter((file) => HEX_COLOR.test(stringsIn(parse(file))))
    .map(relative);
  assert.deepEqual(offenders, []);
});

test("règle 2 : les feuilles de style passent par les tokens, qui seuls portent les valeurs", () => {
  const sheets = [...collectFiles(path.join(SOURCE_ROOT, "styles"), /\.css$/), path.join(SOURCE_ROOT, "app", "globals.css")];
  assert.ok(sheets.length > 5, "aucune feuille lue : le test ne vérifierait rien");
  const offenders = sheets
    .filter((file) => relative(file) !== path.join("styles", "tokens.css"))
    .filter((file) => HEX_COLOR.test(readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")))
    .map(relative);
  assert.deepEqual(offenders, []);
});

const parseSample = (text) => ts.createSourceFile("Sample.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

test("le détecteur de couleurs voit le cas d'école, et ignore commentaires et ancres", () => {
  assert.ok(HEX_COLOR.test(stringsIn(parseSample(`const a = <p style={{ color: "#c0ffee" }} />;`))));
  assert.ok(HEX_COLOR.test(stringsIn(parseSample("const b = `border: 1px solid #fff`;"))));
  /* « #418 » a la forme d'une couleur : c'est parce que seules les chaînes
     sont lues que le commentaire qui cite l'erreur de React passe. */
  const harmless = parseSample(`/* React #418 */ const href = "#recherches"; const tab = "#ventes";`);
  assert.ok(!HEX_COLOR.test(stringsIn(harmless)));
});
