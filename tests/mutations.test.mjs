import assert from "node:assert/strict";
import test from "node:test";
import { createListing, setListingStatus, updateListing } from "../src/lib/data/listing-mutations.ts";
import { contactSeller, proposeListing, sendMessage } from "../src/lib/data/message-mutations.ts";
import { setWantedStatus } from "../src/lib/data/wanted-mutations.ts";
import { blockOtherParticipant, hideConversation } from "../src/lib/data/conversation-mutations.ts";
import { closeDeal, reviewDeal } from "../src/lib/data/deal-mutations.ts";
import { deleteListing } from "../src/lib/data/listing-mutations.ts";
import { reportContent } from "../src/lib/data/report-mutations.ts";
import { joinWaitlist, reserveForBuyer } from "../src/lib/data/waitlist-mutations.ts";
import { MOCK_CONVERSATION_ROWS } from "../src/lib/mock/conversations.mock.ts";
import { MOCK_PROFILE_ROWS } from "../src/lib/mock/profiles.mock.ts";
import { getListingBySlug } from "../src/lib/data/listings.ts";
import { MOCK_LISTING_ROWS } from "../src/lib/mock/listings.mock.ts";
import { MOCK_WANTED_ROWS } from "../src/lib/mock/wanted.mock.ts";
import { LISTING_VALUES, photoRefs } from "./fixtures.mjs";

/* La couche d'écriture, telle que les actions serveur l'appellent. En
   phase 1 elle ne persiste rien, mais tous ses contrôles sont réels : qui
   écrit, sur quoi, et si c'est permis. Le compte de démonstration est u-01. */

const ownListing = MOCK_LISTING_ROWS.find((row) => row.seller_id === "u-01" && row.status !== "sold");
const foreignListing = MOCK_LISTING_ROWS.find((row) => row.seller_id !== "u-01" && row.status !== "sold");
const foreignSoldListing = MOCK_LISTING_ROWS.find((row) => row.seller_id !== "u-01" && row.status === "sold");

test("un dépôt valide est accepté et dit honnêtement qu'il n'est pas enregistré", async () => {
  const result = await createListing(LISTING_VALUES);
  assert.equal(result.status, "not-persisted");
  assert.match(result.data.path, /^\/annonces\/vrac-400-cartes-pokemon-avignon-/);
});

test("un dépôt ne peut pas accrocher une image du web à l'annonce", async () => {
  const result = await createListing({ ...LISTING_VALUES, photos: ["https://ailleurs.example/vol.jpg"] });
  assert.equal(result.status, "invalid");
  assert.ok(result.fieldErrors.photos);
});

test("modifier l'annonce d'un autre vendeur répond introuvable, pas interdit", async () => {
  const result = await updateListing(foreignListing.id, LISTING_VALUES);
  assert.equal(result.status, "not-found");
});

test("modifier sa propre annonce garde le lien permanent", async () => {
  const listing = await getListingBySlug(ownListing.slug);
  const result = await updateListing(ownListing.id, {
    ...LISTING_VALUES,
    title: "Un tout autre titre pour ce lot",
    photos: listing.photos.map((photo) => photo.url),
  });
  assert.equal(result.status, "not-persisted");
  assert.equal(result.data.path, `/annonces/${ownListing.slug}`);
});

test("le statut ne se change que sur ses propres annonces", async () => {
  assert.equal((await setListingStatus(ownListing.id, "reserved")).status, "not-persisted");
  assert.equal((await setListingStatus(foreignListing.id, "sold")).status, "not-found");
});

test("on ne peut pas s'écrire à soi-même à propos de sa propre annonce", async () => {
  const result = await contactSeller({ listingId: ownListing.id, body: "Bonjour" });
  assert.equal(result.status, "invalid");
});

test("un lot vendu ne reçoit plus de demande", async () => {
  const result = await contactSeller({ listingId: foreignSoldListing.id, body: "Bonjour" });
  assert.equal(result.status, "invalid");
});

test("écrire à un vendeur ouvre un fil, ou reprend celui qui existe", async () => {
  const result = await contactSeller({ listingId: foreignListing.id, body: "Bonjour, toujours disponible ?" });
  assert.equal(result.status, "not-persisted");
  assert.equal(typeof result.data.isExisting, "boolean");
});

test("proposer un lot d'un autre jeu à une demande est refusé", async () => {
  const wanted = MOCK_WANTED_ROWS.find((row) => row.status === "open" && row.buyer_id !== "u-01");
  const otherGame = MOCK_LISTING_ROWS.find(
    (row) => row.seller_id === "u-01" && row.status !== "sold" && row.game_id !== wanted.game_id,
  );
  assert.ok(otherGame, "le compte de démonstration n'a pas de lot d'un autre jeu");
  const result = await proposeListing({ wantedId: wanted.id, listingId: otherGame.id, body: "J'ai ce lot" });
  assert.equal(result.status, "invalid");
});

