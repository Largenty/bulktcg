import assert from "node:assert/strict";
import test from "node:test";
import { GAME_SCOPED_PARAMS, buildListingHref } from "../src/lib/listing-query.ts";
import { resolveListingSearch } from "../src/lib/listing-search.ts";
import { routes } from "../src/lib/routes.ts";

const PER_PAGE = 18;

test("un code postal devient un point d'origine, comme le nom de la commune", () => {
  const byCode = resolveListingSearch({ ville: "84000" }, { perPage: PER_PAGE });
  const byName = resolveListingSearch({ ville: "Avignon" }, { perPage: PER_PAGE });
  assert.equal(byCode.origin?.name, "Avignon");
  assert.deepEqual(byCode.query.origin, byName.query.origin);
  assert.equal(byCode.radiusKm, 50);
});

test("une ville inconnue ne filtre rien, et revient avec des pistes", () => {
  const resolved = resolveListingSearch({ ville: "Avigon" }, { perPage: PER_PAGE });
  assert.equal(resolved.origin, null);
  assert.equal(resolved.query.city, undefined, "la liste ne doit pas être filtrée sur une ville inconnue");
  assert.equal(resolved.cityResolution?.status, "unknown");
  assert.ok(resolved.cityResolution.suggestions.some((city) => city.name === "Avignon"));
});

test("le jeu imposé par la page et une ville inconnue ne comptent pas comme critères choisis", () => {
  const resolved = resolveListingSearch({ jeu: "pokemon", ville: "Nulle-part", type: "bulk" }, { gameId: "pokemon", perPage: PER_PAGE });
  assert.equal(resolved.activeFilterCount, 1);
});

test("une recherche textuelle compte comme un critère", () => {
  assert.equal(resolveListingSearch({ q: "display" }, { perPage: PER_PAGE }).activeFilterCount, 1);
});

test("retirer un filtre repart de la première page et garde les autres critères", () => {
  const href = buildListingHref("/annonces", { jeu: "magic", type: "bulk", page: "3" }, { type: null });
  assert.equal(href, "/annonces?jeu=magic");
});

test("la page d'un jeu est une adresse, et changer de jeu laisse les critères du jeu quitté", () => {
  /* /annonces?jeu=pokemon a été la page Pokémon ; c'est /pokemon, et
     l'ancienne adresse y redirige. */
  assert.equal(routes.game("pokemon"), "/pokemon");
  assert.equal(routes.listingsFor(null), "/annonces");
  assert.equal(routes.listingsFor("other"), "/autres-jeux");
  /* Une série Pokémon sur la page Magic viderait la liste : elle ne suit
     pas. Le prix et l'état, communs à tous les jeux, suivent. */
  const dropped = Object.fromEntries(GAME_SCOPED_PARAMS.map((key) => [key, null]));
  const href = buildListingHref(routes.listingsFor("magic"), { jeu: "pokemon", serie: "pokemon-ev08", produit: "etb", etat: "NM", "prix-max": "40", page: "2" }, dropped);
  assert.equal(href, "/magic?etat=NM&prix-max=40");
});

test("une suggestion de ville remplace la saisie et retire le rayon choisi pour l'ancienne", () => {
  const href = buildListingHref("/annonces", { ville: "Avigon", rayon: "25" }, { ville: "Avignon", rayon: null });
  assert.equal(href, "/annonces?ville=Avignon");
});

test("« echange=1 » filtre sur l'échange et compte comme un critère, rien d'autre ne filtre", () => {
  const open = resolveListingSearch({ echange: "1" }, { perPage: PER_PAGE });
  assert.equal(open.query.openToTrade, true);
  assert.equal(open.activeFilterCount, 1);
  const ignored = resolveListingSearch({ echange: "oui" }, { perPage: PER_PAGE });
  assert.equal(ignored.query.openToTrade, undefined);
  assert.equal(ignored.activeFilterCount, 0);
});
