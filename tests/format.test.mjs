import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCardCount,
  formatDistance,
  formatPrice,
  formatRating,
  formatWeight,
  getDropPercent,
} from "../src/lib/format.ts";
import { UNKNOWN_VALUE } from "../src/lib/labels.ts";

const NARROW_SPACE = / | |\s/g;

function normalize(value) {
  return value.replace(NARROW_SPACE, " ");
}

test("un prix rond n'affiche pas de centimes", () => {
  assert.equal(normalize(formatPrice(3500)), "35 €");
});

test("un prix avec centimes les affiche", () => {
  assert.equal(normalize(formatPrice(1250)), "12,50 €");
});

test("une donnée absente affiche un tiret, jamais zéro", () => {
  assert.equal(formatCardCount(null), UNKNOWN_VALUE);
  assert.equal(formatWeight(null), UNKNOWN_VALUE);
  assert.equal(formatDistance(null), UNKNOWN_VALUE);
  /* Le nombre et son unité ne se séparent pas en fin de ligne : « Orange
     (21 » d'un côté, « km) » de l'autre, dans la carte du secteur. */
  for (const distance of [0.4, 4.35, 21]) assert.match(formatDistance(distance), /\u00a0km$/);
  assert.equal(formatRating(null), UNKNOWN_VALUE);
});

test("une valeur nulle mesurée reste zéro, elle n'est pas confondue avec l'absence", () => {
  assert.equal(normalize(formatCardCount(0)), "0 cartes");
  assert.equal(normalize(formatPrice(0)), "0 €");
});

test("le pourcentage de baisse est arrondi à l'entier", () => {
  assert.equal(getDropPercent(4000, 5500), 27);
  assert.equal(getDropPercent(3800, 4500), 16);
});

test("une baisse sur un prix précédent nul ne divise pas par zéro", () => {
  assert.equal(getDropPercent(1000, 0), 0);
});
