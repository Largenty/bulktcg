import assert from "node:assert/strict";
import test from "node:test";
import { matchListingAgainstWanted, sortMatches } from "../src/lib/matching.ts";
import {
  countWantedListings,
  getListingsMatchingWanted,
  getWantedListings,
  getWantedMatches,
} from "../src/lib/data/wanted.ts";
import { getListingBySlug } from "../src/lib/data/listings.ts";

/* Avignon comme point de départ, un lot Pokémon en vrac à 35 €. */
const WANTED = {
  id: "w-test",
  slug: "test",
  reference: "RC-TEST",
  buyer: { id: "u-x", username: "acheteur", city: "Avignon", postalCode: "84000", avatarInitials: "AC", ratingAvg: null, ratingCount: 0 },
  gameId: "pokemon",
  title: "Cherche du vrac",
  description: "…",
  lotType: "bulk",
  maxPriceCents: 6000,
  minCardCount: 300,
  city: "Avignon",
  postalCode: "84000",
  departmentCode: "84",
  latitude: 43.9493,
  longitude: 4.8055,
  maxDistanceKm: 30,
  status: "open",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
  fulfilledAt: null,
};

const LISTING = {
  gameId: "pokemon",
  lotType: "bulk",
  cardCount: 400,
  priceCents: 3500,
  latitude: 43.9493,
  longitude: 4.8055,
  status: "available",
};

test("un lot conforme sur tous les critères est une correspondance certaine", () => {
  const match = matchListingAgainstWanted(LISTING, WANTED);
  assert.ok(match);
  assert.equal(match.certainty, "certain");
  assert.equal(match.unverified, null);
  assert.ok(match.distanceKm < 1);
});

test("un autre jeu ne correspond jamais", () => {
  assert.equal(matchListingAgainstWanted({ ...LISTING, gameId: "magic" }, WANTED), null);
});

test("« Autre » ne croise jamais qu'« à vérifier » : le jeu exact n'y est pas dit", () => {
  /* Un lot Digimon et une demande Star Wars Unlimited portent tous deux
     « Autre ». Le croisement ne peut ni l'affirmer ni l'exclure. */
  const match = matchListingAgainstWanted({ ...LISTING, gameId: "other" }, { ...WANTED, gameId: "other", minCardCount: null });
  assert.ok(match, "un lot « Autre » conforme n'est plus proposé");
  assert.equal(match.certainty, "probable");
  assert.match(match.unverified, /Autre/);
  /* Les deux raisons s'additionnent, aucune ne masque l'autre. */
  const both = matchListingAgainstWanted({ ...LISTING, gameId: "other", cardCount: null }, { ...WANTED, gameId: "other" });
  assert.match(both.unverified, /Autre.*;.*pas compté/);
});

test("le format demandé n'est pas élargi", () => {
  /* Une correspondance approximative répétée détruit la confiance dans la
     notification, et le vendeur cesse de la lire. */
  assert.equal(matchListingAgainstWanted({ ...LISTING, lotType: "binder" }, WANTED), null);
  assert.equal(matchListingAgainstWanted({ ...LISTING, lotType: "mixed" }, WANTED), null);
});

test("un lot au-dessus du budget est écarté, un lot pile au budget est gardé", () => {
  assert.equal(matchListingAgainstWanted({ ...LISTING, priceCents: 6001 }, WANTED), null);
  assert.ok(matchListingAgainstWanted({ ...LISTING, priceCents: 6000 }, WANTED));
});

test("un lot hors du rayon accepté est écarté", () => {
  /* Marseille est à environ 90 km d'Avignon, le rayon demandé est de 30. */
  const marseille = { ...LISTING, latitude: 43.2965, longitude: 5.3698 };
  assert.equal(matchListingAgainstWanted(marseille, WANTED), null);
});

test("un lot vendu ne correspond à rien", () => {
  assert.equal(matchListingAgainstWanted({ ...LISTING, status: "sold" }, WANTED), null);
});

test("une demande close ou trouvée ne reçoit plus de correspondance", () => {
  assert.equal(matchListingAgainstWanted(LISTING, { ...WANTED, status: "closed" }), null);
  assert.equal(matchListingAgainstWanted(LISTING, { ...WANTED, status: "fulfilled" }), null);
});

