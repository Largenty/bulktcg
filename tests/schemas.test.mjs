import assert from "node:assert/strict";
import test from "node:test";
import { collectErrors } from "../src/lib/schemas/field-errors.ts";
import { messageSchema } from "../src/lib/schemas/message-form.ts";
import { withKnownCommune } from "../src/lib/schemas/commune.ts";
import { COMMUNE_ERROR, profileSchema } from "../src/lib/schemas/profile-form.ts";
import { reportSchema } from "../src/lib/schemas/report-form.ts";
import { reviewSchema } from "../src/lib/schemas/review-form.ts";
import { WANTED_COMMUNE_ERROR, wantedFormSchema } from "../src/lib/schemas/wanted-form.ts";

/* Les schémas que les actions serveur rejouent : un formulaire se trafique,
   et c'est ici qu'un envoi forgé s'arrête. Seul celui des annonces avait
   ses tests (listing-form.test.mjs) ; les cinq autres n'en avaient aucun.

   Chaque table part d'un envoi valide — accepté, sans quoi un refus ne
   prouverait rien — et n'en fausse qu'un champ à la fois : le refus doit
   tomber sur ce champ-là, et sur lui seul, pour que le message s'affiche
   sous le bon champ. */

function refusedFields(schema, input) {
  const result = schema.safeParse(input);
  assert.equal(result.success, false, `accepté à tort : ${JSON.stringify(input).slice(0, 160)}`);
  return Object.keys(collectErrors(result.error));
}

function assertRefusals(schema, valid, cases) {
  assert.equal(schema.safeParse(valid).success, true, "l'envoi de référence doit passer");
  for (const [label, patch, fields] of cases) {
    assert.deepEqual(refusedFields(schema, { ...valid, ...patch }), [fields].flat(), label);
  }
}

const WANTED = {
  title: "Cherche vrac Pokémon pour le club",
  gameId: "pokemon",
  lotType: "",
  maxPriceEuros: "80",
  minCardCount: "",
  city: "Avignon",
  postalCode: "84000",
  maxDistanceKm: "50",
  description: "Je récupère du volume pour dépanner des débutants au club.",
};

test("une demande de recherche refuse ce qu'un formulaire honnête n'enverrait pas", () => {
  assertRefusals(withKnownCommune(wantedFormSchema, WANTED_COMMUNE_ERROR), WANTED, [
    ["un jeu inconnu", { gameId: "digimon" }, "gameId"],
    ["un format inconnu", { lotType: "classeur" }, "lotType"],
    ["un budget nul", { maxPriceEuros: "0" }, "maxPriceEuros"],
    ["un budget illisible", { maxPriceEuros: "beaucoup" }, "maxPriceEuros"],
    ["un volume non entier", { minCardCount: "12,5" }, "minCardCount"],
    ["un rayon trop court", { maxDistanceKm: "4" }, "maxDistanceKm"],
    ["un rayon démesuré", { maxDistanceKm: "500" }, "maxDistanceKm"],
    ["un rayon absent, que Number() lirait zéro", { maxDistanceKm: "" }, "maxDistanceKm"],
    ["un code postal à quatre chiffres", { postalCode: "8400" }, "postalCode"],
    ["une commune inconnue", { city: "Atlantide", postalCode: "99999" }, "city"],
    ["une description d'un mot", { description: "Du vrac." }, "description"],
    ["un titre trop court", { title: "Vrac" }, "title"],
  ]);
});

test("une demande garde « peu importe » comme une réponse, jamais comme un zéro", () => {
  const result = wantedFormSchema.parse({ ...WANTED, maxPriceEuros: "", minCardCount: "" });
  assert.equal(result.maxPriceEuros, null);
  assert.equal(result.minCardCount, null);
  assert.equal(result.lotType, "");
  assert.equal(result.maxDistanceKm, 50);
});

const PROFILE = { username: "lecomptoirdukado", bio: "", city: "Avignon", postalCode: "84000" };

test("un profil refuse un pseudo illisible en filigrane et une fiche boutique douteuse", () => {
  assertRefusals(withKnownCommune(profileSchema, COMMUNE_ERROR), PROFILE, [
    ["un pseudo de deux lettres", { username: "ab" }, "username"],
    ["un pseudo accentué", { username: "étoile" }, "username"],
    ["un pseudo avec une espace", { username: "le comptoir" }, "username"],
    ["un pseudo de 25 caractères", { username: "a".repeat(25) }, "username"],
    ["une présentation de 281 caractères", { bio: "a".repeat(281) }, "bio"],
    ["un site en clair", { shopWebsite: "http://boutique.example" }, "shopWebsite"],
    ["un lien javascript:", { shopWebsite: "javascript:alert(1)" }, "shopWebsite"],
    ["une adresse de trois lettres", { shopAddress: "abc" }, "shopAddress"],
    ["une commune inconnue", { city: "Atlantide", postalCode: "99999" }, "city"],
  ]);
});

test("un pseudo est rendu tel que le filigrane l'écrira", () => {
  const result = profileSchema.parse({ ...PROFILE, username: "  LeComptoir.Du-Kado  " });
  assert.equal(result.username, "lecomptoir.du-kado");
  assert.equal(result.shopWebsite, "", "une fiche boutique absente arrive vide, pas undefined");
});

const REVIEW = { dealId: "d-02", punctuality: "5", responsiveness: "4", reliability: "3", comment: "" };

test("un avis refuse toute note hors de 1 à 5, et un critère laissé vide", () => {
  assertRefusals(reviewSchema, REVIEW, [
    ["une note de zéro", { punctuality: "0" }, "punctuality"],
    ["une note de six", { responsiveness: "6" }, "responsiveness"],
    ["une demi-note", { reliability: "4.5" }, "reliability"],
    /* La coercition lirait zéro : c'est un refus avec la consigne. */
    ["un critère vide", { punctuality: "" }, "punctuality"],
    ["un critère absent", { punctuality: null }, "punctuality"],
    ["une note illisible", { reliability: "excellent" }, "reliability"],
    ["sans vente", { dealId: "" }, "dealId"],
    ["un identifiant démesuré", { dealId: "d".repeat(65) }, "dealId"],
    ["un commentaire de 1 001 caractères", { comment: "a".repeat(1001) }, "comment"],
  ]);
  assert.deepEqual(reviewSchema.parse(REVIEW).punctuality, 5);
});

const REPORT = { targetType: "listing", targetKey: "vrac-400-cartes-pokemon-avignon-01", reason: "scam", details: "" };

test("un signalement ne vise qu'une cible et un motif de la liste fermée", () => {
  assertRefusals(reportSchema, REPORT, [
    ["une cible d'un autre type", { targetType: "user" }, "targetType"],
    ["un motif hors liste", { reason: "spam" }, "reason"],
    ["sans cible", { targetKey: "" }, "targetKey"],
    ["une cible démesurée", { targetKey: "a".repeat(161) }, "targetKey"],
    ["un détail de 1 001 caractères", { details: "a".repeat(1001) }, "details"],
  ]);
});

test("un message n'est ni vide ni roman, et part sans ses espaces de bord", () => {
  assertRefusals(messageSchema, { body: "Bonjour, toujours disponible ?" }, [
    ["que des espaces", { body: "     " }, "body"],
    ["une lettre", { body: "a" }, "body"],
    ["2 001 caractères", { body: "a".repeat(2001) }, "body"],
  ]);
  assert.equal(messageSchema.parse({ body: "  Bonjour  " }).body, "Bonjour");
});
