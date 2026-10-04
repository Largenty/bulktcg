import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { CLIENT_SOURCES, SOURCES, parse, reachableFromClients } from "./client-graph.mjs";
import { SOURCE_ROOT } from "./sources.mjs";

/* Un composant client est rendu deux fois : au serveur (souvent au build,
   pour une page statique) puis dans le navigateur, à l'hydratation. S'il lit
   l'heure ou le hasard pendant le rendu, les deux passes ne produisent pas le
   même texte et React abandonne l'hydratation (erreur #418).

   C'est arrivé sur « Mes annonces » : la ligne d'annonce, composant client,
   écrivait « déposée il y a 3 heures » et décidait « À la une » avec
   Date.now(). Le build et le navigateur n'étaient pas d'accord, et rien ne le
   montrait à l'écran. La règle : ce qui dépend de l'heure se calcule côté
   serveur, ou arrive en prop (`now`), comme dans les formulaires de dépôt.

   C'est arrivé une seconde fois, hors de portée du premier test : l'aperçu
   du dépôt d'une recherche, composant client, rendait la vignette d'une
   demande — un composant partagé, sans "use client" —, qui appelait
   formatAge(date) sans instant, et formatAge lisait Date.now() par défaut.
   « 1 min » au build, « 26 min » dans le navigateur. D'où le second test :
   il suit les imports depuis chaque composant client et refuse tout appel
   qui laisse une fonction lire l'horloge par défaut. */

/* Chacune rend une valeur différente d'un appel à l'autre. */
const IMPURE = [/\bDate\.now\(/, /\bnew Date\(/, /\bMath\.random\(/, /\bcrypto\.randomUUID\(/];

test("des composants clients sont bien trouvés", () => {
  /* Sans ce garde-fou, un changement de directive ferait passer le test à
     vide : aucun fichier examiné, aucune violation. */
  assert.ok(CLIENT_SOURCES.length >= 20, `seulement ${CLIENT_SOURCES.length} composants clients trouvés`);
});

test("aucun composant client ne lit l'heure ni le hasard", () => {
  const violations = CLIENT_SOURCES.flatMap(([file, text]) =>
    IMPURE.filter((pattern) => pattern.test(text)).map((pattern) => `${path.relative(SOURCE_ROOT, file)} : ${pattern.source}`),
  );
  assert.deepEqual(
    violations,
    [],
    "Calculez la valeur côté serveur, ou passez `now` en prop depuis la page.",
  );
});

/* --- Ce que les composants clients rendent, jusqu'au bout des imports --- */

/* Voir client-graph.mjs : les modules qu'un composant client importe, de
   proche en proche, hors imports de type et modules serveur. */

/* Les fonctions du projet dont un paramètre lit l'horloge ou le hasard par
   défaut, et la position de ce paramètre. */
const CLOCK_DEFAULT = /\b(Date\.now\(\)|new Date\(\)|Math\.random\(\)|crypto\.randomUUID\(\)|performance\.now\(\))/;
function clockDefaultedFunctions() {
  const functions = new Map();
  for (const file of SOURCES.keys()) {
    const visit = (node) => {
      const name =
        ts.isFunctionDeclaration(node) && node.name
          ? node.name.text
          : ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
            ? node.name.text
            : null;
      const parameters = ts.isFunctionDeclaration(node) ? node.parameters : node.initializer?.parameters;
      if (name && parameters) {
        const index = parameters.findIndex((parameter) => parameter.initializer && CLOCK_DEFAULT.test(parameter.initializer.getText()));
        if (index >= 0) functions.set(name, { index, file });
      }
      ts.forEachChild(node, visit);
    };
    visit(parse(file));
  }
  return functions;
}

test("rien de ce qu'un composant client rend ne laisse une fonction lire l'horloge par défaut", () => {
  const reached = reachableFromClients();
  /* Le chemin du bug doit être parcouru, sinon le test passerait à vide. */
  for (const expected of ["components/deposit/WantedPreview.tsx", "components/wanted/WantedCard.tsx", "components/listing/ListingCard.tsx", "lib/format.ts"]) {
    assert.ok(reached.has(path.join(SOURCE_ROOT, expected)), `${expected} n'est pas atteint depuis les composants clients`);
  }
  const defaulted = clockDefaultedFunctions();
  const violations = [];
  for (const file of reached) {
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && defaulted.has(node.expression.text)) {
        if (node.arguments.length <= defaulted.get(node.expression.text).index) {
          const { line } = parse(file).getLineAndCharacterOfPosition(node.getStart());
          violations.push(`${path.relative(SOURCE_ROOT, file)}:${line + 1} : ${node.getText().slice(0, 60)}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(parse(file));
  }
  assert.deepEqual(violations, [], "Passez l'instant (`now`) : la valeur par défaut lit l'horloge, et le build et l'hydratation ne sont plus d'accord.");
});

test("aucune fonction à portée d'un composant client ne lit l'horloge par défaut", () => {
  /* Plus strict que le test précédent, et tenable depuis que lib/format et
     lib/listing-display exigent leur instant : une valeur par défaut qui lit
     l'horloge est un #418 qui attend son premier appel sans argument. */
  const reached = reachableFromClients();
  const offenders = [...clockDefaultedFunctions()]
    .filter(([, { file }]) => reached.has(file))
    .map(([name, { file }]) => `${path.relative(SOURCE_ROOT, file)} : ${name}`);
  assert.deepEqual(offenders, [], "Rendez l'instant obligatoire : chaque appelant le passe.");
});
