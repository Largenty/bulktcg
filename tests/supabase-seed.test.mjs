import assert from "node:assert/strict";
import test from "node:test";
import { TABLES } from "../src/lib/data/source.ts";
import {
  DEMO_EMAIL_DOMAIN,
  DEMO_NAMESPACE,
  SEED_STEPS,
  buildSeedPlan,
  demoEmail,
  demoId,
  generateDemoPassword,
  uuidV5,
} from "../scripts/supabase-seed/plan.mjs";

/* Le chargement des données de démonstration dans Supabase
   (scripts/supabase-seed.mjs), sans réseau : les identifiants, l'ordre que
   les déclencheurs acceptent, et des clés étrangères qui visent toutes une
   ligne chargée avant elles. */

const plan = buildSeedPlan(TABLES);
const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("les identifiants sont des UUID v5, stables d'un passage à l'autre, un par identifiant de démonstration", () => {
  /* Le vecteur de la documentation de Python : uuid5(NAMESPACE_DNS, "python.org"). */
  assert.equal(uuidV5("python.org", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"), "886313e1-3b8a-5372-9b90-0c9aee199e5d");
  assert.equal(demoId("u-01"), uuidV5("u-01", DEMO_NAMESPACE));
  assert.equal(demoId("u-01"), demoId("u-01"));
  const mockIds = [
    ...TABLES.profiles.map((row) => row.id),
    ...TABLES.listings.map((row) => row.id),
    ...TABLES.wanted.map((row) => row.id),
    ...TABLES.conversations.map((row) => row.id),
    ...TABLES.conversationStarts.keys(),
    ...TABLES.deals.map((row) => row.id),
    ...TABLES.reviews.map((row) => row.id),
    ...TABLES.notifications.map((row) => row.id),
    ...TABLES.conversations.flatMap((row) => row.messages.map((message) => message.id)),
  ];
  const ids = mockIds.map(demoId);
  assert.ok(ids.every((id) => UUID_V5.test(id)), "un identifiant n'est pas un UUID v5");
  assert.equal(new Set(ids).size, new Set(mockIds).size, "deux identifiants de démonstration tombent sur le même UUID");
});

test("chaque compte a une adresse du domaine réservé, et le mot de passe tiré passe toute règle de composition", () => {
  assert.equal(DEMO_EMAIL_DOMAIN, "bulktcg.example");
  assert.equal(demoEmail("lecomptoirdukado"), "lecomptoirdukado@bulktcg.example");
  assert.equal(plan.accounts.length, TABLES.profiles.length);
  for (const account of plan.accounts) {
    assert.match(account.email, /^[a-z0-9._-]{3,24}@bulktcg\.example$/);
    assert.match(account.metadata.username, /^[a-z0-9._-]{3,24}$/, "le pseudo ne passerait pas la contrainte de profiles");
  }
  const [first, second] = [generateDemoPassword(), generateDemoPassword()];
  assert.notEqual(first, second);
  for (const pattern of [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/]) assert.match(first, pattern);
  assert.ok(first.length >= 32);
});

test("l'ordre du chargement respecte les dépendances de chaque étape", () => {
  const seen = new Set();
  for (const step of SEED_STEPS) {
    for (const dependency of step.dependsOn) assert.ok(seen.has(dependency), `${step.name} passe avant ${dependency}`);
    seen.add(step.name);
  }
  /* Les contraintes qui ont décidé de l'ordre : une annonce, ses séries et
     ses produits sont finis avant sa vente clôturée, qui les fige
     (freeze_listing_after_deal, freeze_listing_parts_after_deal). */
  const deals = SEED_STEPS.find((step) => step.name === "deals");
  const frozen = ["listing_editions", "listing_finishes", "listing_tags"];
  assert.deepEqual(deals?.dependsOn.filter((name) => frozen.includes(name)).sort(), frozen);
});

test("chaque clé étrangère vise une ligne chargée", () => {
  const accounts = new Set(plan.accounts.map((row) => row.id));
  const listings = new Map(plan.listings.map((row) => [row.id, row]));
  const conversations = new Map(plan.conversations.map((row) => [row.id, row]));
  const deals = new Map(plan.deals.map((row) => [row.id, row]));
  const wanted = new Set(plan.wanted.map((row) => row.id));
  for (const row of plan.listings) {
    assert.ok(accounts.has(row.seller_id));
    if (row.reserved_for !== null) assert.ok(accounts.has(row.reserved_for));
  }
  for (const row of [...plan.listingEditions, ...plan.listingTags, ...plan.waitlist]) assert.ok(listings.has(row.listing_id));
  for (const row of plan.wanted) assert.ok(accounts.has(row.buyer_id));
  for (const row of plan.conversations) {
    assert.equal(listings.get(row.listing_id)?.seller_id, row.seller_id, "le vendeur d'une conversation est celui de l'annonce");
    assert.ok(accounts.has(row.buyer_id) && row.buyer_id !== row.seller_id);
  }
  for (const row of plan.messages) {
    const conversation = conversations.get(row.conversation_id);
    assert.ok(conversation && [conversation.buyer_id, conversation.seller_id].includes(row.sender_id), "un message vient d'une des deux parties");
  }
  for (const row of plan.deals) {
    const conversation = conversations.get(row.conversation_id);
    assert.ok(conversation, "une vente cite une conversation chargée");
    assert.deepEqual([row.listing_id, row.seller_id, row.buyer_id], [conversation.listing_id, conversation.seller_id, conversation.buyer_id]);
  }
  for (const { row } of plan.reviews) {
    const deal = deals.get(row.deal_id);
    assert.ok(deal && [deal.seller_id, deal.buyer_id].includes(row.reviewer_id), "seules les parties d'une vente la notent (stamp_review)");
  }
  for (const row of plan.notifications) {
    assert.ok(accounts.has(row.user_id));
    if (row.listing_id !== null) assert.ok(listings.has(row.listing_id));
    if (row.deal_id !== null) assert.ok(deals.has(row.deal_id));
    if (row.wanted_id !== null) assert.ok(wanted.has(row.wanted_id));
  }
});

test("une annonce naît comme la base la fait naître, et celles qui ne le sont pas en démonstration sont finies ensuite", () => {
  /* derive_listing_display (migration 11) : « Disponible », sans
     réservation ni prix d'avant, quoi qu'on envoie, clé de service comprise. */
  for (const row of plan.listings) {
    assert.deepEqual([row.status, row.reserved_for, row.sold_at, row.previous_price_cents], ["available", null, null, null], `${row.slug} ne naît pas comme la base la fait naître`);
  }
  const finishes = new Map(plan.listingFinishes.map((finish) => [finish.id, finish]));
  for (const mock of TABLES.listings) {
    const row = plan.listings.find((candidate) => candidate.id === demoId(mock.id));
    const finish = finishes.get(demoId(mock.id));
    const born = mock.status === "available" && mock.previous_price_cents === null;
    assert.equal(finish === undefined, born, `${mock.id} : finie à tort, ou pas finie`);
    if (born) {
      assert.deepEqual([row?.price_cents, row?.view_count], [mock.price_cents, mock.view_count]);
      continue;
    }
    /* Au prix d'avant quand elle a baissé, pour que la baisse vienne de la
       base ; sans vues, pour que la dernière mise à jour lui rende sa date. */
    assert.deepEqual([row?.price_cents, row?.view_count], [mock.previous_price_cents ?? mock.price_cents, 0]);
    assert.deepEqual(
      [finish?.status, finish?.reserved_for, finish?.price_cents, finish?.previous_price_cents, finish?.sold_at, finish?.updated_at],
      [mock.status, mock.reserved_for === null ? null : demoId(mock.reserved_for), mock.price_cents, mock.previous_price_cents, mock.sold_at, mock.updated_at],
    );
  }
  assert.ok(plan.listingFinishes.every((finish) => finish.view_count > 0), "une annonce finie sans vue ne pourrait pas retrouver sa date de mise à jour");
  for (const kind of ["sold", "reserved"]) assert.ok(plan.listingFinishes.some((finish) => finish.status === kind), `aucune annonce « ${kind} » à finir : le test ne vérifie plus rien`);
  assert.ok(plan.listingFinishes.some((finish) => finish.previous_price_cents !== null), "aucune baisse de prix à finir : le test ne vérifie plus rien");
  assert.ok(plan.listings.every((row) => !("photos" in row) && !("seller" in row)), "une jointure partirait comme colonne");
  assert.ok(!SEED_STEPS.some((step) => step.name.includes("photo")), "les photos arrivent en phase 3");
});

test("aucune notification chargée n'en double une autre au sens de notifications_one_per_match", () => {
  /* Index unique (kind, user_id, listing_id, wanted_id), migration 11 : deux
     lignes s'y heurtent quand les quatre colonnes sont égales et renseignées
     — null ne vaut pas null. Celles de notify_review, une par avis, n'ont pas
     de demande. */
  const keys = [
    ...plan.notifications.map((row) => [row.kind, row.user_id, row.listing_id, row.wanted_id]),
    ...plan.reviews.map((review) => ["review_received", review.expected.reviewed_id, review.expected.listing_id, null]),
  ]
    .filter((key) => key.every((value) => value !== null))
    .map((key) => key.join("|"));
  assert.ok(keys.length > 0, "aucune notification de croisement chargée : le test ne vérifie plus rien");
  assert.equal(new Set(keys).size, keys.length, "deux notifications se heurteraient à l'index unique");
});

test("les messages partent dans l'ordre chronologique, et les conversations anciennes masquées", () => {
  const dates = plan.messages.map((message) => message.created_at);
  assert.deepEqual(dates, dates.toSorted());
  const earlierIds = new Set([...TABLES.conversationStarts.keys()].map(demoId));
  const earlier = plan.conversations.filter((row) => earlierIds.has(row.id));
  assert.equal(earlier.length, TABLES.conversationStarts.size);
  assert.ok(earlier.every((row) => row.buyer_deleted_at !== null && row.seller_deleted_at !== null));
});

test("les notifications d'avis de la démonstration sont celles que notify_review posera", () => {
  /* Elles ne sont pas recopiées : l'insertion de l'avis les crée. */
  for (const notification of plan.reviewNotifications) {
    assert.ok(
      plan.reviews.some((review) => review.row.deal_id === notification.deal_id && review.expected.reviewed_id === notification.user_id),
      "une notification d'avis sans l'avis qui la crée",
    );
  }
  assert.ok(plan.notifications.every((row) => row.kind !== "review_received"));
});

test("l'avis d'un compte supprimé rejoue un vrai compte, sa vente et son avis, valides pour la base", () => {
  assert.equal(plan.deletedAccountReviews.length, TABLES.reviews.filter((review) => review.deal_id === null).length);
  for (const entry of plan.deletedAccountReviews) {
    assert.match(entry.account.metadata.username, /^[a-z0-9._-]{3,24}$/);
    assert.ok(entry.listing.title.length >= 12 && entry.listing.title.length <= 90);
    assert.ok(entry.listing.description.length >= 40);
    assert.match(entry.listing.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.deepEqual([entry.review.deal_id, entry.review.reviewer_id], [entry.deal.id, entry.account.id]);
    assert.equal(entry.deal.buyer_id, entry.conversation.buyer_id);
    assert.ok(new Date(entry.deal.closed_at) < new Date(entry.review.created_at));
  }
});
