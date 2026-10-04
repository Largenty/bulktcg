import assert from "node:assert/strict";
import test from "node:test";
import {
  countListingsMatchingWanted,
  countWantedListings,
  countWantedWithoutBudget,
  getListingsMatchingWanted,
  getWantedCountByGame,
  getWantedListings,
  getWantedListingsByBuyer,
  getWantedMatches,
} from "../src/lib/data/wanted.ts";
import { getListings } from "../src/lib/data/listings.ts";
import { isWantedReachableFrom } from "../src/lib/matching.ts";
import { getCityBySlug } from "../src/lib/cities.ts";

const AVIGNON = getCityBySlug("avignon");
const origin = { latitude: AVIGNON.latitude, longitude: AVIGNON.longitude };

test("« atteignable » n'est pas « proche » : c'est le rayon de l'acheteur qui décide", () => {
  /* Un voisin qui ne bouge pas de 10 km n'est pas atteignable ; un acheteur
     à 60 km prêt à en faire 100 l'est. Confondre les deux ferait proposer un
     vendeur à quelqu'un qui ne viendra jamais. */
  const voisinImmobile = { latitude: AVIGNON.latitude + 0.15, longitude: AVIGNON.longitude, maxDistanceKm: 10 };
  const lointainMobile = { latitude: AVIGNON.latitude + 0.55, longitude: AVIGNON.longitude, maxDistanceKm: 100 };

  assert.equal(isWantedReachableFrom(voisinImmobile, origin), false);
  assert.equal(isWantedReachableFrom(lointainMobile, origin), true);
});

test("le filtre par ville ne garde que les demandes dont le rayon couvre la ville", async () => {
  const all = await getWantedListings({ limit: 100 });
  const reachable = await getWantedListings({ origin, reachableOnly: true, limit: 100 });

  assert.ok(reachable.length > 0, "aucune demande n'atteint Avignon");
  assert.ok(reachable.length < all.length, "le filtre ne retire rien");
  for (const wanted of reachable) {
    assert.equal(
      isWantedReachableFrom(wanted, origin),
      true,
      `${wanted.title} est retenue alors que son rayon ne couvre pas Avignon`,
    );
  }
});

test("le compteur par jeu porte sur les mêmes lignes que la liste affichée", async () => {
  const query = { origin, reachableOnly: true };
  const countByGame = await getWantedCountByGame(query);
  const total = await countWantedListings(query);

  assert.equal(
    Object.values(countByGame).reduce((sum, count) => sum + count, 0),
    total,
    "la barre de filtres annonce un total différent de celui de la liste",
  );

  const pokemon = await countWantedListings({ ...query, gameId: "pokemon" });
  assert.equal(countByGame.pokemon, pokemon);
});

test("le tableau de bord de l'acheteur garde ses demandes closes, la liste publique non", async () => {
  /* Une demande fermée reste dans son compte : la rouvrir doit coûter un
     clic, et son lien continue de répondre pour ceux qui l'avaient gardé. */
  const mine = await getWantedListingsByBuyer("u-03");
  const publicList = await getWantedListings({ limit: 100 });

  assert.ok(
    mine.some((wanted) => wanted.status !== "open"),
    "aucune demande close dans le tableau de bord de test",
  );
  assert.equal(
    publicList.some((wanted) => wanted.status !== "open"),
    false,
    "une demande close apparaît dans la liste publique",
  );
});

test("le croisement inverse accepte un brouillon sans statut ni identité", async () => {
  /* La forme minimale suffit : c'est ce qui permet de montrer à un acheteur
     ce qui existe déjà avant même qu'il ait déposé sa demande. */
  const draft = {
    gameId: "pokemon",
    lotType: "bulk",
    maxPriceCents: 8000,
    minCardCount: null,
    latitude: AVIGNON.latitude,
    longitude: AVIGNON.longitude,
    maxDistanceKm: 50,
  };
  assert.ok(await countListingsMatchingWanted(draft) > 0);

  const impossible = { ...draft, maxPriceCents: 1 };
  assert.equal(await countListingsMatchingWanted(impossible), 0);
});

test("une demande fermée ne reçoit plus de croisement, même dans son propre compte", async () => {
  const mine = await getWantedListingsByBuyer("u-03");
  const closed = mine.find((wanted) => wanted.status !== "open");
  assert.ok(closed, "pas de demande close dans le jeu de test");
  assert.equal(await countListingsMatchingWanted(closed), 0);
});

