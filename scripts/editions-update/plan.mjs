/* La partie pure du référentiel des séries : des réponses des API aux lignes
   de src/lib/editions/editions.json, sans réseau. Les tests la rejouent sur
   des réponses enregistrées (tests/fixtures/editions/). */
import { z } from "zod";
import { ALIASES, BLOCK_ORDER, CORRECTIONS, CURATED_ENTRIES, EXCLUDED, ONE_PIECE_YEARS } from "./curated.mjs";

export const GAMES = ["pokemon", "magic", "onepiece", "lorcana", "yugioh", "riftbound", "naruto"];
/* Les jeux qu'une API alimente ; Naruto n'en a aucune de fiable. */
export const API_GAMES = ["pokemon", "magic", "onepiece", "lorcana", "yugioh", "riftbound"];

/* Le même découpage que lib/slug.ts, écrit ici pour rester lisible par Node
   sans TypeScript ; tests/editions-referential.test.mjs vérifie qu'ils
   s'accordent. */
export function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const editionId = (gameId, code) => `${gameId}-${slugify(code)}`;

/* ---------------------------------------------------------------------
   Les réponses des API, vérifiées avant toute écriture. Seuls les champs
   lus sont décrits ; le reste est ignoré.
   --------------------------------------------------------------------- */
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}/).transform((value) => value.slice(0, 10));

export const RAW_SCHEMAS = {
  magic: z.object({
    data: z.array(
      z.object({
        code: z.string().min(2),
        name: z.string().min(1),
        released_at: isoDay.optional(),
        set_type: z.string(),
        digital: z.boolean(),
        parent_set_code: z.string().optional(),
        block_code: z.string().optional(),
        block: z.string().optional(),
      }),
    ).min(100),
  }),
  pokemon: z.object({
    series: z.record(z.string(), z.object({ id: z.string(), sets: z.array(z.object({ id: z.string(), name: z.string() })) })),
    sets: z.record(z.string(), z.object({ id: z.string(), name: z.string().min(1), releaseDate: isoDay })),
  }),
  yugioh: z.array(
    z.object({ set_code: z.string(), set_name: z.string().min(1), num_of_cards: z.number(), tcg_date: isoDay.nullish() }),
  ).min(100),
  lorcana: z.object({
    results: z.array(z.object({ code: z.string(), name: z.string().min(1), released_at: isoDay.nullish() })).min(5),
  }),
  onepiece: z.array(z.object({ set_id: z.string(), set_name: z.string().min(1) })).min(5),
  riftbound: z.object({
    data: z.array(z.object({ code: z.string(), name: z.string().min(1), release_date: isoDay, card_count: z.number() })).min(3),
  }),
};

/* ---------------------------------------------------------------------
   Ce qu'on propose, jeu par jeu : les boosters, jamais une promo, un jeton,
   un deck de démarrage ni une série numérique — et rien qui ne soit pas
   encore sorti. Une candidate : { apiId, code, name, releasedOn, block }.
   --------------------------------------------------------------------- */
const POKEMON_SERIES = { me: "Méga-Évolution", sv: "Écarlate & Violet", swsh: "Épée & Bouclier" };
const POKEMON_PREFIX = { me: "ME", sv: "EV", swsh: "EB" };

/* sv08 → EV08, sv08.5 → EV08.5, sv10.5b → EV10.5B ; swsh9tg, sve ou svp
   n'en sont pas. */
function pokemonCode(setId) {
  if (setId === "30th") return "30C";
  const match = /^(me|sv|swsh)(\d+)(\.\d+[bw]?)?$/.exec(setId);
  if (!match) return null;
  const [, prefix, number, decimal = ""] = match;
  return `${POKEMON_PREFIX[prefix]}${number.padStart(2, "0")}${decimal.toUpperCase()}`;
}

/* Les sets dont la date se lit sur leur fiche : une requête par set, pour
   ceux-là seulement. */
export function pokemonSetsToDetail(seriesList) {
  return seriesList.flatMap((series) => series.sets.map((set) => set.id)).filter((id) => pokemonCode(id) || ALIASES.pokemon[id]);
}
export const POKEMON_SERIES_IDS = Object.keys(POKEMON_SERIES);

