import "server-only";
import type { City } from "@/lib/city-label";
import { searchKey, toCity, type Commune, type CommuneIndex } from "@/lib/communes/store";

/* Chercher une commune parmi 35 000 : ce qu'un champ propose pendant la
   frappe, et les pistes quand un nom ne correspond à rien. Les communes
   retirées n'y figurent jamais. */

/* Le rang d'une commune pour une saisie : le nom entier, puis son début,
   puis le début d'un de ses mots (« sorgue » trouve L'Isle-sur-la-Sorgue).
   null : elle ne correspond pas. */
function rank(commune: Commune, key: string): number | null {
  if (commune.key === key) return 0;
  if (commune.key.startsWith(key)) return 1;
  if (commune.key.split("-").some((word) => word.startsWith(key))) return 2;
  return null;
}

type Ranked = { rank: number; commune: Commune };

/* À rang égal, la plus peuplée d'abord : « valence » propose Valence
   (Drôme) avant Valence (Tarn-et-Garonne), et « saint » Saint-Denis avant un
   hameau. */
function byRankThenPopulation(left: Ranked, right: Ranked): number {
  return left.rank - right.rank || right.commune.population - left.commune.population || left.commune.name.localeCompare(right.commune.name, "fr");
}

/* Suggestions pendant la frappe. Un nombre cherche par début de code
   postal, et propose chaque couple — « 7501 » donne Paris 75010 à 75019 ;
   un nom propose chaque commune une fois, à son code postal principal. */
export function searchCommunes(index: CommuneIndex, query: string, limit: number): City[] {
  const value = query.trim();
  if (/^\d{1,5}$/.test(value)) {
    const pairs: Array<{ commune: Commune; postalCode: string }> = [];
    for (const commune of index.active) {
      for (const postalCode of commune.postalCodes) if (postalCode.startsWith(value)) pairs.push({ commune, postalCode });
    }
    return pairs
      .sort((left, right) => left.postalCode.localeCompare(right.postalCode) || right.commune.population - left.commune.population)
      .slice(0, limit)
      .map(({ commune, postalCode }) => toCity(commune, postalCode));
  }
  const key = searchKey(value);
  if (key.length < 2) return [];
  const ranked: Ranked[] = [];
  for (const commune of index.active) {
    const found = rank(commune, key);
    if (found !== null) ranked.push({ rank: found, commune });
  }
  return ranked
    .sort(byRankThenPopulation)
    .slice(0, limit)
    .map(({ commune }) => toCity(commune));
}

/* Distance d'édition : « Avigon » est à une lettre d'« Avignon ». Suffisant
   pour rattraper une faute de frappe, pas pour deviner une autre ville.

   La matrice de Levenshtein, une ligne par lettre de left : on ne garde que
   la ligne précédente, et la dernière case calculée est la réponse. */
export function editDistance(left: string, right: string): number {
  let previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);
  let cell = right.length;
  for (const [row, leftChar] of left.split("").entries()) {
    let diagonal = row;
    cell = row + 1;
    const currentRow = [cell];
    for (const [column, above] of previousRow.slice(1).entries()) {
      cell = Math.min(above + 1, cell + 1, diagonal + (leftChar === right.charAt(column) ? 0 : 1));
      currentRow.push(cell);
      diagonal = above;
    }
    previousRow = currentRow;
  }
  return cell;
}

/* Des pistes, jamais une substitution silencieuse : on propose, la
   personne choisit. Un code postal inconnu propose les communes de son
   département les plus proches par le code, un nom mal tapé les communes les
   plus proches à l'écrit — les plus peuplées d'abord à distance égale. */
export function suggestCommunes(index: CommuneIndex, input: string, limit: number): City[] {
  const value = input.trim();
  if (!value) return [];

  const postal = value.match(/\d{5}/)?.[0];
  if (postal) {
    const department = postal.startsWith("20") ? postal.slice(0, 3) : postal.slice(0, 2);
    const pairs = [...index.byPostalCode.entries()]
      .filter(([code]) => code.startsWith(department))
      .flatMap(([code, communes]) => communes.filter((commune) => !commune.isRetired).map((commune) => ({ code, commune })));
    return pairs
      .sort(
        (left, right) =>
          Math.abs(Number(left.code) - Number(postal)) - Math.abs(Number(right.code) - Number(postal)) ||
          right.commune.population - left.commune.population,
      )
      .slice(0, limit)
      .map(({ code, commune }) => toCity(commune, code));
  }

  const key = searchKey(value);
  if (key.length < 3) return [];
  const tolerance = Math.max(2, Math.floor(key.length / 4));
  const close: Ranked[] = [];
  for (const commune of index.active) {
    const isPrefix = commune.key.startsWith(key);
    if (!isPrefix && Math.abs(commune.key.length - key.length) > tolerance) continue;
    const distance = isPrefix ? 0 : editDistance(key, commune.key);
    if (distance <= tolerance) close.push({ rank: distance, commune });
  }
  return close
    .sort(byRankThenPopulation)
    .slice(0, limit)
    .map(({ commune }) => toCity(commune));
}
