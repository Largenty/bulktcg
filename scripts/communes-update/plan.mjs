/* La partie pure de la mise à jour du référentiel des communes : à partir de
   la liste officielle, du fichier précédent et des 112 communes de la
   migration 2, le nouveau fichier — sans réseau, donc testable.

   Trois promesses tiennent ici :
   - un lien de page ne change jamais : une commune garde son slug d'une
     année sur l'autre, même renommée, et le slug d'une commune disparue
     n'est jamais redonné ;
   - les 112 communes de la migration 2 gardent leurs coordonnées et leur
     code postal d'origine, ceux que la base porte déjà ;
   - une commune disparue (fusion) reste, marquée retirée : les annonces qui
     la citent s'affichent encore, mais on ne la propose plus. */

const COMBINING_MARKS = /[̀-ͯ]/g;
const LIGATURES = { œ: "oe", Œ: "oe", æ: "ae", Æ: "ae", ß: "ss" };

/* La même règle que src/lib/slug.ts, recopiée pour que le script tourne
   sans charger le TypeScript ; tests/communes-update.test.mjs les compare. */
export function slugify(value) {
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/[œŒæÆß]/g, (letter) => LIGATURES[letter] ?? letter)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* Les départements que la base accepte (check de communes.department_code) :
   métropole, Corse et départements d'outre-mer. Les collectivités du
   Pacifique et les TAAF (984 à 989) en sont exclues. */
export const DEPARTMENT_CODE = /^(\d{2}|2[AB]|97\d)$/;

/* Les 112 communes de la migration 2, lues dans son insert : la source de
   leurs coordonnées et de leur code postal, figés. */
