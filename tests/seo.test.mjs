import assert from "node:assert/strict";
import test from "node:test";
import { getCityBySlug } from "../src/lib/cities.ts";
import { buildCityPageContent } from "../src/lib/seo.ts";

const POKEMON = { id: "pokemon", label: "Pokémon", colorToken: "--pokemon", sortOrder: 1 };

test("le titre d'une page de ville suit la grammaire du nom de la ville", () => {
  const havre = buildCityPageContent(POKEMON, getCityBySlug("le-havre"), []);
  assert.equal(havre.heading, "Cartes Pokémon d'occasion au Havre");
  const isle = buildCityPageContent(POKEMON, getCityBySlug("l-isle-sur-la-sorgue"), []);
  assert.equal(isle.heading, "Cartes Pokémon d'occasion à L'Isle-sur-la-Sorgue");
});

test("aucune phrase n'accole un article masculin à un département qui n'en veut pas", () => {
  /* « Valence est dans le Drôme » : chaque département a son article, le
     texte n'en écrit plus aucun. */
  const valence = buildCityPageContent(POKEMON, getCityBySlug("valence"), []);
  assert.doesNotMatch(valence.paragraphs.join(" "), /dans le Drôme/);
  assert.match(valence.paragraphs.join(" "), /Drôme, 26/);
});

test("une page sans lot dans la commune reste en noindex, même avec des voisins", () => {
  const page = buildCityPageContent(POKEMON, getCityBySlug("carpentras"), [], 3);
  assert.equal(page.isIndexable, false);
  assert.match(page.paragraphs.join(" "), /À moins de 30 km, 3 autres lots Pokémon attendent preneur\./);
});

test("une page vide nomme sa commune par son code postal, pas par son département", () => {
  /* « à Paris (Paris) » : le département était pris pour une précision de
     lieu. La page peuplée écrivait déjà le code postal ; la vide aussi. */
  const paris = buildCityPageContent(POKEMON, getCityBySlug("paris"), []);
  assert.match(paris.description, /à Paris \(75001\)\./);
  assert.doesNotMatch(paris.description, /\(Paris\)/);
  const valence = buildCityPageContent(POKEMON, getCityBySlug("valence"), []);
  assert.match(valence.description, /\(26000\)/);
});

test("un seul lot voisin s'accorde au singulier", () => {
  const page = buildCityPageContent(POKEMON, getCityBySlug("carpentras"), [], 1);
  assert.match(page.paragraphs.join(" "), /1 autre lot Pokémon attend preneur\./);
});

/* --- Audit SEO de septembre 2026 : adresse publique, aperçus, index --- */

const { resolveSiteUrl, SITE_URL } = await import("../src/lib/site.ts");
const {
  INDEXABLE,
  isListingIndexable,
  listingLastModified,
  isProfileIndexable,
  listingListMetadata,
  listingRobots,
  listingShareDescription,
  listingShareTitle,
  truncateAtWord,
} = await import("../src/lib/metadata.ts");
const { getListingBySlug, getListings } = await import("../src/lib/data/listings.ts");

const AVAILABLE = "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01";
const SOLD = "carton-6-kg-de-vrac-pokemon-toutes-series-orange-02";
const DAY_MS = 24 * 60 * 60 * 1000;

test("l'adresse publique du site ne retombe sur localhost qu'en local", () => {
  /* Un build de production sans variable écrivait http://localhost:3000
     dans og:image, la canonique et le plan de site : Facebook ne peut pas
     aller chercher une image sur localhost. */
  assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://bulktcg.fr/", CI: "true" }), "https://bulktcg.fr");
  assert.equal(resolveSiteUrl({ VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "bulktcg.fr" }), "https://bulktcg.fr");
  assert.equal(resolveSiteUrl({ NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: "bulktcg.vercel.app" }), "https://bulktcg.vercel.app");
  assert.throws(() => resolveSiteUrl({ VERCEL: "1" }), /NEXT_PUBLIC_SITE_URL/);
  assert.throws(() => resolveSiteUrl({ CI: "true" }), /NEXT_PUBLIC_SITE_URL/);
  assert.throws(() => resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "bulktcg.fr" }), /absolue/);
  /* npm run build, verify et le smoke tournent sans aucune variable. */
  assert.equal(resolveSiteUrl({}), "http://localhost:3000");
});

