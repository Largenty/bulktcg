/* Partage et référencement : ce que Facebook, WhatsApp et les moteurs
   lisent d'une page, mesuré sur le site construit. Audit SEO de septembre
   2026 : og:site_name perdu sur les fiches, image de 1,1 Mo en PNG, lot
   vendu partagé comme disponible, aucune donnée structurée. */
import assert from "node:assert/strict";
import { BASE, check } from "./harness.mjs";

const AVAILABLE = "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01";
const SOLD = "carton-6-kg-de-vrac-pokemon-toutes-series-orange-02";

const decode = (value) => value.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

async function headOf(path) {
  const html = await (await fetch(`${BASE}${path}`)).text();
  const meta = (attribute, name) => {
    const match = html.match(new RegExp(`<meta ${attribute}="${name}" content="([^"]*)"`));
    return match ? decode(match[1]) : null;
  };
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
  return { meta, jsonLd, canonical };
}

/* Le build local écrit ses liens absolus sur localhost:3000 : on garde le
   chemin, on interroge le serveur du smoke. */
const onBase = (url) => `${BASE}${new URL(url).pathname}${new URL(url).search}`;

const nodesOf = (blocks) => blocks.flatMap((block) => block["@graph"] ?? [block]);

export async function sharing() {
  await check("une fiche partagée garde le nom du site, sa langue, son adresse et sa canonique", async () => {
    const { meta, canonical } = await headOf(`/annonces/${AVAILABLE}`);
    assert.equal(meta("property", "og:site_name"), "BulkTCG");
    assert.equal(meta("property", "og:locale"), "fr_FR");
    assert.match(meta("property", "og:url") ?? "", new RegExp(`/annonces/${AVAILABLE}$`));
    assert.match(canonical ?? "", new RegExp(`/annonces/${AVAILABLE}$`));
    /* Coupée entre deux mots, et les faits d'abord. */
    const description = meta("name", "description") ?? "";
    assert.match(description, /^Pokémon · 35/);
    assert.ok(description.length <= 160 && (description.endsWith("…") || description.endsWith(".")), `description : « ${description} »`);
  });

  await check("l'image de partage est un JPEG léger, et son adresse porte sa version", async () => {
    const { meta } = await headOf(`/annonces/${AVAILABLE}`);
    const image = meta("property", "og:image") ?? "";
    assert.match(new URL(image).pathname, new RegExp(`^/annonces/${AVAILABLE}/opengraph-image/[a-z0-9]+$`));
    assert.equal(meta("property", "og:image:type"), "image/jpeg");
    const response = await fetch(onBase(image));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff], "le fichier n'est pas un JPEG");
    /* WhatsApp et Messenger ignorent les aperçus lourds : 1,1 Mo en PNG. */
    assert.ok(bytes.length < 300_000, `${bytes.length} octets`);
    /* Une ancienne version ne répond plus : l'aperçu ne survit pas au lot. */
    const stale = await fetch(`${BASE}/annonces/${AVAILABLE}/opengraph-image/ancienne-version`);
    assert.equal(stale.status, 404);
  });

  await check("un lot vendu se partage comme vendu, jusque dans ses données structurées", async () => {
    const { meta, jsonLd } = await headOf(`/annonces/${SOLD}`);
    assert.match(meta("property", "og:title") ?? "", /^Vendu — /);
    const product = nodesOf(jsonLd).find((node) => node["@type"] === "Product");
    assert.ok(product, "aucune donnée structurée sur la fiche");
    assert.equal(product.offers.availability, "https://schema.org/SoldOut");
  });

  await check("chaque gabarit porte des données structurées qui se relisent", async () => {
    const types = async (path) => nodesOf((await headOf(path)).jsonLd).map((node) => node["@type"]);
    assert.deepEqual((await types(`/annonces/${AVAILABLE}`)).sort(), ["BreadcrumbList", "Product"]);
    assert.deepEqual((await types("/")).sort(), ["Organization", "WebSite"]);
    assert.deepEqual(await types("/pokemon/avignon"), ["BreadcrumbList"]);
    assert.deepEqual(await types("/profil/repaire_du_joueur"), ["Store"]);
    assert.deepEqual(await types("/profil/lecomptoirdukado"), [], "un particulier se déclare comme magasin");
  });

  await check("une demande, un profil, un jeu et une ville ont chacun leur image de partage, légère et versionnée", async () => {
    /* Ils montraient tous l'image générique du site : une demande collée
       dans un groupe ne disait pas ce que l'acheteur cherche. */
    const pages = ["/recherches/cherche-display-riftbound-scellee-vf-ou-vo-apt-14", "/profil/repaire_du_joueur", "/pokemon", "/pokemon/avignon"];
    for (const path of pages) {
      const { meta } = await headOf(path);
      const image = meta("property", "og:image") ?? "";
      assert.match(new URL(image).pathname, new RegExp(`^${path}/opengraph-image/[a-z0-9]+$`), `${path} garde l'image du site`);
      const response = await fetch(onBase(image));
      assert.equal(response.status, 200, `${path} : ${response.status}`);
      assert.equal(response.headers.get("content-type"), "image/jpeg", path);
      const size = (await response.arrayBuffer()).byteLength;
      assert.ok(size > 5_000 && size < 300_000, `${path} : ${size} octets`);
    }
  });

  await check("l'accueil a sa canonique, et le favicon une taille que Google affiche", async () => {
    const html = await (await fetch(`${BASE}/`)).text();
    assert.match(html, /<link rel="canonical" href="[^"]+"/);
    const sizes = [...html.matchAll(/<link rel="icon"[^>]*sizes="(\d+)x\d+"/g)].map((match) => Number(match[1]));
    assert.ok(sizes.some((side) => side % 48 === 0), `tailles déclarées : ${sizes.join(", ")}`);
  });
}