const SELECTORS = {
  pokemon(raw, today) {
    return Object.entries(raw.series).flatMap(([seriesId, series]) =>
      series.sets.flatMap((set) => {
        const detail = raw.sets[set.id];
        const code = pokemonCode(set.id) ?? (ALIASES.pokemon[set.id] ? set.id : null);
        if (!code || !detail || detail.releaseDate > today) return [];
        return [{ apiId: set.id, code, name: detail.name, releasedOn: detail.releaseDate, block: POKEMON_SERIES[seriesId] }];
      }),
    );
  },

  magic(raw, today) {
    const sets = raw.data.filter(
      (set) => !set.digital && set.released_at && set.released_at <= today && !set.parent_set_code && !EXCLUDED.magic.includes(set.code),
    );
    const modern = sets
      .filter((set) => set.released_at >= "2017-01-01" && ["core", "expansion", "masters", "draft_innovation"].includes(set.set_type))
      .map((set) => ({
        apiId: set.code,
        code: set.code.toUpperCase(),
        name: set.name,
        releasedOn: set.released_at,
        block: ["masters", "draft_innovation"].includes(set.set_type)
          ? "Suppléments"
          : set.released_at >= "2022-01-01"
            ? "Extensions récentes"
            : "Extensions 2017–2021",
      }));
    /* Avant 2017, un bloc entier : « du vrac Zendikar », pas les trois
       extensions une à une. */
    const blocks = new Map();
    for (const set of sets) {
      if (set.released_at >= "2017-01-01" || !["core", "expansion"].includes(set.set_type) || !set.block_code || set.block === "Core Set") continue;
      const known = blocks.get(set.block_code);
      if (!known || set.released_at < known.releasedOn) {
        blocks.set(set.block_code, {
          apiId: `block:${set.block_code}`,
          code: set.block_code.toUpperCase(),
          name: `Bloc ${set.block}`,
          releasedOn: set.released_at,
          block: "Séries anciennes",
        });
      }
    }
    return [...modern, ...blocks.values()];
  },

  /* Un booster de base : un code à quatre lettres et une centaine de
     cartes. Avant 2022, les époques (écrites à la main) suffisent. */
  yugioh(raw, today) {
    return raw
      .filter((set) => /^[A-Z]{4}$/.test(set.set_code) && set.num_of_cards >= 99 && set.num_of_cards <= 101)
      .filter((set) => set.tcg_date && set.tcg_date >= "2022-01-01" && set.tcg_date <= today)
      .map((set) => ({ apiId: set.set_code, code: set.set_code, name: set.set_name, releasedOn: set.tcg_date, block: "Extensions récentes" }));
  },

  /* Les chapitres seulement : Lorcast numérote 1, 2, 3… ; P1, cp ou D23 sont
     des promos. */
  lorcana(raw, today) {
    return raw.results
      .filter((set) => /^\d+$/.test(set.code) && set.released_at && set.released_at <= today)
      .map((set) => ({ apiId: set.code, code: `CH${set.code}`, name: set.name, releasedOn: set.released_at, block: "Chapitres" }));
  },

  /* OP-xx, EB-xx et PRB-xx ; « OP14-EB04 » est OP-14. L'API ne date rien :
     l'année vient de la table écrite à la main, et une série sans année
     attend qu'on l'y ajoute. */
  onepiece(raw) {
    return raw.flatMap((set) => {
      const match = /^(OP|EB|PRB)-?(\d+)(?:-EB\d+)?$/.exec(set.set_id);
      if (!match) return [];
      const code = `${match[1]}-${match[2].padStart(2, "0")}`;
      const year = ONE_PIECE_YEARS[code];
      if (!year) return [{ apiId: set.set_id, code, name: set.set_name, releasedOn: null, block: null, missingYear: true }];
      return [{ apiId: set.set_id, code, name: set.set_name, releasedOn: null, year, block: match[1] === "OP" ? "Extensions" : "Suppléments" }];
    });
  },

  /* Les extensions : un code de trois lettres et plus de cent cartes. Les
     promos de tournoi ou de juge n'en sont pas. */
  riftbound(raw, today) {
    return raw.data
      .filter((set) => /^[a-z]{3}$/.test(set.code) && set.card_count >= 100 && !/promotional/i.test(set.name) && set.release_date <= today)
      .map((set) => ({ apiId: set.code, code: set.code.toUpperCase(), name: set.name, releasedOn: set.release_date, block: "Extensions" }));
  },
};