test("écrire dans une conversation dont on n'est pas participant répond introuvable", async () => {
  const result = await sendMessage({ conversationId: "c-inexistante", body: "Bonjour" });
  assert.equal(result.status, "not-found");
});

test("fermer la demande d'un autre acheteur répond introuvable", async () => {
  const foreignWanted = MOCK_WANTED_ROWS.find((row) => row.buyer_id !== "u-01");
  assert.equal((await setWantedStatus(foreignWanted.id, "closed")).status, "not-found");
});

/* Les gestes d'une conversation. c-01 et c-02 : u-01 vend, rien n'est
   clôturé. c-03 : u-01 a vendu l-07 à u-02, qui l'a noté. c-05 : u-04 a
   vendu l-13 à u-01 il y a vingt heures, personne n'a encore noté. */
const conversation = (id) => MOCK_CONVERSATION_ROWS.find((row) => row.id === id);
const SCORES = { punctuality: 5, responsiveness: 4, reliability: 5 };

test("retirer une conversation ou bloquer ne vise qu'un fil dont on est participant", async () => {
  assert.equal((await hideConversation("c-01")).status, "not-persisted");
  assert.equal((await blockOtherParticipant("c-01")).status, "not-persisted");
  assert.equal((await hideConversation("c-inexistante")).status, "not-found");
  assert.equal((await blockOtherParticipant("c-inexistante")).status, "not-found");
});

test("seul le vendeur clôture une vente, et une seule fois", async () => {
  /* u-01 vend l-21 sur c-02 : il clôture. */
  assert.equal(conversation("c-02").deal, null);
  assert.equal((await closeDeal("c-02", "sale")).status, "not-persisted");
  /* u-01 est l'acheteur de c-05 : pour lui, il n'y a rien à clôturer. */
  assert.equal((await closeDeal("c-05", "sale")).status, "not-found");
  /* c-03 est déjà clôturée : un lot ne se vend qu'une fois. */
  const again = await closeDeal("c-03", "trade");
  assert.equal(again.status, "invalid");
  assert.ok(again.fieldErrors.deal);
  assert.equal((await closeDeal("c-inexistante", "sale")).status, "not-found");
});

test("chaque partie note l'autre une fois, et seulement sur sa propre vente", async () => {
  /* d-02 : u-01 a acheté, personne n'a noté. */
  assert.equal((await reviewDeal({ dealId: "d-02", scores: SCORES, comment: "" })).status, "not-persisted");
  /* d-03 : u-01 a déjà noté le vendeur. */
  const twice = await reviewDeal({ dealId: "d-03", scores: SCORES, comment: "Encore" });
  assert.equal(twice.status, "invalid");
  /* d-04 : une vente entre deux autres comptes n'existe pas pour u-01. */
  assert.equal((await reviewDeal({ dealId: "d-04", scores: SCORES, comment: "" })).status, "not-found");
});

test("une vente clôturée ne se « dévend » pas et son annonce ne se supprime pas", async () => {
  /* l-07 : vendu par u-01 à u-02, avec un avis. */
  const reopened = await setListingStatus("l-07", "available");
  assert.equal(reopened.status, "invalid");
  const deleted = await deleteListing("l-07");
  assert.equal(deleted.status, "invalid");
  /* Un lot vendu sans acheteur désigné reste libre de ses gestes. */
  assert.equal((await setListingStatus(ownListing.id, "sold")).status, "not-persisted");
});

/* Audit de sécurité, M4 : un vendeur mal noté réécrivait « 900 cartes » en
   « environ 300 » après la vente, et l'avis « lot conforme » perdait sa
   pièce de référence. */
test("une annonce dont la vente est clôturée ne se modifie plus", async () => {
  const result = await updateListing("l-07", { ...LISTING_VALUES, title: "Environ trois cents cartes" });
  assert.equal(result.status, "invalid");
  assert.ok(result.fieldErrors.listing);
});

test("l'option « 8 photos » déjà payée ouvre les huit photos à la modification", async () => {
  /* l-01 : u-01 a payé l'option. Voir tests/photo-allowance.test.mjs pour
     une annonce qui ne l'a pas. */
  const result = await updateListing("l-01", { ...LISTING_VALUES, photos: photoRefs(8), extraPhotos: true });
  assert.equal(result.status, "not-persisted");
  assert.equal(result.data.photosAwaitingPayment, 0);
});

