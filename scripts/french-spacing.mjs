/* Espaces insécables de la typographie française, dans les textes du site.

   node scripts/french-spacing.mjs          → liste les écarts, code de sortie 1 s'il y en a
   node scripts/french-spacing.mjs --write  → les corrige
   node scripts/french-spacing.mjs --write src/components/auth src/app/connexion
                                            → seulement dans ces fichiers ou dossiers, pour ne
                                              pas réécrire ce que d'autres modifient en même temps

   Seuls les textes sont examinés — chaînes et texte JSX — grâce à l'arbre
   syntaxique TypeScript : un « a ? b : c » de code n'est jamais touché. Les
   données de démonstration (src/lib/mock) sont exclues : elles imitent ce que
   saisissent les utilisateurs, et on ne réécrit pas leur texte. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "..", "src");
const EXCLUDED = [path.join(ROOT, "lib", "mock")];
const NBSP = " ";
const NNBSP = " ";

/* Espace fine insécable devant ? ! ; — espace insécable devant : et dans
   les guillemets. Une lettre, un chiffre ou une fermeture doit précéder :
   « 3 ? » ou « lot ? », jamais un « ? » isolé en début de chaîne. */
const RULES = [
  { pattern: /(?<=[\p{L}\p{N})»%€\]]) (?=[?!;])/gu, replacement: NNBSP },
  { pattern: /(?<=[\p{L}\p{N})»%€\]]) (?=:(?:\s|$))/gu, replacement: NBSP },
  { pattern: /« /g, replacement: `«${NBSP}` },
  { pattern: / »/g, replacement: `${NBSP}»` },
];

export function collectSources(directory = ROOT) {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((file) => !EXCLUDED.some((excluded) => file.startsWith(`${excluded}${path.sep}`)));
}

function isText(node) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node) ||
    node.kind === ts.SyntaxKind.JsxText
  );
}

/* Les chaînes d'un import ou d'une directive ne sont pas du texte. */
function isCode(node) {
  const parent = node.parent;
  return ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent) || (ts.isExpressionStatement(parent) && parent.parent && ts.isSourceFile(parent.parent));
}

export function findGaps(file) {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const visit = (node) => {
    if (isText(node) && !isCode(node)) {
      const start = node.getStart(source);
      const raw = text.slice(start, node.getEnd());
      let fixed = raw;
      for (const rule of RULES) fixed = fixed.replace(rule.pattern, rule.replacement);
      if (fixed !== raw) edits.push({ start, end: node.getEnd(), raw, fixed, line: source.getLineAndCharacterOfPosition(start).line + 1 });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { text, edits };
}

/* Lancé en commande, et non importé par un test. */
if (import.meta.filename === process.argv[1]) {
  const { values, positionals } = parseArgs({ options: { write: { type: "boolean", default: false } }, allowPositionals: true });
  const { write } = values;
  const scopes = positionals.map((arg) => path.resolve(arg));
  const inScope = (file) => scopes.length === 0 || scopes.some((scope) => file === scope || file.startsWith(`${scope}${path.sep}`));
  let count = 0;
  for (const file of collectSources().filter(inScope)) {
    const { text, edits } = findGaps(file);
    if (edits.length === 0) continue;
    count += edits.length;
    if (write) {
      let next = text;
      for (const edit of edits.toReversed()) next = next.slice(0, edit.start) + edit.fixed + next.slice(edit.end);
      writeFileSync(file, next);
    } else {
      for (const edit of edits) console.log(`${path.relative(ROOT, file)}:${edit.line}  ${edit.raw.trim().slice(0, 80)}`);
    }
  }
  console.log(`${count} texte(s) ${write ? "corrigé(s)" : "à corriger"}`);
  if (!write && count > 0) process.exitCode = 1;
}