test("une description se coupe entre deux mots, jamais au milieu", () => {
  const long = "Gros lot de quatre cents cartes issues des séries récentes, quelques rayures de classeur sur une dizaine de communes.";
  /* Toutes les longueurs : une seule tombait peut-être par hasard entre deux
     mots. */
  for (let maxLength = 30; maxLength < long.length; maxLength += 1) {
    const cut = truncateAtWord(long, maxLength);
    assert.ok(cut.length <= maxLength, `${cut.length} caractères pour ${maxLength}`);
    assert.ok(cut.endsWith("…"));
    const kept = cut.slice(0, -1);
    assert.ok(long.startsWith(kept) && [" ", ","].includes(long[kept.length]), `coupé au milieu d'un mot : « ${cut} »`);
  }
  assert.equal(truncateAtWord("Court.", 80), "Court.");
});

test("l'aperçu d'une annonce commence par les faits, et un lot vendu le dit d'abord", async () => {
  const available = await getListingBySlug(AVAILABLE);
  const description = listingShareDescription(available, Date.now());
  assert.ok(description.length <= 160);
  assert.match(description, /^Pokémon · 35\s€ · Vrac · 400\scartes · Avignon \(84000\) — Gros lot/);
  assert.doesNotMatch(listingShareTitle(available, Date.now()), /^(Vendu|Réservé)/);

  const sold = await getListingBySlug(SOLD);
  assert.match(listingShareTitle(sold, Date.now()), /^Vendu — Carton 6 kg/);
  assert.match(listingShareDescription(sold, Date.now()), /^Vendu — /);
  /* Un lot non compté n'invente pas « 0 carte ». */
  assert.doesNotMatch(listingShareDescription(sold, Date.now()), /\b0\s?cartes?\b/);
});

test("une annonce vendue reste indexée trente jours, puis sort de l'index", async () => {
  const sold = await getListingBySlug(SOLD);
  const soldAt = new Date(sold.soldAt);
  const soon = listingRobots(sold, new Date(soldAt.getTime() + 5 * DAY_MS));
  assert.equal(soon.index, true);
  assert.equal(soon.unavailable_after, new Date(soldAt.getTime() + 30 * DAY_MS).toISOString());
  assert.deepEqual(listingRobots(sold, new Date(soldAt.getTime() + 31 * DAY_MS)), { index: false, follow: true });
  assert.deepEqual(listingRobots(await getListingBySlug(AVAILABLE), new Date()), INDEXABLE);
  assert.deepEqual(listingRobots({ ...sold, audience: "pros" }, new Date()), { index: false, follow: false });
});

test("une annonce expirée répond encore, hors de l'index et du plan de site, et son aperçu le dit d'abord", async () => {
  /* Son vendeur ne l'a pas prolongée : le lot n'est peut-être plus à
     vendre. Le lien partagé répond, mais aucun moteur n'y envoie plus
     personne. */
  const { getListingById } = await import("../src/lib/data/listings.ts");
  const expired = await getListingById("l-41");
  assert.ok(expired, "l'annonce expirée de la démonstration a disparu");
  assert.equal(await getListingBySlug(expired.slug).then((found) => found?.id), "l-41", "sa page ne répond plus");
  assert.deepEqual(listingRobots(expired, new Date()), { index: false, follow: true });
  assert.match(listingShareTitle(expired, Date.now()), /^Expirée — /);
  const listed = await getListings({ includeSold: true, limit: Number.MAX_SAFE_INTEGER });
  assert.ok(!listed.some((listing) => listing.id === "l-41"), "une annonce expirée sort encore dans les listes et le plan de site");
  /* Prolongée la veille de son échéance, elle redevient indexable. */
  assert.deepEqual(listingRobots({ ...expired, renewedAt: new Date().toISOString() }, new Date()), INDEXABLE);
});

test("la page N d'une liste a sa propre canonique ; les filtres renvoient à l'adresse nue", () => {
  assert.deepEqual(listingListMetadata("Cartes Pokémon", "/pokemon", {}), {
    title: "Cartes Pokémon",
    alternates: { canonical: "/pokemon" },
    robots: INDEXABLE,
  });
  const second = listingListMetadata("Cartes Pokémon", "/pokemon", { page: "2" });
  assert.equal(second.alternates.canonical, "/pokemon?page=2");
  assert.equal(second.title, "Cartes Pokémon — page 2");
  assert.equal(second.robots.index, false);
  const filtered = listingListMetadata("Cartes Pokémon", "/pokemon", { etat: "NM", page: "2" });
  assert.equal(filtered.alternates.canonical, "/pokemon");
  assert.equal(filtered.robots.index, false);
});

test("un profil sans rien de public reste hors index", () => {
  const quiet = { activeListingCount: 0, ratingCount: 0, shop: null };
  assert.equal(isProfileIndexable(quiet), false);
  assert.equal(isProfileIndexable({ ...quiet, activeListingCount: 1 }), true);
  assert.equal(isProfileIndexable({ ...quiet, ratingCount: 3 }), true);
  assert.equal(isProfileIndexable({ ...quiet, shop: { siret: null, address: null, hours: null, website: null } }), true);
});

