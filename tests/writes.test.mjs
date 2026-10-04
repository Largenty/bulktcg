import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createListing } from "../src/lib/data/listing-mutations.ts";
import { createWanted } from "../src/lib/data/wanted-mutations.ts";
import { listingFormSchema, listingFormSchemaWithoutPhotos, LISTING_COMMUNE_ERROR } from "../src/lib/schemas/listing-form.ts";
import { withKnownCommune } from "../src/lib/schemas/commune.ts";
import { draftIdSchema } from "../src/lib/schemas/record-id.ts";
import { idSlugSuffix } from "../src/lib/slug.ts";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* Les écritures de la phase 2 : chaque mutation passe par performWrite, qui
   garde la couture pour la démonstration et écrit dans Supabase dès que la
   base est configurée. Ces tests tournent sans base — la démonstration —, et
   les scénarios SQL (supabase/tests, fichier 12) tiennent l'autre côté. */

const DATA_ROOT = path.join(SOURCE_ROOT, "lib", "data");
const MUTATIONS = collectFiles(DATA_ROOT, /-mutations\.ts$/);
const read = (file) => readFileSync(file, "utf8");

/* Les seules écritures qui ne passent pas par performWrite, chacune pour sa
   raison : Supabase Auth n'est pas PostgREST, et ses fonctions ont leurs
   propres coutures ; les notifications d'un dépôt partent hors du temps de
   réponse (after) avec la clé de service ; la vue d'une fiche n'a pas
   encore d'appelant. */
const OUTSIDE_PERFORM_WRITE = new Set([
  "auth.signIn",
  "auth.signUp",
  "auth.passwordReset",
  "auth.passwordUpdate",
  "notifications.insert",
  "listings.view",
]);
const DIRECT_DEFER = new Map([
  ["auth-mutations.ts", "les coutures de Supabase Auth"],
  ["listing-mutations.ts", "les notifications d'un dépôt, dans la démonstration"],
]);

function declaredOperations() {
  const seam = read(path.join(DATA_ROOT, "write-seam.ts"));
  const union = seam.match(/export type WriteOperation =([\s\S]+?);/);
  assert.ok(union, "WriteOperation introuvable dans write-seam.ts");
  return [...union[1].matchAll(/"([a-zA-Z.]+)"/g)].map((match) => match[1]);
}

