import assert from "node:assert/strict";
import test from "node:test";
import { LISTING_VALUES } from "./fixtures.mjs";

/* Le même parcours vu d'une boutique : u-13, compte professionnel au
   forfait actif. La session se lit au chargement, d'où l'import dynamique
   après le choix du compte. */
process.env.DEMO_USER_ID = "u-13";
const { declareProStatus, leaveProStatus } = await import("../src/lib/data/pro-status-mutations.ts");
const { createListing } = await import("../src/lib/data/listing-mutations.ts");
const { getProfileById } = await import("../src/lib/data/profiles.ts");

test("un compte déjà professionnel ne se déclare pas une seconde fois", async () => {
  let asked = false;
  const result = await declareProStatus({ siret: "55203253400703", companyName: "", certifies: true }, async () => {
    asked = true;
    return { status: "unknown" };
  });
  assert.equal(result.status, "invalid");
  assert.match(result.fieldErrors.siret, /déjà professionnel/);
  assert.equal(asked, false, "le répertoire est interrogé pour rien");
});

test("une boutique au forfait en cours ne repasse pas en particulier avant de l'avoir résilié", async () => {
  const shop = await getProfileById("u-13");
  assert.equal(shop.isPro && shop.hasProPlan, true, "u-13 n'est plus une boutique au forfait actif");
  const result = await leaveProStatus();
  assert.equal(result.status, "invalid");
  assert.match(result.fieldErrors.status, /forfait/);
});

test("une boutique dépose sans déclaration de particulier : son statut le dit déjà", async () => {
  assert.equal((await createListing({ ...LISTING_VALUES, privateSeller: false })).status, "not-persisted");
});