test("une fiche garde le nom du site et sa langue dans son aperçu", async () => {
  /* Next remplace l'openGraph du gabarit par celui de la page : og:site_name
     et og:locale avaient disparu des fiches, les seules pages qu'on
     partage vraiment. */
  const { generateMetadata } = await import("../src/app/annonces/[slug]/page.tsx");
  const metadata = await generateMetadata({ params: Promise.resolve({ slug: AVAILABLE }) });
  assert.equal(metadata.openGraph.siteName, "BulkTCG");
  assert.equal(metadata.openGraph.locale, "fr_FR");
  assert.equal(metadata.openGraph.url, `/annonces/${AVAILABLE}`);
  assert.equal(metadata.alternates.canonical, `/annonces/${AVAILABLE}`);
});

test("le plan de site porte des dates réelles, les photos, et rien d'inindexable", async () => {
  const { default: sitemap } = await import("../src/app/sitemap.ts");
  const entries = await sitemap();
  const now = Date.now();
  const urls = entries.map((entry) => entry.url);
  assert.ok(urls.every((url) => url.startsWith(SITE_URL)), "une adresse sort du site");
  assert.ok(!urls.some((url) => url.includes("?")), "une adresse filtrée est déclarée");
  assert.equal(new Set(urls).size, urls.length, "une adresse est déclarée deux fois");

  const dates = entries.flatMap((entry) => (entry.lastModified ? [new Date(entry.lastModified).getTime()] : []));
  assert.ok(new Set(dates).size > 5, "toutes les adresses portent la même date");
  assert.ok(dates.every((time) => time <= now), "une date est dans le futur");

  const listings = await getListings({ includeSold: true, limit: Number.MAX_SAFE_INTEGER });
  for (const listing of listings) {
    const entry = entries.find((candidate) => candidate.url === `${SITE_URL}/annonces/${listing.slug}`);
    assert.equal(Boolean(entry), isListingIndexable(listing, new Date()), `${listing.slug} : plan de site et index divergent`);
    if (entry) {
      assert.equal(new Date(entry.lastModified).getTime(), listingLastModified(listing).getTime(), `${listing.slug} : date inventée`);
    }
    if (entry && listing.photos.some((photo) => photo.url)) assert.ok(entry.images.length > 0, `${listing.slug} sans ses photos`);
  }
  /* Un profil n'y figure qu'avec une annonce en ligne. */
  const sellers = new Set(listings.filter((listing) => listing.status !== "sold").map((listing) => listing.seller.username));
  for (const url of urls.filter((candidate) => candidate.startsWith(`${SITE_URL}/p/`))) {
    assert.ok(sellers.has(url.split("/profil/")[1]), `${url} n'a rien en ligne`);
  }
});

test("chaque page partagée a son image, versionnée, et rien pour ce qui n'existe pas", async () => {
  /* Une demande, un profil, un jeu, une ville : leur aperçu montrait la
     marque du site. Chaque image déclare une version, un texte et du JPEG. */
  const routes = [
    ["../src/app/recherches/[slug]/opengraph-image.tsx", { slug: "cherche-display-riftbound-scellee-vf-ou-vo-apt-14" }, { slug: "inconnue" }],
    ["../src/app/profil/[username]/opengraph-image.tsx", { username: "repaire_du_joueur" }, { username: "personne" }],
    ["../src/app/[game]/opengraph-image.tsx", { game: "pokemon" }, { game: "belote" }],
    ["../src/app/[game]/[city]/opengraph-image.tsx", { game: "pokemon", city: "avignon" }, { game: "pokemon", city: "atlantide" }],
  ];
  for (const [path, known, unknown] of routes) {
    const { generateImageMetadata } = await import(path);
    const [image, ...rest] = await generateImageMetadata({ params: known });
    assert.equal(rest.length, 0, path);
    assert.match(image.id, /^[a-z0-9]+$/, `${path} : version illisible`);
    assert.equal(image.contentType, "image/jpeg");
    assert.deepEqual(image.size, { width: 1200, height: 630 });
    assert.ok(image.alt.length > 10, `${path} : texte alternatif vide`);
    assert.deepEqual(await generateImageMetadata({ params: unknown }), [], `${path} répond pour ce qui n'existe pas`);
    /* Un second calcul tombe sur la même version : la page et l'image,
       rendues séparément, doivent s'accorder. */
    assert.equal((await generateImageMetadata({ params: known }))[0].id, image.id);
  }
});
