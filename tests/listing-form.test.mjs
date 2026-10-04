import assert from "node:assert/strict";
import { withKnownCommune } from "../src/lib/schemas/commune.ts";
import test from "node:test";
import { LISTING_COMMUNE_ERROR, listingFormSchema, toPriceCents } from "../src/lib/schemas/listing-form.ts";

const VALID = {
  title: "Vrac 400 cartes Pokémon",
  gameId: "pokemon",
  lotType: "bulk",
  condition: "mixed",
  language: "VF",
  cardCount: "400",
  weightKg: "1,1",
  priceEuros: "35",
  city: "Avignon",
  postalCode: "84000",
  description:
    "Quatre cents cartes des séries récentes, aucune carte pliée, remise en main propre à Avignon.",
  editions: ["pokemon-ev08"],
  tags: ["booster-pack"],
  photos: ["local:lz4k2-9f8a7b6c"],
  audience: "everyone",
};

test("l'audience est obligatoire et fermée", () => {
  /* Sans valeur par défaut : un envoi qui n'en porte pas ne doit pas
     rendre publique une annonce que son vendeur voulait réserver aux pros. */
  const { audience: _audience, ...withoutAudience } = VALID;
  assert.equal(listingFormSchema.safeParse(withoutAudience).success, false);
  assert.equal(listingFormSchema.safeParse({ ...VALID, audience: "amis" }).success, false);
  assert.equal(listingFormSchema.safeParse({ ...VALID, audience: "pros" }).success, true);
});

test("accepte un formulaire complet et convertit la virgule décimale", () => {
  const result = listingFormSchema.safeParse(VALID);
  assert.equal(result.success, true);
  assert.equal(result.data.cardCount, 400);
  assert.equal(result.data.weightKg, 1.1);
  assert.equal(toPriceCents(result.data.priceEuros), 3500);
});

test("un champ numérique vide vaut null, jamais zéro", () => {
  const result = listingFormSchema.safeParse({ ...VALID, cardCount: "", weightKg: "" });
  assert.equal(result.success, true);
  assert.equal(result.data.cardCount, null);
  assert.equal(result.data.weightKg, null);
});

test("refuse un nombre de cartes égal à zéro", () => {
  const result = listingFormSchema.safeParse({ ...VALID, cardCount: "0" });
  assert.equal(result.success, false);
});

test("refuse un code postal qui n'a pas cinq chiffres", () => {
  const result = listingFormSchema.safeParse({ ...VALID, postalCode: "840" });
  assert.equal(result.success, false);
});

test("refuse un prix nul ou négatif", () => {
  assert.equal(listingFormSchema.safeParse({ ...VALID, priceEuros: "0" }).success, false);
  assert.equal(listingFormSchema.safeParse({ ...VALID, priceEuros: "-5" }).success, false);
});

test("une série d'un autre jeu est refusée, même si elle existe", () => {
  /* Sans ce contrôle, un formulaire trafiqué déposerait une extension Magic
     sur une annonce Pokémon et le filtre par série deviendrait faux pour
     tout le monde. */
  const result = listingFormSchema.safeParse({ ...VALID, editions: ["magic-mh3"] });
  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /n'appartient pas au jeu/);
});

