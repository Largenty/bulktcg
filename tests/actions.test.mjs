import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { submitListing } from "../src/app/actions/listings.ts";
import { placementPaths } from "../src/app/actions/revalidate.ts";
import { submitWanted } from "../src/app/actions/wanted.ts";
import { CITIES } from "../src/lib/cities.ts";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* Les actions serveur, telles qu'une requête POST les atteint — pas
   seulement depuis l'interface. Le compte de démonstration est u-01. */

function formDataOf(values) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) {
    for (const item of [value].flat()) data.append(name, item);
  }
  return data;
}

const LISTING = {
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
  photos: ["local:abc"],
  audience: "everyone",
  privateSeller: "on",
};

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

/* Deux champs cachés échappaient au schéma des identifiants : ils étaient
   seulement « une chaîne ». Un fichier glissé à leur place faisait même
   basculer la modification en création d'une nouvelle annonce. */
const FORGED_IDS = ["../l-01", "l-01/../w-01", "x".repeat(65), "l 01", new File(["l-01"], "l-01")];

test("un identifiant d'annonce hors forme, dans le champ caché, ne mène à rien", async () => {
  for (const listingId of FORGED_IDS) {
    const result = await submitListing(formDataOf({ ...LISTING, listingId }));
    assert.equal(result.status, "not-found", `« ${listingId} » est passé`);
  }
  /* Témoins : sans identifiant, un dépôt ; avec le sien, une modification. */
  assert.equal((await submitListing(formDataOf(LISTING))).status, "not-persisted");
  assert.equal((await submitListing(formDataOf({ ...LISTING, listingId: "l-21" }))).status, "not-persisted");
});

test("un identifiant de demande hors forme, dans le champ caché, ne mène à rien", async () => {
  for (const wantedId of FORGED_IDS) {
    const result = await submitWanted(formDataOf({ ...WANTED, wantedId }));
    assert.equal(result.status, "not-found", `« ${wantedId} » est passé`);
  }
  assert.equal((await submitWanted(formDataOf(WANTED))).status, "not-persisted");
});

test("une écriture rafraîchit la page du jeu et celle de la commune, à leur vraie adresse", () => {
  /* La page d'un jeu a quitté /annonces?jeu=… pour /pokemon : la
     revalidation suit l'adresse décidée par routes.game, et la page
     de commune son slug réel — apostrophe et traits d'union compris. */
  const isle = CITIES.find((city) => city.name.includes("'"));
  assert.ok(isle, "aucune commune à apostrophe dans le référentiel");
  assert.deepEqual(placementPaths([{ gameId: "pokemon", city: isle.name, postalCode: isle.postalCode }]), ["/pokemon", `/pokemon/${isle.slug}`]);
});

test("une écriture rafraîchit la page de sa commune, pas celle d'un homonyme", () => {
  /* Trois communes s'appellent Valence : la page nue est celle de la Drôme.
     Tirée du nom, l'adresse rafraîchissait la page d'une autre commune — ou
     une 404, pour « Apremont », dont aucune homonyme n'a la page nue. */
  assert.deepEqual(placementPaths([{ gameId: "magic", city: "Valence", postalCode: "82400" }]), ["/magic", "/magic/valence-82"]);
  assert.deepEqual(placementPaths([{ gameId: "magic", city: "Valence", postalCode: "26000" }]), ["/magic", "/magic/valence"]);
  assert.deepEqual(placementPaths([{ gameId: "pokemon", city: "Apremont", postalCode: "01100" }]), ["/pokemon", "/pokemon/apremont-01"]);
  /* Un couple que le référentiel ne connaît pas n'a pas de page à rafraîchir. */
  assert.deepEqual(placementPaths([{ gameId: "pokemon", city: "Nulle-Part", postalCode: "00000" }]), ["/pokemon"]);
});

test("aucune action ne rend périmé tout le site, ni toutes les pages d'un motif", () => {
  /* Audit de sécurité, M5 : « Tout marquer comme lu » invalidait les quelque
     mille pages du site, une inscription sur liste d'attente toutes les
     fiches, un avis tous les profils — à la portée de n'importe quel
     compte, en boucle. Des chemins concrets, ou refresh() pour ce qui ne
     regarde que la personne. */
  const actions = path.join(SOURCE_ROOT, "app", "actions");
  for (const file of collectFiles(actions, /\.ts$/)) {
    const source = readFileSync(file, "utf8");
    const name = path.basename(file);
    assert.doesNotMatch(source, /revalidatePath\(\s*"\/"\s*,\s*"layout"\s*\)/, `${name} invalide tout le site`);
    assert.doesNotMatch(source, /revalidatePath\(\s*["`][^"`]*\[[^\]]+\]/, `${name} invalide un motif de route entier`);
  }
});
