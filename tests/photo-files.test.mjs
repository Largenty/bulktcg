import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PHOTO_BYTES, createLocalPhotoRef, moveItem, selectPhotoFiles } from "../src/lib/photo-files.ts";
import { PHOTO_REF_PATTERN, findForeignPhotoRefs } from "../src/lib/photo-refs.ts";

const photo = (name, type = "image/jpeg", size = 2_000_000) => ({ name, type, size });

test("un fichier qui n'est pas une photo est écarté, avec son nom et la raison", () => {
  const { accepted, rejected } = selectPhotoFiles([photo("lot.jpg"), photo("facture.pdf", "application/pdf")], 8);
  assert.deepEqual(accepted.map((file) => file.name), ["lot.jpg"]);
  assert.match(rejected[0], /facture\.pdf : format non pris en charge/);
});

test("une photo de plus de 10 Mo est écartée", () => {
  const { accepted, rejected } = selectPhotoFiles([photo("raw.jpg", "image/jpeg", MAX_PHOTO_BYTES + 1)], 8);
  assert.equal(accepted.length, 0);
  assert.match(rejected[0], /plus de 10 Mo/);
});

test("la limite de photos est tenue, et ce qui dépasse est dit", () => {
  const { accepted, rejected } = selectPhotoFiles([photo("a.jpg"), photo("b.jpg"), photo("c.jpg")], 2);
  assert.equal(accepted.length, 2);
  assert.match(rejected[0], /c\.jpg : la limite de photos est atteinte/);
});

test("une référence locale est valide pour le schéma, sans dépendre de crypto.randomUUID", () => {
  const ref = createLocalPhotoRef();
  assert.match(ref, PHOTO_REF_PATTERN);
  assert.notEqual(ref, createLocalPhotoRef());
});

test("déplacer une photo change l'ordre sans rien perdre, et ne sort pas des bornes", () => {
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 0, -1), ["a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 3), ["a", "b", "c"]);
});

test("une photo déplacée depuis un rang qui n'existe pas ne crée pas de photo fantôme", () => {
  /* Seul le rang d'arrivée était borné : un rang de départ hors de la liste
     insérait undefined en tête — une vignette sans photo dans le
     formulaire —, et un rang négatif déplaçait la dernière photo, splice
     comptant alors depuis la fin. noUncheckedIndexedAccess l'a montré. */
  assert.deepEqual(moveItem(["a", "b", "c"], 3, 0), ["a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], -1, 0), ["a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 1.5, 0), ["a", "b", "c"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
});

test("une photo publiée étrangère à l'annonce est repérée, les autres non", () => {
  const own = ["https://images.unsplash.com/photo-1"];
  const refs = ["https://images.unsplash.com/photo-1", "local:abc", "storage:2cdc28f0-017a-49c4-9ed7-87056c839011", "https://ailleurs.example/vol.jpg"];
  assert.deepEqual(findForeignPhotoRefs(refs, own), ["https://ailleurs.example/vol.jpg"]);
});

test("une clé de stockage ne remonte pas l'arborescence", () => {
  assert.doesNotMatch("storage:../../secret.jpg", PHOTO_REF_PATTERN);
  assert.doesNotMatch("storage:a/../b", PHOTO_REF_PATTERN);
  assert.doesNotMatch("storage:u-01/photo.exe", PHOTO_REF_PATTERN);
});

test("une clé de fichier est un identifiant de Cloudflare Images : un segment, sans extension", () => {
  /* Cloudflare Images tire ses identifiants lui-même, sans dossier ni
     extension. La forme de R2 — « compte/fichier.webp » — n'a plus cours
     depuis que R2 est écarté : elle passait encore, par précaution, tant que
     le choix n'était pas fait. À qui appartient un fichier, c'est toujours le
     registre qui le dit, pas la forme de sa clé. */
  assert.match("storage:2cdc28f0-017a-49c4-9ed7-87056c839011", PHOTO_REF_PATTERN);
  for (const r2Shaped of ["storage:u-01/2f3e-9a.webp", "storage:u-01/2f3e-9a.jpg", "storage:2f3e-9a.webp", "storage:u-01//photo.webp"]) {
    assert.doesNotMatch(r2Shaped, PHOTO_REF_PATTERN, r2Shaped);
  }
  assert.doesNotMatch("storage:", PHOTO_REF_PATTERN);
});

test("une clé de fichier devient l'adresse que Cloudflare sert, selon le gabarit configuré", async () => {
  const { resolvePhotoUrl } = await import("../src/lib/data/mappers/shared.ts");
  const saved = process.env.NEXT_PUBLIC_PHOTOS_URL;
  try {
    /* Sans livraison configurée, aucune adresse inventée. */
    delete process.env.NEXT_PUBLIC_PHOTOS_URL;
    assert.equal(resolvePhotoUrl("2cdc28f0-017a"), null);
    /* La plus grande variante : l'image de partage, les données structurées
       et le plan de site veulent la photo entière ; le chargeur next/image
       la réduit pour l'affichage (tests/photo-hosting.test.mjs). */
    process.env.NEXT_PUBLIC_PHOTOS_URL = "https://imagedelivery.net/Hx9aB/{key}/{variant}";
    assert.equal(resolvePhotoUrl("2cdc28f0-017a"), "https://imagedelivery.net/Hx9aB/2cdc28f0-017a/w1600");
    /* Le domaine personnalisé, s'il vient un jour, ne change que le gabarit. */
    process.env.NEXT_PUBLIC_PHOTOS_URL = "https://bulktcg.example/cdn-cgi/imagedelivery/Hx9aB/{key}/{variant}";
    assert.equal(resolvePhotoUrl("2cdc28f0-017a"), "https://bulktcg.example/cdn-cgi/imagedelivery/Hx9aB/2cdc28f0-017a/w1600");
    /* Une clé s'encode : elle ne peut pas ouvrir une requête ni un fragment. */
    assert.equal(resolvePhotoUrl("a b?c#d"), "https://bulktcg.example/cdn-cgi/imagedelivery/Hx9aB/a%20b%3Fc%23d/w1600");
    /* Les photos de démonstration (Unsplash) passent telles quelles ; aucune
       autre adresse absolue — l'image de partage la téléchargerait côté
       serveur (audit de sécurité, F9). */
    assert.equal(resolvePhotoUrl("https://images.unsplash.com/photo-1"), "https://images.unsplash.com/photo-1");
    assert.equal(resolvePhotoUrl("https://169.254.169.254/latest/meta-data"), null);
    assert.equal(resolvePhotoUrl("http://images.unsplash.com/photo-1"), null);
  } finally {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_PHOTOS_URL;
    else process.env.NEXT_PUBLIC_PHOTOS_URL = saved;
  }
});