test("une série inconnue du référentiel ou retirée est refusée par le serveur, qui seul le connaît", async () => {
  /* Le schéma partagé part dans le navigateur, où le référentiel ne vit pas :
     il ne vérifie que le jeu que porte l'identifiant. L'action ajoute le
     contrôle du référentiel (withKnownEditions). */
  const { withKnownEditions } = await import("../src/lib/schemas/editions.ts");
  assert.equal(listingFormSchema.safeParse({ ...VALID, editions: ["pokemon-ev99"] }).success, true);
  const server = withKnownEditions(listingFormSchema);
  const unknown = server.safeParse({ ...VALID, editions: ["pokemon-ev99"] });
  assert.equal(unknown.success, false);
  assert.match(unknown.error.issues[0].message, /n'appartient pas au jeu/);
  assert.equal(server.safeParse({ ...VALID, editions: ["pokemon-ev08"] }).success, true);
});

test("un produit qui n'existe pas pour ce jeu est refusé", () => {
  /* « Structure Deck » est du vocabulaire Yu-Gi-Oh : le proposer sur une
     annonce Pokémon n'aurait aucun sens. */
  const result = listingFormSchema.safeParse({ ...VALID, tags: ["structure-deck"] });
  assert.equal(result.success, false);
});

test("aucune série et aucun produit reste valide : « non précisé » est une réponse", () => {
  const result = listingFormSchema.safeParse({ ...VALID, editions: [], tags: [] });
  assert.equal(result.success, true);
  assert.deepEqual(result.data.editions, []);
});

test("au-delà de douze séries le formulaire refuse et explique pourquoi", () => {
  const tooMany = [
    "pokemon-ev01", "pokemon-ev02", "pokemon-ev03", "pokemon-ev04", "pokemon-ev05",
    "pokemon-ev06", "pokemon-ev07", "pokemon-ev08", "pokemon-ev09", "pokemon-ev10",
    "pokemon-eb01", "pokemon-eb05", "pokemon-eb06",
  ];
  const result = listingFormSchema.safeParse({ ...VALID, editions: tooMany });
  assert.equal(result.success, false);
  assert.match(result.error.issues[0].message, /laissez le champ vide/);
});

test("plusieurs séries et plusieurs produits passent ensemble", () => {
  /* Le cas du lot mixte : deux classeurs, un coffret et du vrac. */
  const result = listingFormSchema.safeParse({
    ...VALID,
    editions: ["pokemon-ev", "pokemon-eb", "pokemon-ev03-5"],
    tags: ["etb", "booster-box", "playmat"],
  });
  assert.equal(result.success, true);
  assert.equal(result.data.editions.length, 3);
  assert.equal(result.data.tags.length, 3);
});

test("une annonce sans photo est refusée, avec une raison", () => {
  const result = listingFormSchema.safeParse({ ...VALID, photos: [] });
  assert.equal(result.success, false);
  const issue = result.error.issues.find((candidate) => candidate.path[0] === "photos");
  assert.match(issue.message, /au moins une photo/);
});

test("au-delà de huit photos le formulaire refuse", () => {
  const photos = Array.from({ length: 9 }, (_, index) => `local:photo-${index}`);
  assert.equal(listingFormSchema.safeParse({ ...VALID, photos }).success, false);
});

const somePhotos = (count) => Array.from({ length: count }, (_, index) => `local:photo-${index}`);

test("trois photos sont gratuites : la quatrième demande l'option « 8 photos »", () => {
  assert.equal(listingFormSchema.safeParse({ ...VALID, photos: somePhotos(3) }).success, true);
  const refused = listingFormSchema.safeParse({ ...VALID, photos: somePhotos(5) });
  assert.equal(refused.success, false);
  const issue = refused.error.issues.find((candidate) => candidate.path[0] === "photos");
  assert.match(issue.message, /retirez-en 2/);
  assert.equal(listingFormSchema.safeParse({ ...VALID, photos: somePhotos(5), extraPhotos: "on" }).success, true);
  assert.equal(listingFormSchema.safeParse({ ...VALID, photos: somePhotos(9), extraPhotos: "on" }).success, false);
});

test("les photos en trop sont refusées dès le premier envoi, même avec un autre champ faux", () => {
  /* Les contrôles d'objet ne tournaient qu'une fois tout le reste valide :
     l'erreur sur les photos n'apparaissait qu'au second envoi. */
  const result = listingFormSchema.safeParse({ ...VALID, title: "", photos: somePhotos(4) });
  const paths = result.error.issues.map((issue) => issue.path[0]);
  assert.ok(paths.includes("title"));
  assert.ok(paths.includes("photos"), "l'erreur sur les photos attend que le titre soit corrigé");
});

test("les trois formes de référence de photo sont admises, pas une autre", () => {
  const accepted = ["local:abc-123", "storage:2cdc28f0-017a-49c4-9ed7-87056c83901a", "https://images.unsplash.com/photo-1"];
  assert.equal(listingFormSchema.safeParse({ ...VALID, photos: accepted }).success, true);
  /* Une clé de Cloudflare Images n'a ni chemin ni extension : la forme R2
     (« compte/fichier.webp ») n'est plus recevable. */
  for (const bad of ["file:///etc/passwd", "javascript:alert(1)", "local:../x", "http://exemple.fr/a.jpg", "storage:u-01/2f3e.jpg", "storage:", "storage:a/../b"]) {
    assert.equal(listingFormSchema.safeParse({ ...VALID, photos: [bad] }).success, false, `référence acceptée : ${bad}`);
  }
});

/* La commune se vérifie dans l'action (schemas/commune.ts) : le référentiel
   ne part pas dans le navigateur, et le schéma partagé n'en vérifie que la
   forme. */
const serverListingSchema = withKnownCommune(listingFormSchema, LISTING_COMMUNE_ERROR);

test("une commune absente du référentiel est refusée sur le champ ville, par l'action", () => {
  const result = serverListingSchema.safeParse({ ...VALID, city: "Avignonville", postalCode: "84000" });
  assert.equal(result.success, false);
  assert.ok(result.error.issues.some((issue) => issue.path[0] === "city" && issue.message === LISTING_COMMUNE_ERROR));
  assert.equal(listingFormSchema.safeParse({ ...VALID, city: "Avignonville", postalCode: "84000" }).success, true, "le schéma partagé ne vérifie que la forme");
});

test("un code postal qui ne va pas avec un nom unique est remplacé par celui de la commune", () => {
  /* Sans JavaScript, le code postal d'une commune précédente peut rester
     dans le champ caché : le nom, unique, l'emporte. */
  const result = serverListingSchema.parse({ ...VALID, city: "Avignon", postalCode: "26000" });
  assert.equal(result.city, "Avignon");
  assert.equal(result.postalCode, "84000");
});

test("un homonyme sans son code postal est refusé, en nommant les communes possibles", () => {
  const result = serverListingSchema.safeParse({ ...VALID, city: "Valence", postalCode: "" });
  assert.equal(result.success, false);
  const message = result.error.issues.find((issue) => issue.path[0] === "city")?.message ?? "";
  assert.match(message, /Plusieurs communes portent ce nom/);
  assert.match(message, /Valence \(26000, Drôme\)/);
  /* Avec son code postal, chacune passe. */
  assert.equal(serverListingSchema.parse({ ...VALID, city: "Valence", postalCode: "82400" }).postalCode, "82400");
});

test("sans JavaScript, un nom unique ou « Nom (code) » suffisent", () => {
  assert.equal(serverListingSchema.parse({ ...VALID, city: "Carpentras", postalCode: "" }).postalCode, "84200");
  const label = serverListingSchema.parse({ ...VALID, city: "Valence (82400)", postalCode: "" });
  assert.deepEqual([label.city, label.postalCode], ["Valence", "82400"]);
});

test("la lecture du formulaire garde toutes les valeurs des champs multiples", async () => {
  const { readListingFormData } = await import("../src/lib/schemas/listing-form.ts");
  const formData = new FormData();
  formData.append("title", "Vrac 400 cartes Pokémon");
  for (const edition of ["pokemon-ev08", "pokemon-ev07"]) formData.append("editions", edition);
  for (const photo of ["local:a", "local:b", "local:c"]) formData.append("photos", photo);
  const raw = readListingFormData(formData);
  assert.deepEqual(raw.editions, ["pokemon-ev08", "pokemon-ev07"]);
  assert.deepEqual(raw.photos, ["local:a", "local:b", "local:c"]);
});

test("l'échange est une case : cochée elle arrive « on », absente elle vaut non", () => {
  const open = listingFormSchema.safeParse({ ...VALID, openToTrade: "on", tradeNote: "  du vrac One Piece  " });
  assert.equal(open.success, true);
  assert.equal(open.data.openToTrade, true);
  assert.equal(open.data.tradeNote, "du vrac One Piece");
  const closed = listingFormSchema.safeParse({ ...VALID });
  assert.equal(closed.success, true);
  assert.equal(closed.data.openToTrade, false);
  assert.equal(closed.data.tradeNote, "");
  const tooLong = listingFormSchema.safeParse({ ...VALID, openToTrade: "on", tradeNote: "x".repeat(141) });
  assert.equal(tooLong.success, false);
});
