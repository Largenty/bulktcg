import assert from "node:assert/strict";
import test from "node:test";
import { getListings } from "../src/lib/data/listings.ts";
import { toMatchCandidates } from "../src/lib/match-candidate.ts";

/* Le dépôt d'une recherche sérialisait des annonces entières vers le
   navigateur : pour qui un lot était réservé s'y lisait, avec les vues et
   l'identifiant de chaque vendeur (audit du front, M2). */

const ALLOWED = ["cardCount", "city", "gameId", "id", "latitude", "longitude", "lotType", "priceCents", "sellerUsername", "slug", "status", "title"];

test("le croisement côté navigateur ne reçoit que la forme minimale d'une annonce", async () => {
  const listings = await getListings({ includeSold: true, limit: 500 });
  const candidates = toMatchCandidates(listings, "u-01");
  assert.ok(candidates.length > 0);
  for (const candidate of candidates) {
    assert.deepEqual(Object.keys(candidate).sort(), ALLOWED);
  }
});

test("les lots du compte lui-même sont écartés avant de partir", async () => {
  const listings = await getListings({ includeSold: true, limit: 500 });
  const own = new Set(listings.filter((listing) => listing.seller.id === "u-01").map((listing) => listing.id));
  assert.ok(own.size > 0, "le compte de démonstration n'a plus de lot : le cas n'est plus exercé");
  assert.deepEqual(toMatchCandidates(listings, "u-01").filter((candidate) => own.has(candidate.id)), []);
});
