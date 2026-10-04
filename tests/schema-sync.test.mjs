import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { TABLE_COLUMNS } from "../src/lib/data/supabase-rows.ts";
import { MIGRATIONS, allSeedRows, enumValues, migrationsDir, rowColumns, seedRows, sql, tableBody, tableColumns } from "./schema.mjs";

/* rows.ts décrit les lignes telles que Supabase les rendra ; les migrations
   SQL créent les tables. Les deux sont écrits à la main en phase 1 : ce test
   garantit qu'ils disent la même chose, pour que le jour de la bascule ne
   révèle pas une colonne oubliée d'un côté ou de l'autre. Il tient aussi la
   structure du schéma — l'ordre des migrations, les énumérations, les
   référentiels et les contraintes d'intégrité. La RLS et les droits sont dans
   schema-security.test.mjs. */

test("chaque migration tient sous 500 lignes, dans un ordre d'horodatage sans ambiguïté", () => {
  assert.ok(MIGRATIONS.length > 1, "le schéma n'est plus découpé");
  const versions = MIGRATIONS.map((file) => file.match(/^(\d{14})_[a-z0-9_]+\.sql$/)?.[1]);
  assert.ok(versions.every(Boolean), "une migration n'a pas la forme <horodatage>_<nom>.sql");
  assert.equal(new Set(versions).size, versions.length, "deux migrations partagent un horodatage");
  for (const file of MIGRATIONS) {
    const lines = readFileSync(path.join(migrationsDir, file), "utf8").trimEnd().split("\n").length;
    assert.ok(lines < 500, `${file} fait ${lines} lignes`);
  }
});

