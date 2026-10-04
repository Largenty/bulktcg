import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/* Le schéma SQL et rows.ts, lus une fois pour les deux fichiers de tests qui
   les comparent : schema-sync.test.mjs (structure, colonnes, énumérations,
   référentiels) et schema-security.test.mjs (RLS, droits, fonctions).

   Le schéma est découpé en migrations ordonnées par leur horodatage : elles
   sont lues ici dans l'ordre où `supabase db push` les applique, et
   concaténées. Chaque assertion porte sur le schéma entier, quel que soit le
   fichier qui le déclare. */

const ROOT = path.resolve(import.meta.dirname, "..");
export const rows = readFileSync(path.join(ROOT, "src", "lib", "data", "rows.ts"), "utf8");
export const migrationsDir = path.join(ROOT, "supabase", "migrations");
export const MIGRATIONS = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
export const sql = MIGRATIONS.map((file) => readFileSync(path.join(migrationsDir, file), "utf8")).join("\n");

export function rowColumns(typeName) {
  const start = rows.indexOf(`export type ${typeName} = {`);
  assert.ok(start >= 0, `type ${typeName} introuvable dans rows.ts`);
  const body = rows.slice(start, rows.indexOf("\n};", start));
  return body
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => /^[a-z_]+:/.test(line))
    .map((line) => line.split(":")[0])
    .sort();
}

/* Ce qu'une migration plus récente ajoute à une table déjà créée :
   « alter table public.<table> », retour à la ligne, puis ses clauses
   « add column » et « add constraint » jusqu'au point-virgule (le cycle de
   vie des annonces, migration 15). « alter table … enable row level
   security », sur une seule ligne, n'en est pas. */
function alterations(table) {
  return [...sql.matchAll(new RegExp(`alter table public\\.${table}\\n([\\s\\S]+?);\\n`, "g"))].map((match) => match[1]);
}

export function tableColumns(table) {
  const start = sql.indexOf(`create table public.${table} (`);
  assert.ok(start >= 0, `table ${table} introuvable dans les migrations`);
  const body = sql.slice(start, sql.indexOf("\n);", start));
  const created = body
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("--"))
    .filter((line) => !/^(constraint|unique|check|primary key|foreign key)\b/.test(line))
    .map((line) => line.split(/\s+/)[0]);
  const added = alterations(table).flatMap((clauses) => [...clauses.matchAll(/^\s*add column ([a-z_]+)/gm)].map((match) => match[1]));
  return [...created, ...added].sort();
}

/* La table telle que la décrivent toutes les migrations : sa création, puis
   ce que les suivantes lui ajoutent. */
export const tableBody = (table) => {
  const start = sql.indexOf(`create table public.${table} (`);
  return [sql.slice(start, sql.indexOf("\n);", start)), ...alterations(table)].join("\n");
};

/* Les tuples d'un « insert into public.<table> (…) values … ; » : chaînes
   entre apostrophes (doublées à l'intérieur), nombres nus. */
export function seedRows(table, from = 0) {
  const start = sql.indexOf(`insert into public.${table} (`, from);
  assert.ok(start >= 0, `aucune donnée pour ${table}`);
  const tuples = sql.slice(start, sql.indexOf(";\n", start)).split("\n").slice(1)
    .flatMap((line) => [...line.matchAll(/\(((?:'(?:[^']|'')*'|[^()'])*)\)/g)]);
  return tuples.map((tuple) =>
    [...tuple[1].matchAll(/'((?:[^']|'')*)'|(-?\d+(?:\.\d+)?)/g)].map((value) =>
      value[1] === undefined ? Number(value[2]) : value[1].replaceAll("''", "'"),
    ),
  );
}

/* Toutes les lignes posées dans une table, migration après migration : un
   référentiel s'enrichit par une migration plus récente (« Cartes à l'unité »,
   migration 13), que seedRows, qui ne lit que la première insertion, ne
   verrait pas. */
export function allSeedRows(table) {
  const rows = [];
  for (let at = sql.indexOf(`insert into public.${table} (`); at >= 0; at = sql.indexOf(`insert into public.${table} (`, at + 1)) {
    rows.push(...seedRows(table, at));
  }
  return rows;
}

/* Les valeurs d'une énumération dans l'ordre de PostgreSQL : celles de sa
   création, puis chaque « add value », à sa place (« after » ou « before »)
   ou en fin de liste. */
export function enumValues(name) {
  const created = sql.match(new RegExp(`create type public\\.${name} as enum \\(([^;]+)\\);`));
  assert.ok(created, `énumération ${name} introuvable`);
  const values = [...created[1].matchAll(/'([^']+)'/g)].map((value) => value[1]);
  const added = new RegExp(`alter type public\\.${name} add value (?:if not exists )?'([^']+)'(?: (after|before) '([^']+)')?;`, "g");
  for (const [, value, side, anchor] of sql.matchAll(added)) {
    if (values.includes(value)) continue;
    const at = side ? values.indexOf(anchor) + (side === "after" ? 1 : 0) : values.length;
    assert.ok(!side || values.includes(anchor), `${name} : « ${anchor} » introuvable pour placer « ${value} »`);
    values.splice(at, 0, value);
  }
  return values;
}

/* Les colonnes d'une écriture, lues dans rows.ts : celles de ListingRow moins
   la liste Omit<> du type d'écriture. C'est la liste exacte de ce que
   l'application envoie ; la migration ne doit rendre au rôle connecté ni
   plus, ni moins. */
export function writableColumns(typeName) {
  const declaration = rows.match(new RegExp(`export type ${typeName} = (?:Partial<\\s*)?Omit<\\s*ListingRow,\\s*([^>]+)>`));
  assert.ok(declaration, `type ${typeName} introuvable dans rows.ts`);
  const omitted = new Set([...declaration[1].matchAll(/"([a-z_]+)"/g)].map((match) => match[1]));
  return rowColumns("ListingRow").filter((column) => !omitted.has(column)).sort();
}

export function grantedColumns(privilege, table = "listings") {
  /* Toutes les déclarations, pas la première : une migration plus récente
     ajoute des colonnes (l'identifiant tiré par le formulaire, migration
     11), et n'en lire qu'une cacherait celles-là. */
  const grants = [...sql.matchAll(new RegExp(`grant ${privilege} \\(([^)]+)\\) on public\\.${table} to authenticated;`, "g"))];
  assert.ok(grants.length > 0, `aucune colonne en ${privilege} déclarée sur ${table}`);
  return [...new Set(grants.flatMap((grant) => grant[1].split(",").map((column) => column.trim())))].sort();
}

/* Les colonnes d'un type d'écriture de rows.ts : Pick<> les nomme, Omit<>
   les retranche de la ligne. */
export function declaredColumns(typeName) {
  const declaration = rows.match(new RegExp(`export type ${typeName} = (?:Partial<\\s*)?(Pick|Omit)<\\s*([A-Za-z]+),\\s*([^>]+)>`));
  assert.ok(declaration, `type ${typeName} introuvable dans rows.ts`);
  const listed = [...declaration[3].matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
  return declaration[1] === "Pick" ? listed.sort() : rowColumns(declaration[2]).filter((column) => !listed.includes(column));
}
