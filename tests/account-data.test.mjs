import assert from "node:assert/strict";
import test from "node:test";
import { buildPipelineRows } from "../src/lib/account-pipeline.ts";
import { groupListingsByStage } from "../src/lib/account-stages.ts";
import { isExpired } from "../src/lib/listing-lifecycle.ts";
import { getConversationsForUser, getUnreadConversationCount } from "../src/lib/data/conversations.ts";
import { getDealById, getDealsForUser } from "../src/lib/data/deals.ts";
import { getListingsOwnedBy } from "../src/lib/data/listings.ts";
import { getNotificationsForUser, getUnreadNotificationCount } from "../src/lib/data/notifications.ts";
import { getProfileById, getReviewsForUser } from "../src/lib/data/profiles.ts";
import { getWaitlistCountsForSeller, isOnWaitlist } from "../src/lib/data/waitlist.ts";
import { getWantedListingsByBuyer } from "../src/lib/data/wanted.ts";
import { MOCK_DEAL_ROWS } from "../src/lib/mock/deals.mock.ts";
import { MOCK_PROFILE_ROWS } from "../src/lib/mock/profiles.mock.ts";
import { MOCK_REVIEW_ROWS } from "../src/lib/mock/reviews.mock.ts";

/* Les lectures du compte — ventes, avis, notifications, liste d'attente,
   suivi — et la cohérence des données de démonstration qui les nourrissent.
   Le compte de démonstration est u-01. */

test("une vente n'existe que pour ses deux parties", async () => {
  const deals = await getDealsForUser("u-01");
  assert.deepEqual(deals.map((deal) => deal.id).sort(), ["d-01", "d-02", "d-03"]);
  assert.equal(await getDealById("d-04", "u-01"), null);
  assert.ok(await getDealById("d-04", "u-09"));
  /* Les plus récentes d'abord. */
  const closedAt = deals.map((deal) => new Date(deal.closedAt).getTime());
  assert.deepEqual(closedAt, closedAt.toSorted((left, right) => right - left));
});

test("chaque avis de démonstration respecte les contraintes du schéma", () => {
  const seen = new Set();
  for (const review of MOCK_REVIEW_ROWS) {
    /* Un avis survit au compte de son auteur (on delete set null). La vente
       part avec l'une de ses parties et l'annonce avec son vendeur : comme la
       personne notée est toujours là, c'est l'auteur qui est parti. */
    if (review.deal_id === null || review.listing_id === null) {
      assert.equal(review.reviewer_id, null, `${review.id} : une vente disparue alors que son auteur est encore là`);
      assert.equal(review.reviewer, null);
      assert.ok(MOCK_PROFILE_ROWS.some((profile) => profile.id === review.reviewed_id), `${review.id} : personne notée introuvable`);
      continue;
    }
    const deal = MOCK_DEAL_ROWS.find((candidate) => candidate.id === review.deal_id);
    assert.ok(deal, `${review.id} : vente introuvable`);
    assert.ok([deal.seller_id, deal.buyer_id].includes(review.reviewer_id), `${review.id} : l'auteur n'est pas partie de la vente`);
    assert.notEqual(review.reviewer_id, review.reviewed_id, `${review.id} : on ne se note pas soi-même`);
    const key = `${review.deal_id}/${review.reviewer_id}`;
    assert.ok(!seen.has(key), `${review.id} : deux avis de la même personne sur la même vente`);
    seen.add(key);
    assert.ok(new Date(review.created_at) >= new Date(deal.closed_at), `${review.id} : avis antérieur à la vente`);
  }
});

test("la note d'un profil n'est jamais contredite par les avis affichés sous elle", () => {
  /* Le mock ne montre qu'une partie de l'historique : la moyenne stockée doit
     rester atteignable avec les avis visibles et des avis de 1 à 5 pour le
     reste. Un profil à 2 avis noté 5,0 au-dessus d'un avis à 4,0 mentirait. */
  for (const profile of MOCK_PROFILE_ROWS) {
    const shown = MOCK_REVIEW_ROWS.filter((review) => review.reviewed_id === profile.id);
    assert.ok(shown.length <= profile.rating_count, `${profile.username} : plus d'avis affichés que comptés`);
    if (profile.rating_count === 0) {
      assert.equal(profile.rating_avg, null);
      continue;
    }
    for (const [column, average] of [
      ["punctuality", profile.punctuality_avg],
      ["responsiveness", profile.responsiveness_avg],
      ["reliability", profile.reliability_avg],
    ]) {
      const sum = shown.reduce((total, review) => total + review[column], 0);
      const hidden = profile.rating_count - shown.length;
      const lowest = (sum + hidden) / profile.rating_count;
      const highest = (sum + hidden * 5) / profile.rating_count;
      assert.ok(average >= lowest - 0.05 && average <= highest + 0.05, `${profile.username} : ${column} ${average} impossible`);
    }
    const overall = (profile.punctuality_avg + profile.responsiveness_avg + profile.reliability_avg) / 3;
    assert.ok(Math.abs(profile.rating_avg - overall) < 0.051, `${profile.username} : la note globale n'est pas la moyenne des critères`);
  }
});

