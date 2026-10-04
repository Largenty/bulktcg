import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { SOURCE_ROOT, collectFiles, stringsIn } from "./sources.mjs";

/* Un texte prend la largeur de son parent. Un paragraphe bridé à 62ch ou un
   titre à 20ch dans une colonne qui en offre le double laissent un vide à
   droite, désalignent les blocs d'une même page, et c'est l'erreur qui
   revenait le plus : la manchette de l'accueil tenait dans 20 caractères,
   la phrase d'accroche perchée à côté. Quand une mesure doit être limitée,
   c'est la mise en page qui la limite — une colonne de grille, un gabarit
   de page — jamais l'élément de texte. max-w-full et max-w-none restent
   permis : ils ne font que dire « la largeur du parent ». */

const TEXT_ELEMENTS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "dt", "dd", "span", "label", "legend",
  "blockquote", "figcaption", "small", "strong", "em", "a", "code", "output",
  /* Composants qui rendent un titre ou un lien. */
  "Heading", "Link",
]);

const FORBIDDEN = /(?:^|[\s:])(max-w-(?!full\b|none\b)[^\s"'`]+)/g;

/* Une largeur comptée en caractères ne bride qu'un texte, quel que soit
   l'élément qui la porte : un div à 68ch autour d'une description laissait un
   tiers de sa carte vide, et le test ne regardait que les balises de texte. */
const CHARACTER_MEASURE = /(?:^|[\s:])(max-w-\[[\d.]+ch\])/g;

/* Un fichier de page ne bride pas son gabarit : il prend toute la largeur du
   conteneur, et limite la mesure par des colonnes. Sept pages s'arrêtaient à
   760, 800, 860, 880, 1 040 ou 1 080 px et laissaient jusqu'à la moitié d'un
   grand écran vide. */
const ROUTE_FILE = /[\\/]app[\\/].*\.tsx$/;

/* Sauf les images de partage et les icônes : des dessins de taille fixe que
   Satori compose, pas des pages qu'un écran met en largeur. */
const IMAGE_ROUTE = /[\\/](opengraph-image|twitter-image|icon|apple-icon)\.tsx$/;

/* Un style en ligne bride autant qu'une classe : global-error.tsx tenait son
   texte à 480 px par style={{ maxWidth }}, et le test ne lisait que
   className. Les mêmes règles, sur les propriétés qui bornent une largeur ;
   « 100% » et « none » disent seulement « la largeur du parent ». */
const INLINE_MEASURES = new Set(["maxWidth", "maxInlineSize"]);
const PARENT_WIDTH = new Set(["100%", "none"]);

function inlineMeasures(initializer) {
  const expression = ts.isJsxExpression(initializer) ? initializer.expression : undefined;
  if (!expression || !ts.isObjectLiteralExpression(expression)) return [];
  return expression.properties.filter(ts.isPropertyAssignment).flatMap((property) => {
    const name = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) ? property.name.text : null;
    if (!name || !INLINE_MEASURES.has(name)) return [];
    const literal = ts.isStringLiteral(property.initializer) || ts.isNoSubstitutionTemplateLiteral(property.initializer);
    const value = literal ? property.initializer.text : property.initializer.getText();
    return PARENT_WIDTH.has(value) ? [] : [{ name, value }];
  });
}

function offendersIn(file, { isRoute = ROUTE_FILE.test(file) && !IMAGE_ROUTE.test(file) } = {}) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const offenders = [];
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const rule = TEXT_ELEMENTS.has(tag) || isRoute ? FORBIDDEN : CHARACTER_MEASURE;
      const where = `${path.relative(SOURCE_ROOT, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} <${tag}>`;
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue;
        const name = attribute.name.getText(source);
        if (name === "className") {
          for (const [, utility] of stringsIn(attribute.initializer).matchAll(rule)) offenders.push(`${where} ${utility}`);
        } else if (name === "style") {
          for (const measure of inlineMeasures(attribute.initializer)) {
            if (rule === FORBIDDEN || /^[\d.]+ch$/.test(measure.value)) offenders.push(`${where} style ${measure.name}: ${measure.value}`);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return offenders;
}

test("aucun élément de texte ne porte de largeur maximale : il prend celle de son parent", () => {
  const offenders = collectFiles(SOURCE_ROOT, /\.tsx$/).flatMap(offendersIn);
  assert.deepEqual(offenders, [], `\n  ${offenders.join("\n  ")}\n`);
});

test("le détecteur de largeur voit bien le cas d'école", () => {
  const sample = path.join(import.meta.dirname, "stubs", "text-width-sample.tsx");
  const offenders = offendersIn(sample, { isRoute: false });
  assert.equal(
    offenders.length,
    6,
    `attendu : le titre, le paragraphe, le lien, le div à 68ch, et en ligne le paragraphe et la mesure en caractères — lu : ${offenders.join(", ")}`,
  );
  /* Lu comme une page, le gabarit à 820 px est refusé lui aussi, en classe
     comme en ligne. */
  assert.equal(offendersIn(sample, { isRoute: true }).length, 8);
  /* Une image de partage n'est pas une page : son style en ligne compose un
     dessin de 1 200 × 630 px. */
  assert.ok(!IMAGE_ROUTE.test(path.join(SOURCE_ROOT, "app", "global-error.tsx")));
  assert.ok(IMAGE_ROUTE.test(path.join(SOURCE_ROOT, "app", "opengraph-image.tsx")));
});
