/* Toute la base en un seul fichier : supabase/setup.sql, à coller dans
   l'éditeur SQL d'un projet Supabase neuf, quand on ne passe pas par la CLI.

   node scripts/supabase-setup.mjs   → régénère supabase/setup.sql

   Les migrations de supabase/migrations/ restent la source : découpées par
   domaine, chacune sous 500 lignes, relues par les tests et rejouées sur
   PostgreSQL. Ce fichier les met bout à bout, dans l'ordre où
   `supabase db push` les applique, et ne s'écrit jamais à la main :
   tests/supabase-setup.test.mjs échoue dès qu'il ne les suit plus. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
export const SETUP_PATH = path.join(ROOT, "supabase", "setup.sql");

const RULE = `-- ${"=".repeat(86)}`;

/* Le contenu attendu de supabase/setup.sql, calculé depuis les migrations. */
export function buildSetupSql() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const versions = files.map((file) => file.slice(0, file.indexOf("_")));
  const header = [
    "-- BulkTCG — toute la base, en un seul fichier.",
    "--",
    "-- À exécuter une seule fois, sur un projet Supabase neuf : dans le tableau de bord du",
    "-- projet, SQL Editor, coller tout le fichier, puis Run. Il crée les énumérations, les",
    "-- référentiels (communes, séries, produits), les tables, les fonctions, les déclencheurs,",
    "-- la RLS et les droits. Rien à installer avant : il ne s'appuie que sur ce que tout projet",
    "-- Supabase fournit (les rôles anon, authenticated et service_role, et auth.users).",
    "--",
    "-- Fichier généré, à ne pas modifier : il met bout à bout les migrations de",
    "-- supabase/migrations/, qui restent la source. Après avoir modifié l'une d'elles :",
    "-- node scripts/supabase-setup.mjs — tests/supabase-setup.test.mjs le vérifie.",
    "--",
    "-- Une fois la base créée, un changement de schéma s'applique par sa seule nouvelle",
    "-- migration ; ce fichier ne sert qu'à créer une base vide. Pour passer ensuite à la CLI",
    "-- (supabase db push), marquer d'abord ces migrations comme déjà appliquées :",
    `--   npx supabase migration repair --status applied ${versions.join(" ")}`,
    "--",
    "-- Sommaire :",
    ...files.map((file) => `--   ${file}`),
  ].join("\n");
  const sections = files.map((file) => {
    const body = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8").trimEnd();
    return `${RULE}\n-- ${file}\n${RULE}\n\n${body}\n`;
  });
  return `${header}\n\n${sections.join("\n")}`;
}

if (import.meta.main) {
  writeFileSync(SETUP_PATH, buildSetupSql());
  console.log(`${path.relative(ROOT, SETUP_PATH)} régénéré.`);
}
