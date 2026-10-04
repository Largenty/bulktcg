import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { SOURCE_ROOT, collectFiles, stringsIn } from "./sources.mjs";

/* Un texte posé sur un aplat prend l'encre de l'aplat, pas celle de la page.
   La craie sur un aplat d'encre tenait 16:1 en clair et tombait à 1,00:1 en
   sombre, où l'encre devient claire : le bouton principal, le compteur de
   messages, la case cochée devenaient des rectangles muets. L'audit de
   contraste mesure les paires de tokens ; ce test vérifie que les composants
   emploient la bonne paire — --on-ink sur --ink, --on-chalk sur --chalk.

   Un aplat et son texte peuvent vivre dans deux chaînes d'un même tableau de
   classes (la case à cocher) : on raisonne donc par attribut className
   entier, et par valeur de propriété dans un dictionnaire de styles. */

/* Un variant d'état (aria-pressed:, hover:, peer-checked:) compte comme
   l'état de base : l'aplat d'un bouton pressé porte le même texte. */
const withoutVariants = (text) => text.replace(/[a-z-]+:(?=bg-|text-)/g, "");

/* Aplat → textes interdits dessus. */
const RULES = [
  { fill: /(?<![a-z-])bg-\[var\(--ink(?:-soft)?\)\]/, text: /(?<![a-z-])text-\[var\(--chalk(?:-soft|-muted)?\)\]/, fix: "--on-ink" },
  { fill: /(?<![a-z-])bg-\[var\(--chalk\)\]/, text: /(?<![a-z-])text-\[var\(--ink(?:-soft)?\)\]/, fix: "--on-chalk" },
];

/* Les groupes de classes d'un fichier : chaque attribut className, et chaque
   valeur d'un dictionnaire de styles (TONE_STYLE, TONES…). Dans un
   conditionnel, chaque branche est un groupe à part — « a ? aplat d'encre :
   texte de craie » n'a jamais les deux à la fois. */
function classGroups(file) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const groups = [];
  const split = (node) => {
    if (ts.isConditionalExpression(node)) return [...split(node.whenTrue), ...split(node.whenFalse)];
    if (ts.isParenthesizedExpression(node) || ts.isJsxExpression(node)) return node.expression ? split(node.expression) : [];
    return [node];
  };
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === "className" && node.initializer) {
      const parts = split(node.initializer);
      /* Des branches séparées, mais les chaînes fixes autour valent pour
         toutes : un tableau garde tout ensemble. */
      if (parts.length > 1) parts.forEach((part) => groups.push({ node: part, text: stringsIn(part) }));
      else groups.push({ node, text: stringsIn(node) });
    } else if (ts.isPropertyAssignment(node) && (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer) || ts.isTemplateExpression(node.initializer))) {
      groups.push({ node, text: stringsIn(node.initializer) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return groups.map(({ node, text }) => ({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, text }));
}

test("un texte posé sur un aplat d'encre ou de craie prend l'encre de l'aplat", () => {
  const findings = [];
  let groupCount = 0;
  for (const file of collectFiles(SOURCE_ROOT, /\.tsx?$/)) {
    for (const { line, text } of classGroups(file)) {
      groupCount += 1;
      /* Dans un groupe, un conditionnel imbriqué dans une chaîne de gabarit
         peut réunir deux branches : on ne signale que si l'aplat et le texte
         interdit apparaissent dans la même chaîne de classes. */
      const plain = withoutVariants(text);
      for (const rule of RULES) {
        if (rule.fill.test(plain) && rule.text.test(plain)) findings.push(`${path.relative(SOURCE_ROOT, file)}:${line} → ${rule.fix}`);
      }
    }
  }
  assert.ok(groupCount > 200, `seulement ${groupCount} groupes de classes lus — le test ne vérifie rien`);
  assert.deepEqual(findings, []);
});

test("les règles CSS posent aussi l'encre de l'aplat", () => {
  const CSS_RULES = [
    { fill: /background(?:-color)?:\s*var\(--ink(?:-soft)?\)/, text: /(?<![a-z-])color:\s*var\(--chalk/, fix: "color: var(--on-ink)" },
    { fill: /background(?:-color)?:\s*var\(--chalk\)/, text: /(?<![a-z-])color:\s*var\(--ink\)/, fix: "color: var(--on-chalk)" },
    { fill: /background(?:-color)?:[^;]*var\(--foil\)/, text: /(?<![a-z-])color:\s*var\(--ink\)/, fix: "color: var(--foil-ink)" },
  ];
  const findings = [];
  for (const file of collectFiles(SOURCE_ROOT, /\.css$/)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const [, selector, body] = match;
      for (const rule of CSS_RULES) {
        if (rule.fill.test(body) && rule.text.test(body)) findings.push(`${path.relative(SOURCE_ROOT, file)} : ${selector.trim().split("\n").pop()} → ${rule.fix}`);
      }
    }
  }
  assert.deepEqual(findings, []);
});

/* Le test se falsifie sur un exemple écrit ici : s'il ne voyait plus le cas
   d'école, la liste vide ci-dessus ne prouverait rien. */
test("le détecteur voit bien le cas d'école", () => {
  const sample = path.join(import.meta.dirname, "stubs", "ink-plate-sample.tsx");
  const groups = classGroups(sample).map(({ text }) => withoutVariants(text));
  const flagged = groups.filter((text) => RULES.some((rule) => rule.fill.test(text) && rule.text.test(text)));
  assert.equal(flagged.length, 3, "le bouton, la case cochée et le dictionnaire de styles doivent être signalés");
});
