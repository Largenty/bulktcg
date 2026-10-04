import assert from "node:assert/strict";
import test from "node:test";
import {
  toConversation,
  toListing,
  toReview,
  toSellerProfile,
  toSellerSummary,
} from "../src/lib/data/mappers.ts";
import { LISTING_ROW, PROFILE_ROW } from "./fixtures.mjs";

/* Lecture : des lignes de la base vers le domaine. L'écriture, dans l'autre
   sens, est dans mappers-writes.test.mjs. */

test("le statut professionnel porte le badge, le forfait seul ouvre les lots réservés", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const shop = { ...PROFILE_ROW, account_type: "pro", company_name: "Le Repaire" };

  const active = toSellerSummary({ ...shop, pro_until: future });
  assert.equal(active.isPro, true);
  assert.equal(active.hasProPlan, true);
  assert.equal(active.companyName, "Le Repaire");

  /* Forfait expiré, ou jamais pris : toujours un professionnel — l'acheteur
     doit le savoir —, mais plus rien de plus qu'un particulier à voir. */
  for (const proUntil of [past, null]) {
    const lapsed = toSellerSummary({ ...shop, pro_until: proUntil });
    assert.equal(lapsed.isPro, true, "une boutique sans forfait se présente comme un particulier");
    assert.equal(lapsed.hasProPlan, false);
  }

  const person = toSellerSummary(PROFILE_ROW);
  assert.equal(person.isPro, false);
  assert.equal(person.hasProPlan, false);
  assert.equal(person.companyName, null);

  assert.throws(() => toSellerSummary({ ...PROFILE_ROW, account_type: "boutique" }), /profiles\.account_type/);
});

test("l'audience d'une annonce est convertie et vérifiée", () => {
  assert.equal(toListing(LISTING_ROW).audience, "everyone");
  assert.equal(toListing({ ...LISTING_ROW, audience: "pros" }).audience, "pros");
  assert.throws(() => toListing({ ...LISTING_ROW, audience: "amis" }), /listings\.audience/);
});

test("toSellerSummary convertit chaque colonne snake_case", () => {
  const seller = toSellerSummary(PROFILE_ROW);
  assert.equal(seller.postalCode, "84000");
  assert.equal(seller.avatarInitials, "VE");
  assert.equal(seller.ratingAvg, 4.6);
  assert.equal(seller.ratingCount, 12);
  assert.ok(!("postal_code" in seller), "une colonne snake_case a fui vers le domaine");
});

test("un rating_avg null reste null et n'est pas coalescé en 0", () => {
  const seller = toSellerSummary({ ...PROFILE_ROW, rating_avg: null, rating_count: 0 });
  assert.equal(seller.ratingAvg, null);
  assert.notEqual(seller.ratingAvg, 0);
});

test("toSellerProfile prend le compte d'annonces actives en paramètre, il ne l'invente pas", () => {
  const profile = toSellerProfile(PROFILE_ROW, 3);
  assert.equal(profile.activeListingCount, 3);
  assert.equal(profile.soldListingCount, 18);
});

test("la présentation du profil reste null quand le vendeur n'a rien écrit", () => {
  assert.equal(toSellerProfile(PROFILE_ROW, 0).bio, null);
});

test("la note d'un profil se détaille critère par critère, et reste nulle sans avis", () => {
  const profile = toSellerProfile(PROFILE_ROW, 3);
  assert.deepEqual(profile.ratingBreakdown, { punctuality: 4.8, responsiveness: 4.3, reliability: 4.7 });
  const fresh = toSellerProfile(
    { ...PROFILE_ROW, rating_avg: null, rating_count: 0, punctuality_avg: null, responsiveness_avg: null, reliability_avg: null },
    0,
  );
  assert.deepEqual(fresh.ratingBreakdown, { punctuality: null, responsiveness: null, reliability: null });
});

test("la fiche boutique suit le statut professionnel, forfait ou non", () => {
  const shop = {
    siret: "55203253400703",
    legal_name: "DANONE",
    pro_verified_at: "2026-10-02T08:00:00.000Z",
    shop_address: "Rue Carnot, 84000 Avignon",
    shop_hours: "Du mardi au samedi",
    shop_website: "https://boutique.example",
    cardmarket_url: "https://www.cardmarket.com/fr/Magic/Users/Boutique",
    cardnexus_url: null,
  };
  const pro = { ...PROFILE_ROW, ...shop, account_type: "pro", company_name: "Boutique", pro_until: "2999-01-01T00:00:00.000Z" };
  const expected = {
    siret: "55203253400703",
    legalName: "DANONE",
    verifiedAt: "2026-10-02T08:00:00.000Z",
    address: "Rue Carnot, 84000 Avignon",
    hours: "Du mardi au samedi",
    website: "https://boutique.example",
    cardmarketUrl: "https://www.cardmarket.com/fr/Magic/Users/Boutique",
    cardnexusUrl: null,
  };
  assert.deepEqual(toSellerProfile(pro, 0).shop, expected);
  /* Forfait expiré : la boutique reste une boutique, fiche comprise. */
  assert.deepEqual(toSellerProfile({ ...pro, pro_until: "2020-01-01T00:00:00.000Z" }, 0).shop, expected);
  assert.equal(toSellerProfile(PROFILE_ROW, 0).shop, null);
});

