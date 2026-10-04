import assert from "node:assert/strict";
import test from "node:test";
import { toListing } from "../src/lib/data/mappers.ts";
import { TABLES } from "../src/lib/data/source.ts";
import {
  toConversationRowWithRelations,
  toListingRowWithRelations,
  toReviewRowWithRelations,
  toWantedRowWithRelations,
} from "../src/lib/data/supabase-rows.ts";
import { PRODUCT_TAG_IDS } from "../src/lib/product-tags.ts";

/* Une réponse de PostgREST, telle que la rend le select de source.ts : les
   horodatages en « +00:00 », une jointure vide parfois null, une relation
   à une ligne parfois en tableau, et les lignes jointes dans l'ordre de la
   base. La conversion la ramène à la forme des lignes de la démonstration,
   que les modules et les mappers lisent sans savoir d'où elle vient. */

const postgrestTime = (iso) => iso.replace(/Z$/, "+00:00");

function asPostgrestListing(row, overrides = {}) {
  const { seller, photos, editions, tags, ...columns } = row;
  return {
    ...columns,
    created_at: postgrestTime(columns.created_at),
    updated_at: postgrestTime(columns.updated_at),
    seller,
    photos,
    editions: editions.toReversed(),
    /* À rebours du référentiel : un ordre que la conversion doit défaire. */
    tags: tags.toSorted((left, right) => PRODUCT_TAG_IDS.indexOf(right.tag) - PRODUCT_TAG_IDS.indexOf(left.tag)),
    ...overrides,
  };
}

const listingWithTags = TABLES.listings.find((row) => row.tags.length > 1 && row.editions.length > 1);

test("une annonce de PostgREST redevient une ligne de la démonstration, et toListing la lit", () => {
  assert.ok(listingWithTags, "aucune annonce de démonstration n'a deux produits et deux séries");
  const row = toListingRowWithRelations(asPostgrestListing(listingWithTags, { photos: null }));
  assert.deepEqual(row.seller, listingWithTags.seller);
  assert.deepEqual(row.photos, [], "une jointure vide arrive parfois null : elle redevient []");
  assert.deepEqual(
    row.tags.map((tag) => tag.tag),
    PRODUCT_TAG_IDS.filter((tag) => listingWithTags.tags.some((candidate) => candidate.tag === tag)),
    "les produits suivent l'ordre du référentiel, pas celui de la base",
  );
  const listing = toListing(row);
  assert.equal(listing.id, listingWithTags.id);
  assert.deepEqual(
    listing.editions.map((edition) => edition.id),
    toListing(listingWithTags).editions.map((edition) => edition.id),
    "les séries suivent leur position, quel que soit l'ordre de la réponse",
  );
});

test("une annonce sans vendeur est une dérive de la base : elle lève", () => {
  assert.throws(() => toListingRowWithRelations(asPostgrestListing(listingWithTags, { seller: null })), /Ligne incomplète en base/);
});

const conversation = TABLES.conversations.find((row) => row.deal !== null && row.messages.length > 0);

function asPostgrestConversation(row, overrides = {}) {
  return { ...row, messages: row.messages.toReversed(), ...overrides };
}

test("une conversation de PostgREST garde sa vente, qu'elle arrive en objet ou en tableau", () => {
  assert.ok(conversation, "aucune conversation de démonstration n'a de vente et de messages");
  for (const deal of [conversation.deal, [conversation.deal]]) {
    const row = toConversationRowWithRelations(asPostgrestConversation(conversation, { deal }));
    assert.deepEqual(row.deal, conversation.deal);
    assert.equal(row.messages.length, conversation.messages.length);
  }
  assert.equal(toConversationRowWithRelations(asPostgrestConversation(conversation, { deal: [] })).deal, null);
  assert.equal(toConversationRowWithRelations(asPostgrestConversation(conversation, { deal: null })).deal, null);
  const empty = toConversationRowWithRelations(asPostgrestConversation(conversation, { messages: null, deal: { ...conversation.deal, reviews: null } }));
  assert.deepEqual(empty.messages, []);
  assert.deepEqual(empty.deal?.reviews, []);
});

test("une conversation dont l'annonce ou une partie manque lève : la RLS les laisse lire aux deux parties", () => {
  assert.throws(() => toConversationRowWithRelations(asPostgrestConversation(conversation, { listing: null })), /l'annonce de la conversation/);
  assert.throws(() => toConversationRowWithRelations(asPostgrestConversation(conversation, { buyer: [] })), /l'acheteur de la conversation/);
});

test("un avis garde son annonce et son auteur absents : ce sont des réponses, pas des dérives", () => {
  const review = TABLES.reviews.find((row) => row.listing !== null && row.reviewer !== null);
  assert.ok(review);
  const hidden = toReviewRowWithRelations({ ...review, listing: null, reviewer: null });
  assert.equal(hidden.listing, null, "un lot réservé aux pros ne fuit pas par un avis");
  assert.equal(hidden.reviewer, null, "un auteur supprimé");
  assert.deepEqual(toReviewRowWithRelations({ ...review, listing: [review.listing], reviewer: review.reviewer }), review);
});

test("une demande garde son auteur, et lève sans lui", () => {
  const wanted = TABLES.wanted[0];
  assert.deepEqual(toWantedRowWithRelations({ ...wanted, buyer: [wanted.buyer] }), wanted);
  assert.throws(() => toWantedRowWithRelations({ ...wanted, buyer: null }), /l'auteur de la demande/);
});