test("l'ordre de création reste valide : rien n'est référencé avant d'exister", () => {
  /* Une clé étrangère vise une table déjà créée, un déclencheur une fonction
     déjà déclarée : sinon l'application dans l'ordre échoue au milieu. */
  const tables = new Set(["auth.users"]);
  for (const match of sql.matchAll(/create table (public\.[a-z_]+) \(|references (public\.[a-z_]+|auth\.users) \(/g)) {
    if (match[1]) tables.add(match[1]);
    else assert.ok(tables.has(match[2]), `${match[2]} est référencée avant d'être créée`);
  }
  const functions = new Set();
  for (const match of sql.matchAll(/create or replace function (public\.[a-z_]+)\(|execute function (public\.[a-z_]+)\(/g)) {
    if (match[1]) functions.add(match[1]);
    else assert.ok(functions.has(match[2]), `${match[2]} est appelée par un déclencheur avant d'être déclarée`);
  }
});

const TABLE_OF_ROW = {
  CommuneRow: "communes",
  EditionRow: "editions",
  ProductTagGameRow: "product_tag_games",
  AccountSettingsRow: "account_settings",
  ProfileRow: "profiles",
  ListingRow: "listings",
  PhotoUploadRow: "photo_uploads",
  ListingPhotoRow: "listing_photos",
  ListingEditionRow: "listing_editions",
  ListingTagRow: "listing_tags",
  WantedRow: "wanted_listings",
  ConversationRow: "conversations",
  MessageRow: "messages",
  ReviewRow: "reviews",
  DealRow: "deals",
  BlockRow: "blocks",
  ReportRow: "reports",
  ListingWaitlistRow: "listing_waitlist",
  NotificationRow: "notifications",
};

for (const [typeName, table] of Object.entries(TABLE_OF_ROW)) {
  test(`${typeName} et la table ${table} ont les mêmes colonnes`, () => {
    assert.deepEqual(rowColumns(typeName), tableColumns(table));
  });
}

/* La lecture vérifie que la base a bien ces colonnes (assertColumns) : une
   migration oubliée lève au lieu de vider les listes. Les listes doivent
   donc suivre les migrations, ni plus ni moins. */
for (const [table, columns] of Object.entries(TABLE_COLUMNS)) {
  test(`la lecture attend de ${table} les colonnes que créent les migrations`, () => {
    assert.deepEqual([...columns].sort(), tableColumns(table));
  });
}

test("chaque énumération du domaine existe en base avec les mêmes valeurs", async () => {
  const {
    STATUS_LABELS,
    LOT_TYPE_LABELS,
    CONDITION_LABELS,
    LANGUAGE_LABELS,
    WANTED_STATUS_LABELS,
    GAME_LABELS,
    TAG_LABELS,
    AUDIENCE_LABELS,
    ACCOUNT_TYPE_LABELS,
    DEAL_KIND_LABELS,
    REPORT_REASON_LABELS,
    REPORT_TARGET_LABELS,
    REVIEW_ROLE_LABELS,
    NOTIFICATION_KIND_LABELS,
  } = await import("../src/lib/labels.ts");
  const enums = {
    listing_status: STATUS_LABELS,
    lot_type: LOT_TYPE_LABELS,
    card_condition: CONDITION_LABELS,
    card_language: LANGUAGE_LABELS,
    wanted_status: WANTED_STATUS_LABELS,
    game_id: GAME_LABELS,
    product_tag: TAG_LABELS,
    listing_audience: AUDIENCE_LABELS,
    account_type: ACCOUNT_TYPE_LABELS,
    deal_kind: DEAL_KIND_LABELS,
    report_reason: REPORT_REASON_LABELS,
    report_target: REPORT_TARGET_LABELS,
    review_role: REVIEW_ROLE_LABELS,
    notification_kind: NOTIFICATION_KIND_LABELS,
  };
  for (const [name, labels] of Object.entries(enums)) {
    /* La création, plus chaque « add value » d'une migration plus récente. */
    assert.deepEqual(enumValues(name).toSorted(), Object.keys(labels).sort(), `valeurs divergentes pour ${name}`);
  }
});

test("les produits sont dans le même ordre en base et dans le référentiel", async () => {
  /* L'ordre d'une énumération est celui de PostgreSQL : un « add value »
     sans « after » rangerait « Cartes à l'unité » après le classeur, et un
     tri par produit ne suivrait plus le formulaire. */
  const { PRODUCT_TAG_IDS } = await import("../src/lib/product-tags.ts");
  assert.deepEqual(enumValues("product_tag"), PRODUCT_TAG_IDS);
});

test("les jeux sont dans le même ordre en base et dans GAME_IDS", async () => {
  /* Un enum Postgres se trie dans l'ordre de sa déclaration : un
     « order by game_id » doit rendre l'ordre des menus et de la tranche. */
  const { GAME_IDS } = await import("../src/types/game.ts");
  const match = sql.match(/create type public\.game_id as enum \(([^;]+)\);/);
  const values = [...match[1].matchAll(/'([^']+)'/g)].map((value) => value[1]);
  assert.deepEqual(values, [...GAME_IDS]);
});

test("au-delà des photos gratuites, la base exige l'option « 8 photos »", async () => {
  /* Le formulaire refuse la quatrième photo sans l'option ; la base aussi,
     en dernier recours. Le seuil SQL est celui de lib/site.ts. */
  const { FREE_PHOTOS, MAX_PHOTOS } = await import("../src/lib/site.ts");
  const guard = sql.match(/create or replace function public\.check_photo_allowance\(\)[\s\S]+?\$\$;/);
  assert.ok(guard, "check_photo_allowance introuvable");
  assert.match(guard[0], new RegExp(`new\\.position >= ${FREE_PHOTOS}\\b`));
  assert.match(guard[0], /extra_photos/);
  assert.match(sql, /create trigger listing_photos_allowance before insert or update of position on public\.listing_photos/);
  assert.match(sql, new RegExp(`position smallint not null check \\(position between 0 and ${MAX_PHOTOS - 1}\\)`));
});

test("le ménage des photos attend les délais de grâce décidés dans lib/photo-hosting.ts", async () => {
  /* La base tient les délais elle-même : un appel mal réglé ne retire pas
     les photos 4 à 8 d'un paiement encore en route. Le guide les cite
     (tests/photo-hosting.test.mjs) ; ici, ils doivent être les mêmes. */
  const { PHOTO_DURATIONS } = await import("../src/lib/photo-hosting.ts");
  const claim = sql.match(/create or replace function public\.claim_photo_purge\([\s\S]+?\n\$\$;/);
  assert.ok(claim, "claim_photo_purge introuvable");
  const SECONDS = { hour: 3600, hours: 3600, day: 86400, days: 86400 };
  const grace = (column) => {
    const found = claim[0].match(new RegExp(`u\\.${column} < now\\(\\) - interval '(\\d+) (hours?|days?)'`));
    assert.ok(found, `aucun délai sur ${column}`);
    return Number(found[1]) * SECONDS[found[2]];
  };
  /* Jamais accroché : le délai part du dépôt. Décroché : de la date de retrait. */
  assert.equal(grace("created_at"), PHOTO_DURATIONS.unattachedGraceSeconds);
  assert.equal(grace("detached_at"), PHOTO_DURATIONS.detachedGraceSeconds);
  assert.match(claim[0], /u\.detached_at is null and u\.created_at < now\(\)/);
  /* Le serveur boucle sur des lots que la base borne, et une reprise ne
     revient qu'après la fin du passage qui l'a prise (src/lib/photo-purge.ts). */
  const { PHOTO_PURGE } = await import("../src/lib/photo-purge.ts");
  const retryDelays = [...claim[0].matchAll(/u\.purge_started_at < now\(\) - interval '(\d+) (hours?)'/g)].map((found) => Number(found[1]) * SECONDS[found[2]]);
  assert.deepEqual(retryDelays, [PHOTO_PURGE.retryAfterSeconds, PHOTO_PURGE.retryAfterSeconds], "la part des reprises et leur sélection n'ont pas le même délai");
  assert.match(claim[0], new RegExp(`batch_size is null or batch_size not between 1 and ${PHOTO_PURGE.maxBatchSize} then`));
  /* Le bail d'un passage dure plus que le pire passage (tests/photo-purge.test.mjs). */
  const lease = claim[0].match(/values \(true, purge_run, now\(\) \+ interval '(\d+) minutes'\)/);
  assert.ok(lease, "le bail du ménage introuvable");
  assert.equal(Number(lease[1]) * 60, PHOTO_PURGE.leaseSeconds);
});

test("ce que rend le ménage a les colonnes que le serveur lit", () => {
  const signature = sql.match(/create or replace function public\.claim_photo_purge\([^)]*\)\s+returns table \(([^)]+)\)/);
  assert.ok(signature, "claim_photo_purge ne rend pas une table");
  const columns = signature[1].split(",").map((column) => column.trim().split(/\s+/)[0]).sort();
  assert.deepEqual(rowColumns("PhotoPurgeClaimRow"), columns);
});

test("les référentiels en base sont ceux du code, ligne à ligne", async () => {
  /* Une commune, une série ou un produit ajouté d'un côté seulement serait
     refusé par la base alors que le formulaire le propose, ou l'inverse.
     Les communes : la migration 2 n'en pose que 112, que le référentiel du
     code (src/lib/communes/communes.json) doit contenir à l'identique — le
     reste arrive par npm run supabase:communes, qui écrit ces mêmes lignes
     (toCommuneRows) et s'arrêterait sur une ligne différente. */
  const { readReferential, toCommuneRows } = await import("../scripts/communes-update/plan.mjs");
  const { CORRECTIONS } = await import("../scripts/editions-update/curated.mjs");
  const { readEditions } = await import("../scripts/editions-update/plan.mjs");
  const { getProductTagsByGame } = await import("../src/lib/product-tags.ts");
  const { GAME_IDS } = await import("../src/types/game.ts");
  const referential = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "src", "lib", "communes", "communes.json"), "utf8"));
  const loaded = new Map(
    toCommuneRows(readReferential(referential)).map((row) => [
      row.slug,
      [row.slug, row.name, row.postal_code, row.department_code, row.department_name, row.latitude, row.longitude],
    ]),
  );
  const seeded = seedRows("communes");
  assert.ok(seeded.length > 100, `seulement ${seeded.length} communes dans la migration 2`);
  for (const commune of seeded) assert.deepEqual(loaded.get(commune[0]), commune, `${commune[0]} : la migration 2 et le référentiel divergent`);
  /* Les séries : les 98 de la migration 2 sont dans le référentiel
     (src/lib/editions/editions.json), telles quelles — des annonces les
     citent —, sauf les corrections listées dans curated.mjs. Le reste, et
     l'ordre du formulaire (sort_order), arrive par npm run
     supabase:editions, qui s'arrête sur tout autre code changé. */
  const editionFile = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "src", "lib", "editions", "editions.json"), "utf8"));
  const stored = new Map(readEditions(editionFile).map((edition) => [edition.id, edition]));
  const seededEditions = seedRows("editions");
  assert.equal(seededEditions.length, 98, "la migration 2 pose 98 séries");
  for (const [id, gameId, code, name, year, block] of seededEditions) {
    const edition = stored.get(id);
    assert.ok(edition, `${id} manque au référentiel des séries`);
    assert.deepEqual(
      [edition.gameId, edition.code, edition.name, edition.year, edition.block, edition.retiredOn],
      [gameId, CORRECTIONS[id]?.code ?? code, name, year, block, null],
      `${id} : la migration 2 et le référentiel divergent`,
    );
  }
  assert.deepEqual(
    allSeedRows("product_tag_games").map(([tag, gameId]) => `${tag}/${gameId}`).sort(),
    GAME_IDS.flatMap((gameId) => getProductTagsByGame(gameId).map((tag) => `${tag.id}/${gameId}`)).sort(),
  );
});

