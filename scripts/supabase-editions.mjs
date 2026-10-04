/* Charge le référentiel des séries dans le projet Supabase de .env.

   npm run supabase:editions

   La table editions est la cible de la clé étrangère des séries d'une
   annonce (listing_editions) : une série proposée au dépôt mais absente de
   la base refuserait l'annonce. La migration 2 n'y pose que les 98 séries de
   la phase 1 ; ce script y écrit src/lib/editions/editions.json
   (scripts/editions-update/plan.mjs, toEditionRows) — séries retirées
   comprises, qui ne quittent jamais la table.

   Il ajoute les nouvelles séries et met à jour les noms et l'ordre. Il ne
   supprime rien, et s'arrête avant toute écriture sur une série qui
   changerait de jeu ou de code, hors des corrections listées
   (editions-update/curated.mjs). Relancé, il n'écrit rien. À relancer après
   chaque mise à jour du référentiel (node scripts/editions-update.mjs). */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CORRECTIONS } from "./editions-update/curated.mjs";
import { readEditions, toEditionRows } from "./editions-update/plan.mjs";
import { EDITION_COLUMNS, planEditionLoad } from "./supabase-editions/plan.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const REFERENTIAL = path.join(ROOT, "src", "lib", "editions", "editions.json");

async function readExistingRows(admin) {
  const { data, error } = await admin.from("editions").select(EDITION_COLUMNS.join(", ")).order("id").range(0, 4999);
  if (error) throw new Error(`Lecture de editions : ${error.message}`);
  return data;
}

async function main() {
  const nextEnv = createRequire(path.join(ROOT, "package.json"))("@next/env");
  nextEnv.loadEnvConfig(ROOT, true, { info() {}, error: console.error });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) throw new Error("Supabase n'est pas configuré : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY, dans .env.");
  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  const started = Date.now();
  const wanted = toEditionRows(readEditions(JSON.parse(readFileSync(REFERENTIAL, "utf8"))));
  const existing = await readExistingRows(admin);
  const plan = planEditionLoad(wanted, existing, CORRECTIONS);
  console.log(
    `Référentiel : ${wanted.length} séries. En base : ${existing.length}, dont ${plan.unchanged} identiques. ` +
      `À ajouter : ${plan.inserts.length}. À mettre à jour : ${plan.updates.length}.`,
  );
  for (const row of plan.extra) console.log(`  en base hors du référentiel, laissée en place : ${row.id}`);
  if (plan.conflicts.length > 0) {
    console.error("\nArrêt avant toute écriture :");
    for (const { row, reason } of plan.conflicts) console.error(`  ${row.id} : ${reason}`);
    process.exitCode = 1;
    return;
  }

  for (const step of plan.steps) {
    const { error } = await admin.from("editions").upsert(step.rows, { onConflict: "id" });
    if (error) throw new Error(`${step.gameId}, ${step.phase === "shift" ? "décalage" : "écriture"} : ${error.message}. Relancez : le passage reprend.`);
    console.log(`  ${step.gameId.padEnd(9)} ${step.phase === "shift" ? "décalage" : "écriture"} : ${step.rows.length} lignes`);
  }

  const after = await readExistingRows(admin);
  const check = planEditionLoad(wanted, after, CORRECTIONS);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nEn ${seconds} s. La table compte ${after.length} séries ; ${check.unchanged} identiques au référentiel.`);
  if (check.unchanged !== wanted.length) {
    console.error("La base ne correspond pas encore au référentiel : relancez pour voir ce qui manque.");
    process.exitCode = 1;
  }
}

await main();
