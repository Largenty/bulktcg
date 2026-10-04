/* Lecture des sources, pour les tests qui relisent le code lui-même (pas de
   suffixe .test : le lanceur ne l'exécute pas). Six tests recopiaient le même
   parcours de dossiers, chacun avec son filtre, et deux la même collecte de
   chaînes dans l'arbre syntaxique. */
import { readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

export const SOURCE_ROOT = path.resolve(import.meta.dirname, "..", "src");

/* Les fichiers d'un dossier et de ses sous-dossiers dont le nom répond au
   motif. */
export function collectFiles(directory, pattern) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && pattern.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/* Les chaînes littérales d'un nœud, gabarits compris, mises bout à bout :
   tout ce qu'un attribut className peut contenir, branches et expressions
   imbriquées comprises. */
export function stringsIn(node) {
  const found = [];
  const visit = (child) => {
    if (ts.isStringLiteral(child) || ts.isNoSubstitutionTemplateLiteral(child)) found.push(child.text);
    else if (ts.isTemplateExpression(child)) {
      found.push(child.head.text, ...child.templateSpans.map((span) => span.literal.text));
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found.join(" ");
}
