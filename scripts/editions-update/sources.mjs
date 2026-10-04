/* Les appels aux API des séries : du script seul, jamais du navigateur ni
   pendant le rendu d'une page. Chaque appel a son délai, porte le nom de
   l'application (Scryfall l'exige), attend 100 ms après le précédent — la
   plus stricte des règles publiées, Lorcast et Scryfall —, et s'arrête sur
   un 429 : on ne réessaie pas contre une API qui demande d'arrêter. Les
   réponses sont vérifiées par plan.mjs (Zod) avant d'écrire quoi que ce
   soit. Aucune ne demande de clé. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { POKEMON_SERIES_IDS, pokemonSetsToDetail } from "./plan.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const VERSION = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
export const USER_AGENT = `BulkTCG/${VERSION} (editions-update)`;

const TIMEOUT_MS = 20_000;
const SPACING_MS = 100;

/* L'adresse de chaque source, telle que le fichier du référentiel la cite. */
export const SOURCES = {
  pokemon: "https://api.tcgdex.net/v2/fr",
  magic: "https://api.scryfall.com/sets",
  onepiece: "https://optcgapi.com/api/allSets/",
  lorcana: "https://api.lorcast.com/v0/sets",
  yugioh: "https://db.ygoprodeck.com/api/v7/cardsets.php",
  riftbound: "https://api.rifthunt.com/sets",
};

let lastCall = 0;

async function getJson(url) {
  const wait = lastCall + SPACING_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCall = Date.now();
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "error",
  });
  if (response.status === 429) throw new Error(`${new URL(url).host} demande de ralentir (429) : arrêt.`);
  if (!response.ok) throw new Error(`${new URL(url).host} a répondu ${response.status}.`);
  return response.json();
}

/* La réponse brute d'un jeu, telle que selectCandidates l'attend. TCGdex ne
   date un set que sur sa fiche : une requête par set des trois séries
   récentes, une cinquantaine en tout. */
export async function fetchRaw(gameId) {
  if (gameId !== "pokemon") return getJson(SOURCES[gameId]);
  const series = {};
  for (const id of POKEMON_SERIES_IDS) series[id] = await getJson(`${SOURCES.pokemon}/series/${id}`);
  const sets = {};
  for (const id of pokemonSetsToDetail(Object.values(series))) {
    const detail = await getJson(`${SOURCES.pokemon}/sets/${encodeURIComponent(id)}`);
    sets[id] = { id: detail.id, name: detail.name, releaseDate: detail.releaseDate };
  }
  return {
    series: Object.fromEntries(Object.entries(series).map(([id, value]) => [id, { id: value.id, sets: value.sets.map((set) => ({ id: set.id, name: set.name })) }])),
    sets,
  };
}
