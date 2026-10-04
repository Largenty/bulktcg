import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";

import { render, text } from "./markup.mjs";

/* Après la vente : la clôture dans la conversation, les avis, la fiche
   boutique, le signalement et la liste des fils. */

test("une vente clôturée se dit en une ligne dans la conversation, avec le lien pour noter", async () => {
  const { DealNote } = await import("../src/components/messages/DealNote.tsx");
  const deal = { id: "d-02", kind: "sale", closedAt: "2026-09-28T10:00:00.000Z", reviewerIds: [] };
  const toReview = render(createElement(DealNote, { deal, viewerId: "u-01", isSeller: false, otherUsername: "bastien26" }));
  assert.match(text(toReview), /Acheté à bastien26 le 28 septembre 2026/);
  assert.match(toReview, /href="\/mon-compte\/transactions\/d-02#avis"/);
  assert.match(text(toReview), /Noter bastien26/);
  /* Une fois l'avis laissé, la ligne mène au récapitulatif. */
  const reviewed = render(createElement(DealNote, { deal: { ...deal, reviewerIds: ["u-01"] }, viewerId: "u-01", isSeller: false, otherUsername: "bastien26" }));
  assert.match(text(reviewed), /Voir le récapitulatif/);
  assert.doesNotMatch(text(reviewed), /Noter/);
});