test("une commune, une série, un produit, un prix barré et un lien ne s'écrivent pas au hasard", () => {
  for (const table of ["profiles", "listings", "wanted_listings"]) {
    assert.match(tableBody(table), /foreign key \(city, postal_code\) references public\.communes \(name, postal_code\)/, `${table} sans commune vérifiée`);
  }
  /* Le navigateur désigne la commune, la base la place sur la carte. */
  for (const table of ["listings", "wanted_listings"]) {
    assert.match(sql, new RegExp(`update of city, postal_code, department_code, latitude, longitude on public\\.${table}\\s+for each row execute function public\\.stamp_commune\\(\\)`));
    assert.match(tableBody(table), /slug text not null unique check \(slug ~ '\^\[a-z0-9\]\+\(-\[a-z0-9\]\+\)\*\$'\)/, `slug libre sur ${table}`);
  }
  assert.match(tableBody("listing_editions"), /edition_id text not null references public\.editions \(id\)/);
  assert.match(sql, /create trigger listing_editions_match_game before insert or update on public\.listing_editions/);
  assert.match(sql, /create trigger listing_tags_match_game before insert or update on public\.listing_tags/);
  assert.match(sql, /create trigger listings_game_change before update of game_id on public\.listings/);
  assert.match(sql, /revoke insert, update, delete on public\.communes, public\.editions, public\.product_tag_games from anon, authenticated;/);
  assert.match(tableBody("listings"), /check \(previous_price_cents is null or previous_price_cents > price_cents\)/);
});

