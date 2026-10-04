/* Ce que le chargement des communes écrira, décidé avant toute écriture :
   les couples absents de la base, et ce qui empêcherait de les poser sans
   rien écraser. La partie pure de scripts/supabase-communes.mjs, testée sans
   réseau (tests/supabase-communes.test.mjs). */

/* Les colonnes de la table communes (CommuneRow, src/lib/data/rows.ts), dans
   l'ordre où toCommuneRows les produit. */
export const COMMUNE_COLUMNS = ["slug", "name", "postal_code", "department_code", "department_name", "latitude", "longitude"];

/* Un lot par requête : 1 000 lignes, le plafond d'une réponse de Supabase. */
export const BATCH_SIZE = 1000;

const pairKey = (row) => `${row.name}\u0000${row.postal_code}`;

/* La première colonne qui diffère entre deux lignes, ou null. Les
   coordonnées se comparent en nombres : la base rend des doubles, le
   fichier des décimales arrondies, et les 112 de la migration 2 sont les
   mêmes valeurs des deux côtés. */
function differingColumn(wanted, existing) {
  return (
    COMMUNE_COLUMNS.find((column) =>
      column === "latitude" || column === "longitude" ? Number(wanted[column]) !== Number(existing[column]) : wanted[column] !== existing[column],
    ) ?? null
  );
}

/* Le plan d'un passage :
   - `missing` : les lignes du référentiel absentes de la base, à insérer ;
   - `unchanged` : celles qui y sont déjà, à l'identique ;
   - `conflicts` : un couple présent avec d'autres valeurs, ou un slug pris
     par un autre couple. Le passage s'arrête alors sans rien écrire : une
     annonce peut citer cette ligne, et la changer en silence déplacerait le
     lot sur la carte ou changerait l'adresse de sa page ;
   - `extra` : des lignes de la base qu'aucune commune du référentiel ne
     porte. Elles restent : une clé étrangère peut les viser. */
export function planCommuneLoad(wanted, existing) {
  const existingByPair = new Map(existing.map((row) => [pairKey(row), row]));
  const existingBySlug = new Map(existing.map((row) => [row.slug, row]));
  const wantedPairs = new Set(wanted.map(pairKey));
  const missing = [];
  const conflicts = [];
  let unchanged = 0;
  for (const row of wanted) {
    const present = existingByPair.get(pairKey(row));
    if (present) {
      const column = differingColumn(row, present);
      if (column === null) unchanged += 1;
      else conflicts.push({ row, reason: `déjà en base avec un autre « ${column} » (${present[column]} au lieu de ${row[column]})` });
      continue;
    }
    const holder = existingBySlug.get(row.slug);
    if (holder) {
      conflicts.push({ row, reason: `le slug « ${row.slug} » est déjà pris par ${holder.name} (${holder.postal_code})` });
      continue;
    }
    missing.push(row);
  }
  const extra = existing.filter((row) => !wantedPairs.has(pairKey(row)));
  return { missing, unchanged, conflicts, extra };
}

/* Les lots d'insertion, dans l'ordre du référentiel. */
export function batches(rows, size = BATCH_SIZE) {
  const chunks = [];
  for (let start = 0; start < rows.length; start += size) chunks.push(rows.slice(start, start + size));
  return chunks;
}
