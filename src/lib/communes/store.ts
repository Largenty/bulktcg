import "server-only";
import referential from "@/lib/communes/communes.json" with { type: "json" };
import type { City } from "@/lib/city-label";
import { slugify } from "@/lib/slug";

/* Le référentiel des communes, chargé une fois par processus serveur : les
   34 879 communes du Découpage administratif (geo.api.gouv.fr, Licence
   Ouverte Etalab 2.0), tenues à jour par scripts/communes-update.mjs. Jamais
   dans le navigateur — 2,5 Mo — : « server-only » fait échouer le build d'un
   composant client qui l'importerait. */

export type Commune = {
  communeCode: string;
  slug: string;
  name: string;
  /* Le nom tel que la recherche le compare : sans accents ni ponctuation,
     « saint » écrit en entier. */
  key: string;
  departmentCode: string;
  departmentName: string;
  /* Le premier est le code postal principal : celui de la page de la
     commune, et celui de la migration 2 pour les 112 d'origine. */
  postalCodes: string[];
  latitude: number;
  longitude: number;
  population: number;
  /* Disparue à une mise à jour (fusion) : encore lue et affichée, jamais
     proposée. */
  isRetired: boolean;
};

/* La forme du fichier : une commune par ligne, code INSEE, slug, nom,
   département, codes postaux séparés d'une espace, latitude, longitude,
   population. */
export type CommuneRow = [string, string, string, string, string, number, number, number];
export type ReferentialFile = {
  departments: Record<string, string>;
  frozen: string[];
  retired: Record<string, string>;
  communes: CommuneRow[];
};

/* Les communes et les clés par lesquelles on les retrouve. */
export type CommuneIndex = {
  communes: readonly Commune[];
  /* Celles qu'on peut proposer : toutes, moins les retirées. */
  active: readonly Commune[];
  bySlug: ReadonlyMap<string, Commune>;
  byCode: ReadonlyMap<string, Commune>;
  byPair: ReadonlyMap<string, Commune>;
  /* Jusqu'à quarante-six communes pour 51300. */
  byPostalCode: ReadonlyMap<string, Commune[]>;
  /* Les homonymes : jusqu'à douze Sainte-Colombe. */
  byKey: ReadonlyMap<string, Commune[]>;
  /* Les 112 communes de la migration 2, dans son ordre. */
  frozenCodes: readonly string[];
};

const SAINT = /(^|-)st(e?)(?=-|$)/g;

/* La forme sous laquelle on compare un nom saisi et un nom du référentiel :
   « St-Rémy », « saint remy » et « Saint-Rémy » se rejoignent. */
export function searchKey(value: string): string {
  return slugify(value).replace(SAINT, (_, edge: string, feminine: string) => `${edge}saint${feminine}`);
}

/* Un couple nom et code postal désigne une seule commune en France : la clé
   étrangère de la base repose dessus, et tests/cities.test.mjs le vérifie. */
export const pairKey = (name: string, postalCode: string) => `${searchKey(name)}|${postalCode.trim()}`;

export function indexReferential(file: ReferentialFile): CommuneIndex {
  const communes = file.communes.map(([communeCode, slug, name, departmentCode, postalCodes, latitude, longitude, population]) => ({
    communeCode,
    slug,
    name,
    key: searchKey(name),
    departmentCode,
    departmentName: file.departments[departmentCode] ?? "",
    postalCodes: postalCodes.split(" "),
    latitude,
    longitude,
    population,
    isRetired: communeCode in file.retired,
  }));
  return {
    communes,
    active: communes.filter((commune) => !commune.isRetired),
    bySlug: new Map(communes.map((commune) => [commune.slug, commune])),
    byCode: new Map(communes.map((commune) => [commune.communeCode, commune])),
    byPair: new Map(communes.flatMap((commune) => commune.postalCodes.map((code) => [pairKey(commune.name, code), commune] as const))),
    byPostalCode: groupBy(communes.flatMap((commune) => commune.postalCodes.map((code) => [code, commune] as const))),
    byKey: groupBy(communes.map((commune) => [commune.key, commune] as const)),
    frozenCodes: file.frozen,
  };
}

function groupBy(entries: ReadonlyArray<readonly [string, Commune]>): Map<string, Commune[]> {
  const groups = new Map<string, Commune[]>();
  for (const [key, commune] of entries) {
    const group = groups.get(key);
    if (group) group.push(commune);
    else groups.set(key, [commune]);
  }
  return groups;
}

/* Une ligne du fichier, relue avec ses types : le JSON n'en promet aucun, et
   une ligne mal formée doit arrêter le serveur au démarrage plutôt que
   placer une annonce nulle part. */
function toRow(row: Array<string | number>, position: number): CommuneRow {
  const [communeCode, slug, name, departmentCode, postalCodes, latitude, longitude, population] = row;
  if (
    typeof communeCode !== "string" ||
    typeof slug !== "string" ||
    typeof name !== "string" ||
    typeof departmentCode !== "string" ||
    typeof postalCodes !== "string" ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    typeof population !== "number"
  ) {
    throw new Error(`Référentiel des communes : ligne ${position + 1} mal formée.`);
  }
  return [communeCode, slug, name, departmentCode, postalCodes, latitude, longitude, population];
}

/* Le référentiel du site. */
export const COMMUNE_INDEX = indexReferential({
  departments: referential.departments,
  frozen: referential.frozen,
  retired: referential.retired,
  communes: referential.communes.map(toRow),
});

/* Une commune vue pour l'un de ses codes postaux — le principal par
   défaut. */
export function toCity(commune: Commune, postalCode: string = commune.postalCodes[0] ?? ""): City {
  return {
    slug: commune.slug,
    name: commune.name,
    postalCode,
    departmentCode: commune.departmentCode,
    departmentName: commune.departmentName,
    latitude: commune.latitude,
    longitude: commune.longitude,
    communeCode: commune.communeCode,
    population: commune.population,
  };
}

export const byPopulation = (left: Commune, right: Commune) => right.population - left.population;
