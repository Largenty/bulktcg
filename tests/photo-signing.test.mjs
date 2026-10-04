import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { PHOTO_DURATIONS } from "../src/lib/photo-hosting.ts";
import { privatePhotoExpiry, signPhotoUrl, signPrivatePhoto } from "../src/lib/photo-signing.ts";

/* Les URL signées des photos privées (annonces réservées aux pros). Aucun
   compte Cloudflare n'a servi à les vérifier : ce qui les tient, c'est le
   code même de la documentation de Cloudflare, rejoué ici avec Web Crypto,
   et un vecteur calculé à part avec openssl. */

const KEY = "cle-de-signature-factice";
const PHOTO = "https://imagedelivery.net/Hx9aB/2cdc28f0-017a-49c4-9ed7-87056c839011/w640";

/* L'exemple de « Serve private images using signed URL tokens »
   (developers.cloudflare.com/images/manage-images/serve-images/serve-private-images/),
   recopié ligne à ligne — seule l'expiration est passée au lieu d'être tirée
   de l'horloge. */
async function cloudflareDocumentedSignature(photoUrl, signingKey, expiry) {
  const bufferToHex = (buffer) => [...new Uint8Array(buffer)].map((x) => x.toString(16).padStart(2, "0")).join("");
  const url = new URL(photoUrl);
  const encoder = new TextEncoder();
  const secretKeyData = encoder.encode(signingKey);
  const key = await crypto.subtle.importKey("raw", secretKeyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  url.searchParams.set("exp", expiry);
  const stringToSign = url.pathname + "?" + url.searchParams.toString();
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(stringToSign));
  const sig = bufferToHex(new Uint8Array(mac).buffer);
  url.searchParams.set("sig", sig);
  return url.toString();
}

test("l'URL signée est celle que produit le code de la documentation de Cloudflare", async () => {
  for (const [photo, expiry] of [
    [PHOTO, 1790000100],
    ["https://imagedelivery.net/Hx9aB/083eb7b2-5392-4565-b69e-aff66acddd00/w1600", 1790003700],
    ["https://bulktcg.example/cdn-cgi/imagedelivery/Hx9aB/083eb7b2-5392-4565-b69e-aff66acddd00/w160", 1800000000],
  ]) {
    assert.equal(signPhotoUrl(photo, KEY, expiry), await cloudflareDocumentedSignature(photo, KEY, expiry));
  }
});

test("la signature est le HMAC-SHA256 hexadécimal du chemin et de son expiration", () => {
  /* printf '%s' '/Hx9aB/2cdc28f0-017a-49c4-9ed7-87056c839011/w640?exp=1790000100' \
       | openssl dgst -sha256 -hmac 'cle-de-signature-factice' */
  assert.equal(
    signPhotoUrl(PHOTO, KEY, 1790000100),
    `${PHOTO}?exp=1790000100&sig=b4426800ecdeb317d5a68e7ba4dc6543c49853a93772ffa865d7c14fa5fbae42`,
  );
  /* Une autre clé, une autre expiration : une autre signature. */
  assert.notEqual(signPhotoUrl(PHOTO, "autre-cle", 1790000100), signPhotoUrl(PHOTO, KEY, 1790000100));
  assert.notEqual(signPhotoUrl(PHOTO, KEY, 1790000400), signPhotoUrl(PHOTO, KEY, 1790000100));
});

test("une adresse déjà signée ne se signe pas une seconde fois", () => {
  /* L'ancienne signature entrerait dans la chaîne signée, et Cloudflare
     refuserait la nouvelle. */
  assert.throws(() => signPhotoUrl(signPhotoUrl(PHOTO, KEY, 1790000100), KEY, 1790000400), /déjà munie d'une requête/);
});

test("une URL signée vit dix à quinze minutes, la même pour tous pendant cinq minutes", () => {
  const { privateUrlSeconds, privateUrlStepSeconds } = PHOTO_DURATIONS;
  for (let nowSeconds = 1790000000; nowSeconds < 1790000000 + 3 * privateUrlStepSeconds; nowSeconds += 7) {
    const expiresAt = privatePhotoExpiry(nowSeconds * 1000 + 999);
    assert.equal(expiresAt % privateUrlStepSeconds, 0, "l'expiration n'est pas arrondie au pas");
    assert.ok(expiresAt - nowSeconds >= privateUrlSeconds, `trop courte à ${nowSeconds}`);
    assert.ok(expiresAt - nowSeconds < privateUrlSeconds + privateUrlStepSeconds, `trop longue à ${nowSeconds}`);
  }
  /* Les lecteurs d'un même intervalle de cinq minutes reçoivent la même
     adresse ; le suivant commence juste après. */
  const windowStart = 1790001000 - privateUrlSeconds - privateUrlStepSeconds + 1;
  assert.equal(privatePhotoExpiry(windowStart * 1000), 1790001000);
  assert.equal(privatePhotoExpiry((windowStart + privateUrlStepSeconds - 1) * 1000), 1790001000);
  assert.equal(privatePhotoExpiry((windowStart + privateUrlStepSeconds) * 1000), 1790001000 + privateUrlStepSeconds);
});

test("la route des photos privées reçoit l'URL signée de la variante demandée, et combien de temps la garder", () => {
  const config = { photosUrl: "https://imagedelivery.net/Hx9aB/{key}/{variant}", signingKey: KEY };
  const nowMs = 1790000100 * 1000;
  const signed = signPrivatePhoto("2cdc28f0-017a-49c4-9ed7-87056c839011", "w640", config, nowMs);
  assert.equal(signed.expiresAt, privatePhotoExpiry(nowMs));
  assert.equal(signed.url, signPhotoUrl(PHOTO, KEY, signed.expiresAt));
  /* La redirection se garde jusqu'à une minute avant l'expiration : le
     navigateur ne suit jamais une URL morte. */
  assert.equal(signed.maxAgeSeconds, signed.expiresAt - 1790000100 - PHOTO_DURATIONS.privateRedirectMarginSeconds);
  assert.ok(signed.maxAgeSeconds > 0);
});

test("la signature ne quitte pas le serveur", () => {
  /* La clé de signature vit dans l'environnement du serveur : un composant
     client qui importerait ce module ferait échouer le build. */
  const source = readFileSync(path.join(import.meta.dirname, "..", "src", "lib", "photo-signing.ts"), "utf8");
  assert.match(source, /^import "server-only";/);
});
