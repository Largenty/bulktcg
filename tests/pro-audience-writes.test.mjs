import assert from "node:assert/strict";
import test from "node:test";
import { MOCK_LISTING_ROWS } from "../src/lib/mock/listings.mock.ts";
import { MOCK_WANTED_ROWS } from "../src/lib/mock/wanted.mock.ts";

/* Une annonce réservée aux pros ne sort jamais du cercle, côté écritures
   aussi. Audit de sécurité, M6 : un vendeur proposait son lot réservé à un
   particulier qui cherchait ce jeu, et ouvrait un fil sur une annonce que
   celui-ci ne peut pas lire. Le compte de démonstration est celui du
   vendeur de l-35 ; il se lit au chargement de la session, d'où l'import
   dynamique. */
process.env.DEMO_USER_ID = "u-02";
const { proposeListing, sendMessage } = await import("../src/lib/data/message-mutations.ts");

const row = (rows, id) => rows.find((candidate) => candidate.id === id);

test("un lot réservé aux pros ne se propose pas à un particulier", async () => {
  const reserved = row(MOCK_LISTING_ROWS, "l-35");
  const wanted = row(MOCK_WANTED_ROWS, "w-02");
  assert.equal(reserved.seller_id, "u-02");
  assert.equal(reserved.audience, "pros");
  assert.equal(wanted.game_id, reserved.game_id, "la demande doit chercher ce jeu, sinon le refus prouve autre chose");
  assert.equal(wanted.status, "open");

  const result = await proposeListing({ wantedId: wanted.id, listingId: reserved.id, body: "J'ai ce lot" });
  assert.equal(result.status, "invalid");
  assert.ok(result.fieldErrors.listingId);
});

test("le même vendeur propose sans peine un lot visible de tous", async () => {
  const everyone = row(MOCK_LISTING_ROWS, "l-03");
  const wanted = row(MOCK_WANTED_ROWS, "w-01");
  assert.equal(everyone.seller_id, "u-02");
  assert.equal(everyone.audience, "everyone");
  assert.equal(wanted.game_id, everyone.game_id);

  const result = await proposeListing({ wantedId: wanted.id, listingId: everyone.id, body: "J'ai ce lot" });
  assert.equal(result.status, "not-persisted");
});

test("le vendeur d'un lot passé « pros » écrit encore dans ses fils", async () => {
  /* c-06 : le particulier qui avait écrit avant ne peut plus répondre ; sa
     vendeuse, elle, peut encore lui expliquer. */
  const result = await sendMessage({ conversationId: "c-06", body: "Une boutique passe samedi, je vous tiens au courant." });
  assert.equal(result.status, "not-persisted");
});
