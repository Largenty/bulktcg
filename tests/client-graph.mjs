/* Ce qui s'exécute dans le navigateur : les composants clients, et tout ce
   qu'ils importent de proche en proche (pas de suffixe .test : le lanceur ne
   l'exécute pas). Deux tests le lisent — la pureté du rendu client
   (render-purity) et le socle de navigateurs (browser-support). */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

export const SOURCES = new Map(
  collectFiles(SOURCE_ROOT, /\.tsx?$/).map((file) => [file, readFileSync(file, "utf8")]),
);

const isClient = (text) => /^["']use client["'];?/.test(text.trimStart());
export const CLIENT_SOURCES = [...SOURCES].filter(([, text]) => isClient(text));

const parsed = new Map();
export const parse = (file) => {
  if (!parsed.has(file)) parsed.set(file, ts.createSourceFile(file, SOURCES.get(file), ts.ScriptTarget.Latest, true));
  return parsed.get(file);
};

const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx"];
function resolve(fromFile, specifier) {
  const base = specifier.startsWith("@/")
    ? path.join(SOURCE_ROOT, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(fromFile), specifier)
      : null;
  if (!base) return null;
  return [base, ...EXTENSIONS.map((extension) => base + extension)].find((candidate) => SOURCES.has(candidate) && existsSync(candidate)) ?? null;
}

/* Un import de type n'emporte aucun code. TypeScript 6 range « import
   type » avec « import defer » sous phaseModifier : seul le premier est
   effacé. */
function valueImports(file) {
  const found = [];
  const visit = (node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const isTypeOnly = ts.isImportDeclaration(node)
        ? node.importClause?.phaseModifier === ts.SyntaxKind.TypeKeyword
        : node.isTypeOnly;
      if (!isTypeOnly) found.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0] ?? node)) {
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(file));
  return found.map((specifier) => resolve(file, specifier)).filter(Boolean);
}

/* Un module "server-only" ou "use server" n'est jamais exécuté dans le
   navigateur : un composant client n'en reçoit que des références. */
export const neverRenderedInBrowser = (text) => /^import\s+["']server-only["']/m.test(text) || /^["']use server["']/.test(text.trimStart());

const hasModifier = (node, kind) => ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((modifier) => modifier.kind === kind);

/* Un type d'un module serveur, vu du client : quel qu'il soit, avec
   jusqu'à quatre paramètres — MutationResult<null> doit rester écrivable. */
const anyType = (name) => `export type ${name}<A = any, B = any, C = any, D = any> = any;`;
const anyValue = (name) => `export declare const ${name}: any;`;

/* Ce que le code client voit d'un module serveur : ses exports, typés
   lâchement, et rien de ce qu'il importe. L'exécution s'arrête à cette
   frontière (reachableFromClients) ; sans ce relais, TypeScript la
   franchirait — d'un formulaire à son action, de l'action au client
   Supabase et à next/headers, jusqu'aux types de Node et d'esnext — et la
   compilation du code client (browser-support) jugerait le serveur. */
export function serverStub(file, text) {
  const lines = [];
  for (const statement of ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true).statements) {
    const exported = hasModifier(statement, ts.SyntaxKind.ExportKeyword);
    const isDefault = hasModifier(statement, ts.SyntaxKind.DefaultKeyword);
    if (ts.isExportAssignment(statement) || (exported && isDefault)) {
      lines.push("declare const __default: any;", "export default __default;");
    } else if (exported && (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
      lines.push(anyValue(statement.name.text));
      if (ts.isClassDeclaration(statement)) lines.push(anyType(statement.name.text));
    } else if (exported && ts.isVariableStatement(statement)) {
      for (const { name } of statement.declarationList.declarations) if (ts.isIdentifier(name)) lines.push(anyValue(name.text));
    } else if (exported && (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement))) {
      lines.push(anyType(statement.name.text));
    } else if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) {
        /* export * : le module visé est relayé à son tour s'il est serveur. */
        if (statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) lines.push(`export * from "${statement.moduleSpecifier.text}";`);
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          lines.push(anyType(element.name.text));
          if (!statement.isTypeOnly && !element.isTypeOnly) lines.push(anyValue(element.name.text));
        }
      }
    }
  }
  return `${lines.join("\n")}\nexport {};\n`;
}

/* Les relais de tous les modules serveur du projet, par chemin, pour
   createProgram (compile.mjs). */
export function serverBoundaryStubs() {
  return new Map([...SOURCES].filter(([, text]) => neverRenderedInBrowser(text)).map(([file, text]) => [file, serverStub(file, text)]));
}

export function reachableFromClients() {
  const reached = new Set();
  const queue = CLIENT_SOURCES.map(([file]) => file);
  while (queue.length > 0) {
    const file = queue.pop();
    if (reached.has(file) || neverRenderedInBrowser(SOURCES.get(file))) continue;
    reached.add(file);
    queue.push(...valueImports(file));
  }
  return reached;
}
