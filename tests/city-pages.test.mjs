import assert from "node:assert/strict";
import test from "node:test";
import { citiesNear, distinguishedName, getCityByPair, getCityBySlug, hasHomonym } from "../src/lib/cities.ts";
import { getListings } from "../src/lib/data/listings.ts";
import { GAME_SEGMENT, routes } from "../src/lib/routes.ts";
import { CITY_PAGE_NEARBY_KM, buildCityPageContent, getNearbyCities, getPopulatedCities } from "../src/lib/seo.ts";
import { SITE_URL } from "../src/lib/site.ts";

/* Une page par commune de France, et ce qui y mène : les lots d'une
   commune retrouvés par leur couple (commune, code postal), les liens de
   ville d'une page de jeu, les communes d'à côté, le plan de site. Trois
   communes s'appellent Valence : le nom seul ne désigne plus une page. */

const POKEMON = { id: "pokemon", label: "Pokémon", colorToken: "--pokemon", sortOrder: 1 };
const valence = getCityBySlug("valence");
const valence82 = getCityByPair("Valence", "82400");
const avignon = getCityBySlug("avignon");

test("un homonyme a sa page, son adresse et son département ; un nom unique reste nu", () => {
  assert.equal(valence82.slug, "valence-82");
  assert.ok(hasHomonym(valence) && hasHomonym(valence82));
  assert.equal(distinguishedName(valence), "Valence (Drôme)");
  assert.equal(distinguishedName(valence82), "Valence (Tarn-et-Garonne)");
  assert.ok(!hasHomonym(avignon));
  assert.equal(distinguishedName(avignon), "Avignon");
  const page = buildCityPageContent(POKEMON, valence82, [], 0, { placeName: distinguishedName(valence82) });
  assert.equal(page.heading, "Cartes Pokémon d'occasion à Valence (Tarn-et-Garonne)");
  /* La description porte déjà le code postal, qui suffit à départager. */
  assert.match(page.description, /à Valence \(82400\)\./);
});

test("une commune retirée garde sa page, lisible, mais hors de l'index même avec des lots", async () => {
  const [listing] = await getListings({ communeSlug: "avignon", limit: 1 });
  assert.ok(listing, "aucun lot à Avignon : le test ne prouverait rien");
  const live = buildCityPageContent(POKEMON, avignon, [listing]);
  const retired = buildCityPageContent(POKEMON, avignon, [listing], 0, { isRetired: true });
  assert.equal(live.isIndexable, true);
  assert.equal(retired.isIndexable, false);
  assert.match(retired.paragraphs.join(" "), /a rejoint une commune nouvelle/);
});

test("les lots d'une page de ville sont ceux de son couple (commune, code postal), pas de son nom", async () => {
  const all = await getListings({ includeSold: true, limit: Number.MAX_SAFE_INTEGER });
  const inValence = all.filter((listing) => getCityByPair(listing.city, listing.postalCode)?.slug === "valence");
  assert.ok(inValence.length > 0, "aucun lot à Valence dans la démonstration");
  const listed = await getListings({ communeSlug: "valence", includeSold: true, limit: Number.MAX_SAFE_INTEGER });
  assert.deepEqual(listed.map((listing) => listing.id).toSorted(), inValence.map((listing) => listing.id).toSorted());
  /* Valence (82) n'a aucun lot : ceux de la Drôme n'y montent pas. */
  assert.deepEqual(await getListings({ communeSlug: "valence-82", includeSold: true }), []);
});

test("les liens de ville d'une page de jeu mènent à la bonne Valence, la commune la plus fournie d'abord", () => {
  const cities = getPopulatedCities([
    { city: "Valence", postalCode: "82400" },
    { city: "Valence", postalCode: "26000" },
    { city: "Avignon", postalCode: "84000" },
    { city: "Valence", postalCode: "26000" },
    { city: "Atlantide", postalCode: "99999" },
  ]);
  assert.deepEqual(
    cities.map(({ city, label, count }) => [city.slug, label, count]),
    [
      ["valence", "Valence (Drôme)", 2],
      ["avignon", "Avignon", 1],
      ["valence-82", "Valence (Tarn-et-Garonne)", 1],
    ],
  );
});