test("un signalement vise quelqu'un d'autre, et seulement ce que le signaleur peut voir", async () => {
  const report = (targetType, targetKey) => reportContent({ targetType, targetKey, reason: "scam", details: "" });
  const self = MOCK_PROFILE_ROWS.find((row) => row.id === "u-01");
  const other = MOCK_PROFILE_ROWS.find((row) => row.id !== "u-01");
  const foreignProOnly = MOCK_LISTING_ROWS.find((row) => row.audience === "pros" && row.seller_id !== "u-01");
  const ownWanted = MOCK_WANTED_ROWS.find((row) => row.buyer_id === "u-01");
  const foreignWanted = MOCK_WANTED_ROWS.find((row) => row.buyer_id !== "u-01");

  assert.equal((await report("listing", foreignListing.slug)).status, "not-persisted");
  assert.equal((await report("listing", ownListing.slug)).status, "invalid");
  /* u-01 est un particulier : un lot réservé aux pros n'existe pas pour lui. */
  assert.ok(foreignProOnly, "aucun lot réservé aux pros d'un autre vendeur");
  assert.equal((await report("listing", foreignProOnly.slug)).status, "not-found");
  assert.equal((await report("profile", other.username)).status, "not-persisted");
  assert.equal((await report("profile", self.username)).status, "invalid");
  assert.equal((await report("wanted", foreignWanted.slug)).status, "not-persisted");
  if (ownWanted) assert.equal((await report("wanted", ownWanted.slug)).status, "invalid");
  assert.equal((await report("conversation", "c-01")).status, "not-persisted");
  assert.equal((await report("conversation", "c-inexistante")).status, "not-found");
});

/* La réservation. l-27 (u-09) est réservé pour u-12 : u-01, qui avait écrit
   avant (c-04), lit son fil mais n'y écrit plus. l-21 (u-01) est réservé
   pour u-04 (c-02). l-16 est réservé hors du site, sans personne désignée. */
test("un lot réservé ne reçoit plus de nouveau message, sauf de la personne pour qui il l'est", async () => {
  const l27 = MOCK_LISTING_ROWS.find((row) => row.id === "l-27");
  assert.equal(l27.status, "reserved");
  assert.equal((await contactSeller({ listingId: "l-27", body: "Toujours là ?" })).status, "invalid");
  assert.equal((await contactSeller({ listingId: "l-16", body: "Toujours là ?" })).status, "invalid");
  /* Le fil déjà ouvert ne se relance pas non plus… */
  const relaunch = await sendMessage({ conversationId: "c-04", body: "Et si la réservation tombe ?" });
  assert.equal(relaunch.status, "invalid");
  assert.match(relaunch.fieldErrors.body, /liste d'attente/);
  /* …mais le vendeur, lui, écrit à qui il veut. */
  assert.equal((await sendMessage({ conversationId: "c-02", body: "Samedi, 10 h ?" })).status, "not-persisted");
});

test("un lot passé « pros » après coup : le particulier relit son fil sans plus y écrire", async () => {
  /* c-06 : le compte de démonstration avait écrit à propos de l-35 avant que
     sa vendeuse le réserve aux professionnels. */
  const reply = await sendMessage({ conversationId: "c-06", body: "Toujours d'accord pour samedi ?" });
  assert.equal(reply.status, "invalid");
  assert.match(reply.fieldErrors.body, /réservé ce lot aux professionnels/);
  /* Depuis la fiche non plus : son fil existe, le lot n'est donc pas
     « introuvable » pour lui — il est fermé, et la réponse le dit. */
  const contact = await contactSeller({ listingId: "l-35", body: "Bonjour" });
  assert.equal(contact.status, "invalid");
  assert.match(contact.fieldErrors.body, /réservé ce lot aux professionnels/);
});

test("la liste d'attente ne s'ouvre que sur le lot réservé d'un autre", async () => {
  assert.equal((await joinWaitlist("l-27")).status, "not-persisted");
  assert.equal((await joinWaitlist("l-21")).status, "invalid", "son propre lot");
  const available = await joinWaitlist(foreignListing.id);
  assert.equal(available.status, "invalid");
  assert.match(available.fieldErrors.waitlist, /écrivez au vendeur/);
  assert.equal((await joinWaitlist(foreignSoldListing.id)).status, "invalid");
  assert.equal((await joinWaitlist("l-inexistante")).status, "not-found");
});

test("on ne réserve que pour quelqu'un qui a écrit à propos du lot", async () => {
  /* c-01 : u-01 vend l-01 à pioupiou_du_84. */
  assert.equal((await reserveForBuyer("c-01")).status, "not-persisted");
  /* c-05 : u-01 y est l'acheteur, il n'a rien à réserver. */
  assert.equal((await reserveForBuyer("c-05")).status, "not-found");
  /* c-03 : le lot est vendu. */
  assert.equal((await reserveForBuyer("c-03")).status, "invalid");
});
