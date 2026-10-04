import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { MOCK_LISTING_ROWS } from "../src/lib/mock/listings.mock.ts";
import { MOCK_PHOTO_UPLOAD_ROWS } from "../src/lib/mock/photo-uploads.mock.ts";
import { LISTING_VALUES, photoRefs } from "./fixtures.mjs";

/* Les photos 4 à 8 d'une annonce sans l'option attendent le paiement, puis
   le webhook les accroche avec la clé de service, que la RLS ne retient
   pas. Tout ce que la base refuserait alors — le fichier d'un autre compte
   (relecture Cloudflare, F1), un fichier qu'une autre annonce affiche déjà
   (un fichier, une photo), un fichier que le ménage a pris — est refusé
   ici, avant le paiement : après, le vendeur aurait payé pour rien. La base
   tient les mêmes règles (supabase/tests/scenarios/03-photos.sql et
   11-photo-purge.sql). Le compte de démonstration se lit au chargement de
   la session : il est choisi avant l'import. */
process.env.DEMO_USER_ID = "u-03";
const { createListing, updateListing } = await import("../src/lib/data/listing-mutations.ts");
const { findUnattachableUploads } = await import("../src/lib/data/photo-uploads.ts");
const { TABLES } = await import("../src/lib/data/source.ts");

const keyOf = (ownerId) => MOCK_PHOTO_UPLOAD_ROWS.find((row) => row.owner_id === ownerId)?.key;
const OWN = `storage:${keyOf("u-03")}`;
const FOREIGN = `storage:${keyOf("u-01")}`;

/* Deux fichiers de plus au registre de u-03, le temps de ce test : l'un
   affiché par son annonce l-26, l'autre pris par le ménage. */
const SHOWN = "c0ffee00-0000-4000-8000-0000000000a1";
const CLAIMED = "c0ffee00-0000-4000-8000-0000000000a2";
const created = "2026-09-20T10:00:00.000Z";
TABLES.photoUploads.push(
  { key: SHOWN, owner_id: "u-03", created_at: created, detached_at: null, purge_started_at: null },
  { key: CLAIMED, owner_id: "u-03", created_at: created, detached_at: created, purge_started_at: "2026-09-30T03:00:00.000Z" },
);
const listing26 = TABLES.listings.find((row) => row.id === "l-26");
assert.equal(listing26?.seller_id, "u-03");
listing26.photos.push({ id: "p-l26-registre", listing_id: "l-26", storage_path: SHOWN, position: listing26.photos.length });

const awaitingPayment = (ref) => ({ ...LISTING_VALUES, photos: [...photoRefs(3), ref], extraPhotos: true });

test("le fichier d'un autre compte, glissé parmi les photos qui attendent le paiement, est refusé avant le paiement", async () => {
  const refused = await createListing(awaitingPayment(FOREIGN));
  assert.equal(refused.status, "invalid");
  assert.ok(refused.fieldErrors.photos);
  /* Le sien passe, et attend le paiement. */
  const accepted = await createListing(awaitingPayment(OWN));
  assert.equal(accepted.status, "not-persisted");
  assert.equal(accepted.data.photosAwaitingPayment, 1);
});

test("un fichier qu'une autre annonce affiche déjà, ou que le ménage a pris, est refusé avant le paiement", async () => {
  for (const ref of [`storage:${SHOWN}`, `storage:${CLAIMED}`]) {
    const refused = await createListing(awaitingPayment(ref));
    assert.equal(refused.status, "invalid", ref);
    assert.ok(refused.fieldErrors.photos, ref);
  }
});

test("à la modification, une annonce garde ses propres fichiers, et ne prend pas ceux d'une autre", async () => {
  assert.equal((await updateListing("l-26", { ...LISTING_VALUES, photos: [`storage:${SHOWN}`] })).status, "not-persisted");
  const refused = await updateListing("l-08", { ...LISTING_VALUES, photos: [`storage:${SHOWN}`] });
  assert.equal(refused.status, "invalid");
  assert.equal((await updateListing("l-08", { ...LISTING_VALUES, photos: [FOREIGN] })).status, "invalid");
  assert.equal((await updateListing("l-08", { ...LISTING_VALUES, photos: [OWN] })).status, "not-persisted");
});

test("seul le registre dit ce qu'un fichier peut devenir : une clé qu'il ne connaît pas ne s'accroche pas", async () => {
  const forNewListing = { ownerId: "u-03", listingId: null };
  assert.deepEqual(await findUnattachableUploads([OWN, "local:photo-1", "https://images.unsplash.com/photo-1"], forNewListing), []);
  assert.deepEqual(
    await findUnattachableUploads([FOREIGN, "storage:inconnue", `storage:${SHOWN}`, `storage:${CLAIMED}`], forNewListing),
    [FOREIGN, "storage:inconnue", `storage:${SHOWN}`, `storage:${CLAIMED}`],
  );
  assert.deepEqual(await findUnattachableUploads([`storage:${SHOWN}`], { ownerId: "u-03", listingId: "l-26" }), []);
});

test("la démonstration se charge en base une image par photo d'annonce, au nom de son vendeur", () => {
  /* Une même adresse Unsplash sert plusieurs annonces, souvent de vendeurs
     différents : téléversée une fois par adresse, elle violerait « un
     fichier, une photo » et l'appartenance au vendeur. Le guide doit le
     dire, avec les nombres de la démonstration (relecture du suivi). */
  /* Les adresses Unsplash seules : ce fichier accroche plus haut une clé du
     registre à l-26, le temps de ses propres tests. */
  const photos = MOCK_LISTING_ROWS.flatMap((row) => row.photos.map((photo) => ({ url: photo.storage_path, listingId: row.id, sellerId: row.seller_id })))
    .filter(({ url }) => url?.startsWith("https://"));
  const sellersByUrl = Map.groupBy(photos, ({ url }) => url);
  const countDistinct = (group, field) => new Set(group.map((photo) => photo[field])).size;
  const shared = [...sellersByUrl.values()].filter((group) => countDistinct(group, "listingId") > 1).length;
  const acrossSellers = [...sellersByUrl.values()].filter((group) => countDistinct(group, "sellerId") > 1).length;
  assert.ok(acrossSellers > 0, "plus aucune photo partagée : le paragraphe du guide peut se simplifier");
  const guide = readFileSync(path.join(import.meta.dirname, "..", "supabase", "README.md"), "utf8");
  const demo = guide.slice(guide.indexOf("\n## 10. "), guide.indexOf("\n## 11. "));
  assert.match(demo, /une image par photo d'annonce\*\*, \d+ et\s+non \d+/);
  assert.match(demo, /au nom du\s+vendeur de cette annonce/);
  assert.ok(demo.includes(`${shared} des ${sellersByUrl.size}, dont ${acrossSellers} chez`), "le guide ne cite pas les nombres de la démonstration");
  assert.match(demo, new RegExp(`\\*\\*, ${photos.length} et\\s+non ${sellersByUrl.size}`));
});
