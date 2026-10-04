import assert from "node:assert/strict";
import test from "node:test";
import { REPLY_BLOCK_REASONS, getReplyBlock } from "../src/lib/conversation-display.ts";

/* La règle « qui peut encore écrire dans ce fil », en table. Elle était
   recodée à quatre endroits — page du fil, page « Nouveau message », fiche,
   couche données — et la décision « un lot passé pros après coup » en
   aurait ajouté un cinquième. Une seule fonction, lue par toutes, et tenue
   en base par la politique d'écriture des messages. */

const SELLER = "u-seller";
const BUYER = "u-buyer";
const listing = (overrides = {}) => ({ status: "available", reservedForId: null, audience: "everyone", ...overrides });
const block = (listingState, viewer) => getReplyBlock({ sellerId: SELLER, listing: listingState }, viewer);

const PARTICULIER = { id: BUYER, isActivePro: false };
const BOUTIQUE = { id: BUYER, isActivePro: true };

const CASES = [
  ["un lot disponible, visible de tous", listing(), PARTICULIER, null],
  ["réservé pour ce lecteur", listing({ status: "reserved", reservedForId: BUYER }), PARTICULIER, null],
  ["réservé pour un autre", listing({ status: "reserved", reservedForId: "u-other" }), PARTICULIER, "reserved-for-other"],
  ["réservé hors du site", listing({ status: "reserved", reservedForId: null }), PARTICULIER, "reserved-for-other"],
  ["passé « pros », lu par un particulier", listing({ audience: "pros" }), PARTICULIER, "pros-only"],
  ["passé « pros », lu par une boutique au forfait actif", listing({ audience: "pros" }), BOUTIQUE, null],
  /* Les deux à la fois : le passage aux pros l'emporte, c'est lui que le
     particulier doit lire — la liste d'attente ne lui servirait à rien. */
  ["passé « pros » et réservé pour un autre", listing({ audience: "pros", status: "reserved", reservedForId: "u-other" }), PARTICULIER, "pros-only"],
  ["vendu : les parties se parlent encore, pour l'avis", listing({ status: "sold" }), PARTICULIER, null],
];

for (const [label, listingState, viewer, expected] of CASES) {
  test(`qui peut écrire : ${label}`, () => {
    assert.equal(block(listingState, viewer), expected);
  });
}

test("le vendeur écrit toujours dans les fils de son lot", () => {
  for (const [, listingState] of CASES) {
    assert.equal(block(listingState, { id: SELLER, isActivePro: false }), null);
  }
});

test("chaque blocage a sa phrase, la même à l'écran et dans le refus de la couche données", () => {
  for (const reason of Object.values(REPLY_BLOCK_REASONS)) assert.ok(reason.length > 40);
  assert.match(REPLY_BLOCK_REASONS["pros-only"], /relire/);
  assert.match(REPLY_BLOCK_REASONS["reserved-for-other"], /liste d.attente/);
});
