import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { ESLint } from "eslint";
import { ROOT, diagnosticCodesFor, projectOptions } from "./compile.mjs";

/* « Aucune API dépréciée » tient par le lint typé (eslint.config.mjs) :
   React, Next, Zod, Node, TypeScript et Playwright marquent @deprecated ce
   qu'ils vont retirer, et la règle le lit dans leurs types. Ce test tient la
   règle elle-même, de deux façons.

   Elle couvre l'application, les tests, les scripts et le banc SQL : un
   « files » rétréci la ferait taire sans bruit.

   Elle voit réellement un appel déprécié, dans chacun de ces dossiers.
   Cela n'arrive que si les types sont lus — sans eux, un schéma Zod ou une
   page Playwright ne sont qu'un « any », et tout passe. Même chose pour les
   deux règles du projet qui la complètent : la clé dépréciée d'un objet
   (bulktcg/no-deprecated-keys), et ce que Playwright déconseille sans le
   déprécier (bulktcg/playwright-locators).

   Rien n'est écrit sur le disque : le texte d'un vrai fichier, retouché,
   est remis au lint à sa place. Une retouche qui ne change rien — son motif
   a quitté le fichier — fait échouer le cas : celui qui n'attend aucun
   signalement passerait sinon à vide, et les autres échoueraient en
   accusant la règle.

   Il tient enfin les deux options que tsconfig.json impose pour le retrait
   de types de Node (CLAUDE.md, règle 15), et la règle de lint qui en
   découle. */

const eslint = new ESLint({ cwd: ROOT });

async function rulesReportedFor(file, edit) {
  const filePath = path.join(ROOT, file);
  const original = readFileSync(filePath, "utf8");
  const text = edit(original);
  assert.notEqual(text, original, `${file} : la retouche n'a rien changé — le motif qu'elle cherche a quitté le fichier`);
  const [result] = await eslint.lintText(text, { filePath });
  return result.messages.map((message) => message.ruleId);
}

const appended = (line) => (text) => `${text}\n${line}\n`;
const count = (rules, rule) => rules.filter((candidate) => candidate === rule).length;

test("la règle couvre l'application, les tests, les scripts et le banc SQL", async () => {
  for (const file of ["src/app/page.tsx", "src/lib/format.ts", "next.config.ts", "tests/format.test.mjs", "scripts/smoke/harness.mjs", "scripts/screenshot.mjs", "supabase/tests/run.mjs"]) {
    const config = await eslint.calculateConfigForFile(path.join(ROOT, file));
    assert.deepEqual(config.rules["@typescript-eslint/no-deprecated"], [2], file);
    assert.equal(config.languageOptions.parserOptions.projectService, true, `${file} : lint sans les types`);
  }
  for (const file of ["src/app/page.tsx", "tests/format.test.mjs", "scripts/smoke/harness.mjs"]) {
    const config = await eslint.calculateConfigForFile(path.join(ROOT, file));
    assert.deepEqual(config.rules["bulktcg/no-deprecated-keys"], [2], file);
  }
  for (const file of ["scripts/smoke/harness.mjs", "scripts/screenshot.mjs"]) {
    const config = await eslint.calculateConfigForFile(path.join(ROOT, file));
    assert.deepEqual(config.rules["bulktcg/playwright-locators"], [2], file);
  }
  for (const file of ["src/app/page.tsx", "src/lib/format.ts", "next.config.ts"]) {
    const config = await eslint.calculateConfigForFile(path.join(ROOT, file));
    assert.deepEqual(config.rules["@typescript-eslint/no-import-type-side-effects"], [2], file);
  }
});

test("le lint voit une API dépréciée, dans chacun des dossiers", async () => {
  const cases = [
    ["Zod", "src/lib/schemas/fields.ts", appended("export const legacyEmail = z.string().email();")],
    ["React", "src/components/deposit/useWantedSubmit.ts", appended("export type LegacySubmit = React.FormEvent<HTMLFormElement>;")],
    ["Next, une prop de composant", "src/components/ui/IntentLink.tsx", (text) => text.replace("{...props}", "{...props}\n      legacyBehavior")],
    ["Node", "tests/sources.mjs", appended('import { parse } from "node:url";\nparse("https://bulktcg.example/");')],
    ["Playwright", "scripts/smoke/harness.mjs", appended("await page.waitForNavigation();")],
    ["Node, dans le banc SQL", "supabase/tests/run.mjs", appended('import { parse as parseUrl } from "node:url";\nparseUrl("https://bulktcg.example/");')],
  ];
  for (const [library, file, edit] of cases) {
    const rules = await rulesReportedFor(file, edit);
    assert.equal(count(rules, "@typescript-eslint/no-deprecated"), 1, `${library} (${file}) : ${rules.join(", ") || "rien"}`);
  }
});

