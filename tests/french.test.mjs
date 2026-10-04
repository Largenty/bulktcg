import assert from "node:assert/strict";
import test from "node:test";
import { atCity, countLabel, fromCity, pluralize } from "../src/lib/french.ts";
import { GAME_IDS } from "../src/types/game.ts";
import { GAME_LABELS, gamePhrases, withGame } from "../src/lib/labels.ts";
import { buildCityPageContent } from "../src/lib/seo.ts";
import { getCityBySlug } from "../src/lib/cities.ts";
import { render, text } from "./markup.mjs";

/* Deux fautes sont passées en production avant ce module : « à moins de
   50 km d'Valence » et « les 1 critères sélectionnés ». Ces tests les
   auraient arrêtées. */

test("« de » s'élide devant une voyelle, pas devant une consonne", () => {
  assert.equal(fromCity("Avignon"), "d'Avignon");
  assert.equal(fromCity("Orange"), "d'Orange");
  assert.equal(fromCity("Valence"), "de Valence");
  assert.equal(fromCity("Carpentras"), "de Carpentras");
});

test("le h muet s'élide, le h aspiré non", () => {
  assert.equal(fromCity("Hyères"), "d'Hyères");
  assert.equal(fromCity("Haguenau"), "de Haguenau");
});

test("l'article d'un nom de ville se contracte avec la préposition", () => {
  assert.equal(atCity("Le Havre"), "au Havre");
  assert.equal(fromCity("Le Havre"), "du Havre");
  assert.equal(atCity("Les Angles"), "aux Angles");
  assert.equal(fromCity("Les Angles"), "des Angles");
  assert.equal(atCity("La Rochelle"), "à La Rochelle");
  assert.equal(fromCity("La Rochelle"), "de La Rochelle");
  assert.equal(atCity("L'Isle-sur-la-Sorgue"), "à L'Isle-sur-la-Sorgue");
  assert.equal(fromCity("L'Isle-sur-la-Sorgue"), "de L'Isle-sur-la-Sorgue");
});

test("un nom qui commence par « Le » sans être un article n'est pas coupé", () => {
  assert.equal(atCity("Lens"), "à Lens");
  assert.equal(fromCity("Lens"), "de Lens");
});

test("zéro et un prennent le singulier, deux et plus le pluriel", () => {
  assert.equal(pluralize(0, "critère"), "critère");
  assert.equal(pluralize(1, "critère"), "critère");
  assert.equal(pluralize(2, "critère"), "critères");
  assert.equal(countLabel(1, "critère"), "1 critère");
  assert.equal(countLabel(3, "annonce"), "3 annonces");
});

test("le pluriel irrégulier se passe explicitement, et les milliers sont espacés", () => {
  assert.equal(countLabel(2, "avis", "avis"), "2 avis");
  assert.equal(countLabel(2, "demande ouverte", "demandes ouvertes"), "2 demandes ouvertes");
  assert.equal(countLabel(2783, "vue").replace(/\s/g, " "), "2 783 vues");
});

test("« Autre » ne s'accole jamais comme un nom de jeu", () => {
  /* « Cartes Autre d'occasion », « Où trouver du Autre », « lot Autre » :
     un nom propre s'accole, « Autre » non. Chaque tournure passe par
     gamePhrases, et la page de ville de chaque jeu est relue. */
  const city = getCityBySlug("avignon");
  for (const gameId of GAME_IDS) {
    const game = { id: gameId, label: GAME_LABELS[gameId], colorToken: `--${gameId}`, sortOrder: 1 };
    for (const nearby of [0, 1, 3]) {
      const content = buildCityPageContent(game, city, [], nearby);
      const text = [content.title, content.description, content.heading, ...content.paragraphs].join(" ");
      assert.doesNotMatch(text, /\b(?:du|le|lots?|[Cc]artes) Autre\b/, `${gameId} : ${text}`);
    }
  }
  assert.equal(gamePhrases("other").cards, "cartes d'autres jeux");
  assert.equal(gamePhrases("pokemon").some, "du Pokémon");
  assert.equal(withGame("autres lots", "other"), "autres lots");
  assert.equal(withGame("autres lots", "magic"), "autres lots Magic");
});

test("les panneaux d'une page de ville n'accolent pas « Autre » non plus", async () => {
  /* « Aucune carte Autre », « Tout le Autre », « Le marché Autre à Orange » :
     la page de ville écrivait ses propres phrases, hors de buildCityPageContent. */
  const { CitySellPanel } = await import("../src/components/market/CitySellPanel.tsx");
  const { CityBuyPanel } = await import("../src/components/market/CityBuyPanel.tsx");
  const { CityMarket } = await import("../src/components/market/CityMarket.tsx");
  const city = getCityBySlug("orange");
  for (const gameId of GAME_IDS) {
    const game = { id: gameId, label: GAME_LABELS[gameId], colorToken: `--${gameId}`, sortOrder: 1 };
    const readable = text([
      CitySellPanel({ game, city, listings: [], nearbyListings: [], distances: new Map() }),
      CityBuyPanel({ game, city, wantedListings: [] }),
      CityMarket({ game, city, details: ["Un paragraphe."], nearbyCities: [getCityBySlug("avignon")] }),
    ].map(render).join(" "));
    assert.doesNotMatch(readable, /\b(?:du|le|de|carte|cartes|lots?|[Cc]artes|marché) Autre\b/, `${gameId} : ${readable.slice(0, 300)}`);
  }
});
