import assert from "node:assert/strict";
import test from "node:test";
import { buildPreviewListing, checksForGame, getDraftPriceLabel, getMissingPreviewChoices } from "../src/lib/listing-draft.ts";
import { getCityBySlug } from "../src/lib/cities.ts";
import { getEditionById } from "../src/lib/editions.ts";
import { EMPTY_LISTING_DRAFT, NOW, SELLER } from "./fixtures.mjs";

/* Les séries que le formulaire aurait reçues du serveur (/series). */
const KNOWN = new Map(["magic-mh3", "pokemon-ev08"].map((id) => [id, getEditionById(id)]));

test("l'aperçu se dessine dès l'arrivée, en emplacements vides plutôt qu'en valeurs supposées", () => {
  /* Il attendait jeu, format, état et langue, et restait un cadre vide
     pendant toute la première moitié du formulaire. */
  const listing = buildPreviewListing(EMPTY_LISTING_DRAFT, [], SELLER, NOW, null, KNOWN);
  assert.equal(listing.gameId, null);
  assert.equal(listing.lotType, null);
  assert.equal(listing.condition, null);
  assert.equal(listing.language, null);
  assert.equal(listing.openToTrade, false);
});

test("un nom hérité d'Object n'est ni un format, ni un état, ni une langue", () => {
  /* Le brouillon testait « valeur in LOT_TYPE_LABELS » : `in` remonte la
     chaîne des prototypes, et « constructor » passait pour un format de lot,
     que l'aperçu aurait affiché comme une fonction. */
  const listing = buildPreviewListing(
    { ...EMPTY_LISTING_DRAFT, lotType: "constructor", condition: "toString", language: "__proto__" },
    [],
    SELLER,
    NOW,
    null,
    KNOWN,
  );
  assert.equal(listing.lotType, null);
  assert.equal(listing.condition, null);
  assert.equal(listing.language, null);
});

test("l'aperçu montre les séries et produits cochés, pas ceux d'un autre jeu", () => {
  const listing = buildPreviewListing(
    { ...EMPTY_LISTING_DRAFT, gameId: "magic", editions: ["magic-mh3", "pokemon-ev08"], tags: ["playmat", "etb"] },
    [],
    SELLER,
    NOW,
    null,
    KNOWN,
  );
  assert.deepEqual(listing.editions.map((edition) => edition.code), ["MH3"]);
  assert.deepEqual(listing.tags, ["playmat"]);
});

test("changer de jeu ne laisse cochées que les valeurs par défaut qui existent pour lui", () => {
  assert.deepEqual(
    checksForGame("magic", { editions: ["magic-mh3", "pokemon-ev08"], tags: ["etb", "playmat"] }),
    { editions: ["magic-mh3"], tags: ["playmat"] },
  );
  assert.deepEqual(checksForGame(""), { editions: [], tags: [] });
});

test("l'aperçu dit ce qui manque au lieu de supposer un jeu ou un état", () => {
  assert.deepEqual(getMissingPreviewChoices(EMPTY_LISTING_DRAFT), ["le jeu", "le format", "l'état", "la langue"]);
  assert.deepEqual(
    getMissingPreviewChoices({ ...EMPTY_LISTING_DRAFT, gameId: "magic", lotType: "bulk", condition: "NM", language: "EN" }),
    [],
  );
});

test("un prix non saisi s'affiche « — €», jamais « 0 € »", () => {
  assert.equal(getDraftPriceLabel(EMPTY_LISTING_DRAFT), "— €");
  assert.equal(getDraftPriceLabel({ ...EMPTY_LISTING_DRAFT, priceEuros: "35" }), undefined);
});

test("un nombre de cartes non saisi reste inconnu dans l'aperçu", () => {
  const listing = buildPreviewListing(
    { ...EMPTY_LISTING_DRAFT, gameId: "pokemon", lotType: "bulk", condition: "mixed", language: "VF", cardCount: "", city: "Avignon" },
    [],
    SELLER,
    NOW,
    getCityBySlug("avignon"),
    KNOWN,
  );
  assert.equal(listing.cardCount, null);
  assert.equal(listing.weightKg, null);
  assert.equal(listing.postalCode, "84000");
});

test("les virgules décimales du brouillon sont lues comme au dépôt", () => {
  const listing = buildPreviewListing(
    { ...EMPTY_LISTING_DRAFT, gameId: "pokemon", lotType: "bulk", condition: "mixed", language: "VF", weightKg: "1,5", priceEuros: "42,50" },
    [],
    SELLER,
    NOW,
    null,
    KNOWN,
  );
  assert.equal(listing.weightKg, 1.5);
  assert.equal(listing.priceCents, 4250);
});
