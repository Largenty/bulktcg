import assert from "node:assert/strict";
import test from "node:test";
import { PHOTO_MAX_WIDTH, PHOTO_RATIO, convertedPhotoName, planPhotoCrop } from "../src/lib/photo-format.ts";

/* Les photos partent au format du visuel de l'annonce : 4:3, recadrées au
   centre comme l'affichage les taille, jamais agrandies, 1 600 px au plus. */

test("une photo trop large est taillée sur les côtés, au centre", () => {
  const plan = planPhotoCrop(3000, 1000);
  assert.deepEqual(plan, { sx: 834, sy: 0, sWidth: 1333, sHeight: 1000, width: 1333, height: 1000 });
});

test("une photo trop haute est taillée en haut et en bas, au centre", () => {
  const plan = planPhotoCrop(1200, 1600);
  assert.equal(plan.sWidth, 1200);
  assert.equal(plan.sHeight, 900);
  assert.equal(plan.sy, 350);
  assert.equal(plan.width / plan.height, PHOTO_RATIO);
});

test("une grande photo est réduite à 1 600 px de large, au format 4:3", () => {
  const plan = planPhotoCrop(4032, 3024);
  assert.equal(plan.width, PHOTO_MAX_WIDTH);
  assert.equal(plan.height, 1200);
  assert.equal(plan.sWidth, 4032);
});

test("une petite photo n'est jamais agrandie, et garde au moins un pixel", () => {
  assert.deepEqual(planPhotoCrop(640, 480), { sx: 0, sy: 0, sWidth: 640, sHeight: 480, width: 640, height: 480 });
  const tiny = planPhotoCrop(1, 1);
  assert.ok(tiny.width >= 1 && tiny.height >= 1 && tiny.sWidth >= 1 && tiny.sHeight >= 1);
});

test("le nom dit le format réellement produit", () => {
  assert.equal(convertedPhotoName("IMG_2031.HEIC", "image/webp"), "IMG_2031.webp");
  assert.equal(convertedPhotoName("lot.carton.png", "image/jpeg"), "lot.carton.jpg");
  assert.equal(convertedPhotoName(".png", "image/webp"), "photo.webp");
});