export function parseLegacyCommunes(migrationSql) {
  const insert = migrationSql.slice(migrationSql.indexOf("insert into public.communes"));
  const rows = [];
  const pattern = /\('([a-z0-9-]+)', '((?:[^']|'')+)', '(\d{5})', '([0-9AB]{2,3})', '((?:[^']|'')+)', (-?[\d.]+), (-?[\d.]+)\)/g;
  for (const match of insert.slice(0, insert.indexOf(";")).matchAll(pattern)) {
    const [, slug, name, postalCode, departmentCode, departmentName, latitude, longitude] = match;
    rows.push({
      slug,
      name: name.replaceAll("''", "'"),
      postalCode,
      departmentCode,
      departmentName: departmentName.replaceAll("''", "'"),
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
  }
  return rows;
}

/* Une commune de la liste officielle, ramenée à ce que le fichier garde. Les
   coordonnées sont celles de la mairie : le centre géométrique d'Arles tombe
   en Camargue, à 15 km de la ville. */
function fromOfficial(commune) {
  const point = (commune.mairie ?? commune.centre).coordinates;
  return {
    insee: commune.code,
    name: commune.nom,
    departmentCode: commune.codeDepartement,
    departmentName: commune.departement?.nom ?? "",
    postalCodes: [...commune.codesPostaux].sort(),
    latitude: round(point[1]),
    longitude: round(point[0]),
    population: commune.population ?? 0,
  };
}

const round = (value) => Math.round(value * 10_000) / 10_000;

/* Le fichier précédent, relu en enregistrements : null au premier passage. */
export function readReferential(file) {
  if (!file) return null;
  const retired = file.retired ?? {};
  const frozen = new Set(file.frozen ?? []);
  return file.communes.map(([insee, slug, name, departmentCode, postalCodes, latitude, longitude, population]) => ({
    insee,
    slug,
    name,
    departmentCode,
    departmentName: file.departments[departmentCode] ?? "",
    postalCodes: postalCodes.split(" "),
    latitude,
    longitude,
    population,
    frozen: frozen.has(insee),
    retiredOn: retired[insee] ?? null,
  }));
}

/* Le nouveau référentiel, et ce qui a changé. `today` date une commune
   retirée ; elle garde la date de son premier retrait. */
export function buildReferential({ official, previous, legacy, today }) {
  const current = official
    .filter((commune) => DEPARTMENT_CODE.test(commune.codeDepartement) && commune.codesPostaux?.length > 0)
    .map(fromOfficial)
    .sort((left, right) => left.insee.localeCompare(right.insee));
  const previousByInsee = new Map((previous ?? []).map((commune) => [commune.insee, commune]));
  const currentInsee = new Set(current.map((commune) => commune.insee));

  /* Les slugs déjà donnés — communes retirées comprises — ne se redonnent
     pas. */
  const taken = new Set((previous ?? []).map((commune) => commune.slug));
  const legacyByInsee = matchLegacy(legacy, current, previousByInsee);
  for (const row of legacyByInsee.values()) taken.add(row.slug);

  const baseCount = countBy(current, (commune) => slugify(commune.name));
  const baseDepartmentCount = countBy(current, (commune) => `${slugify(commune.name)}|${commune.departmentCode}`);
  const report = { added: [], retired: [], renamed: [] };

  const communes = current.map((commune) => {
    const before = previousByInsee.get(commune.insee);
    const legacyRow = legacyByInsee.get(commune.insee);
    if (before && before.name !== commune.name) report.renamed.push(`${before.name} → ${commune.name} (${commune.insee})`);
    if (!before) report.added.push(commune.insee);
    const slug = before?.slug ?? legacyRow?.slug ?? allocateSlug(commune, { taken, baseCount, baseDepartmentCount });
    taken.add(slug);
    if (!legacyRow) return { ...commune, slug, frozen: false, retiredOn: null };
    /* Figée : la commune telle que la migration 2 l'a écrite en base. */
    return {
      ...commune,
      slug,
      postalCodes: [legacyRow.postalCode, ...commune.postalCodes.filter((code) => code !== legacyRow.postalCode)],
      latitude: legacyRow.latitude,
      longitude: legacyRow.longitude,
      frozen: true,
      retiredOn: null,
    };
  });

  for (const before of previous ?? []) {
    if (currentInsee.has(before.insee)) continue;
    if (!before.retiredOn) report.retired.push(before.insee);
    communes.push({ ...before, retiredOn: before.retiredOn ?? today });
  }
  communes.sort((left, right) => left.insee.localeCompare(right.insee));
  assertUniqueSlugs(communes);
  /* Les 112 dans l'ordre de la migration 2 : celui des pages qu'elles ont
     toujours eues. */
  return { communes, frozenOrder: [...legacyByInsee.keys()], report };
}

/* Chaque ligne de la migration 2 retrouve sa commune : même nom, même
   département, et son code postal parmi ceux de la commune. Une seule qui
   manque arrête tout — la base la porte, le code doit la porter aussi. */
function matchLegacy(legacy, current, previousByInsee) {
  const byInsee = new Map();
  for (const row of legacy) {
    const found = current.find(
      (commune) =>
        slugify(commune.name) === slugify(row.name) &&
        commune.departmentCode === row.departmentCode &&
        commune.postalCodes.includes(row.postalCode),
    ) ?? [...previousByInsee.values()].find((commune) => commune.slug === row.slug);
    if (!found) throw new Error(`Commune de la migration 2 introuvable dans la liste officielle : ${row.name} (${row.postalCode}).`);
    byInsee.set(found.insee, row);
  }
  return byInsee;
}

/* Le slug d'une nouvelle commune : son nom s'il est unique en France, son
   nom et son département s'il l'est dans le département, son nom et son code
   INSEE sinon — et jamais un slug déjà donné. */
function allocateSlug(commune, { taken, baseCount, baseDepartmentCount }) {
  const base = slugify(commune.name);
  const candidates = [];
  if (baseCount.get(base) === 1) candidates.push(base);
  if (baseDepartmentCount.get(`${base}|${commune.departmentCode}`) === 1) candidates.push(`${base}-${commune.departmentCode.toLowerCase()}`);
  candidates.push(`${base}-${commune.insee.toLowerCase()}`);
  const slug = candidates.find((candidate) => !taken.has(candidate));
  if (!slug) throw new Error(`Aucun slug libre pour ${commune.name} (${commune.insee}).`);
  return slug;
}

/* La clé d'une ligne de la table communes : la commune pour son code postal
   principal, la commune et le code postal pour les autres (paris-75002).
   Exportée pour le chargement en base. */
export function rowSlug(commune, postalCode) {
  return postalCode === commune.postalCodes[0] ? commune.slug : `${commune.slug}-${postalCode}`;
}

function assertUniqueSlugs(communes) {
  const seen = new Set();
  for (const commune of communes) {
    for (const postalCode of commune.postalCodes) {
      const slug = rowSlug(commune, postalCode);
      if (seen.has(slug)) throw new Error(`Slug en double : ${slug}.`);
      seen.add(slug);
    }
  }
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
  return counts;
}

/* Le fichier, une commune par ligne : la mise à jour annuelle se relit en
   diff. */
export function serializeReferential(communes, { updatedOn, frozenOrder }) {
  const departments = Object.fromEntries(
    [...new Map(communes.map((commune) => [commune.departmentCode, commune.departmentName])).entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
  const frozen = frozenOrder.filter((insee) => communes.some((commune) => commune.insee === insee && commune.frozen));
  const retired = Object.fromEntries(communes.filter((commune) => commune.retiredOn).map((commune) => [commune.insee, commune.retiredOn]));
  const rows = communes.map((commune) =>
    JSON.stringify([
      commune.insee,
      commune.slug,
      commune.name,
      commune.departmentCode,
      commune.postalCodes.join(" "),
      commune.latitude,
      commune.longitude,
      commune.population,
    ]),
  );
  return [
    "{",
    `"source": ${JSON.stringify("Découpage administratif, geo.api.gouv.fr — Licence Ouverte Etalab 2.0")},`,
    `"updatedOn": ${JSON.stringify(updatedOn)},`,
    `"departments": ${JSON.stringify(departments)},`,
    `"frozen": ${JSON.stringify(frozen)},`,
    `"retired": ${JSON.stringify(retired)},`,
    `"communes": [`,
    rows.join(",\n"),
    "]",
    "}",
    "",
  ].join("\n");
}

/* Les lignes de la table communes (colonnes de CommuneRow, src/lib/data/
   rows.ts) : une par couple commune et code postal, communes retirées
   comprises — une annonce qui en cite une garde sa clé étrangère. */
export function toCommuneRows(communes) {
  return communes.flatMap((commune) =>
    commune.postalCodes.map((postalCode) => ({
      slug: rowSlug(commune, postalCode),
      name: commune.name,
      postal_code: postalCode,
      department_code: commune.departmentCode,
      department_name: commune.departmentName,
      latitude: commune.latitude,
      longitude: commune.longitude,
    })),
  );
}
