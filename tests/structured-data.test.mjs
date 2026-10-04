import assert from "node:assert/strict";
import test from "node:test";
import { getListingBySlug, getListings } from "../src/lib/data/listings.ts";
import { getProfileByUsername } from "../src/lib/data/profiles.ts";
import {
  breadcrumbJsonLd,
  listingBreadcrumbItems,
  listingJsonLd,
  listingPageJsonLd,
  serializeJsonLd,
  siteJsonLd,
  storeJsonLd,
} from "../src/lib/structured-data.ts";
import { SITE_URL } from "../src/lib/site.ts";

/* Les données structurées (schema.org) : ce que les moteurs lisent d'une
   page sans avoir à la deviner. Le site n'en avait aucune (audit SEO, P1-9).
   Même règle qu'à l'écran : ce qui manque est omis, jamais écrit 0. */

const AVAILABLE = "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01";
const SOLD = "carton-6-kg-de-vrac-pokemon-toutes-series-orange-02";

const all = await getListings({ includeSold: true, limit: Number.MAX_SAFE_INTEGER });
const find = (predicate, reason) => {
  const listing = all.find(predicate);
  assert.ok(listing, `aucune annonce de démonstration : ${reason}`);
  return listing;
};

test("une annonce disponible décrit son lot, son prix et où le récupérer", async () => {
  const listing = await getListingBySlug(AVAILABLE);
  const data = listingJsonLd(listing);
  assert.equal(data["@type"], "Product");
  assert.equal(data.name, listing.title);
  assert.equal(data.sku, listing.reference);
  assert.deepEqual(data.brand, { "@type": "Brand", name: "Pokémon" });
  assert.ok(data.image.length > 0 && data.image.every((url) => /^https?:\/\//.test(url)), "images en adresses absolues");
  const offer = data.offers;
  assert.equal(offer.price, (listing.priceCents / 100).toFixed(2));
  assert.equal(offer.priceCurrency, "EUR");
  assert.equal(offer.availability, "https://schema.org/InStock");
  assert.equal(offer.availableDeliveryMethod, "https://schema.org/OnSitePickup");
  assert.equal(offer.availableAtOrFrom.address.postalCode, listing.postalCode);
  assert.equal(offer.url, `${SITE_URL}/annonces/${listing.slug}`);
  /* Ni coordonnées ni note : la ville suffit, et la note du vendeur n'est
     pas celle du lot. */
  const json = JSON.stringify(data);
  assert.doesNotMatch(json, /latitude|longitude|aggregateRating/);
});

test("un lot vendu ou réservé le dit dans son offre, et un lot scellé est neuf", async () => {
  assert.equal(listingJsonLd(await getListingBySlug(SOLD)).offers.availability, "https://schema.org/SoldOut");
  const reserved = find((listing) => listing.status === "reserved", "réservée");
  assert.equal(listingJsonLd(reserved).offers.availability, "https://schema.org/Reserved");
  const sealed = find((listing) => listing.condition === "sealed", "scellée");
  assert.equal(listingJsonLd(sealed).offers.itemCondition, "https://schema.org/NewCondition");
  const used = find((listing) => listing.condition !== "sealed", "d'occasion");
  assert.equal(listingJsonLd(used).offers.itemCondition, "https://schema.org/UsedCondition");
});

test("un lot non compté n'a pas de nombre de cartes, jamais zéro", () => {
  const uncounted = find((listing) => listing.cardCount === null, "non comptée");
  const names = listingJsonLd(uncounted).additionalProperty.map((property) => property.name);
  assert.ok(!names.includes("Nombre de cartes"));
  for (const listing of all) {
    assert.doesNotMatch(JSON.stringify(listingJsonLd(listing)), /"value":0[,}]/, `${listing.slug} écrit une valeur à 0`);
  }
});

test("« Autre » n'a pas de marque, et une boutique vend sous son enseigne", () => {
  const other = find((listing) => listing.gameId === "other", "« Autre »");
  assert.equal(listingJsonLd(other).brand, undefined);
  const pro = find((listing) => listing.seller.isPro && listing.seller.companyName, "d'une boutique");
  assert.deepEqual(listingJsonLd(pro).offers.seller.name, pro.seller.companyName);
  assert.equal(listingJsonLd(pro).offers.seller["@type"], "Organization");
  const individual = find((listing) => !listing.seller.isPro, "d'un particulier");
  assert.equal(listingJsonLd(individual).offers.seller["@type"], "Person");
});

test("un titre piégé ne ferme pas la balise, et le bloc se relit à l'identique", async () => {
  const listing = { ...(await getListingBySlug(AVAILABLE)), title: '</script><script>alert("x")</script> & <!--' };
  const serialized = serializeJsonLd(listingJsonLd(listing));
  assert.doesNotMatch(serialized, /</, "un « < » brut reste dans le bloc");
  assert.doesNotMatch(serialized, /<\/script/i);
  assert.equal(JSON.parse(serialized).name, listing.title);
});

test("la fiche relie le lot et son fil d'Ariane dans un seul bloc", async () => {
  const listing = await getListingBySlug(AVAILABLE);
  const data = listingPageJsonLd(listing);
  assert.equal(data["@context"], "https://schema.org");
  const [product, breadcrumb] = data["@graph"];
  assert.equal(product["@type"], "Product");
  assert.equal(product["@context"], undefined, "un @context par nœud répète celui du bloc");
  assert.equal(breadcrumb["@type"], "BreadcrumbList");
  assert.deepEqual(
    breadcrumb.itemListElement.map((item) => item.position),
    breadcrumb.itemListElement.map((_, index) => index + 1),
  );
  assert.equal(breadcrumb.itemListElement.at(-1).item, `${SITE_URL}/annonces/${listing.slug}`);
  assert.equal(breadcrumb.itemListElement[1].item, `${SITE_URL}/pokemon`);
});

test("le fil d'Ariane mène à la page de la commune du lot, pas à celle d'un homonyme", async () => {
  /* L'écran et les données structurées partagent ce fil. Tirée du nom, la
     commune d'un lot à Valence (Tarn-et-Garonne) menait à la page de Valence
     (Drôme), et celle d'Apremont (Ain) à une 404. */
  const listing = await getListingBySlug(AVAILABLE);
  const communeOf = (place) => listingBreadcrumbItems({ ...listing, ...place }).find((item) => item.name === place.city)?.path;
  assert.equal(communeOf({ city: "Valence", postalCode: "82400" }), "/pokemon/valence-82");
  assert.equal(communeOf({ city: "Valence", postalCode: "26000" }), "/pokemon/valence");
  assert.equal(communeOf({ city: "Apremont", postalCode: "01100" }), "/pokemon/apremont-01");
  /* Un couple inconnu du référentiel n'a pas de page : son maillon est omis,
     et le fil garde ses autres étapes. */
  const unknown = listingBreadcrumbItems({ ...listing, city: "Nulle-Part", postalCode: "00000" });
  assert.deepEqual(unknown.map((item) => item.name), ["Annonces", "Pokémon", listing.title]);
});

test("l'accueil déclare le site et son éditeur, avec l'adresse de sa canonique", () => {
  const [organization, website] = siteJsonLd()["@graph"];
  assert.equal(organization["@type"], "Organization");
  assert.equal(website["@type"], "WebSite");
  assert.equal(website.url, SITE_URL, "l'accueil s'écrit sans barre finale, comme sa canonique");
  assert.equal(website.publisher["@id"], organization["@id"]);
  const trail = breadcrumbJsonLd([{ name: "Annonces", path: "/annonces" }]);
  assert.equal(trail.itemListElement[0].item, `${SITE_URL}/annonces`);
});

test("seul un compte professionnel se déclare comme magasin, forfait ou non", async () => {
  const shop = await getProfileByUsername("repaire_du_joueur");
  const store = storeJsonLd(shop);
  assert.equal(store["@type"], "Store");
  assert.equal(store.name, shop.companyName);
  assert.equal(store.address.postalCode, shop.postalCode);
  assert.equal(storeJsonLd(await getProfileByUsername("lecomptoirdukado")), null, "un particulier n'est pas un magasin");
  /* u-15 : forfait expiré — toujours une boutique, et décrite comme telle. */
  assert.equal(storeJsonLd(await getProfileByUsername("le_de_d_orange"))?.["@type"], "Store");
});
