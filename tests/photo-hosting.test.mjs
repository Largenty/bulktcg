import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { imageConfigDefault } from "next/dist/shared/lib/image-config.js";
import nextConfig from "../next.config.ts";
import { PHOTO_MAX_WIDTH, PHOTO_RATIO } from "../src/lib/photo-format.ts";
import {
  DEFAULT_PHOTO_VARIANT,
  PHOTO_DURATIONS,
  PHOTO_VARIANTS,
  buildPhotoUrl,
  directUploadExpiry,
  photoLoaderUrl,
  photoVariantFor,
} from "../src/lib/photo-hosting.ts";

/* L'hébergement des photos chez Cloudflare Images : les variantes, le
   chargeur next/image de la phase 2, les durées décidées — et le guide de
   bascule qui les cite (supabase/README.md, § 6 et 8). */

const ROOT = path.resolve(import.meta.dirname, "..");
const TEMPLATE = "https://imagedelivery.net/Hx9aB/{key}/{variant}";
const PHOTO = "https://imagedelivery.net/Hx9aB/2cdc28f0-017a/w1600";
const HOUR = 3600;
const DAY = 24 * HOUR;

test("cinq variantes nommées, au format des photos, jusqu'à la largeur maximale d'un envoi", () => {
  assert.deepEqual(
    PHOTO_VARIANTS.map(({ name }) => name),
    ["w160", "w320", "w640", "w1024", "w1600"],
  );
  for (const [index, variant] of PHOTO_VARIANTS.entries()) {
    assert.equal(variant.name, `w${variant.width}`);
    assert.equal(variant.height, Math.round(variant.width / PHOTO_RATIO), `${variant.name} n'est pas en 4:3`);
    if (index > 0) assert.ok(variant.width > PHOTO_VARIANTS[index - 1].width, "les variantes ne vont pas en croissant");
  }
  /* Au-delà de ce que le navigateur envoie (lib/photo-format), il n'y a
     rien de plus à montrer ; l'adresse enregistrée vise la plus grande. */
  assert.equal(PHOTO_VARIANTS.at(-1).width, PHOTO_MAX_WIDTH);
  assert.equal(DEFAULT_PHOTO_VARIANT, PHOTO_VARIANTS.at(-1).name);
});

test("chaque largeur du srcset reçoit la plus petite variante qui la couvre", () => {
  /* Les largeurs que next/image demande réellement : celles du projet et
     celles de Next par défaut. */
  const widths = [...nextConfig.images.imageSizes, ...imageConfigDefault.deviceSizes];
  for (const width of widths) {
    const chosen = PHOTO_VARIANTS.find(({ name }) => name === photoVariantFor(width));
    const smaller = PHOTO_VARIANTS.filter((variant) => variant.width < chosen.width);
    if (width <= PHOTO_MAX_WIDTH) assert.ok(chosen.width >= width, `${width} px reçoit ${chosen.name}, trop petite`);
    else assert.equal(chosen.width, PHOTO_MAX_WIDTH);
    assert.ok(smaller.every((variant) => variant.width < width), `${width} px reçoit ${chosen.name} quand une plus petite suffisait`);
  }
  assert.equal(photoVariantFor(160), "w160");
  assert.equal(photoVariantFor(161), "w320");
  assert.equal(photoVariantFor(3840), "w1600");
});

test("le chargeur change la variante d'une photo du site, et rien d'autre", () => {
  assert.equal(photoLoaderUrl(PHOTO, 256, TEMPLATE), "https://imagedelivery.net/Hx9aB/2cdc28f0-017a/w320");
  assert.equal(photoLoaderUrl(PHOTO, 1920, TEMPLATE), PHOTO);
  /* La route du site qui sert les photos privées : la variante est aussi
     le dernier segment, et la route signe celle-là (supabase/README.md, § 8). */
  assert.equal(photoLoaderUrl("/photos/2cdc28f0-017a/w1600", 64, TEMPLATE), "/photos/2cdc28f0-017a/w160");
  assert.equal(photoLoaderUrl("/photos/2cdc28f0-017a/w1600", 64, undefined), "/photos/2cdc28f0-017a/w160");
  for (const untouched of [
    /* Signée : la signature porte sur la variante. */
    `${PHOTO}?exp=1790000700&sig=b442`,
    /* Un autre hôte, même avec un segment qui ressemble à une variante. */
    "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3",
    "https://ailleurs.example/Hx9aB/2cdc28f0-017a/w1600",
    "//imagedelivery.net/Hx9aB/2cdc28f0-017a/w1600",
    /* Une variante que le site ne déclare pas. */
    "https://imagedelivery.net/Hx9aB/2cdc28f0-017a/public",
    "blob:http://localhost:3000/5d2c",
  ]) {
    assert.equal(photoLoaderUrl(untouched, 256, TEMPLATE), untouched, untouched);
  }
  /* Sans gabarit configuré, aucune adresse absolue n'est reconnue. */
  assert.equal(photoLoaderUrl(PHOTO, 256, undefined), PHOTO);
});

