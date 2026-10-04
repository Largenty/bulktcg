/* Ce que le chargement des séries écrira, décidé avant toute écriture. La
   partie pure de scripts/supabase-editions.mjs, testée sans réseau
   (tests/supabase-editions.test.mjs). */

/* Les colonnes de la table editions (EditionRow, src/lib/data/rows.ts). */
export const EDITION_COLUMNS = ["id", "game_id", "code", "name", "year", "block", "sort_order"];

/* L'ordre d'une série change à chaque nouvelle extension : la base tient
   unique (game_id, sort_order), sans contrainte différable. Les lignes d'un
   jeu passent donc d'abord au-delà de cet écart, puis à leur place. */
export const SORT_ORDER_SHIFT = 10_000;
const EXTRA_SHIFT = 2 * SORT_ORDER_SHIFT;

/* Le plan d'un passage, jeu par jeu :
   - `inserts` et `updates` : ce qui change ;
   - `conflicts` : un identifiant qui changerait de jeu ou de code — des
     annonces le citent, le filtre par série deviendrait faux —, sauf les
     corrections listées (curated.mjs), ou un code déjà porté par une autre
     ligne du jeu. Le passage s'arrête alors sans rien écrire ;
   - `extra` : des lignes de la base que le référentiel ne porte pas. Elles
     restent — jamais supprimées —, poussées hors de l'ordre du formulaire ;
   - `steps` : les écritures, dans l'ordre où elles se font. */
export function planEditionLoad(wanted, existing, corrections = {}) {
  const existingById = new Map(existing.map((row) => [row.id, row]));
  const wantedIds = new Set(wanted.map((row) => row.id));
  const inserts = [];
  const updates = [];
  const conflicts = [];
  let unchanged = 0;

  for (const row of wanted) {
    const present = existingById.get(row.id);
    if (!present) {
      const holder = existing.find((other) => other.game_id === row.game_id && other.code === row.code);
      if (holder) conflicts.push({ row, reason: `le code ${row.code} est déjà porté par ${holder.id}` });
      else inserts.push(row);
      continue;
    }
    if (present.game_id !== row.game_id) {
      conflicts.push({ row, reason: `changerait de jeu (${present.game_id} → ${row.game_id})` });
      continue;
    }
    if (present.code !== row.code && corrections[row.id]?.code !== row.code) {
      conflicts.push({ row, reason: `changerait de code (${present.code} → ${row.code}) sans correction listée` });
      continue;
    }
    if (EDITION_COLUMNS.every((column) => present[column] === row[column])) unchanged += 1;
    else updates.push(row);
  }
  const extra = existing.filter((row) => !wantedIds.has(row.id));

  const steps = [];
  if (conflicts.length === 0) {
    const changedGames = new Set([...inserts, ...updates].map((row) => row.game_id));
    for (const gameId of changedGames) {
      const current = existing.filter((row) => row.game_id === gameId);
      const finals = new Map(wanted.filter((row) => row.game_id === gameId).map((row) => [row.id, row]));
      const extras = current.filter((row) => !finals.has(row.id));
      steps.push({
        gameId,
        phase: "shift",
        rows: [
          ...current.filter((row) => finals.has(row.id)).map((row) => ({ ...row, sort_order: SORT_ORDER_SHIFT + finals.get(row.id).sort_order })),
          ...extras.map((row, index) => ({ ...row, sort_order: EXTRA_SHIFT + index + 1 })),
        ],
      });
      steps.push({ gameId, phase: "final", rows: [...finals.values()] });
    }
  }
  return { inserts, updates, unchanged, conflicts, extra, steps };
}