test("les communes d'à côté : celles qui ont des lots, puis les plus peuplées, jamais plus de six", () => {
  const plain = getNearbyCities(avignon);
  assert.equal(plain.length, 6);
  assert.ok(plain.every((city) => city.communeCode !== avignon.communeCode));
  const around = citiesNear(avignon, CITY_PAGE_NEARBY_KM).filter(({ city }) => city.communeCode !== avignon.communeCode);
  const expected = around
    .toSorted((left, right) => right.city.population - left.city.population || left.distanceKm - right.distanceKm)
    .slice(0, 6)
    .map(({ city }) => city.slug);
  assert.deepEqual(plain.map((city) => city.slug), expected, "les plus peuplées du rayon ne sont pas retenues");
  assert.deepEqual(getNearbyCities(avignon).map((city) => city.slug), plain.map((city) => city.slug), "deux rendus, deux listes");

  /* Un village qui a des lots passe devant. */
  const village = around.toSorted((left, right) => left.city.population - right.city.population)[0].city;
  assert.ok(!plain.some((city) => city.slug === village.slug));
  const withLots = getNearbyCities(avignon, new Set([village.slug]));
  assert.equal(withLots[0].slug, village.slug);
  assert.equal(withLots.length, 6);
});

test("toute commune a sa page, et une adresse inconnue répond 404", async () => {
  const { default: GameCityPage, generateMetadata } = await import("../src/app/[game]/[city]/page.tsx");
  const params = (city) => ({ params: Promise.resolve({ game: "pokemon", city }) });

  /* Un village de 115 habitants et un homonyme : servis, hors de l'index
     tant qu'ils n'ont aucun lot. */
  for (const slug of ["ambleon", "valence-82"]) {
    const metadata = await generateMetadata(params(slug));
    assert.equal(metadata.alternates.canonical, routes.gameCity("pokemon", slug));
    assert.equal(metadata.robots.index, false, `${slug} : indexée sans lot`);
  }
  assert.match((await generateMetadata(params("valence-82"))).title, /à Valence \(Tarn-et-Garonne\)/);
  /* Les lots de Valence (Drôme) ne rendent pas indexable la page de Valence
     (Tarn-et-Garonne), dans le jeu même où ils sont. */
  const [inValence] = await getListings({ communeSlug: "valence", limit: 1 });
  assert.ok(inValence, "aucun lot à Valence : le test ne prouverait rien");
  const atValence = (city) => generateMetadata({ params: Promise.resolve({ game: GAME_SEGMENT[inValence.gameId], city }) });
  assert.notEqual((await atValence("valence")).robots.index, false, "Valence (Drôme) a des lots : elle s'indexe");
  assert.equal((await atValence("valence-82")).robots.index, false, "les lots de la Drôme ont rendu indexable Valence (82)");
  /* L'image de partage compte comme la page : « aucun lot » à Valence (82),
     et son titre nomme son département. */
  const { generateImageMetadata } = await import("../src/app/[game]/[city]/opengraph-image.tsx");
  const shareOf = async (city) => (await generateImageMetadata({ params: { game: GAME_SEGMENT[inValence.gameId], city } }))[0].alt;
  assert.match(await shareOf("valence-82"), /Valence \(Tarn-et-Garonne\) — Aucun lot à Valence/);
  assert.doesNotMatch(await shareOf("valence"), /Aucun lot/);
  assert.deepEqual(await generateImageMetadata({ params: { game: "pokemon", city: "atlantide" } }), []);
  assert.notEqual((await generateMetadata(params("avignon"))).robots.index, false, "Avignon a des lots : elle s'indexe");

  assert.equal((await generateMetadata(params("atlantide"))).title, "Page introuvable");
  await assert.rejects(GameCityPage(params("atlantide")), (error) => /404|NOT_FOUND/.test(String(error.digest ?? error.message)));
});

test("le plan de site déclare exactement les pages de ville qui ont des lots, retrouvées par leur couple", async () => {
  const { default: sitemap } = await import("../src/app/sitemap.ts");
  const entries = await sitemap();
  const cityPages = entries
    .map((entry) => entry.url.slice(SITE_URL.length))
    .filter((path) => /^\/[a-z-]+\/[a-z0-9-]+$/.test(path) && !path.startsWith("/annonces/") && !path.startsWith("/profil/") && !path.startsWith("/recherches/"));
  const online = await getListings({ limit: Number.MAX_SAFE_INTEGER });
  const expected = new Set(
    online.flatMap((listing) => {
      const city = getCityByPair(listing.city, listing.postalCode);
      return city ? [routes.gameCity(listing.gameId, city.slug)] : [];
    }),
  );
  assert.ok(expected.size > 0);
  assert.deepEqual(new Set(cityPages), expected);
});
