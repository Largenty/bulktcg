import assert from "node:assert/strict";
import test from "node:test";
import {
  TABLES,
  conversationRows,
  conversationStartRows,
  dealRows,
  isSupabaseMode,
  notificationRows,
  photoUploadRows,
  proOnlyCountRows,
  profileRows,
  publicListingRows,
  readableListingRows,
  reviewRows,
  waitlistCountsFor,
  waitlistRows,
  wantedRows,
} from "../src/lib/data/source.ts";

/* Les chargeurs de source.ts, en démonstration : ils rendent les lignes de
   TABLES, et la démonstration se comporte exactement comme avant la phase 2.
   Les modules refont les tris de visibilité derrière eux ; sans ce test, un
   chargeur qui perdrait le sien passerait inaperçu en démonstration et
   laisserait fuir le jour où la RLS ne le doublerait plus. */

test("sans Supabase configuré, les chargeurs lisent la démonstration", () => {
  assert.equal(isSupabaseMode(), false);
});

test("chaque chargeur rend la table de la démonstration, telle quelle", async () => {
  const loaders = [
    [readableListingRows, TABLES.listings],
    [profileRows, TABLES.profiles],
    [reviewRows, TABLES.reviews],
    [wantedRows, TABLES.wanted],
    [conversationRows, TABLES.conversations],
    [conversationStartRows, TABLES.conversationStarts],
    [dealRows, TABLES.deals],
    [notificationRows, TABLES.notifications],
    [waitlistRows, TABLES.waitlist],
    [photoUploadRows, TABLES.photoUploads],
  ];
  for (const [load, rows] of loaders) assert.equal(await load(), rows, `${load.name || "un chargeur"} ne rend plus TABLES`);
});

test("un visiteur anonyme ne lit que les annonces ouvertes à tous", async () => {
  const rows = await publicListingRows();
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.audience === "everyone"), "une annonce réservée aux pros sort du chargeur public");
  assert.equal(rows.length, TABLES.listings.filter((row) => row.audience === "everyone").length);
  assert.ok(TABLES.listings.some((row) => row.audience === "pros"), "la démonstration n'a plus de lot réservé : le test ne vérifie rien");
});

test("les lots réservés aux pros se comptent par jeu, sans les lots vendus", async () => {
  const count = async () => new Map((await proOnlyCountRows()).map((row) => [row.game_id, row.listing_count]));
  const expected = new Map();
  for (const row of TABLES.listings) {
    if (row.audience === "pros" && row.status !== "sold") expected.set(row.game_id, (expected.get(row.game_id) ?? 0) + 1);
  }
  assert.ok(expected.size > 0, "la démonstration n'a plus de lot réservé : le test ne vérifie rien");
  assert.deepEqual(await count(), expected);

  /* La démonstration n'a aucun lot réservé vendu : on en glisse un, puis un
     disponible, le temps de vérifier que seul le second compte. */
  const model = TABLES.listings.find((row) => row.audience === "pros");
  const sold = { ...model, id: "l-test-sold", status: "sold" };
  const available = { ...model, id: "l-test-available", status: "available" };
  TABLES.listings.push(sold, available);
  try {
    const counted = await count();
    assert.equal(counted.get(model.game_id), (expected.get(model.game_id) ?? 0) + 1, "un lot vendu compte, ou un lot ajouté ne compte pas");
  } finally {
    TABLES.listings.splice(TABLES.listings.indexOf(sold), 2);
  }
  assert.deepEqual(await count(), expected);
});

test("une liste d'attente se compte pour les lots demandés, et pour eux seuls", async () => {
  const waited = [...new Set(TABLES.waitlist.map((row) => row.listing_id))];
  assert.ok(waited.length > 0, "la démonstration n'a plus de liste d'attente : le test ne vérifie rien");
  const [first, ...others] = waited.map((id) => TABLES.listings.find((row) => row.id === id));
  assert.ok(first);
  const counts = await waitlistCountsFor([first]);
  assert.deepEqual([...counts.keys()], [first.id], "un lot non demandé apparaît dans les comptes");
  assert.equal(counts.get(first.id), TABLES.waitlist.filter((row) => row.listing_id === first.id).length);
  assert.equal((await waitlistCountsFor(others.filter(Boolean))).size, others.length);
  assert.equal((await waitlistCountsFor([])).size, 0);
});
