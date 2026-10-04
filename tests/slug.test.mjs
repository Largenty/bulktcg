import assert from "node:assert/strict";
import test from "node:test";
import { parseDecimal, parsePositiveDecimal } from "../src/lib/decimal.ts";
import { buildSlug, slugify } from "../src/lib/slug.ts";

/* Le lien permanent est la promesse du produit : il se colle dans un groupe
   Facebook et ne bouge plus. slugify le fabrique, et sert aussi à comparer
   les villes et à chercher dans les annonces — une erreur ici casse à la
   fois des liens, des pages de ville et la recherche. */

test("un titre devient un lien lisible : minuscules, sans accent, des tirets", () => {
  assert.equal(slugify("Vrac 400 cartes Pokémon séries EB"), "vrac-400-cartes-pokemon-series-eb");
  assert.equal(slugify("Écarlate & Violet — 151"), "ecarlate-violet-151");
  assert.equal(slugify("L'Isle-sur-la-Sorgue"), "l-isle-sur-la-sorgue");
});

test("les ligatures s'écrivent en toutes lettres au lieu de disparaître", () => {
  /* « Æther Revolt » devenait « ther-revolt », « Cœur » « c-ur » : la
     décomposition NFD ne sépare pas ces lettres, et tout ce qui n'était pas
     a-z tombait. */
  assert.equal(slugify("Æther Revolt"), "aether-revolt");
  assert.equal(slugify("Pokémon Cœur d'Or"), "pokemon-coeur-d-or");
  assert.equal(slugify("Straße"), "strasse");
  /* Et la recherche retrouve « œil » qu'on tape « oeil », ou l'inverse. */
  assert.equal(slugify("à vue d'œil"), slugify("a vue d'oeil"));
});

test("rien de ce qui casse une URL ne passe, ni tiret en bord", () => {
  assert.equal(slugify("a/b?c#d%e&f=g"), "a-b-c-d-e-f-g");
  assert.equal(slugify("  --Classeur !!  "), "classeur");
  assert.match(slugify("../../admin"), /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("un titre sans lettre latine donne un lien qui tient encore debout", () => {
  /* Un titre en japonais ne laisse rien au slug : la commune et le suffixe
     suffisent à faire un lien valide et unique, jamais un tiret en tête. */
  assert.equal(slugify("ポケモン"), "");
  assert.equal(buildSlug("ポケモン", "Avignon", "7f3a"), "avignon-7f3a");
  assert.equal(buildSlug("", "", "7f3a"), "7f3a");
});

test("le lien assemble titre, commune et suffixe, dans cet ordre", () => {
  assert.equal(buildSlug("Display scellé 151", "Orange", "07"), "display-scelle-151-orange-07");
});

test("un nombre se tape à la française, et une saisie illisible ne vaut rien", () => {
  assert.equal(parseDecimal("35,50"), 35.5);
  assert.equal(parseDecimal("1.5"), 1.5);
  /* L'espace des milliers, ordinaire, insécable ou fine : « 1 000 cartes »
     rendait NaN et le dépôt refusait le lot. */
  assert.equal(parseDecimal("1 000"), 1000);
  assert.equal(parseDecimal("1\u00a0000,50"), 1000.5);
  assert.equal(parseDecimal("12\u202f500"), 12500);
  assert.ok(Number.isNaN(parseDecimal("abc")));
  assert.equal(parsePositiveDecimal("42,5"), 42.5);
  /* Vide, zéro, négatif ou illisible : rien, jamais zéro (règle de données). */
  for (const input of ["", "   ", "0", "-3", "abc", "12,5,3"]) {
    assert.equal(parsePositiveDecimal(input), null, `« ${input} » ne décrit aucune quantité`);
  }
});