test("le lint voit une clé dépréciée, que typescript-eslint laisse passer", async () => {
  /* typescript-eslint compare la clé à l'objet écrit ; bulktcg/no-deprecated-keys
     la compare au type attendu, qui porte la dépréciation. */
  const cases = [
    ["Zod, `message` au lieu de `error`", "src/lib/schemas/fields.ts", appended('export const legacyMessage = z.string().min(1, { message: "Requis." });')],
    ["Next, `themeColor` dans les métadonnées", "src/app/pro/page.tsx", (text) => text.replace("export const metadata: Metadata = {", 'export const metadata: Metadata = {\n  themeColor: "#000000",')],
    ["Playwright, une option de lancement", "scripts/smoke/harness.mjs", appended("await chromium.launch({ logger: { isEnabled: () => false, log: () => undefined } });")],
    [
      "une union avec string, dont le membre objet déprécie la clé",
      "src/lib/format.ts",
      appended(
        'type LegacyTarget =\n  | string\n  | {\n      /** @deprecated Utiliser `href`. */\n      url?: string;\n      href?: string;\n    };\nexport const legacyTarget = (target: LegacyTarget) => target;\nlegacyTarget({ url: "/x" });',
      ),
    ],
  ];
  for (const [what, file, edit] of cases) {
    const rules = await rulesReportedFor(file, edit);
    assert.equal(count(rules, "bulktcg/no-deprecated-keys"), 1, `${what} (${file}) : ${rules.join(", ") || "rien"}`);
  }
});

test("le lint ne prête pas à un objet les méthodes dépréciées d'une chaîne", async () => {
  /* String.prototype.link est dépréciée. `{ link }` remis à
     `string | { link: string }` vise le membre objet de l'union, que rien ne
     déprécie : seul ce membre peut recevoir un littéral objet. */
  const rules = await rulesReportedFor(
    "src/lib/format.ts",
    appended('export const legacyTarget = (target: string | { link: string }) => target;\nlegacyTarget({ link: "/x" });'),
  );
  assert.equal(count(rules, "bulktcg/no-deprecated-keys"), 0, rules.join(", "));
});

test("le lint refuse un import de type qui chargerait quand même son module", async () => {
  /* Sous verbatimModuleSyntax, `import { type A } from "…"` s'efface en
     `import "…"` : un composant client tirerait ainsi un module serveur dans
     son paquet. */
  const rules = await rulesReportedFor(
    "src/lib/format.ts",
    appended('import { type ListingStatus as LegacyStatus } from "@/types/listing";\nexport type LegacyFormatStatus = LegacyStatus;'),
  );
  assert.equal(count(rules, "@typescript-eslint/no-import-type-side-effects"), 1, rules.join(", "));
});

test("tsconfig.json impose verbatimModuleSyntax et erasableSyntaxOnly, et le compilateur s'y tient", () => {
  /* Les tests chargent le TypeScript par le retrait de types de Node, qui ne
     sait effacer ni un enum ni un import de type écrit sans « type ». */
  const options = projectOptions();
  assert.equal(options.verbatimModuleSyntax, true, "verbatimModuleSyntax");
  assert.equal(options.erasableSyntaxOnly, true, "erasableSyntaxOnly");
  const cases = [
    ["un enum, que le retrait de types ne sait pas effacer", "export enum LegacyStatus {\n  Available,\n}", 1294],
    [
      "un type importé sans « type », que Node chercherait à l'exécution",
      'import { ListingStatus as LegacyStatus } from "@/types/listing";\nexport const legacyStatus = (status: LegacyStatus) => status;',
      1484,
    ],
  ];
  for (const [what, code, expected] of cases) {
    assert.deepEqual(diagnosticCodesFor("src/lib/format.ts", appended(code)), [expected], what);
  }
});

test("le lint voit ce que Playwright déconseille : sélecteur, attente fixe, ElementHandle, networkidle", async () => {
  const rules = await rulesReportedFor(
    "scripts/smoke/helpers.mjs",
    appended(`/** @param {Page} tab */
export async function legacy(tab) {
  await tab.fill("#title", "Classeur");
  await tab.waitForSelector("text=Publier");
  await tab.waitForTimeout(100);
  await tab.locator("#title").elementHandle();
  await tab.waitForLoadState("networkidle");
  await tab.goto("/annonces", { waitUntil: "networkidle" });
  await tab.waitForLoadState("load");
  await tab.locator("#title").fill("Classeur");
}`),
  );
  assert.equal(count(rules, "bulktcg/playwright-locators"), 6, rules.join(", "));
});
