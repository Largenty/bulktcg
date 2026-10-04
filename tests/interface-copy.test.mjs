import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { DEMO_MODE_REASON } from "../src/lib/demo-mode.ts";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* Ce que l'interface dit d'elle-même. Quinze comptes rendus annonçaient une
   base « qui arrive en phase 2 » une fois la base branchée, la connexion par
   Google « avec l'authentification, en phase 2 » sur un site qui
   authentifiait déjà, et une photo de profil que rien ne prévoyait. « Phase »
   est un mot de l'équipe : un visiteur ne sait pas ce qu'il désigne, et la
   phrase devient fausse le jour où la phase arrive. */

/* Les textes d'un fichier : chaînes, gabarits et texte JSX — jamais les
   commentaires, qui parlent aux développeurs. */
function shownTexts(file, text = readFileSync(file, "utf8")) {
  const kind = file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const found = [];
  const visit = (node) => {
    let value = null;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) value = node.text;
    else if (ts.isTemplateExpression(node)) value = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join("…");
    if (value !== null) found.push({ value, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const PROJECT_PHASE = /\bphase\s+\d/i;

function phaseMentions(file, text) {
  return shownTexts(file, text)
    .filter(({ value }) => PROJECT_PHASE.test(value))
    .map(({ value, line }) => `${path.relative(SOURCE_ROOT, file)}:${line} « ${value.replace(/\s+/g, " ").trim()} »`);
}

test("aucun texte affiché ne parle des phases du projet", () => {
  const files = collectFiles(SOURCE_ROOT, /\.tsx?$/);
  assert.deepEqual(files.flatMap((file) => phaseMentions(file)), []);
});

test("le détecteur lit les chaînes et le texte JSX, pas les commentaires", () => {
  const probe = (text) => phaseMentions("sonde.tsx", text).length;
  assert.equal(probe('const note = "La base arrive en phase 2.";'), 1);
  assert.equal(probe("const note = `Rien n'est enregistré : phase ${2}`;"), 0, "un nombre substitué n'est pas écrit");
  assert.equal(probe("const view = <p>Le téléversement arrive en phase 3.</p>;"), 1);
  assert.equal(probe("/* Phase 2 : la session se lit dans les cookies. */\nconst x = 1;"), 0);
});

test("la démonstration se dit dans une seule phrase, que reprennent les comptes rendus", () => {
  /* Un compte rendu « not-persisted » dit pourquoi rien n'est enregistré
     avec DEMO_MODE_REASON, au lieu de réécrire sa propre raison. */
  const components = collectFiles(path.join(SOURCE_ROOT, "components"), /\.tsx$/);
  const ownReasons = components.flatMap((file) =>
    shownTexts(file)
      .filter(({ value }) => /rien n.est (enregistré|parti|transmis|changé|vérifié|supprimé)/.test(value) && /\bbase\b/.test(value))
      .map(({ value, line }) => `${path.relative(SOURCE_ROOT, file)}:${line} « ${value} »`),
  );
  assert.deepEqual(ownReasons, []);
  assert.doesNotMatch(DEMO_MODE_REASON, /phase|base de données/);
});
