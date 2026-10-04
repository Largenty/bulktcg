import assert from "node:assert/strict";
import test from "node:test";
import { LISTING_VALUES } from "./fixtures.mjs";

/* Le statut professionnel, déclaré par SIRET, et la déclaration d'un
   particulier au dépôt (Code de la consommation, D111-8). Le compte de
   démonstration est u-01, un particulier ; le répertoire des entreprises
   est remplacé par un verdict choisi — aucun réseau. */
const { declareProStatus, leaveProStatus } = await import("../src/lib/data/pro-status-mutations.ts");
const { createListing } = await import("../src/lib/data/listing-mutations.ts");

const company = (overrides = {}) => ({
  siret: "55203253400703",
  legalName: "DANONE",
  tradeName: null,
  isActive: true,
  source: "recherche-entreprises",
  ...overrides,
});
const answer = (verdict) => async () => verdict;
const values = (overrides = {}) => ({ siret: "55203253400703", companyName: "", certifies: true, ...overrides });

test("un établissement en activité fait passer le compte en professionnel, sous l'enseigne choisie ou celle du répertoire", async () => {
  const chosen = await declareProStatus(values({ companyName: "Le Comptoir" }), answer({ status: "found", company: company() }));
  assert.equal(chosen.status, "not-persisted");
  assert.deepEqual(chosen.data, { siret: "55203253400703", legalName: "DANONE", companyName: "Le Comptoir" });

  const fromRegistry = await declareProStatus(values(), answer({ status: "found", company: company({ tradeName: "Danone Paris" }) }));
  assert.equal(fromRegistry.data.companyName, "Danone Paris", "l'enseigne du répertoire passe après la raison sociale");

  /* Raison sociale masquée, sans enseigne ni nom choisi : rien à afficher,
     on le demande plutôt que d'inventer. */
  const nameless = await declareProStatus(values(), answer({ status: "found", company: company({ legalName: null }) }));
  assert.equal(nameless.status, "invalid");
  assert.ok(nameless.fieldErrors.companyName);
});

test("un établissement fermé ou absent du répertoire est refusé, et une panne ne conclut rien", async () => {
  const closed = await declareProStatus(values(), answer({ status: "closed", company: company({ isActive: false }) }));
  assert.equal(closed.status, "invalid");
  assert.match(closed.fieldErrors.siret, /fermé/);

  const unknown = await declareProStatus(values(), answer({ status: "unknown" }));
  assert.equal(unknown.status, "invalid");
  assert.match(unknown.fieldErrors.siret, /n'apparaît pas au répertoire public/);

  assert.deepEqual(await declareProStatus(values(), answer({ status: "unavailable" })), { status: "failed", retryable: true });
});

test("un particulier n'a pas de statut professionnel à quitter", async () => {
  assert.deepEqual(await leaveProStatus(), { status: "not-found" });
});

test("un particulier déclare au dépôt vendre à titre personnel, ou rien n'est publié", async () => {
  const refused = await createListing({ ...LISTING_VALUES, privateSeller: false });
  assert.equal(refused.status, "invalid");
  assert.match(refused.fieldErrors.privateSeller, /à titre personnel/);
  assert.equal((await createListing(LISTING_VALUES)).status, "not-persisted");
});