test("le formulaire d'avis pose trois critères en boutons radio natifs, et la fiabilité suit le rôle", async () => {
  const { ReviewForm } = await import("../src/components/review/ReviewForm.tsx");
  const seller = render(createElement(ReviewForm, { dealId: "d-02", revieweeUsername: "bastien26", revieweeRole: "seller" }));
  for (const name of ["punctuality", "responsiveness", "reliability"]) {
    const radios = seller.match(new RegExp(`<input[^>]*type="radio"[^>]*name="${name}"[^>]*>`, "g")) ?? [];
    assert.equal(radios.length, 5, `${name} n'a pas cinq notes`);
  }
  assert.match(text(seller), /Un lot conforme à l'annonce/);
  const buyer = render(createElement(ReviewForm, { dealId: "d-01", revieweeUsername: "julie_cartes", revieweeRole: "buyer" }));
  assert.match(text(buyer), /sans renégocier sur place/);
  /* Aucune note n'est choisie d'avance : « — », jamais 0/5. */
  assert.doesNotMatch(text(seller), /0\/5/);
});

test("la note d'un profil sans avis s'affiche « — » sur chaque critère, sans barre vide", async () => {
  const { RatingBreakdown } = await import("../src/components/review/RatingBreakdown.tsx");
  const empty = render(
    createElement(RatingBreakdown, {
      ratingAvg: null,
      ratingCount: 0,
      breakdown: { punctuality: null, responsiveness: null, reliability: null },
    }),
  );
  assert.equal((text(empty).match(/—/g) ?? []).length, 4);
  assert.doesNotMatch(empty, /score-bar/);
  assert.match(text(empty), /Pas encore d'avis/);
  const rated = render(
    createElement(RatingBreakdown, { ratingAvg: 4.6, ratingCount: 12, breakdown: { punctuality: 4.8, responsiveness: 4.3, reliability: 4.7 } }),
  );
  assert.equal((rated.match(/class="score-bar"/g) ?? []).length, 3);
  assert.match(text(rated), /moyenne des trois/);
});

test("une boutique affiche sa fiche, et un champ vide s'y écrit « — »", async () => {
  const { ShopDetails } = await import("../src/components/profile/ShopDetails.tsx");
  const markup = render(
    createElement(ShopDetails, { shop: { siret: "12345678900017", address: "Rue Carnot, 84000 Avignon", hours: null, website: "https://boutique.example/" } }),
  );
  assert.match(text(markup), /123 456 789 00017/);
  assert.match(text(markup), /boutique\.example/);
  assert.doesNotMatch(text(markup), /https:\/\//);
  assert.match(markup, /rel="nofollow ugc noopener"/);
  assert.match(text(markup), /Horaires —/);
});

test("le lien de signalement désigne sa cible par ce que l'écran connaît", async () => {
  const { ReportLink } = await import("../src/components/report/ReportLink.tsx");
  const listingLink = render(createElement(ReportLink, { target: "listing", targetKey: "vrac-pokemon-avignon-12" }));
  assert.match(listingLink, /href="\/signaler\?annonce=vrac-pokemon-avignon-12"/);
  assert.match(text(listingLink), /Signaler cette annonce/);
  const profileLink = render(createElement(ReportLink, { target: "profile", targetKey: "le_de_d_orange" }));
  assert.match(profileLink, /href="\/signaler\?compte=le_de_d_orange"/);
  assert.match(text(profileLink), /Signaler ce compte/);
});

test("la liste des fils dit pour qui un lot est réservé, et ne compte pas un fil verrouillé comme en attente", async () => {
  const { canReply, countInbox, describeReservation } = await import("../src/lib/conversation-display.ts");
  const { getConversationsForUser } = await import("../src/lib/data/conversations.ts");
  const conversations = await getConversationsForUser("u-01");
  const byId = (id) => conversations.find((conversation) => conversation.id === id);
  /* c-04 : l-27 réservé pour un autre acheteur ; c-02 : l-21, lot de u-01,
     réservé pour la personne de ce fil. */
  assert.equal(describeReservation(byId("c-04"), "u-01"), "Réservé ailleurs");
  assert.equal(describeReservation(byId("c-02"), "u-01"), "Réservé ici");
  assert.equal(canReply(byId("c-04")), false);
  assert.equal(canReply(byId("c-02")), true);
  /* c-06 : l-35 passé « pros » après coup ; le compte de démonstration est
     un particulier. */
  assert.equal(byId("c-06").replyBlock, "pros-only");
  assert.equal(canReply(byId("c-06")), false);
  const { awaiting, unreadLocked } = countInbox(conversations);
  assert.equal(unreadLocked, 1, "le fil verrouillé et non lu n'est pas compté à part");
  assert.equal(awaiting + unreadLocked, conversations.filter((conversation) => conversation.unreadCount > 0).length);
});

test("un avis dont l'auteur a supprimé son compte se signe « Compte supprimé », sans lien de profil", async () => {
  const { ReviewContent } = await import("../src/components/review/ReviewList.tsx");
  const review = {
    id: "r-98",
    dealId: null,
    reviewerId: null,
    reviewerUsername: null,
    reviewerInitials: null,
    reviewedId: "u-99",
    reviewedRole: "buyer",
    scores: { punctuality: 4, responsiveness: 4, reliability: 5 },
    rating: 4.3,
    comment: "Ponctuel.",
    createdAt: "2026-09-01T10:00:00.000Z",
    listing: { unavailable: "deleted" },
  };
  const markup = render(createElement(ReviewContent, { review }));
  assert.match(text(markup), /Compte supprimé/);
  assert.match(text(markup), /sur un lot retiré depuis/);
  assert.doesNotMatch(markup, /href="\/profil\//, "un compte supprimé n'a plus de profil où mener");
  /* L'inverse, sans quoi l'assertion passerait à vide le jour où l'adresse
     d'un profil change : c'est arrivé, /p/ est devenu /profil/. */
  const signed = render(createElement(ReviewContent, { review: { ...review, reviewerId: "u-02", reviewerUsername: "julie_cartes" } }));
  assert.match(signed, /href="\/profil\/julie_cartes"/);
  assert.doesNotMatch(markup, /null|undefined/);
  /* Réservée aux pros, l'annonce existe toujours : l'avis le dit autrement. */
  const reserved = render(createElement(ReviewContent, { review: { ...review, listing: { unavailable: "pro-only" } } }));
  assert.match(text(reserved), /réservé aux professionnels/);
});
