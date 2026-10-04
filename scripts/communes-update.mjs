/* Le référentiel des communes, src/lib/communes/communes.json, tiré du
   Découpage administratif (geo.api.gouv.fr, Licence Ouverte Etalab 2.0).

   node scripts/communes-update.mjs                    → télécharge la liste officielle et réécrit le fichier
   node scripts/communes-update.mjs --from liste.json  → depuis une liste déjà téléchargée

   Une fois par an suffit : les fusions de communes prennent effet au
   1er janvier. Le script garde le slug de chaque commune connue, fige les 112
   de la migration 2, marque retirées celles qui ont disparu, et dit ce qui a
   changé. Ensuite : relire le diff, `npm test`, puis charger les nouvelles
   lignes en base (supabase/README.md). */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildReferential, parseLegacyCommunes, readReferential, serializeReferential } from "./communes-update/plan.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const TARGET = path.join(ROOT, "src", "lib", "communes", "communes.json");
const LEGACY_MIGRATION = path.join(ROOT, "supabase", "migrations", "20260929120100_referentials.sql");
const SOURCE_URL =
  "https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,codeDepartement,departement,centre,mairie,population&format=json";

const { values } = parseArgs({ options: { from: { type: "string" } } });

async function download() {
  const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error(`geo.api.gouv.fr a répondu ${response.status}.`);
  return response.json();
}

const official = values.from ? JSON.parse(readFileSync(values.from, "utf8")) : await download();
const previous = existsSync(TARGET) ? readReferential(JSON.parse(readFileSync(TARGET, "utf8"))) : null;
const legacy = parseLegacyCommunes(readFileSync(LEGACY_MIGRATION, "utf8"));
const today = new Date().toISOString().slice(0, 10);

const { communes, frozenOrder, report } = buildReferential({ official, previous, legacy, today });
writeFileSync(TARGET, serializeReferential(communes, { updatedOn: today, frozenOrder }));

const active = communes.filter((commune) => !commune.retiredOn);
console.log(`${path.relative(ROOT, TARGET)} : ${active.length} communes, ${communes.length - active.length} retirées.`);
if (previous) {
  console.log(`Nouvelles : ${report.added.length}. Retirées cette fois : ${report.retired.length}. Renommées : ${report.renamed.length}.`);
  for (const line of report.renamed) console.log(`  ${line}`);
}