test("un profil reçoit ses avis comme vendeur et comme acheteur", async () => {
  const reviews = await getReviewsForUser("u-01");
  assert.deepEqual(reviews.map((review) => review.reviewedRole).sort(), ["buyer", "seller"]);
  const profile = await getProfileById("u-01");
  assert.equal(profile.shop, null, "un particulier n'a pas de fiche boutique");
  const shop = (await getProfileById("u-13")).shop;
  assert.ok(shop?.address, "la boutique de démonstration a perdu son adresse");
  assert.equal(shop.siret, null, "un SIRET de démonstration serait inventé");
});

test("la cloche compte les notifications non lues, rangées de la plus récente à la plus ancienne", async () => {
  const notifications = await getNotificationsForUser("u-01");
  assert.equal(await getUnreadNotificationCount("u-01"), notifications.filter((item) => item.readAt === null).length);
  assert.equal(await getUnreadNotificationCount("u-01"), 2);
  const times = notifications.map((item) => new Date(item.createdAt).getTime());
  assert.deepEqual(times, times.toSorted((left, right) => right - left));
  const closed = notifications.find((item) => item.kind === "deal_closed");
  assert.equal(closed.actorUsername, "bastien26");
  assert.ok(notifications.find((item) => item.kind === "wanted_match").wanted, "la recherche de la notification est perdue");
  assert.deepEqual(await getNotificationsForUser("u-08"), []);
});

test("les compteurs de l'en-tête disent ce que montrent la boîte et la cloche, pour chaque compte", async () => {
  /* Ils ne relisent plus toute la messagerie ni toutes les notifications à
     chaque page : ce qu'ils comptent doit rester ce que les listes affichent. */
  for (const { id } of MOCK_PROFILE_ROWS) {
    const threads = await getConversationsForUser(id);
    assert.equal(await getUnreadConversationCount(id), threads.filter((thread) => thread.unreadCount > 0).length, `boîte de ${id}`);
    const notifications = await getNotificationsForUser(id);
    assert.equal(await getUnreadNotificationCount(id), notifications.filter((item) => item.readAt === null).length, `cloche de ${id}`);
  }
  assert.equal(await getUnreadConversationCount("u-01"), 2, "le compte de démonstration n'a plus de fil non lu : le test ne vérifie rien");
});

test("le vendeur ne lit de la liste d'attente que le nombre, et chacun sa propre inscription", async () => {
  const counts = await getWaitlistCountsForSeller("u-01");
  assert.equal(counts.get("l-21"), 2);
  assert.equal(counts.has("l-16"), false, "le lot d'un autre vendeur apparaît dans ses comptes");
  assert.equal(await isOnWaitlist("l-16", "u-01"), true);
  assert.equal(await isOnWaitlist("l-27", "u-01"), false);
});

test("chaque étape du suivi compte exactement la liste vers laquelle elle mène", async () => {
  const [listings, wantedListings, deals, conversations] = await Promise.all([
    getListingsOwnedBy("u-01", { includeSold: true }),
    getWantedListingsByBuyer("u-01"),
    getDealsForUser("u-01"),
    getConversationsForUser("u-01"),
  ]);
  const now = Date.now();
  const rows = buildPipelineRows({ userId: "u-01", listings, wantedListings, deals, conversations, now });
  const stage = (title, label) => rows.find((row) => row.title === title).stages.find((item) => item.label === label);
  /* Une annonce expirée reste disponible ou réservée en base : elle se
     compte pourtant à part, comme sa liste la range. */
  const stageOf = (listing) => (isExpired(listing, now) ? "expired" : listing.status);
  for (const [label, value] of [["Disponible", "available"], ["Réservé", "reserved"], ["Vendu", "sold"], ["Expirée", "expired"]]) {
    assert.equal(stage("Mes annonces", label).count, listings.filter((listing) => stageOf(listing) === value).length, label);
  }
  assert.equal(stage("Mes annonces", "Expirée").count, 1, "l'annonce expirée de la démonstration (l-41) n'est plus comptée");
  /* La page « Mes annonces » range avec la règle du suivi : chaque annonce
     à une étape, et une seule, que chaque case du suivi compte. */
  const groups = groupListingsByStage(listings, now);
  assert.equal(Object.values(groups).flat().length, listings.length, "une annonce manque à ses étapes, ou y figure deux fois");
  for (const [label, value] of [["Disponible", "available"], ["Réservé", "reserved"], ["Vendu", "sold"], ["Expirée", "expired"]]) {
    assert.equal(groups[value].length, stage("Mes annonces", label).count, `${label} : la liste et le suivi divergent`);
  }
  /* u-01 a vendu l-07 sans noter l'acheteur, acheté l-13 sans noter le
     vendeur, et noté celui de l-19. */
  assert.equal(stage("Mes annonces", "Acheteur à noter").count, 1);
  assert.equal(stage("Mes achats", "Achetés").count, 2);
  assert.equal(stage("Mes achats", "Vendeur à noter").count, 1);
  assert.equal(stage("Mes recherches", "En recherche").count, wantedListings.filter((wanted) => wanted.status === "open").length);
});
