/* Charge toutes les communes du référentiel dans le projet Supabase de .env.

   npm run supabase:communes

   La table communes est la cible des clés étrangères (city, postal_code) des
   profils, des annonces et des demandes : une commune absente refuserait le
   dépôt qui la cite. La migration 2 n'y pose que les 112 villes de la
   phase 1 ; ce script ajoute les autres couples commune et code postal de
   src/lib/communes/communes.json (scripts/communes-update/plan.mjs,
   toCommuneRows) — communes retirées comprises, qui ne quittent jamais la
   table.

   Il n'ajoute que ce qui manque, et ne modifie ni ne supprime rien : une
   ligne déjà en base avec d'autres valeurs, ou un slug pris par un autre
   couple, arrête le passage avant toute écriture, avec la liste. Relancé, il
   n'écrit rien. À relancer après chaque mise à jour du référentiel
   (node scripts/communes-update.mjs, une fois par an). */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readReferential, toCommuneRows } from "./communes-update/plan.mjs";
import { BATCH_SIZE, COMMUNE_COLUMNS, batches, planCommuneLoad } from "./supabase-communes/plan.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const REFERENTIAL = path.join(ROOT, "src", "lib", "communes", "communes.json");
const MAX_LISTED = 20;

/* Toute la table, page par page dans l'ordre du slug : une réponse s'arrête
   à 1 000 lignes. */
async function readExistingRows(admin) {
  const rows = [];
  for (let from = 0; ; from += BATCH_SIZE) {
    const { data, error } = await admin.from("communes").select(COMMUNE_COLUMNS.join(", ")).order("slug").range(from, from + BATCH_SIZE - 1);
    if (error) throw new Error(`Lecture de communes : ${error.message}`);
    rows.push(...data);
    if (data.length < BATCH_SIZE) return rows;
  }
}

async function countRows(admin) {
  const { count, error } = await admin.from("communes").select("slug", { count: "exact", head: true });
  if (error) throw new Error(`Compte de communes : ${error.message}`);
  return count;
}

function listSome(title, items, describe) {
  console.log(`\n${title} (${items.length}) :`);
  for (const item of items.slice(0, MAX_LISTED)) console.log(`  ${describe(item)}`);
  if (items.length > MAX_LISTED) console.log(`  … et ${items.length - MAX_LISTED} autres.`);
}

async function main() {
  const nextEnv = createRequire(path.join(ROOT, "package.json"))("@next/env");
  nextEnv.loadEnvConfig(ROOT, true, { info() {}, error: console.error });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase n'est pas configuré : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY, dans .env.");
  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  const started = Date.now();
  const wanted = toCommuneRows(readReferential(JSON.parse(readFileSync(REFERENTIAL, "utf8"))));
  const existing = await readExistingRows(admin);
  const plan = planCommuneLoad(wanted, existing);
  console.log(`Référentiel : ${wanted.length} couples. En base : ${existing.length} lignes, dont ${plan.unchanged} identiques.`);

  if (plan.extra.length > 0) {
    listSome("Lignes en base hors du référentiel, laissées en place", plan.extra, (row) => `${row.slug} — ${row.name} (${row.postal_code})`);
  }
  if (plan.conflicts.length > 0) {
    listSome("Arrêt avant toute écriture : lignes en conflit", plan.conflicts, ({ row, reason }) => `${row.name} (${row.postal_code}) : ${reason}`);
    process.exitCode = 1;
    return;
  }

  const chunks = batches(plan.missing);
  let written = 0;
  for (const [index, chunk] of chunks.entries()) {
    /* Seulement des couples absents ; ignoreDuplicates garde l'insertion
       sans effet si un autre passage les a posés entre-temps. */
    const { error } = await admin.from("communes").upsert(chunk, { onConflict: "name,postal_code", ignoreDuplicates: true });
    if (error) throw new Error(`Lot ${index + 1} : ${error.message} (${written} lignes posées avant lui).`);
    written += chunk.length;
    console.log(`  lot ${String(index + 1).padStart(2)}/${chunks.length} : ${chunk.length} lignes`);
  }

  const total = await countRows(admin);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n${written} couples ajoutés en ${seconds} s. La table compte ${total} lignes pour ${wanted.length} couples au référentiel.`);
  if (total !== wanted.length + plan.extra.length) {
    console.error("Le compte final ne correspond pas : relancez pour voir ce qui manque.");
    process.exitCode = 1;
  }
}

await main();