test("toListing convertit tout et n'expose aucune clé de base", () => {
  const listing = toListing(LISTING_ROW);
  assert.equal(listing.priceCents, 4250);
  assert.equal(listing.previousPriceCents, 5000);
  assert.equal(listing.departmentCode, "84");
  assert.equal(listing.gameId, "magic");
  assert.equal(listing.seller.username, "vendeuse_test");
  const keys = Object.keys(listing);
  assert.deepEqual(
    keys.filter((key) => key.includes("_")),
    [],
    "une clé snake_case a traversé le mapper",
  );
});

test("les photos sont remises dans l'ordre de position", () => {
  const listing = toListing(LISTING_ROW);
  assert.deepEqual(
    listing.photos.map((photo) => photo.id),
    ["l-99-p1", "l-99-p2"],
  );
  /* storage_path relatif sans base de stockage configurée : l'URL reste null
     plutôt que de pointer nulle part. */
  assert.equal(listing.photos[0].url, null);
});

test("une URL absolue en base est servie telle quelle", () => {
  const listing = toListing({
    ...LISTING_ROW,
    photos: [
      {
        id: "l-99-p1",
        listing_id: "l-99",
        storage_path: "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3",
        position: 0,
      },
    ],
  });
  assert.equal(listing.photos[0].url, "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3");
});

test("la graine d'une photo est dérivée de son identifiant, donc stable", () => {
  const first = toListing(LISTING_ROW).photos[0].seed;
  const second = toListing(LISTING_ROW).photos[0].seed;
  assert.equal(first, second);
  assert.ok(Number.isInteger(first));
});

test("les champs mesurables absents restent null", () => {
  const listing = toListing({ ...LISTING_ROW, card_count: null, weight_kg: null });
  assert.equal(listing.cardCount, null);
  assert.equal(listing.weightKg, null);
});

test("une valeur d'énumération inconnue lève au lieu de passer en silence", () => {
  assert.throws(() => toListing({ ...LISTING_ROW, status: "archived" }), /listings\.status/);
  assert.throws(() => toListing({ ...LISTING_ROW, game_id: "digimon" }), /listings\.game_id/);
  assert.throws(() => toListing({ ...LISTING_ROW, condition: "GEM" }), /listings\.condition/);
});

const CONVERSATION_ROW = {
  id: "c-99",
  listing_id: "l-99",
  buyer_id: "u-98",
  seller_id: "u-99",
  created_at: "2025-02-01T10:00:00.000Z",
  last_message_at: "2025-02-01T12:00:00.000Z",
  listing: {
    id: "l-99",
    slug: "lot-test-avignon-99",
    title: "Lot de test",
    price_cents: 4250,
    status: "available",
    game_id: "magic",
    audience: "everyone",
    photos: LISTING_ROW.photos,
  },
  buyer: { ...PROFILE_ROW, id: "u-98", username: "acheteur_test" },
  seller: PROFILE_ROW,
  messages: [
    {
      id: "c-99-m2",
      conversation_id: "c-99",
      sender_id: "u-98",
      body: "Deuxième",
      read_at: null,
      created_at: "2025-02-01T12:00:00.000Z",
    },
    {
      id: "c-99-m1",
      conversation_id: "c-99",
      sender_id: "u-99",
      body: "Premier",
      read_at: "2025-02-01T11:00:00.000Z",
      created_at: "2025-02-01T11:00:00.000Z",
    },
  ],
};

/* Le lecteur est « u-99 », le vendeur : le message non lu vient de l'acheteur
   « u-98 » et compte donc pour lui. */
test("toConversation calcule les non-lus et retient le dernier message", () => {
  const conversation = toConversation(CONVERSATION_ROW, "u-99");

  assert.equal(conversation.lastMessage.body, "Deuxième");
  assert.equal(conversation.unreadCount, 1);
  assert.equal(conversation.listing.priceCents, 4250);
  assert.equal(conversation.listing.gameId, "magic");
  assert.equal(conversation.buyer.username, "acheteur_test");
});