/* L'opération nommée en premier argument de chaque performWrite. */
function performedOperations(source) {
  return [...source.matchAll(/performWrite(?:Returning)?(?:<[^(]*>)?\(\s*"([a-zA-Z.]+)"/g)].map((match) => match[1]);
}

test("chaque écriture de la couche données passe par performWrite, hors des exceptions nommées", () => {
  const performed = new Set(MUTATIONS.flatMap((file) => performedOperations(read(file))));
  const missing = declaredOperations().filter((operation) => !OUTSIDE_PERFORM_WRITE.has(operation) && !performed.has(operation));
  assert.deepEqual(missing, [], "écritures déclarées sans requête : elles s'arrêteraient à la couture avec la base");
});

test("aucune mutation n'appelle la couture directement, hors des exceptions nommées", () => {
  /* deferWrite seul rendrait « not-persisted » même avec la base : la
     saisie paraîtrait enregistrée dans la démonstration, et perdue en
     production. */
  const offenders = MUTATIONS.filter((file) => /\bdeferWrite\(/.test(read(file)) && !DIRECT_DEFER.has(path.basename(file))).map((file) =>
    path.basename(file),
  );
  assert.deepEqual(offenders, []);
});

test("le détecteur lit l'opération de chaque forme d'appel", () => {
  assert.deepEqual(
    performedOperations(`
      performWrite("listings.status", a, b, c);
      performWriteReturning<unknown, Result>(
        "listings.insert", a, b, c, d);
      performWriteReturning("wanted.insert", a, b, c, d);`),
    ["listings.status", "listings.insert", "wanted.insert"],
  );
});

test("l'identifiant d'un dépôt est un UUID, rien d'autre", () => {
  assert.ok(draftIdSchema.safeParse(crypto.randomUUID()).success);
  for (const forged of ["l-01", "../l-01", "", "x".repeat(36), "2cdc28f0-017a-49c4-9ed7-87056c83901"]) {
    assert.equal(draftIdSchema.safeParse(forged).success, false, `${forged} accepté comme identifiant`);
  }
});

test("le lien permanent tire son suffixe de l'identifiant, et reste un lien lisible", () => {
  assert.equal(idSlugSuffix("2CDC28F0-017a-49c4-9ed7-87056c839011"), "2cdc28f0");
  assert.match(idSlugSuffix(crypto.randomUUID()), /^[0-9a-f]{8}$/);
});

const VALID = {
  title: "Vrac 400 cartes Pokémon",
  gameId: "pokemon",
  lotType: "bulk",
  condition: "mixed",
  language: "VF",
  cardCount: "400",
  weightKg: "",
  priceEuros: "35",
  city: "Avignon",
  postalCode: "84000",
  description: "Quatre cents cartes des séries récentes, remise en main propre à Avignon.",
  editions: ["pokemon-ev08"],
  tags: ["booster-pack"],
  photos: ["local:lz4k2-9f8a7b6c"],
  audience: "everyone",
  privateSeller: "on",
};

test("sans photos possibles, le dépôt se fait sans photo, et une photo envoyée quand même est refusée", () => {
  /* Avec la base et avant Cloudflare Images (phase 3) : le formulaire
     n'en propose pas, et l'action serveur applique le même schéma. */
  assert.ok(listingFormSchemaWithoutPhotos.safeParse({ ...VALID, photos: [] }).success);
  const withPhoto = listingFormSchemaWithoutPhotos.safeParse(VALID);
  assert.equal(withPhoto.success, false);
  assert.match(JSON.stringify(withPhoto.error?.issues), /photos arrivent bientôt/);
  /* Les autres règles restent : la commune doit exister, ce que l'action
     vérifie (schemas/commune.ts). */
  assert.equal(withKnownCommune(listingFormSchemaWithoutPhotos, LISTING_COMMUNE_ERROR).safeParse({ ...VALID, photos: [], city: "Atlantis", postalCode: "" }).success, false);
  /* Et la démonstration garde son exigence d'une photo au moins. */
  assert.equal(listingFormSchema.safeParse({ ...VALID, photos: [] }).success, false);
});

test("dans la démonstration, un dépôt garde son lien d'aperçu, identifiant fourni ou non", async () => {
  const values = listingFormSchema.parse(VALID);
  for (const draftId of [crypto.randomUUID(), undefined]) {
    const result = await createListing(values, draftId);
    assert.equal(result.status, "not-persisted");
    assert.equal(result.status === "not-persisted" && result.data.slug, "vrac-400-cartes-pokemon-avignon-apercu");
  }
  const wanted = await createWanted(
    {
      title: "Cherche vrac Pokémon pour le club",
      gameId: "pokemon",
      lotType: "",
      maxPriceEuros: 80,
      minCardCount: null,
      city: "Avignon",
      postalCode: "84000",
      maxDistanceKm: 50,
      description: "Je récupère du volume pour dépanner des débutants au club.",
    },
    crypto.randomUUID(),
  );
  assert.equal(wanted.status, "not-persisted");
});

/* Les constats de la relecture de la phase 2 : chacun a le test qui l'aurait
   attrapé. Les règles de la base sont rejouées par les scénarios SQL
   (fichier 12) ; ces tests tiennent le côté du serveur. */

const { readCreatedListing, MATCH_NOTIFICATION_KEY } = await import("../src/lib/data/listing-mutations.ts");
const { toMatchRecipient, toStoredMatchSubject, toWantedMatchNotifications } = await import("../src/lib/data/mappers/notifications.ts");
const { sql } = await import("./schema.mjs");

const STORED = {
  id: "2cdc28f0-017a-49c4-9ed7-87056c839011",
  seller_id: "u-seller",
  game_id: "pokemon",
  lot_type: "bulk",
  card_count: 400,
  price_cents: 3500,
  latitude: 43.95,
  longitude: 4.81,
  audience: "pros",
};
const MATCHES = [
  { wantedId: "w-1", buyerId: "u-pro", buyerHasProPlan: true },
  { wantedId: "w-2", buyerId: "u-private", buyerHasProPlan: false },
  { wantedId: "w-3", buyerId: "u-seller", buyerHasProPlan: true },
];

test("un lot réservé aux pros ne se signale qu'aux pros, et jamais à son vendeur", () => {
  const { listing } = toStoredMatchSubject(STORED);
  assert.deepEqual(
    toWantedMatchNotifications(listing, MATCHES).map((row) => row.user_id),
    ["u-pro"],
    "un particulier apprendrait l'existence d'un lot qu'il ne peut pas voir",
  );
  const everyone = toStoredMatchSubject({ ...STORED, audience: "everyone" }).listing;
  assert.deepEqual(toWantedMatchNotifications(everyone, MATCHES).map((row) => row.user_id), ["u-pro", "u-private"]);
  /* Le sujet de la notification est l'annonce enregistrée. */
  assert.ok(toWantedMatchNotifications(everyone, MATCHES).every((row) => row.listing_id === STORED.id && row.kind === "wanted_match"));
});

test("le croisement d'une annonce enregistrée lit ses colonnes, et refuse une valeur inconnue", () => {
  const { matchable } = toStoredMatchSubject(STORED);
  assert.deepEqual(matchable, {
    gameId: "pokemon",
    lotType: "bulk",
    cardCount: 400,
    priceCents: 3500,
    latitude: 43.95,
    longitude: 4.81,
    seller: { id: "u-seller" },
  });
  assert.throws(() => toStoredMatchSubject({ ...STORED, audience: "amis" }), /listings\.audience/);
  /* Le forfait décide, pas le statut : une boutique au forfait expiré ne
     reçoit pas un lot réservé aux pros. */
  assert.deepEqual(toMatchRecipient({ wanted: { id: "w-9", buyer: { id: "u-9", isPro: true, hasProPlan: false } } }), {
    wantedId: "w-9",
    buyerId: "u-9",
    buyerHasProPlan: false,
  });
});

test("seul un dépôt que la base dit créé prévient les acheteurs ; un doublon ou une réponse illisible, non", () => {
  assert.deepEqual(readCreatedListing({ permalink: "vrac-avignon-2cdc28f0", created: true }, "x"), { slug: "vrac-avignon-2cdc28f0", created: true });
  assert.deepEqual(readCreatedListing({ permalink: "vrac-avignon-2cdc28f0", created: false }, "x"), { slug: "vrac-avignon-2cdc28f0", created: false });
  for (const unreadable of [null, "vrac", { created: "true" }, { permalink: 12 }]) {
    assert.equal(readCreatedListing(unreadable, "repli").created, false, `${JSON.stringify(unreadable)} compté comme une création`);
  }
  /* Et l'écriture ne part qu'à ces deux conditions, sur la ligne gardée par
     la base, jamais sur l'envoi : rejoué avec un autre jeu, un autre prix ou
     une autre audience, un dépôt prévenait d'autres acheteurs. */
  const source = read(path.join(DATA_ROOT, "listing-mutations.ts"));
  const deferred = source.split("\n").filter((line) => /\bafter\(/.test(line));
  assert.ok(deferred.length > 0, "les notifications ne partent plus hors du temps de réponse");
  for (const line of deferred) {
    assert.match(line, /result\.status === "saved" && created\b/, `notification sans création : ${line.trim()}`);
    assert.match(line, /notifyStoredListing\(listing\.id\)/, `notification calculée sur l'envoi : ${line.trim()}`);
  }
});

test("une notification de croisement ne s'écrit qu'une fois : l'écriture vise l'index unique de la base", () => {
  const index = sql.match(/create unique index notifications_one_per_match on public\.notifications \(([^)]+)\);/);
  assert.ok(index, "aucun index n'empêche une notification de croisement en double");
  assert.equal(index[1].split(",").map((column) => column.trim()).join(","), MATCH_NOTIFICATION_KEY);
  const source = read(path.join(DATA_ROOT, "listing-mutations.ts"));
  assert.match(source, /\.upsert\(rows, \{ onConflict: MATCH_NOTIFICATION_KEY, ignoreDuplicates: true \}\)/);
});

test("changer le statut d'une annonce rafraîchit aussi les profils, dont la base change le compte des ventes", () => {
  /* count_sale incrémente ou décrémente profiles.sold_listing_count à
     l'entrée ou à la sortie de « Vendu » : sans invalider les profils, le
     compte des ventes du vendeur restait périmé une heure. */
  const countSale = sql.match(/create or replace function public\.count_sale\(\)[\s\S]+?\n\$\$;/);
  assert.ok(countSale && /update public\.profiles set sold_listing_count/.test(countSale[0]), "count_sale ne touche plus les profils");
  const action = read(path.join(SOURCE_ROOT, "app", "actions", "listings.ts"));
  const body = action.slice(action.indexOf("export async function changeListingStatus"), action.indexOf("export async function removeListing"));
  assert.match(body, /CACHE_TAGS\.profiles/, "le changement de statut laisse le compte des ventes en cache");
});

test("un compte supprimé est déconnecté tout de suite, pas à l'expiration du jeton", () => {
  const source = read(path.join(DATA_ROOT, "profile-mutations.ts"));
  const body = source.slice(source.indexOf("export async function deleteAccount"));
  const deleteAt = body.indexOf("auth.admin.deleteUser(");
  const signOutAt = body.indexOf("await signOut()");
  assert.ok(deleteAt > 0, "la suppression ne passe plus par l'API d'administration");
  assert.ok(signOutAt > deleteAt, "la session survit à la suppression du compte");
});
