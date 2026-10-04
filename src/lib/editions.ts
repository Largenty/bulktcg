import "server-only";
import referential from "@/lib/editions/editions.json" with { type: "json" };
import { RETIRED_EDITIONS_BLOCK, type EditionCatalog } from "@/lib/edition-catalog";
import type { Edition } from "@/types/edition";
import { isGameId, type GameId } from "@/types/game";

/* Le référentiel des séries, tiré des API de chaque jeu par
   scripts/editions-update.mjs — TCGdex pour Pokémon, Scryfall pour Magic,
   YGOPRODeck, Lorcast, OPTCG API, RiftHunt — et écrit dans
   src/lib/editions/editions.json, avec ce que le marché décide à la main :
   les blocs entiers et les époques, l'ordre des blocs, la liste de Naruto.
   Aucune API n'est appelée pendant le rendu d'une page.

   Serveur seulement : le formulaire de dépôt demande les séries du jeu
   choisi à /series (src/app/series/route.ts), et « server-only » fait
   échouer le build d'un composant client qui importerait ce module.

   La langue suit le marché, pas une règle uniforme : les séries Pokémon ont
   des noms français officiels que les vendeurs emploient (TCGdex les
   donne) ; Magic, One Piece et Yu-Gi-Oh se revendent sous leur nom anglais.
   Riftbound porte les deux pour ses premières extensions. La granularité
   aussi suit le marché : les séries récentes sont des extensions précises,
   les anciennes des blocs entiers — un vendeur écrit « du vrac Neo et EX »,
   jamais « Neo Genesis, Neo Discovery, Neo Revelation ».

   Une série que l'API ne donne plus est gardée, marquée retirée : les
   annonces qui la citent l'affichent encore, mais on ne la propose plus. */

type EditionFileRow = [string, string, string, string, number, string, number, string | null, string | null];

export type StoredEdition = Edition & { sortOrder: number; isRetired: boolean };

function toStored(row: EditionFileRow): StoredEdition {
  const [id, gameId, code, name, year, block, sortOrder, , retiredOn] = row;
  if (!isGameId(gameId)) throw new Error(`Série ${id} : jeu inconnu « ${gameId} ».`);
  return { id, gameId, code, name, year, block, sortOrder, isRetired: retiredOn !== null };
}

const EDITIONS: StoredEdition[] = (referential.editions as EditionFileRow[])
  .map(toStored)
  .toSorted((left, right) => left.sortOrder - right.sortOrder);
const EDITIONS_BY_ID = new Map(EDITIONS.map((edition) => [edition.id, edition]));

const toEdition = ({ id, code, gameId, name, year, block }: StoredEdition): Edition => ({ id, code, gameId, name, year, block });

/* Toute série connue, retirées comprises : une annonce peut en citer une. */
export function getEditionById(id: string): Edition | null {
  const edition = EDITIONS_BY_ID.get(id);
  return edition ? toEdition(edition) : null;
}

export function isRetiredEdition(id: string): boolean {
  return EDITIONS_BY_ID.get(id)?.isRetired ?? false;
}

/* Les séries proposées pour un jeu, groupées par bloc et dans l'ordre du
   référentiel — la plus récente en tête, parce que c'est celle qu'on coche
   le plus. Jamais une série retirée. */
function blocksOf(editions: readonly StoredEdition[], gameId: GameId): EditionCatalog["blocks"] {
  const blocks: EditionCatalog["blocks"] = [];
  for (const edition of editions) {
    if (edition.gameId !== gameId || edition.isRetired) continue;
    const current = blocks.at(-1);
    if (current && current.block === edition.block) current.editions.push(toEdition(edition));
    else blocks.push({ block: edition.block, editions: [toEdition(edition)] });
  }
  return blocks;
}

export function getEditionBlocks(gameId: GameId): EditionCatalog["blocks"] {
  return blocksOf(EDITIONS, gameId);
}

/* Ce que le formulaire de dépôt propose pour un jeu. En modification, les
   séries que l'annonce porte déjà et que le référentiel a retirées depuis
   restent cochées, dans un bloc à part : décocher reste possible. Exportée
   pour les tests, avec un référentiel de leur choix. */
export function catalogOf(editions: readonly StoredEdition[], gameId: GameId, kept: readonly string[] = []): EditionCatalog {
  const retired = editions.filter((edition) => edition.gameId === gameId && edition.isRetired && kept.includes(edition.id)).map(toEdition);
  const blocks = blocksOf(editions, gameId);
  return { gameId, blocks: retired.length > 0 ? [...blocks, { block: RETIRED_EDITIONS_BLOCK, editions: retired }] : blocks };
}

export function getEditionCatalog(gameId: GameId, kept: readonly string[] = []): EditionCatalog {
  return catalogOf(EDITIONS, gameId, kept);
}