test("une photo privée ne passe jamais par l'optimiseur de Next, dont le cache est commun à tous les lecteurs", async () => {
  /* Le srcset que next/image construit réellement avec le chargeur des
     photos : chaque candidat reste sur la route du site qui vérifie le
     lecteur (supabase/README.md, § 8), ou garde l'adresse signée telle
     quelle. L'assertion qu'il remplace ne pouvait pas échouer : elle
     cherchait /_next/image dans une adresse que le chargeur rend intacte. */
  const { getImgProps } = await import("next/dist/shared/lib/get-img-props.js");
  /* Un module CommonJS compilé depuis l'ESM : sa fonction est sous « default ». */
  const { default: imageLoaderModule } = await import("next/dist/shared/lib/image-loader.js");
  const nextDefaultLoader = imageLoaderModule.default;
  const { default: photoLoader } = await import("../src/lib/photo-loader.ts");
  const candidatesOf = (src, defaultLoader, loader) =>
    getImgProps(
      { src, alt: "", fill: true, sizes: "(max-width: 640px) 100vw, 640px" },
      { defaultLoader, imgConf: { ...imageConfigDefault, ...nextConfig.images, loader }, showAltText: false, blurComplete: false },
    ).props.srcSet.split(", ").map((candidate) => candidate.split(" ")[0]);
  const privatePhoto = "/photos/2cdc28f0-017a/w1600";
  const saved = process.env.NEXT_PUBLIC_PHOTOS_URL;
  try {
    /* Le chargeur ne se branche qu'avec les photos : gabarit posé. */
    process.env.NEXT_PUBLIC_PHOTOS_URL = TEMPLATE;
    for (const src of [privatePhoto, `${PHOTO}?exp=1790000700&sig=b442`]) {
      const candidates = candidatesOf(src, photoLoader, "custom");
      assert.ok(candidates.length > 1, `aucun srcset pour ${src}`);
      for (const candidate of candidates) {
        assert.doesNotMatch(candidate, /_next\/image/, candidate);
        assert.ok(src.startsWith("/") ? candidate.startsWith("/photos/2cdc28f0-017a/w") : candidate === src, candidate);
      }
    }
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_PHOTOS_URL;
    else process.env.NEXT_PUBLIC_PHOTOS_URL = saved;
  }
  /* Le contrôle sait voir ce qu'il refuse : avec le chargeur par défaut, la
     même photo privée passerait par l'optimiseur. */
  assert.ok(candidatesOf(privatePhoto, nextDefaultLoader, "default").every((candidate) => candidate.startsWith("/_next/image?url=%2Fphotos")));
});