/* Une réponse brute réduite aux champs lus : c'est elle qu'on enregistre
   (--save), et que les tests rejouent. */
export function trimRaw(gameId, raw) {
  return RAW_SCHEMAS[gameId].parse(raw);
}

/* Les candidates d'un jeu, depuis sa réponse brute. Lève si la réponse n'a
   pas la forme attendue : le script garde alors la liste précédente de ce
   jeu, et le dit. */
export function selectCandidates(gameId, raw, today) {
  const parsed = RAW_SCHEMAS[gameId].parse(raw);
  const candidates = SELECTORS[gameId](parsed, today);
  return {
    candidates: candidates.filter((candidate) => !candidate.missingYear),
    skipped: candidates.filter((candidate) => candidate.missingYear).map((candidate) => candidate.code),
  };
}

/* ---------------------------------------------------------------------
   La migration 2 : ses 98 lignes restent telles qu'elles sont — des
   annonces les citent —, sauf les corrections listées.
   --------------------------------------------------------------------- */
export function parseLegacyEditions(migrationSql) {
  const insert = migrationSql.slice(migrationSql.indexOf("insert into public.editions"));
  const pattern = /\('([a-z0-9-]+)', '([a-z]+)', '((?:[^']|'')+)', '((?:[^']|'')+)', (\d{4}), '((?:[^']|'')+)', (\d+)\)/g;
  return [...insert.slice(0, insert.indexOf(";")).matchAll(pattern)].map(([, id, gameId, code, name, year, block, sortOrder]) => ({
    id,
    gameId,
    code: code.replaceAll("''", "'"),
    name: name.replaceAll("''", "'"),
    year: Number(year),
    block: block.replaceAll("''", "'"),
    sortOrder: Number(sortOrder),
  }));
}

/* Un bloc entier ou une époque : en tête de son bloc, avant les séries. */
export const isBlockEntry = (edition) => /^(Bloc|Ère) /.test(edition.name);

/* ---------------------------------------------------------------------
   Le référentiel : les lignes figées, les entrées écrites à la main, puis
   les séries des API. Un identifiant connu ne change jamais ; une série que
   l'API ne donne plus est gardée, marquée retirée, jamais redonnée.
   --------------------------------------------------------------------- */
export function buildReferential({ legacy, previous, candidatesByGame, today }) {
  const byId = new Map();
  const report = { added: [], retired: [], kept: [] };
  const legacyIds = new Set(legacy.map((row) => row.id));

  /* Les candidates de chaque jeu, rangées par identifiant. */
  const fresh = new Map();
  for (const [gameId, candidates] of Object.entries(candidatesByGame)) {
    for (const candidate of candidates) {
      const id = ALIASES[gameId]?.[candidate.apiId] ?? editionId(gameId, candidate.code);
      if (fresh.has(id)) throw new Error(`Deux séries de ${gameId} donnent l'identifiant ${id}.`);
      fresh.set(id, { ...candidate, gameId });
    }
  }

  for (const row of legacy) {
    const match = fresh.get(row.id);
    byId.set(row.id, {
      id: row.id,
      gameId: row.gameId,
      code: CORRECTIONS[row.id]?.code ?? row.code,
      name: row.name,
      year: row.year,
      block: row.block,
      releasedOn: match?.releasedOn ?? previous?.get(row.id)?.releasedOn ?? null,
      retiredOn: null,
    });
  }
  for (const entry of CURATED_ENTRIES) {
    const id = editionId(entry.gameId, entry.code);
    if (!byId.has(id)) byId.set(id, { id, ...entry, releasedOn: null, retiredOn: null });
  }

  for (const [id, candidate] of fresh) {
    if (byId.has(id)) continue;
    const known = previous?.get(id);
    byId.set(id, {
      id,
      gameId: candidate.gameId,
      code: candidate.code,
      name: candidate.name,
      year: candidate.year ?? Number(candidate.releasedOn.slice(0, 4)),
      block: candidate.block,
      releasedOn: candidate.releasedOn,
      retiredOn: null,
    });
    if (!known) report.added.push(id);
  }

  /* Ce que le fichier précédent avait et que cette passe n'a pas redonné :
     gardé tel quel si l'API de son jeu a échoué, retiré sinon. */
  for (const [id, known] of previous ?? []) {
    if (byId.has(id)) continue;
    const gameFetched = Object.hasOwn(candidatesByGame, known.gameId);
    if (!gameFetched || known.retiredOn) {
      byId.set(id, known);
      if (!gameFetched) report.kept.push(id);
      continue;
    }
    byId.set(id, { ...known, retiredOn: today });
    report.retired.push(id);
  }

  for (const id of legacyIds) if (!byId.has(id)) throw new Error(`La ligne ${id} de la migration 2 a disparu.`);
  /* La base tient unique (game_id, code) : deux lignes d'un même jeu ne
     partagent pas un code. */
  const codes = new Map();
  for (const edition of byId.values()) {
    const key = `${edition.gameId}|${edition.code}`;
    if (codes.has(key)) throw new Error(`${codes.get(key)} et ${edition.id} portent le même code ${edition.code}.`);
    codes.set(key, edition.id);
  }
  return { editions: orderEditions([...byId.values()]), report };
}

