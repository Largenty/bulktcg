// Rejoue les migrations sur un PostgreSQL réel (PGlite, PostgreSQL 17 en
// WebAssembly), précédées d'une émulation minimale de Supabase (prelude.sql),
// puis les scénarios de scenarios/ sous les rôles de l'API.
//
//   npm install --no-save @electric-sql/pglite
//   node supabase/tests/run.mjs [dossier_migrations] [dossier_scenarios]
//
// Les fichiers de scenarios/ se jouent dans l'ordre de leur nom, et chacun
// reprend la base là où le précédent l'a laissée. Un scénario commence par
// « -- @step [ok] … » ou « -- @step [refus] … », se joue seul, et dit ce qu'il
// attend :
//
//   -- @error <extrait>   un refus doit lever une erreur dont le message
//                         contient cet extrait — sans lui, une faute de frappe
//                         dans le SQL passerait pour la règle qui refuse ;
//   -- @expect <json>     un parcours doit rendre exactement ces lignes en
//                         dernier résultat, à moins qu'il ne vérifie lui-même
//                         par « raise exception » : un parcours qui n'affirme
//                         rien passerait toujours.
//
// Le code de sortie compte les écarts : une règle retirée d'une migration fait
// échouer son scénario.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const [migrationsDir = path.join(here, "../migrations"), scenariosDir = path.join(here, "scenarios")] = process.argv.slice(2);

const sqlFiles = (dir) => readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();

/* Les scénarios d'un fichier. Ce qui précède le premier « @step » présente le
   fichier et ne se joue pas. */
function parseSteps(file, source) {
  return source
    .split(/^-- @step /m)
    .slice(1)
    .map((chunk) => {
      const [label, ...lines] = chunk.split("\n");
      const directive = (name) => lines.find((line) => line.startsWith(`-- @${name} `))?.slice(`-- @${name} `.length).trim();
      return {
        file,
        label,
        sql: lines.join("\n"),
        expectsRefusal: label.startsWith("[refus]"),
        error: directive("error"),
        expect: directive("expect"),
      };
    });
}

/* Le JSON attendu, réécrit comme le rendra JSON.stringify ; null s'il est
   illisible, ce qui compte comme un écart plutôt que d'arrêter le banc. */
function normalizeJson(text) {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return null;
  }
}

/* Ce qui cloche dans un scénario qui s'est déroulé sans erreur, ou null. */
function problemWithSuccess(step, outcome) {
  if (step.expectsRefusal) return "aucune erreur levée";
  if (step.expect === undefined) {
    return /raise exception/i.test(step.sql) ? null : "n'affirme rien (-- @expect ou raise exception)";
  }
  const expected = normalizeJson(step.expect);
  if (expected === null) return "-- @expect n'est pas du JSON";
  return outcome === expected ? null : `attendu ${expected}`;
}

/* Ce qui cloche dans un scénario qui a levé une erreur, ou null. */
function problemWithError(step, message) {
  if (!step.expectsRefusal) return "erreur inattendue";
  if (step.error === undefined) return "refus sans motif déclaré (-- @error)";
  return message.includes(step.error) ? null : `motif attendu : ${step.error}`;
}

let PGlite;
try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  console.error("PGlite n'est pas installé : npm install --no-save @electric-sql/pglite");
  process.exit(2);
}

const db = new PGlite();
/* Le prélude accompagne les scénarios qu'il prépare : un exécutable copié
   ailleurs (là où PGlite est installé) lit toujours celui du dépôt. */
await db.exec(readFileSync(path.join(path.dirname(scenariosDir), "prelude.sql"), "utf8"));

for (const file of sqlFiles(migrationsDir)) {
  try {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
    console.log(`ok     ${file}`);
  } catch (error) {
    console.log(`ERREUR ${file} : ${error.message}`);
    process.exit(1);
  }
}

const steps = sqlFiles(scenariosDir).flatMap((file) => parseSteps(file, readFileSync(path.join(scenariosDir, file), "utf8")));
let mismatches = 0;
let currentFile = null;
for (const step of steps) {
  if (step.file !== currentFile) {
    currentFile = step.file;
    console.log(`\n${step.file}`);
  }
  let problem;
  let detail;
  try {
    const results = await db.exec(step.sql);
    const withRows = results.filter((result) => result.fields?.length);
    const last = withRows.at(-1) ?? results.at(-1);
    detail = last?.fields?.length ? JSON.stringify(last.rows) : `(${last?.affectedRows ?? 0} ligne(s))`;
    problem = problemWithSuccess(step, detail);
  } catch (error) {
    detail = error.message;
    problem = problemWithError(step, detail);
    await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false);").catch(() => {});
  }
  if (problem) mismatches += 1;
  const verdict = problem ? "ÉCART " : step.expectsRefusal ? "refusé" : "passe ";
  console.log(`${verdict} ${step.label} -> ${detail}${problem ? `\n       ${problem}` : ""}`);
}
await db.close();

console.log(`\n${steps.length} scénarios, ${mismatches} écart${mismatches > 1 ? "s" : ""}.`);
process.exit(mismatches > 0 ? 1 : 0);
