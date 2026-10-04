import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { lookupCompany, readSearchResponse, readSireneResponse } from "../src/lib/company-registry.ts";
import { isValidSiret, normalizeSiret } from "../src/lib/siret.ts";
import { proStatusSchema } from "../src/lib/schemas/pro-status-form.ts";

/* La vérification d'un SIRET, sans réseau : la forme (clé de Luhn), puis
   les réponses du répertoire des entreprises, rejouées depuis
   tests/fixtures/company-registry/ — réelles pour l'API Recherche
   d'entreprises, reconstituées pour Sirene (son README le dit). */

const fixture = (name) =>
  JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures", "company-registry", name), "utf8"));

const ACTIVE = "55203253400703";
const CLOSED = "55203253400646";
const ABSENT = "73282932000074";
const HIDDEN = "98765432101237";

test("un SIRET se vérifie par sa clé de Luhn, La Poste par la somme de ses chiffres", () => {
  for (const siret of [ACTIVE, CLOSED, ABSENT, HIDDEN]) assert.equal(isValidSiret(siret), true, siret);
  assert.equal(isValidSiret("55203253400704"), false, "un chiffre faux passe");
  assert.equal(isValidSiret("552032534"), false, "le SIREN seul passe pour un SIRET");
  assert.equal(isValidSiret("5520325340070A"), false);
  /* La Poste (SIREN 356 000 000) : la somme des chiffres, multiple de cinq. */
  assert.equal(isValidSiret("35600000000001"), true);
  assert.equal(isValidSiret("35600000000048"), false);
  assert.equal(normalizeSiret("552 032 534 00703"), ACTIVE);
  assert.equal(normalizeSiret("552.032.534-00703"), ACTIVE);
});

test("le formulaire refuse une faute de frappe, et la déclaration manquante, avant tout appel", () => {
  const errors = (values) => proStatusSchema.safeParse(values).error?.issues.map((issue) => issue.path[0]) ?? [];
  assert.deepEqual(errors({ siret: "552 032 534 00703", companyName: "", certifies: "on" }), []);
  assert.deepEqual(errors({ siret: "552032534", certifies: "on" }), ["siret"]);
  assert.deepEqual(errors({ siret: "55203253400704", certifies: "on" }), ["siret"]);
  assert.deepEqual(errors({ siret: ACTIVE }), ["certifies"], "le statut passe sans que personne ne s'engage");
  assert.deepEqual(errors({ siret: ACTIVE, companyName: "X", certifies: "on" }), ["companyName"]);
  assert.equal(proStatusSchema.parse({ siret: "552 032 534 00703", certifies: "on" }).siret, ACTIVE);
});

test("le répertoire public dit un établissement actif, fermé ou absent", () => {
  const active = readSearchResponse(ACTIVE, fixture("recherche-actif.json"));
  assert.deepEqual(active, {
    status: "found",
    company: { siret: ACTIVE, legalName: "DANONE", tradeName: null, isActive: true, source: "recherche-entreprises" },
  });
  /* L'entreprise est active, cet établissement non : on ne vend pas sous le
     SIRET d'un établissement fermé. */
  assert.equal(readSearchResponse(CLOSED, fixture("recherche-ferme.json")).status, "closed");
  assert.deepEqual(readSearchResponse(ABSENT, fixture("recherche-absent.json")), { status: "unknown" });
  /* La recherche rend l'entreprise ; un autre de ses établissements ne vaut
     pas celui qu'on a tapé. */
  assert.deepEqual(readSearchResponse(CLOSED, fixture("recherche-actif.json")), { status: "unknown" });
  /* Une réponse qui n'a pas la forme attendue ne conclut rien. */
  assert.deepEqual(readSearchResponse(ACTIVE, { résultats: [] }), { status: "unavailable" });
});

test("Sirene rend une entreprise non diffusée, et un champ masqué n'est jamais affiché « [ND] »", () => {
  const hidden = readSireneResponse(HIDDEN, fixture("sirene-non-diffusible.json"));
  assert.deepEqual(hidden, {
    status: "found",
    company: { siret: HIDDEN, legalName: null, tradeName: null, isActive: true, source: "sirene" },
  });
  assert.deepEqual(readSireneResponse(ACTIVE, fixture("sirene-non-diffusible.json")), { status: "unavailable" }, "la réponse d'un autre SIRET est prise pour la bonne");
});

/* Un fetch de test : chaque adresse appelée, et la réponse prévue. */
function fakeFetch(responses) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), headers: init?.headers ?? {} });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return new Response(next.body === undefined ? null : JSON.stringify(next.body), { status: next.status ?? 200 });
  };
  return { fetch, calls };
}

test("absent du répertoire public, un SIRET passe par Sirene seulement avec une clé", async () => {
  const withoutKey = fakeFetch([{ body: fixture("recherche-absent.json") }]);
  assert.deepEqual(await lookupCompany(ABSENT, { fetch: withoutKey.fetch, inseeApiKey: null }), { status: "unknown" });
  assert.equal(withoutKey.calls.length, 1);
  assert.match(withoutKey.calls[0].url, /^https:\/\/recherche-entreprises\.api\.gouv\.fr\/search\?q=73282932000074&/);

  const withKey = fakeFetch([{ body: fixture("recherche-absent.json") }, { body: fixture("sirene-non-diffusible.json") }]);
  const found = await lookupCompany(HIDDEN, { fetch: withKey.fetch, inseeApiKey: "cle-de-test" });
  assert.equal(found.status, "found");
  assert.equal(withKey.calls[1].url, `https://api.insee.fr/api-sirene/3.11/siret/${HIDDEN}`);
  assert.equal(withKey.calls[1].headers["X-INSEE-Api-Key-Integration"], "cle-de-test");

  const notInSirene = fakeFetch([{ body: fixture("recherche-absent.json") }, { status: 404 }]);
  assert.deepEqual(await lookupCompany(ABSENT, { fetch: notInSirene.fetch, inseeApiKey: "cle" }), { status: "unknown" });
});

test("une panne, une limite ou un délai dépassé ne concluent rien", async () => {
  for (const response of [{ status: 429 }, { status: 503 }, new TypeError("fetch failed")]) {
    const { fetch } = fakeFetch([response]);
    assert.deepEqual(await lookupCompany(ACTIVE, { fetch, inseeApiKey: null }), { status: "unavailable" });
  }
  const sireneDown = fakeFetch([{ body: fixture("recherche-absent.json") }, { status: 500 }]);
  assert.deepEqual(await lookupCompany(ABSENT, { fetch: sireneDown.fetch, inseeApiKey: "cle" }), { status: "unavailable" });
});