test("le croisement n'associe jamais un compte à lui-même", async () => {
  /* Il le faisait douze fois dans chaque sens : la demande d'une vendeuse
     affichait son propre classeur dans « Ce qui correspond », et un tableau
     de bord comptait sa propre recherche parmi « 2 recherches
     correspondent ». */
  const selfMatches = [];
  for (const listing of await getListings({ includeSold: true, limit: 1000 })) {
    for (const match of await getWantedMatches(listing, 1000)) {
      if (match.wanted.buyer.id === listing.seller.id) selfMatches.push(`${listing.id} ↔ ${match.wanted.id}`);
    }
  }
  for (const wanted of await getWantedListings({ includeClosed: true, limit: 1000 })) {
    for (const listing of await getListingsMatchingWanted(wanted, 1000)) {
      if (listing.seller.id === wanted.buyer.id) selfMatches.push(`${wanted.id} ↔ ${listing.id}`);
    }
  }
  assert.deepEqual(selfMatches, []);
});

/* --- Le panneau « Affiner » des recherches --- */

test("filtrer un format garde aussi les demandes « tout format »", async () => {
  /* Un vendeur de classeur doit voir l'acheteur qui en cherche un, et celui
     que le format indiffère : « peu importe » accepte un classeur. */
  const all = await getWantedListings({ limit: 100 });
  const kept = await getWantedListings({ acceptsLotType: "binder", limit: 100 });
  assert.ok(kept.length > 0 && kept.length < all.length);
  assert.ok(kept.every((wanted) => wanted.lotType === null || wanted.lotType === "binder"));
  assert.ok(kept.some((wanted) => wanted.lotType === null), "aucune demande « tout format » dans le jeu de test");
  assert.equal(
    kept.length,
    all.filter((wanted) => wanted.lotType === null || wanted.lotType === "binder").length,
  );
});

test("le budget minimum écarte les demandes sans budget, et le dit", async () => {
  const kept = await getWantedListings({ minBudgetCents: 5000, limit: 100 });
  assert.ok(kept.length > 0);
  assert.ok(kept.every((wanted) => wanted.maxPriceCents !== null && wanted.maxPriceCents >= 5000));
  /* Sans budget n'est pas budget nul : le filtre les écarte, et le compte
     de ce qu'il écarte ne dépend pas du palier choisi. */
  const all = await getWantedListings({ limit: 100 });
  const withoutBudget = all.filter((wanted) => wanted.maxPriceCents === null).length;
  assert.ok(withoutBudget > 0, "aucune demande sans budget dans le jeu de test");
  assert.equal(await countWantedWithoutBudget({ minBudgetCents: 5000 }), withoutBudget);
});

test("le filtre d'acheteur sépare les comptes professionnels des particuliers, forfait échu compris", async () => {
  /* Le statut décide, comme le badge PRO de la vignette — pas le forfait.
     Trié d'après le forfait, le Dé d'Orange (u-15, forfait échu) passait
     pour un particulier, badge PRO sur sa vignette. */
  const pros = await getWantedListings({ buyerKind: "pro", limit: 100 });
  const people = await getWantedListings({ buyerKind: "private", limit: 100 });
  assert.ok(pros.length > 0 && people.length > 0);
  assert.ok(pros.every((wanted) => wanted.buyer.isPro));
  assert.ok(people.every((wanted) => !wanted.buyer.isPro));
  assert.ok(
    pros.some((wanted) => !wanted.buyer.hasProPlan),
    "aucune demande d'une boutique au forfait échu dans la démonstration : le cas n'est pas exercé",
  );
  assert.equal(pros.length + people.length, await countWantedListings({}));
});

test("le tri par budget met les plus hauts d'abord, et les demandes sans budget à la fin", async () => {
  const sorted = await getWantedListings({ sort: "budget-desc", limit: 100 });
  const budgets = sorted.map((wanted) => wanted.maxPriceCents ?? -1);
  assert.deepEqual(budgets.toSorted((a, b) => b - a), budgets);
});

test("les paramètres des demandes ne croisent pas ceux des ventes", async () => {
  /* Sur /annonces, les deux onglets vivent dans la même URL : un format
     choisi côté ventes ne doit pas filtrer les demandes, ni l'inverse. */
  const { resolveWantedSearch } = await import("../src/lib/wanted-search.ts");
  const { parseListingSearchParams } = await import("../src/lib/listing-query.ts");
  const fromSellSide = resolveWantedSearch({ type: "binder", page: "2", tri: "price-asc" });
  assert.equal(fromSellSide.query.acceptsLotType, undefined);
  assert.equal(fromSellSide.page, 1);
  assert.equal(fromSellSide.sort, "recent");
  const fromBuySide = parseListingSearchParams({ "format-demande": "binder", "budget-min": "50" });
  assert.equal(fromBuySide.lotType, undefined);
  assert.equal(fromBuySide.minPriceCents, undefined);
  /* Une valeur illisible est ignorée, jamais transformée en filtre. */
  const garbage = resolveWantedSearch({ "budget-min": "47", acheteur: "admin", "tri-demandes": "distance" });
  assert.equal(garbage.query.minBudgetCents, undefined);
  assert.equal(garbage.query.buyerKind, undefined);
  assert.equal(garbage.sort, "recent", "« les plus proches » sans ville a rendu un ordre arbitraire");
});
