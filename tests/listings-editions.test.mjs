import assert from "node:assert/strict";
import test from "node:test";
import {
  countListings,
  countListingsWithoutEditions,
  getEditionFacets,
  getListings,
} from "../src/lib/data/listings.ts";
import { getEditionById } from "../src/lib/editions.ts";

/* Séries et produits : le filtre strict, ce qu'il écarte faute de
   déclaration, les facettes, et la recherche textuelle qui les indexe. */

test("le filtre par série ne garde que les lots qui la déclarent", async () => {
  const listings = await getListings({ editionId: "pokemon-ev03", limit: 100 });
  assert.ok(listings.length > 0, "aucun lot ne déclare EV03");
  for (const listing of listings) {
    assert.ok(
      listing.editions.some((edition) => edition.id === "pokemon-ev03"),
      `${listing.title} remonte sans déclarer la série`,
    );
  }
});

test("une série qui n'existe que sur un lot vendu ne remonte pas dans la liste publique", async () => {
  /* Le display 151 est parti : sa série ne doit ni ramener de résultat ni
     figurer dans les facettes, sinon le filtre proposerait une impasse. */
  assert.equal((await getListings({ editionId: "pokemon-ev03-5", limit: 100 })).length, 0);
  assert.equal(
    (await getEditionFacets({ gameId: "pokemon" })).some(
      (facet) => facet.edition.id === "pokemon-ev03-5",
    ),
    false,
  );
  assert.equal((await getListings({ editionId: "pokemon-ev03-5", includeSold: true, limit: 100 })).length, 1);
});

test("un lot sans série déclarée est écarté du filtre, et la liste dit combien", async () => {
  /* Filtre strict : on ne peut pas affirmer qu'un carton non trié contient
     EV03.5. Mais on ne l'enterre pas en silence — c'est le chiffre affiché
     à côté du filtre qui rachète la rigueur. */
  const filtered = await getListings({ editionId: "magic-mh3", limit: 100 });
  assert.ok(filtered.length > 0);
  assert.equal(
    filtered.some((listing) => listing.editions.length === 0),
    false,
  );

  /* Quatre lots Magic ne déclarent aucune série — dont deux cartons non
     triés qui contiennent sûrement du Modern Horizons. Le filtre les écarte
     mais la colonne annonce leur nombre. */
  const hidden = await countListingsWithoutEditions({ gameId: "magic" });
  assert.ok(hidden > 0, "aucun lot Magic sans série : le chiffre ne prouverait rien");

  const total = await countListings({ gameId: "magic" });
  const declared = await getListings({ gameId: "magic", limit: 100 });
  assert.equal(
    hidden,
    declared.filter((listing) => listing.editions.length === 0).length,
    "le compteur d'exclusion ne correspond pas aux annonces réelles",
  );
  assert.ok(hidden < total);
});

test("le filtre par produit croise plusieurs produits sur une même annonce", async () => {
  const withPlaymat = await getListings({ tag: "playmat", limit: 100 });
  assert.ok(withPlaymat.length > 0);
  for (const listing of withPlaymat) assert.ok(listing.tags.includes("playmat"));

  /* Le lot One Piece porte boosters ET tapis : les deux filtres doivent le
     retrouver, c'est tout l'intérêt d'une liste plutôt que d'un champ. */
  const both = withPlaymat.filter((listing) => listing.tags.includes("booster-pack"));
  assert.ok(both.length > 0, "aucune annonce ne porte deux produits à la fois");
});

test("les facettes ne proposent que des séries qui ramènent quelque chose", async () => {
  const facets = await getEditionFacets({ gameId: "magic" });
  assert.ok(facets.length > 0);
  for (const { edition, count } of facets) {
    assert.equal(edition.gameId, "magic", `${edition.code} n'est pas une série Magic`);
    assert.ok(count > 0, `${edition.code} est proposée avec zéro résultat`);
    const listings = await getListings({ editionId: edition.id, limit: 100 });
    assert.equal(listings.length, count, `compteur faux pour ${edition.code}`);
  }
});

test("les facettes d'un jeu ignorent le filtre de série en cours", async () => {
  /* Sinon, choisir une série ferait disparaître toutes les autres du menu et
     on ne pourrait plus en changer sans tout effacer. */
  const all = await getEditionFacets({ gameId: "onepiece" });
  const narrowed = await getEditionFacets({ gameId: "onepiece", editionId: "onepiece-op-09" });
  assert.deepEqual(
    narrowed.map((facet) => facet.edition.id),
    all.map((facet) => facet.edition.id),
  );
});

test("la recherche textuelle trouve un lot par son code de série ou son produit", async () => {
  /* « EV08 » n'apparaît dans aucun titre : sans les séries dans l'index, la
     recherche ne ramènerait rien alors que le lot existe. */
  /* « Flammes Obsidiennes » n'apparaît dans aucun titre ni aucune
     description du jeu de données : si la recherche le trouve, c'est bien
     que les séries sont indexées. */
  const byName = await getListings({ search: "Flammes Obsidiennes", limit: 100 });
  assert.ok(byName.length > 0, "le nom de série ne trouve rien");
  assert.ok(byName.every((listing) => listing.editions.some((e) => e.code === "EV03")));

  const byProduct = await getListings({ search: "tapis de jeu", limit: 100 });
  assert.ok(byProduct.length > 0, "le nom du produit ne trouve rien");
});

test("deux jeux peuvent porter le même code court sans se confondre", async () => {
  /* « NEO » désigne le bloc Neo chez Pokémon et la Dynastie Néon chez
     Magic : c'est précisément pour ça que l'identifiant porte le jeu. */
  const pokemon = getEditionById("pokemon-neo");
  const magic = getEditionById("magic-neo");
  assert.equal(pokemon.code, magic.code);
  assert.notEqual(pokemon.name, magic.name);
  assert.equal(pokemon.gameId, "pokemon");
  assert.equal(magic.gameId, "magic");
});
