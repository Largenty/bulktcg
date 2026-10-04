import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { ImageResponse } from "next/og";
import { createElement } from "react";
import sharp from "sharp";
import { getListingBySlug } from "../src/lib/data/listings.ts";
import { shareImageVersion } from "../src/lib/metadata.ts";
import { encodeShareImageJpeg, loadOpenGraphPhoto, toShareImagePhoto } from "../src/lib/og-fonts.ts";
import { render, text } from "./markup.mjs";

/* L'image de partage d'une annonce : ce que Facebook et WhatsApp montrent
   quand le vendeur colle son lien. Audit SEO : une photo WebP la faisait
   échouer (P0-2), elle pesait 1,1 Mo (P1-8), elle ne disait pas qu'un lot
   était vendu (P1-6), et son adresse ne changeait jamais (P1-7). */

const AVAILABLE = "vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01";
const listing = await getListingBySlug(AVAILABLE);

const webpPhoto = () => sharp({ create: { width: 800, height: 600, channels: 3, background: "#cc3344" } }).webp().toBuffer();
const photoImage = (src) =>
  createElement("div", { style: { display: "flex", width: "100%", height: "100%" } }, createElement("img", { src, width: 520, height: 630 }));

test("la version de l'image suit ce qu'elle montre, et rien d'autre", () => {
  const now = Date.now();
  const version = shareImageVersion(listing, now);
  assert.equal(shareImageVersion({ ...listing }, now), version, "deux calculs du même lot divergent");
  assert.notEqual(shareImageVersion({ ...listing, status: "sold" }, now), version, "vendu, l'image garde son adresse");
  assert.notEqual(shareImageVersion({ ...listing, priceCents: listing.priceCents - 500 }, now), version, "une baisse de prix ne change pas l'adresse");
  assert.notEqual(shareImageVersion({ ...listing, seller: { ...listing.seller, isPro: !listing.seller.isPro } }, now), version);
  /* Expirée, elle porte son tampon ; archivée, elle perd sa photo : deux
     images différentes, deux adresses. */
  const expiredAt = Date.parse(listing.renewedAt) + 91 * 86_400_000;
  const archivedAt = Date.parse(listing.renewedAt) + 121 * 86_400_000;
  assert.notEqual(shareImageVersion(listing, expiredAt), version, "expirée, l'image garde son adresse");
  assert.notEqual(shareImageVersion(listing, archivedAt), shareImageVersion(listing, expiredAt), "archivée, l'image garde sa photo");
  /* La page et la route de l'image sont rendues séparément : une date de
     retouche ou une description, que l'image ne montre pas, ne doivent pas
     les faire diverger. */
  assert.equal(shareImageVersion({ ...listing, description: "Autre texte", updatedAt: new Date(0).toISOString() }, now), version);
});

test("une photo WebP devient un JPEG que le moteur de l'image sait lire", async () => {
  const webp = await webpPhoto();
  /* Le moteur refuse la photo telle quelle : c'est ce qui faisait échouer
     l'image de toute annonce déposée depuis la conversion en WebP. */
  await assert.rejects(new ImageResponse(photoImage(`data:image/webp;base64,${webp.toString("base64")}`), { width: 520, height: 630 }).arrayBuffer());
  const converted = await toShareImagePhoto(new Uint8Array(webp));
  assert.match(converted, /^data:image\/jpeg;base64,/);
  const png = await new ImageResponse(photoImage(converted), { width: 520, height: 630 }).arrayBuffer();
  assert.ok(png.byteLength > 0);
  assert.equal(await toShareImagePhoto(new Uint8Array([1, 2, 3])), null, "un fichier illisible doit rendre null, pas lever");
});