test("le chargeur de next.config.ts lit le gabarit du déploiement", async () => {
  const { default: photoLoader } = await import("../src/lib/photo-loader.ts");
  const saved = process.env.NEXT_PUBLIC_PHOTOS_URL;
  try {
    process.env.NEXT_PUBLIC_PHOTOS_URL = TEMPLATE;
    assert.equal(photoLoader({ src: PHOTO, width: 600, quality: 75 }), "https://imagedelivery.net/Hx9aB/2cdc28f0-017a/w640");
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_PHOTOS_URL;
    else process.env.NEXT_PUBLIC_PHOTOS_URL = saved;
  }
  /* Le navigateur charge ce module : il se déclare client, et rien de
     secret ni d'horloge n'y entre. */
  assert.match(readFileSync(path.join(ROOT, "src", "lib", "photo-loader.ts"), "utf8"), /^"use client";/);
  const hosting = readFileSync(path.join(ROOT, "src", "lib", "photo-hosting.ts"), "utf8");
  assert.doesNotMatch(hosting, /process\.env|server-only|Date\.now\(/);
});

test("en phase 1, l'optimiseur de Next sert les photos de démonstration", () => {
  /* Un chargeur déclaré éteint /_next/image (next-server : 404 dès que
     images.loader n'est plus « default »), et les photos Unsplash de la
     démonstration en ont besoin. Le chargeur Cloudflare ne se branche
     qu'avec NEXT_PUBLIC_PHOTOS_URL. */
  assert.equal(process.env.NEXT_PUBLIC_PHOTOS_URL, undefined);
  assert.ok(nextConfig.images.loader === undefined || nextConfig.images.loader === "default");
  assert.equal(nextConfig.images.loaderFile, undefined);
  assert.ok(nextConfig.images.remotePatterns.some((pattern) => pattern.hostname === "images.unsplash.com"));
});

test("une clé et une variante font une adresse, sous n'importe quel domaine de livraison", () => {
  assert.equal(buildPhotoUrl(TEMPLATE, "2cdc28f0-017a", "w640"), "https://imagedelivery.net/Hx9aB/2cdc28f0-017a/w640");
  assert.equal(
    buildPhotoUrl("https://bulktcg.example/cdn-cgi/imagedelivery/Hx9aB/{key}/{variant}", "2cdc28f0-017a", "w160"),
    "https://bulktcg.example/cdn-cgi/imagedelivery/Hx9aB/2cdc28f0-017a/w160",
  );
});

test("les durées décidées tiennent dans ce que Cloudflare et le paiement imposent", () => {
  const { directUploadSeconds, privateUrlSeconds, privateUrlStepSeconds, privateRedirectMarginSeconds, unattachedGraceSeconds, detachedGraceSeconds } =
    PHOTO_DURATIONS;
  /* Cloudflare borne l'expiration d'une adresse de dépôt entre 2 minutes et
     6 heures. */
  assert.ok(directUploadSeconds >= 2 * 60 && directUploadSeconds <= 6 * HOUR);
  assert.equal(directUploadExpiry(Date.UTC(2026, 8, 30, 12, 0, 0, 456)), "2026-09-30T12:10:00Z");
  /* La redirection se garde moins longtemps que l'URL qu'elle désigne. */
  assert.ok(privateRedirectMarginSeconds > 0 && privateRedirectMarginSeconds < privateUrlSeconds);
  assert.ok(privateUrlStepSeconds <= privateUrlSeconds);
  /* Les photos 4 à 8 attendent le paiement : une session de paiement vit au
     plus 24 heures, et un webhook en échec est relancé pendant trois jours.
     Le ménage ne doit pas retirer leurs fichiers avant. */
  assert.ok(unattachedGraceSeconds > DAY + 3 * DAY);
  /* Un fichier décroché survit au moins à la régénération horaire des pages
     prérendues, et moins longtemps qu'un dépôt qui attend son paiement. */
  assert.ok(detachedGraceSeconds >= HOUR && detachedGraceSeconds < unattachedGraceSeconds);
});

/* « 10 minutes », « 7 jours », « 1 jour » : les durées telles que le guide
   les écrit. */
function inWords(seconds) {
  if (seconds % DAY === 0) return `${seconds / DAY} jour${seconds / DAY > 1 ? "s" : ""}`;
  if (seconds % HOUR === 0) return `${seconds / HOUR} heure${seconds / HOUR > 1 ? "s" : ""}`;
  return `${seconds / 60} minute${seconds / 60 > 1 ? "s" : ""}`;
}

function guideSection(number) {
  const guide = readFileSync(path.join(ROOT, "supabase", "README.md"), "utf8");
  const start = guide.indexOf(`\n## ${number}. `);
  assert.ok(start >= 0, `§ ${number} introuvable dans supabase/README.md`);
  return guide.slice(start, guide.indexOf("\n## ", start + 1));
}

test("le guide de bascule cite les durées et les variantes décidées", () => {
  /* Une durée changée ici sans le guide, et le guide mentirait à qui
     configure Cloudflare. */
  const photos = guideSection(6);
  const { directUploadSeconds, unattachedGraceSeconds, detachedGraceSeconds, privateUrlSeconds, privateUrlStepSeconds } = PHOTO_DURATIONS;
  for (const seconds of [directUploadSeconds, unattachedGraceSeconds, detachedGraceSeconds]) {
    assert.ok(photos.includes(`**${inWords(seconds)}`), `§ 6 ne cite pas « ${inWords(seconds)} »`);
  }
  const thousands = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  for (const { name, width, height } of PHOTO_VARIANTS) {
    assert.ok(photos.includes(`| \`${name}\` | ${thousands(width)} × ${thousands(height)} |`), `§ 6 ne décrit pas la variante ${name}`);
  }
  const pro = guideSection(8);
  for (const seconds of [privateUrlSeconds, privateUrlStepSeconds]) {
    assert.ok(pro.includes(inWords(seconds)), `§ 8 ne cite pas « ${inWords(seconds)} »`);
  }
});