/* L'ordre de la liste de dépôt : les blocs dans l'ordre écrit à la main ;
   dans un bloc, les blocs entiers d'abord, puis la sortie la plus récente.
   Une série retirée ferme sa liste : elle n'est plus proposée. */
function orderEditions(editions) {
  const blockRank = (edition) => {
    const rank = BLOCK_ORDER[edition.gameId]?.indexOf(edition.block) ?? -1;
    if (rank < 0) throw new Error(`Le bloc « ${edition.block} » de ${edition.id} n'a pas de place dans BLOCK_ORDER.`);
    return rank;
  };
  const sortKey = (edition) => edition.releasedOn ?? `${edition.year}-00-00`;
  const ordered = editions.toSorted(
    (left, right) =>
      GAMES.indexOf(left.gameId) - GAMES.indexOf(right.gameId) ||
      Number(left.retiredOn !== null) - Number(right.retiredOn !== null) ||
      blockRank(left) - blockRank(right) ||
      Number(isBlockEntry(right)) - Number(isBlockEntry(left)) ||
      sortKey(right).localeCompare(sortKey(left)) ||
      right.code.localeCompare(left.code),
  );
  const counters = new Map();
  return ordered.map((edition) => {
    const sortOrder = (counters.get(edition.gameId) ?? 0) + 1;
    counters.set(edition.gameId, sortOrder);
    return { ...edition, sortOrder };
  });
}

/* ---------------------------------------------------------------------
   Le fichier : une série par ligne, pour qu'une mise à jour se relise dans
   un diff.
   --------------------------------------------------------------------- */
const FIELDS = ["id", "gameId", "code", "name", "year", "block", "sortOrder", "releasedOn", "retiredOn"];

export function serializeEditions(editions, { updatedOn, sources }) {
  const lines = editions.map((edition) => `    ${JSON.stringify(FIELDS.map((field) => edition[field]))}`);
  return `{\n  "updatedOn": ${JSON.stringify(updatedOn)},\n  "sources": ${JSON.stringify(sources)},\n  "fields": ${JSON.stringify(FIELDS)},\n  "editions": [\n${lines.join(",\n")}\n  ]\n}\n`;
}

const fileSchema = z.object({
  updatedOn: z.string(),
  sources: z.record(z.string(), z.string()),
  fields: z.array(z.string()),
  editions: z.array(z.tuple([z.string(), z.string(), z.string(), z.string(), z.number(), z.string(), z.number(), z.string().nullable(), z.string().nullable()])),
});

export function readEditions(file) {
  const parsed = fileSchema.parse(file);
  return parsed.editions.map((row) => Object.fromEntries(FIELDS.map((field, index) => [field, row[index]])));
}

/* Les lignes de la table editions, retirées comprises : la clé étrangère des
   annonces qui les citent en dépend. */
export function toEditionRows(editions) {
  return editions.map((edition) => ({
    id: edition.id,
    game_id: edition.gameId,
    code: edition.code,
    name: edition.name,
    year: edition.year,
    block: edition.block,
    sort_order: edition.sortOrder,
  }));
}
