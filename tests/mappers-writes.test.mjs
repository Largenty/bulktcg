import assert from "node:assert/strict";
import test from "node:test";
import {
  nextPreviousPriceCents,
  toListingEditionInserts,
  toListingInsert,
  toListingPhotoInserts,
  toListingStatusUpdate,
  toListingUpdate,
  toMessageInsert,
  toReviewInsert,
  toWantedInsert,
  toWantedStatusUpdate,
} from "../src/lib/data/mappers.ts";

/* Écriture : du formulaire validé vers les lignes à écrire. La lecture est
   dans mappers.test.mjs. */

const FORM_VALUES = {
  title: "Vrac 400 cartes Pokémon",
  gameId: "pokemon",
  lotType: "bulk",
  condition: "mixed",
  language: "VF",
  cardCount: null,
  weightKg: 1.5,
  priceEuros: 42.5,
  city: "Carpentras",
  postalCode: "84200",
  description: "Quatre cents cartes, remise en main propre à Carpentras.",
  editions: ["pokemon-ev08", "pokemon-ev07"],
  tags: ["booster-pack"],
  photos: ["local:a"],
};

test("toListingInsert n'écrit que des colonnes snake_case, coordonnées tirées du référentiel", () => {
  const row = toListingInsert(FORM_VALUES, "u-01", "vrac-400-cartes-pokemon-carpentras-x1", "2cdc28f0-017a-49c4-9ed7-87056c839011");
  /* L'identifiant tiré par le formulaire part avec la ligne : un double
     envoi retombe sur elle (migration 11). */
  assert.equal(row.id, "2cdc28f0-017a-49c4-9ed7-87056c839011");
  assert.equal(row.price_cents, 4250);
  assert.equal(row.card_count, null, "un lot non compté reste null, jamais 0");
  assert.equal(row.department_code, "84");
  assert.ok(Math.abs(row.latitude - 44.05) < 0.1);
  assert.equal(row.status, "available");
  for (const key of Object.keys(row)) assert.match(key, /^[a-z_]+$/, `clé non snake_case : ${key}`);
});

test("baisser le prix garde l'ancien pour afficher la baisse, le remonter l'efface", () => {
  const current = { priceCents: 5000, previousPriceCents: null };
  assert.equal(nextPreviousPriceCents(current, 4000), 5000);
  assert.equal(nextPreviousPriceCents({ priceCents: 4000, previousPriceCents: 5000 }, 4500), null);
  assert.equal(nextPreviousPriceCents({ priceCents: 4000, previousPriceCents: 5000 }, 4000), 5000);
  const update = toListingUpdate(FORM_VALUES, { priceCents: 6000, previousPriceCents: null });
  assert.equal(update.previous_price_cents, 6000);
  assert.equal("slug" in update, false, "une modification ne réécrit jamais le lien permanent");
  assert.equal("seller_id" in update, false);
  assert.equal("id" in update, false, "une modification ne change pas l'identifiant");
});

test("les séries gardent leur ordre de saisie", () => {
  assert.deepEqual(toListingEditionInserts(FORM_VALUES), [
    { edition_id: "pokemon-ev08", position: 0 },
    { edition_id: "pokemon-ev07", position: 1 },
  ]);
});

test("une photo restée sur l'appareil ne peut pas être écrite en base", () => {
  assert.throws(() => toListingPhotoInserts(["local:a"]), /téléversée/);
  assert.deepEqual(toListingPhotoInserts(["storage:2cdc28f0-017a-49c4-9ed7-87056c839011", "https://images.unsplash.com/p"]), [
    { storage_path: "2cdc28f0-017a-49c4-9ed7-87056c839011", position: 0 },
    { storage_path: "https://images.unsplash.com/p", position: 1 },
  ]);
});

test("passer en « Vendu » date la vente, en sortir l'efface", () => {
  assert.deepEqual(toListingStatusUpdate("sold", "2026-09-29T10:00:00.000Z"), {
    status: "sold",
    sold_at: "2026-09-29T10:00:00.000Z",
  });
  assert.equal(toListingStatusUpdate("reserved", "2026-09-29T10:00:00.000Z").sold_at, null);
});

test("une demande sans budget ni format s'écrit null, pas zéro ni chaîne vide", () => {
  const row = toWantedInsert(
    {
      title: "Cherche vrac Pokémon",
      gameId: "pokemon",
      lotType: "",
      maxPriceEuros: null,
      minCardCount: null,
      city: "Avignon",
      postalCode: "84000",
      maxDistanceKm: 30,
      description: "Toutes séries, tout état accepté.",
    },
    "u-01",
    "cherche-vrac-pokemon-avignon-x1",
    "3cdc28f0-017a-49c4-9ed7-87056c839011",
  );
  assert.equal(row.id, "3cdc28f0-017a-49c4-9ed7-87056c839011");
  assert.equal(row.lot_type, null);
  assert.equal(row.max_price_cents, null);
  assert.equal(row.status, "open");
  assert.deepEqual(toWantedStatusUpdate("fulfilled", "2026-09-29T10:00:00.000Z").fulfilled_at, "2026-09-29T10:00:00.000Z");
  assert.equal(toWantedStatusUpdate("closed", "2026-09-29T10:00:00.000Z").fulfilled_at, null);
});

test("un message est écrit sans ses espaces de bord", () => {
  assert.deepEqual(toMessageInsert({ conversationId: "c-1", senderId: "u-01", body: "  Bonjour  " }), {
    conversation_id: "c-1",
    sender_id: "u-01",
    body: "Bonjour",
  });
});

test("toReviewInsert ne laisse passer ni commentaire vide ni personne notée", () => {
  const insert = toReviewInsert({ dealId: "d-1", reviewerId: "u-1", scores: { punctuality: 5, responsiveness: 5, reliability: 4 }, comment: "   " });
  assert.equal(insert.comment, null);
  assert.equal("reviewed_id" in insert, false);
  assert.deepEqual(Object.keys(insert).sort(), ["comment", "deal_id", "punctuality", "reliability", "responsiveness", "reviewer_id"]);
});

test("une note d'échange sans échange ouvert n'est pas envoyée", () => {
  const values = {
    title: "Vrac 400 cartes Pokémon",
    gameId: "pokemon",
    lotType: "bulk",
    condition: "mixed",
    language: "VF",
    cardCount: 400,
    weightKg: null,
    priceEuros: 35,
    city: "Avignon",
    postalCode: "84000",
    description: "Quatre cents cartes des séries récentes, remise en main propre.",
    editions: [],
    tags: [],
    photos: ["local:abc"],
    audience: "everyone",
    openToTrade: false,
    tradeNote: "du vrac Magic",
  };
  const closed = toListingInsert(values, "u-1", "vrac");
  assert.equal(closed.open_to_trade, false);
  assert.equal(closed.trade_note, null);
  const open = toListingInsert({ ...values, openToTrade: true }, "u-1", "vrac");
  assert.equal(open.open_to_trade, true);
  assert.equal(open.trade_note, "du vrac Magic");
  assert.equal(toListingInsert({ ...values, openToTrade: true, tradeNote: "" }, "u-1", "vrac").trade_note, null);
});
