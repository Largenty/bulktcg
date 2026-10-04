import assert from "node:assert/strict";
import test from "node:test";
import { MOCK_LISTING_ROWS } from "../src/lib/mock/listings.mock.ts";
import { allocatePhotos } from "../src/lib/photo-allowance.ts";
import { LISTING_VALUES, photoRefs } from "./fixtures.mjs";

/* L'option « 8 photos » : trois gratuites, cinq de plus avec l'option.
   Audit de sécurité, M3 : huit photos passaient sur une annonce qui ne
   l'avait jamais payée, pour peu que le formulaire dise extraPhotos. Le
   droit se lit désormais sur l'annonce ; la case cochée n'est qu'une
   demande, et les photos qu'elle ouvre attendent le paiement. */

test("trois photos paraissent sans option, et sans rien demander", () => {
  assert.deepEqual(allocatePhotos(photoRefs(3), { hasPaidOption: false, wantsOption: false }), {
    published: photoRefs(3),
    awaitingPayment: [],
  });
});

test("au-delà de trois, sans l'option ni sa demande, c'est un refus", () => {
  assert.equal(allocatePhotos(photoRefs(4), { hasPaidOption: false, wantsOption: false }), null);
});

test("demander l'option n'en donne pas le droit : les photos 4 à 8 attendent le paiement", () => {
  const allocation = allocatePhotos(photoRefs(8), { hasPaidOption: false, wantsOption: true });
  assert.deepEqual(allocation.published, photoRefs(3));
  assert.deepEqual(allocation.awaitingPayment, photoRefs(8).slice(3));
});

test("l'option payée ouvre huit photos, et jamais une de plus", () => {
  assert.deepEqual(allocatePhotos(photoRefs(8), { hasPaidOption: true, wantsOption: false }), {
    published: photoRefs(8),
    awaitingPayment: [],
  });
  assert.equal(allocatePhotos(photoRefs(9), { hasPaidOption: true, wantsOption: true }), null);
});

/* La même règle au bout de la couche données, sous l'identité du vendeur
   de l-08, qui n'a jamais payé l'option. Le compte de démonstration se lit
   au chargement de la session : il est choisi avant l'import. */
process.env.DEMO_USER_ID = "u-03";
const { createListing, updateListing } = await import("../src/lib/data/listing-mutations.ts");

test("huit photos sur une annonce sans l'option ne passent pas pour payées, même si le formulaire dit extraPhotos", async () => {
  const listing = MOCK_LISTING_ROWS.find((row) => row.id === "l-08");
  assert.equal(listing.seller_id, "u-03");
  assert.equal(listing.extra_photos, false);

  const requested = await updateListing("l-08", { ...LISTING_VALUES, photos: photoRefs(8), extraPhotos: true });
  assert.equal(requested.status, "not-persisted");
  assert.equal(requested.data.photosAwaitingPayment, 5);

  const refused = await updateListing("l-08", { ...LISTING_VALUES, photos: photoRefs(8), extraPhotos: false });
  assert.equal(refused.status, "invalid");
  assert.ok(refused.fieldErrors.photos);
});

test("une annonce qui naît n'a rien payé : l'option cochée au dépôt est une demande", async () => {
  const result = await createListing({ ...LISTING_VALUES, photos: photoRefs(8), extraPhotos: true });
  assert.equal(result.status, "not-persisted");
  assert.equal(result.data.photosAwaitingPayment, 5);
});