/* Le bug que ce test attrape : un message qu'on a soi-même envoyé est non lu
   tant que l'autre ne l'a pas ouvert. Le compter ferait clignoter sa propre
   boîte de réception, et la pastille d'en-tête ne redescendrait jamais. */
test("un message qu'on a envoyé soi-même n'est pas un non-lu pour soi", () => {
  const asSender = toConversation(CONVERSATION_ROW, "u-98");
  assert.equal(asSender.unreadCount, 0);
});

test("le jeu d'une conversation est rétréci comme celui d'une annonce", () => {
  assert.throws(
    () =>
      toConversation(
        { ...CONVERSATION_ROW, listing: { ...CONVERSATION_ROW.listing, game_id: "digimon" } },
        "u-99",
      ),
    /listings\.game_id/,
  );
});

test("toReview calcule la note sur ses trois critères et garde le titre hors du cercle", () => {
  const row = {
    id: "r-99",
    deal_id: "d-99",
    listing_id: "l-99",
    reviewer_id: "u-98",
    reviewed_id: "u-99",
    reviewed_role: "seller",
    punctuality: 5,
    responsiveness: 4,
    reliability: 3,
    comment: null,
    created_at: "2026-09-01T10:00:00.000Z",
    listing: { slug: "lot-de-test", title: "Lot de test" },
    reviewer: { username: "acheteur_test", avatar_initials: "AC" },
  };
  const review = toReview(row);
  assert.deepEqual(review.scores, { punctuality: 5, responsiveness: 4, reliability: 3 });
  /* La moyenne des trois critères, comme public.refresh_rating. */
  assert.equal(review.rating, 4);
  assert.equal(review.reviewedRole, "seller");
  assert.deepEqual(review.listing, { slug: "lot-de-test", title: "Lot de test" });
  assert.equal(review.comment, null);
  /* Une annonce que le lecteur ne peut pas lire n'a pas de titre dans l'avis. */
  assert.deepEqual(toReview({ ...row, listing: null }).listing, { unavailable: "pro-only" });
  /* Un rôle inconnu en base lève, comme toute énumération. */
  assert.throws(() => toReview({ ...row, reviewed_role: "moderator" }));
});

test("un avis dont l'auteur a supprimé son compte se convertit sans lever, et le dit", () => {
  /* La base garde l'avis à la personne notée (on delete set null) : la
     vente, l'annonce et l'auteur y sont nuls. Le mapper lisait
     row.reviewer.username et aurait fait tomber le profil entier. */
  const orphan = {
    id: "r-98",
    deal_id: null,
    listing_id: null,
    reviewer_id: null,
    reviewed_id: "u-99",
    reviewed_role: "buyer",
    punctuality: 4,
    responsiveness: 4,
    reliability: 5,
    comment: "Ponctuel.",
    created_at: "2026-09-01T10:00:00.000Z",
    listing: null,
    reviewer: null,
  };
  const review = toReview(orphan);
  assert.equal(review.reviewerId, null);
  assert.equal(review.reviewerUsername, null);
  assert.equal(review.dealId, null);
  assert.equal(review.rating, 4.3);
  /* Sans annonce du tout, elle est partie avec son vendeur : ce n'est pas
     un lot réservé aux pros, et l'avis ne doit pas le prétendre. */
  assert.deepEqual(review.listing, { unavailable: "deleted" });
});

test("les séries sont résolues contre le référentiel et remises dans l'ordre de saisie", () => {
  const listing = toListing(LISTING_ROW);
  assert.deepEqual(listing.editions.map((edition) => edition.code), ["MH3", "MH2"]);
  assert.equal(listing.editions[0].name, "Modern Horizons 3");
  assert.deepEqual(listing.tags, ["binder-included"]);
});

test("une série absente du référentiel lève au lieu de passer en silence", () => {
  /* Même règle que pour les énumérations : une dérive entre la base et le
     référentiel doit se voir tout de suite, pas produire une annonce dont la
     série s'affiche « undefined ». */
  assert.throws(
    () =>
      toListing({
        ...LISTING_ROW,
        editions: [{ listing_id: "l-99", edition_id: "magic-inexistant", position: 0 }],
      }),
    /Édition inconnue/,
  );
});

test("un produit inconnu lève aussi", () => {
  assert.throws(
    () => toListing({ ...LISTING_ROW, tags: [{ listing_id: "l-99", tag: "hologramme" }] }),
    /listing_tags.tag/,
  );
});

test("une annonce sans série ni produit donne deux listes vides, pas undefined", () => {
  const listing = toListing({ ...LISTING_ROW, editions: [], tags: [] });
  assert.deepEqual(listing.editions, []);
  assert.deepEqual(listing.tags, []);
});
