import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { TABLES } from "../src/lib/data/source.ts";
import { countDemoRows, deleteAccounts, seedDemo } from "../scripts/supabase-seed/database.mjs";
import { buildSeedPlan, demoId } from "../scripts/supabase-seed/plan.mjs";
import { createPgliteAdmin } from "./pglite-supabase.mjs";

/* Le chargement de la démonstration (npm run supabase:seed) rejoué sur un vrai
   PostgreSQL : les migrations dans PGlite, sous le rôle de la clé secrète,
   avec tous leurs déclencheurs. Sans réseau — c'est ici qu'on apprend qu'une
   migration change ce que la base fait d'une ligne, avant de recharger le
   projet. La migration 11 l'a fait : une annonce y naît « Disponible » et
   sans prix d'avant, et la démonstration aurait perdu ses réservations et
   ses baisses de prix sans que rien ne le dise. */

const ROOT = path.resolve(import.meta.dirname, "..");
let PGlite = null;
try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  /* Absent : le test le dit au lieu de passer à vide. */
}
const SKIP = PGlite === null ? "PGlite n'est pas installé : npm install --no-save @electric-sql/pglite" : false;

const SECRETS = { password: "mot-de-passe-de-demonstration", passwordIsNew: false, throwawayPassword: "mot-de-passe-jetable" };
const DEMO_TABLES = ["profiles", "account_settings", "listings", "listing_editions", "listing_tags", "wanted_listings", "conversations", "messages", "deals", "reviews", "listing_waitlist", "notifications"];
const time = (value) => (value === null ? null : new Date(value).getTime());

async function freshDatabase() {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(ROOT, "supabase", "tests", "prelude.sql"), "utf8"));
  const migrations = path.join(ROOT, "supabase", "migrations");
  for (const file of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(migrations, file), "utf8"));
  }
  return db;
}

/* Chaque ligne de chaque table de la démonstration, toutes colonnes. */
async function snapshot(db) {
  const tables = {};
  for (const table of DEMO_TABLES) {
    const result = await db.query(`select coalesce(json_agg(x order by x::text), '[]'::json) as rows from public.${table} x`);
    tables[table] = JSON.stringify(result.rows[0].rows);
  }
  return tables;
}

const expectedCounts = (plan) => ({
  profiles: TABLES.profiles.length,
  account_settings: TABLES.profiles.length,
  listings: TABLES.listings.length,
  listing_photos: 0,
  listing_editions: plan.listingEditions.length,
  listing_tags: plan.listingTags.length,
  wanted_listings: TABLES.wanted.length,
  conversations: plan.conversations.length,
  messages: plan.messages.length,
  deals: TABLES.deals.length,
  reviews: TABLES.reviews.length,
  listing_waitlist: TABLES.waitlist.length,
  /* Les notifications recopiées, plus une par avis (notify_review). */
  notifications: plan.notifications.length + plan.reviews.length,
});

test("sur une base neuve, chaque annonce ressort comme en démonstration — réservée, baissée, vendue, et à sa date", { skip: SKIP }, async () => {
  const db = await freshDatabase();
  const admin = await createPgliteAdmin(db);
  const plan = buildSeedPlan(TABLES);
  await seedDemo(admin, plan, SECRETS);
  assert.deepEqual(await countDemoRows(admin, plan), expectedCounts(plan));

  const { data: listings } = await admin
    .from("listings")
    .select("id,status,reserved_for,price_cents,previous_price_cents,sold_at,view_count,created_at,updated_at")
    .in("id", plan.listings.map((listing) => listing.id));
  const byId = new Map(listings.map((row) => [row.id, row]));
  for (const mock of TABLES.listings) {
    const row = byId.get(demoId(mock.id));
    assert.ok(row, `${mock.id} n'a pas été chargée`);
    assert.deepEqual(
      [row.status, row.reserved_for, row.price_cents, row.previous_price_cents, time(row.sold_at), row.view_count, time(row.created_at), time(row.updated_at)],
      [mock.status, mock.reserved_for === null ? null : demoId(mock.reserved_for), mock.price_cents, mock.previous_price_cents, time(mock.sold_at), mock.view_count, time(mock.created_at), time(mock.updated_at)],
      `${mock.id} ne ressort pas comme en démonstration`,
    );
  }
  assert.ok(TABLES.listings.some((mock) => mock.previous_price_cents !== null), "plus aucune baisse de prix : le test ne vérifie plus rien");
  assert.ok(TABLES.listings.some((mock) => mock.reserved_for !== null), "plus aucune réservation désignée : le test ne vérifie plus rien");

  /* L'historique des ventes vient des ventes chargées (count_sale). */
  const soldBySeller = Map.groupBy(TABLES.listings.filter((mock) => mock.status === "sold"), (mock) => demoId(mock.seller_id));
  const { data: profiles } = await admin.from("profiles").select("id,sold_listing_count").in("id", plan.accounts.map((account) => account.id));
  for (const profile of profiles) assert.equal(profile.sold_listing_count, soldBySeller.get(profile.id)?.length ?? 0);
});

test("relancé, il n'écrit rien ; retiré puis rechargé, il passe par-dessus les liens retirés, que la clé de service seule peut reprendre", { skip: SKIP }, async () => {
  const db = await freshDatabase();
  const admin = await createPgliteAdmin(db);
  const plan = buildSeedPlan(TABLES);
  await seedDemo(admin, plan, SECRETS);
  const loaded = await snapshot(db);

  const second = await seedDemo(admin, plan, SECRETS);
  assert.deepEqual(second.filter(([, count]) => count !== 0), [], "un second passage a encore écrit");
  assert.deepEqual(await snapshot(db), loaded, "un second passage a changé une ligne");

  await deleteAccounts(admin, [...plan.accounts.map((account) => account.id), ...plan.deletedAccountReviews.map((entry) => entry.account.id)]);
  const emptied = await countDemoRows(admin, plan);
  assert.deepEqual(Object.entries(emptied).filter(([, count]) => count !== 0), [], "le retrait a laissé des lignes");
  /* Le retrait laisse les liens des annonces et demandes parties
     (retire_slug, migration 11) : un lien partagé ne désignera pas une
     autre annonce. */
  const retired = await db.query("select count(*)::integer as count from public.retired_slugs");
  assert.equal(retired.rows[0].count, TABLES.listings.length + plan.deletedAccountReviews.length + TABLES.wanted.length);

  await seedDemo(admin, plan, SECRETS);
  assert.deepEqual(await countDemoRows(admin, plan), expectedCounts(plan));

  /* Ce qui l'a permis : check_permalink ne tient que le rôle connecté. Le
     même lien, déposé par le vendeur lui-même, est refusé — la démonstration
     n'aurait pas pu se recharger sans l'exemption. */
  const [mock] = TABLES.listings;
  if (!mock) throw new Error("aucune annonce de démonstration");
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [demoId(mock.seller_id)]);
  await assert.rejects(
    db.query(
      "insert into public.listings (id, slug, seller_id, game_id, title, description, lot_type, condition, language, price_cents, city, postal_code, department_code, latitude, longitude) values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)",
      [mock.slug, demoId(mock.seller_id), mock.game_id, mock.title, mock.description, mock.lot_type, mock.condition, mock.language, mock.price_cents, mock.city, mock.postal_code, mock.department_code, mock.latitude, mock.longitude],
    ),
    /ne finit pas par l'identifiant|a déjà servi/,
  );
});