test("un avis reste sur le profil noté quand son auteur supprime son compte", () => {
  /* « Les avis que vous avez laissés à d'autres vendeurs restent sur leur
     profil : ils leur appartiennent, pas à vous. » */
  for (const column of ["deal_id", "listing_id", "reviewer_id"]) {
    assert.match(tableBody("reviews"), new RegExp(`\\n  ${column} uuid references public\\.[a-z_]+ \\(id\\) on delete set null,`), `${column} emporterait l'avis`);
  }
  assert.match(tableBody("reviews"), /reviewed_id uuid not null references public\.profiles \(id\) on delete cascade/);
});

test("une notification mène toujours à ce dont elle parle", async () => {
  const { NOTIFICATION_KIND_LABELS } = await import("../src/lib/labels.ts");
  for (const kind of Object.keys(NOTIFICATION_KIND_LABELS)) {
    assert.match(tableBody("notifications"), new RegExp(`constraint notifications_${kind}_subject check \\(kind <> '${kind}' or`), `${kind} sans sujet exigé`);
  }
});

test("la base tient les durées du cycle de vie décidées dans lib/listing-lifecycle.ts", async () => {
  /* Une annonce expire, s'annonce et s'archive au même instant pour le site
     et pour la base : la RLS refuserait sinon une conversation qu'un écran
     propose encore, ou l'inverse. */
  const { LISTING_LIFECYCLE } = await import("../src/lib/listing-lifecycle.ts");
  const days = (pattern) => {
    const found = sql.match(pattern);
    assert.ok(found, `${pattern} introuvable`);
    return Number(found[1]);
  };
  assert.equal(days(/function public\.listing_expires_at\([\s\S]+?listing\.renewed_at \+ interval '(\d+) days'/), LISTING_LIFECYCLE.lifetimeDays);
  assert.equal(days(/function public\.listing_archived\([\s\S]+?<= now\(\) - interval '(\d+) days'/), LISTING_LIFECYCLE.archiveAfterDays);
  assert.equal(days(/function public\.run_listing_lifecycle\([\s\S]+?listing_expires_at\(l\) <= now\(\) \+ interval '(\d+) days'/), LISTING_LIFECYCLE.noticeDays);
  /* Une annonce vendue sort de l'index le jour où elle est archivée. */
  const { SOLD_LISTING_INDEXED_DAYS } = await import("../src/lib/metadata.ts");
  assert.equal(SOLD_LISTING_INDEXED_DAYS, LISTING_LIFECYCLE.archiveAfterDays);
});