test("une photo lente ou absente laisse l'image sans elle, dans le délai", async () => {
  const webp = await webpPhoto();
  const server = createServer((request, response) => {
    if (request.url === "/photo.webp") {
      response.writeHead(200, { "Content-Type": "image/webp" }).end(webp);
    } else if (request.url === "/absente.webp") {
      response.writeHead(404).end();
    }
    /* /lente.webp ne répond jamais. */
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.match(await loadOpenGraphPhoto(`${base}/photo.webp`), /^data:image\/jpeg;base64,/);
    assert.equal(await loadOpenGraphPhoto(`${base}/absente.webp`), null);
    const started = Date.now();
    assert.equal(await loadOpenGraphPhoto(`${base}/lente.webp`, { timeoutMs: 200 }), null);
    assert.ok(Date.now() - started < 2000, "le délai n'a pas été tenu");
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test("l'image finale part en JPEG", async () => {
  const png = await sharp({ create: { width: 1200, height: 630, channels: 4, background: "#0f1216" } }).png().toBuffer();
  const jpeg = await encodeShareImageJpeg(png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength));
  assert.deepEqual([...jpeg.subarray(0, 3)], [0xff, 0xd8, 0xff]);
});

test("un lot vendu, réservé ou expiré porte son tampon, et chaque image le filigrane du vendeur", async () => {
  const { OgListingImage } = await import("../src/components/og/OgListingImage.tsx");
  const { getListingStateLabel } = await import("../src/lib/listing-display.ts");
  const drawn = (status, now = Date.now()) => {
    const shown = { ...listing, status };
    return text(render(createElement(OgListingImage, { listing: shown, state: getListingStateLabel(shown, now), photo: null, hasBrandFonts: false })));
  };
  assert.match(drawn("sold"), /Vendu/);
  assert.match(drawn("reserved"), /Réservé/);
  assert.match(drawn("available", Date.parse(listing.renewedAt) + 91 * 86_400_000), /Expirée/);
  assert.doesNotMatch(drawn("available"), /Vendu|Réservé|Disponible|Expirée/);
  assert.match(drawn("available"), new RegExp(`${listing.reference} · @${listing.seller.username}`));
});

/* --- Les pages qui partageaient l'image générique du site ---
   Une demande collée dans un groupe, un profil, la page d'un jeu ou d'une
   ville montraient la marque, pas ce qu'elles contiennent. */

const { getWantedBySlug } = await import("../src/lib/data/wanted.ts");
const { getProfileByUsername } = await import("../src/lib/data/profiles.ts");
const { getCityBySlug } = await import("../src/lib/cities.ts");
const { forSatori, shareImageResponse } = await import("../src/lib/og-fonts.ts");
const { wantedShare, OgWantedImage } = await import("../src/components/og/OgWantedImage.tsx");
const { profileShare, OgProfileImage } = await import("../src/components/og/OgProfileImage.tsx");
const { gameShare, cityShare, OgMarketImage } = await import("../src/components/og/OgMarketImage.tsx");

test("une demande montre son budget en pavé, ou dit qu'elle n'en annonce pas", async () => {
  const withBudget = wantedShare(await getWantedBySlug("cherche-display-riftbound-scellee-vf-ou-vo-apt-14"));
  assert.equal(withBudget.budgetCents, 15000);
  assert.ok(!withBudget.lines.includes("Sans budget annoncé"));
  const withoutBudget = wantedShare(await getWantedBySlug("cherche-lots-one-piece-budget-large-l-isle-sur-la-sorgue-05"));
  assert.equal(withoutBudget.budgetCents, null);
  assert.equal(withoutBudget.lines[0], "Sans budget annoncé");
  /* « 50 km » ne se coupe pas entre le nombre et l'unité. */
  assert.ok(withoutBudget.lines.some((line) => /jusqu'à \d+ km$/.test(line)), withoutBudget.lines.join(" | "));
  assert.equal(withBudget.stamp, null, "une demande ouverte porte un tampon");
});

test("une demande close porte son tampon, trouvée ou abandonnée", async () => {
  const found = await getWantedBySlug("recherche-classeur-modern-horizons-romans-sur-isere-08");
  assert.equal(wantedShare(found).stamp, "Trouvé");
  assert.equal(wantedShare({ ...found, status: "closed" }).stamp, "Abandonnée");
  const markup = text(render(createElement(OgWantedImage, { share: wantedShare(found), hasBrandFonts: false })));
  assert.match(markup, /Trouvé/);
  assert.match(markup, /Recherche/);
});

test("un profil sans avis le dit, et une boutique se présente sous son enseigne", async () => {
  const shop = profileShare(await getProfileByUsername("repaire_du_joueur"));
  assert.equal(shop.title, "Le Repaire du Joueur");
  assert.equal(shop.chip, "Boutique");
  const person = profileShare(await getProfileByUsername("lecomptoirdukado"));
  assert.equal(person.title, "lecomptoirdukado");
  assert.equal(person.chip, "Profil");
  const newcomer = profileShare({ ...(await getProfileByUsername("lecomptoirdukado")), ratingAvg: null, ratingCount: 0 });
  assert.equal(newcomer.lines[0], "Pas encore d'avis");
  assert.doesNotMatch(newcomer.lines.join(" "), /0\/5|Note 0/);
  /* u-15 : forfait expiré, toujours une boutique. */
  assert.equal(profileShare(await getProfileByUsername("le_de_d_orange")).chip, "Boutique");
  assert.match(text(render(createElement(OgProfileImage, { share: shop, hasBrandFonts: false }))), /Le Repaire du Joueur/);
});

test("un marché vide le dit en toutes lettres, jamais « 0 lot »", () => {
  const empty = gameShare("pokemon", { listingCount: 0, wantedCount: 0, prices: [] });
  assert.equal(empty.lines[0], "Aucun lot en ligne pour l'instant");
  assert.doesNotMatch(empty.lines.join(" "), /\b0\s/);
  assert.match(gameShare("pokemon", { listingCount: 1, wantedCount: 2, prices: [3500] }).lines[0], /^1 lot en ligne, à 35\s€$/);
  assert.match(gameShare("pokemon", { listingCount: 2, wantedCount: 0, prices: [800, 45000] }).lines[0], /de 8\s€ à 450\s€$/);

  const paris = getCityBySlug("paris");
  const quiet = cityShare("pokemon", paris, { inCity: 0, nearby: 0, wanted: 0 });
  assert.equal(quiet.lines[0], "Aucun lot à Paris pour l'instant");
  assert.doesNotMatch(quiet.lines.join(" "), /\b0\s/);
  const busy = cityShare("pokemon", getCityBySlug("avignon"), { inCity: 2, nearby: 4, wanted: 3 });
  assert.deepEqual(busy.lines, ["2 lots à Avignon", "4 autres à moins de 30 km", "3 acheteurs viendraient jusqu'ici"]);
  assert.match(text(render(createElement(OgMarketImage, { share: busy, hasBrandFonts: false }))), /Cartes Pokémon d'occasion à Avignon/);
});

test("une image de partage part en JPEG, se garde un an, et survit à une photo refusée", async () => {
  /* Satori perd l'espace fine insécable d'Intl : « 1 500 » devenait « 1500 ». */
  assert.equal(forSatori("1 500 cartes"), "1 500 cartes");
  const empty = () => createElement("div", { style: { display: "flex", width: "100%", height: "100%" } });
  const offline = { loadFonts: async () => [] };
  const response = await shareImageResponse(empty, undefined, offline);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.match(response.headers.get("cache-control"), /max-age=31536000, immutable/);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  /* Un dessin que le moteur refuse retombe sur le repli. */
  const broken = () => photoImage("data:image/webp;base64,UklGRg==");
  const fallback = await shareImageResponse(broken, empty, offline);
  assert.equal(fallback.status, 200);
});
