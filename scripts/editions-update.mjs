/* Le référentiel des séries, src/lib/editions/editions.json, tiré des API
   gratuites de chaque jeu : TCGdex (Pokémon, noms français), Scryfall
   (Magic), YGOPRODeck (Yu-Gi-Oh), Lorcast (Lorcana), OPTCG API (One Piece) et
   RiftHunt (Riftbound). Naruto n'en a aucune de fiable : sa liste reste
   écrite à la main, avec les blocs et les époques (editions-update/curated.mjs).

   node scripts/editions-update.mjs                → interroge les API et réécrit le fichier
   node scripts/editions-update.mjs --save tests/fixtures/editions
                                                   → garde aussi les réponses, réduites aux champs
                                                     lus : les tests rejouent le fichier depuis elles
   node scripts/editions-update.mjs --from <dir>   → depuis des réponses déjà enregistrées

   À relancer quand une extension sort : quelques fois par an. Une API qui
   échoue garde la liste précédente de son jeu, et le script le dit. Ensuite :
   relire le diff, `npm test`, puis `npm run supabase:editions` pour charger
   les nouvelles lignes en base. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { API_GAMES, buildReferential, parseLegacyEditions, readEditions, selectCandidates, serializeEditions, trimRaw } from "./editions-update/plan.mjs";
import { SOURCES, fetchRaw } from "./editions-update/sources.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const TARGET = path.join(ROOT, "src", "lib", "editions", "editions.json");
const LEGACY_MIGRATION = path.join(ROOT, "supabase", "migrations", "20260929120100_referentials.sql");

const { values } = parseArgs({ options: { from: { type: "string" }, save: { type: "string" } } });
const today = new Date().toISOString().slice(0, 10);

const candidatesByGame = {};
const failures = [];
for (const gameId of API_GAMES) {
  try {
    const raw = values.from ? JSON.parse(readFileSync(path.join(values.from, `${gameId}.json`), "utf8")) : await fetchRaw(gameId);
    if (values.save) {
      mkdirSync(values.save, { recursive: true });
      writeFileSync(path.join(values.save, `${gameId}.json`), `${JSON.stringify(trimRaw(gameId, raw))}\n`);
    }
    const { candidates, skipped } = selectCandidates(gameId, raw, today);
    candidatesByGame[gameId] = candidates;
    console.log(`${gameId} : ${candidates.length} séries proposées par l'API.`);
    if (skipped.length > 0) console.log(`  sans année connue, non proposées : ${skipped.join(", ")} (curated.mjs, ONE_PIECE_YEARS)`);
  } catch (error) {
    failures.push(gameId);
    console.error(`${gameId} : ÉCHEC — ${error instanceof Error ? error.message : String(error)}. La liste précédente est gardée.`);
  }
}

const previous = existsSync(TARGET) ? new Map(readEditions(JSON.parse(readFileSync(TARGET, "utf8"))).map((edition) => [edition.id, edition])) : null;
const legacy = parseLegacyEditions(readFileSync(LEGACY_MIGRATION, "utf8"));
const { editions, report } = buildReferential({ legacy, previous, candidatesByGame, today });

mkdirSync(path.dirname(TARGET), { recursive: true });
writeFileSync(TARGET, serializeEditions(editions, { updatedOn: today, sources: SOURCES }));

const active = editions.filter((edition) => !edition.retiredOn);
console.log(`${path.relative(ROOT, TARGET)} : ${active.length} séries proposées, ${editions.length - active.length} retirées.`);
console.log(`Nouvelles : ${report.added.length}. Retirées cette fois : ${report.retired.length}. Gardées faute d'API : ${report.kept.length}.`);
if (failures.length > 0) {
  console.error(`API en échec : ${failures.join(", ")}.`);
  process.exitCode = 1;
}