test("un volume trop faible est écarté, un volume non compté devient une correspondance à vérifier", () => {
  assert.equal(matchListingAgainstWanted({ ...LISTING, cardCount: 120 }, WANTED), null);

  /* « Non compté » n'est pas « insuffisant » : un carton de six kilos dépasse
     évidemment 300 cartes. On le signale au lieu de trancher à la place de
     l'humain. */
  const unknown = matchListingAgainstWanted({ ...LISTING, cardCount: null }, WANTED);
  assert.ok(unknown);
  assert.equal(unknown.certainty, "probable");
  assert.match(unknown.unverified, /300 cartes minimum/);
});

test("sans exigence de volume, un lot non compté reste une correspondance certaine", () => {
  const match = matchListingAgainstWanted(
    { ...LISTING, cardCount: null },
    { ...WANTED, minCardCount: null },
  );
  assert.equal(match.certainty, "certain");
});

test("les correspondances certaines passent devant, puis les plus proches", () => {
  const build = (certainty, distanceKm) => ({ wanted: WANTED, certainty, distanceKm, unverified: null });
  const sorted = sortMatches([
    build("probable", 2),
    build("certain", 25),
    build("certain", 4),
    build("probable", 1),
  ]);
  assert.deepEqual(
    sorted.map((match) => `${match.certainty}-${match.distanceKm}`),
    ["certain-4", "certain-25", "probable-1", "probable-2"],
  );
});

test("la liste publique des demandes n'expose que celles qui sont ouvertes", async () => {
  const open = await getWantedListings({ limit: 100 });
  assert.ok(open.length > 0);
  assert.equal(
    open.every((wanted) => wanted.status === "open"),
    true,
  );
  const all = await countWantedListings({ includeClosed: true });
  assert.ok(all > open.length, "aucune demande close dans le jeu de démonstration");
});

test("le croisement d'une annonce réelle remonte des demandes cohérentes", async () => {
  const listing = await getListingBySlug(
    "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01",
  );
  const matches = await getWantedMatches(listing, 20);
  assert.ok(matches.length > 0, "cette annonce devrait croiser au moins une recherche");

  for (const match of matches) {
    assert.equal(match.wanted.gameId, listing.gameId);
    assert.equal(match.wanted.status, "open");
    assert.ok(match.distanceKm <= match.wanted.maxDistanceKm);
    if (match.wanted.maxPriceCents !== null) {
      assert.ok(listing.priceCents <= match.wanted.maxPriceCents);
    }
  }
});

test("le croisement inverse ne propose que des lots réellement compatibles", async () => {
  const [wanted] = await getWantedListings({ limit: 1 });
  const listings = await getListingsMatchingWanted(wanted, 20);
  for (const listing of listings) {
    assert.equal(listing.gameId, wanted.gameId);
    assert.notEqual(listing.status, "sold");
    assert.ok(matchListingAgainstWanted(listing, wanted) !== null);
  }
});

test("une demande sans correspondance renvoie une liste vide, pas une erreur", async () => {
  const impossible = { ...WANTED, maxPriceCents: 1, maxDistanceKm: 5 };
  assert.deepEqual(await getListingsMatchingWanted(impossible, 10), []);
});

test("un lot qui ne répond pas dit pourquoi, en chiffres", async () => {
  const { explainMismatch } = await import("../src/lib/matching.ts");
  const wanted = {
    gameId: "magic",
    lotType: null,
    maxPriceCents: 8000,
    minCardCount: 300,
    latitude: 44.9334,
    longitude: 4.8924,
    maxDistanceKm: 40,
  };
  const base = { gameId: "magic", lotType: "bulk", cardCount: 900, priceCents: 2200, latitude: 44.9334, longitude: 4.8924 };
  assert.equal(explainMismatch(base, wanted), null);
  assert.match(explainMismatch({ ...base, priceCents: 9000 }, wanted), /au-dessus du budget de 80\s€/);
  assert.match(explainMismatch({ ...base, latitude: 43.9493, longitude: 4.8055 }, wanted), /^à \d+ km, au-delà des 40 km acceptés$/);
  assert.match(explainMismatch({ ...base, cardCount: 120 }, wanted), /120 cartes, sous le minimum de 300/);
  assert.match(explainMismatch({ ...base, gameId: "pokemon" }, wanted), /autre jeu/);
});
