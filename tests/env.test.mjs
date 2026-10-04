import assert from "node:assert/strict";
import test from "node:test";
import { onRequestError, register } from "../src/instrumentation.ts";
import { checkServerEnv, readCloudflareImagesConfig, resolveDemoUserId } from "../src/lib/env.ts";

/* La configuration du serveur, vérifiée au démarrage (instrumentation.ts)
   plutôt que découverte à la première page qui s'en sert. */

const SUPABASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_x",
};

test("la session de démonstration n'existe qu'en développement et en prévisualisation", () => {
  /* Audit de sécurité, M8 : sans configuration, tout visiteur était connecté
     au compte u-01 — une variable restée sur un vrai déploiement aurait
     ouvert un compte réel à n'importe qui. */
  assert.equal(resolveDemoUserId({}), "u-01");
  assert.equal(resolveDemoUserId({ DEMO_USER_ID: "u-13" }), "u-13");
  assert.equal(resolveDemoUserId({ VERCEL_ENV: "preview" }), "u-01");
  assert.equal(resolveDemoUserId({ VERCEL_ENV: "production" }), null);
  assert.equal(resolveDemoUserId(SUPABASE), null);
  /* Restée là, la variable fait échouer le build au lieu d'être ignorée :
     personne ne croit la démonstration coupée alors qu'elle ne l'est pas. */
  assert.throws(() => resolveDemoUserId({ VERCEL_ENV: "production", DEMO_USER_ID: "u-13" }), /DEMO_USER_ID/);
  assert.throws(() => resolveDemoUserId({ ...SUPABASE, DEMO_USER_ID: "u-01" }), /DEMO_USER_ID/);
});

test("une configuration à moitié faite, ou une adresse sans https, est refusée avec son nom", () => {
  assert.deepEqual(checkServerEnv({}), []);
  assert.deepEqual(checkServerEnv(SUPABASE), []);
  /* « NOM= » copié tel quel de .env.example vaut une variable absente. */
  assert.deepEqual(checkServerEnv({ NEXT_PUBLIC_SUPABASE_URL: "", SUPABASE_SECRET_KEY: "" }), []);

  const half = checkServerEnv({ NEXT_PUBLIC_SUPABASE_URL: SUPABASE.NEXT_PUBLIC_SUPABASE_URL });
  assert.equal(half.length, 1);
  assert.match(half[0], /Supabase est configuré à moitié.*NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY/);

  const insecure = checkServerEnv({ ...SUPABASE, NEXT_PUBLIC_SUPABASE_URL: "http://abcd.supabase.co" });
  assert.match(insecure.join(" "), /NEXT_PUBLIC_SUPABASE_URL doit être une adresse absolue en https/);

  const photos = checkServerEnv({ CLOUDFLARE_ACCOUNT_ID: "a1b2" });
  assert.match(photos.join(" "), /Cloudflare Images est configuré à moitié/);

  assert.deepEqual(checkServerEnv({ ...SUPABASE, ...CLOUDFLARE }), []);
});

/* Cloudflare Images configuré en entier, tel que .env.example le décrit. */
const CLOUDFLARE = {
  CLOUDFLARE_ACCOUNT_ID: "a1b2",
  CLOUDFLARE_IMAGES_API_TOKEN: "token",
  CLOUDFLARE_IMAGES_SIGNING_KEY: "signing",
  NEXT_PUBLIC_PHOTOS_URL: "https://imagedelivery.net/Hx9aB/{key}/{variant}",
  CRON_SECRET: "0123456789abcdef0123456789abcdef",
};

test("l'adresse des photos est un gabarit : le hash du compte, puis l'identifiant et la variante", () => {
  /* Sans {key}, chaque photo pointerait sur la même adresse ; sans
     {variant} en dernier, le chargeur next/image ne pourrait plus choisir la
     variante qui couvre la largeur affichée. Sans le hash du compte,
     l'adresse ne désigne aucun compte ; un second {key} resterait écrit tel
     quel, buildPhotoUrl ne posant que le premier (relecture Cloudflare,
     F9). */
  for (const template of [
    "https://imagedelivery.net/Hx9aB",
    "https://imagedelivery.net/Hx9aB/{key}/public",
    "https://imagedelivery.net/Hx9aB/{variant}/{key}",
    "https://photos.example/{key}",
    "https://imagedelivery.net/Hx9aB/{key}/{variant}?v=2",
    "http://imagedelivery.net/Hx9aB/{key}/{variant}",
    "https://imagedelivery.net/{key}/{variant}",
    "https://bulktcg.example/cdn-cgi/imagedelivery/{key}/{variant}",
    "https://imagedelivery.net/{key}/{key}/{variant}",
    "https://imagedelivery.net/Hx9aB/{key}/{key}/{variant}",
    "https://photos.example/Hx9aB/{key}/{variant}",
  ]) {
    assert.match(
      checkServerEnv({ ...CLOUDFLARE, NEXT_PUBLIC_PHOTOS_URL: template }).join(" "),
      /NEXT_PUBLIC_PHOTOS_URL doit être https:\/\/imagedelivery\.net\/<hash du compte>\/\{key\}\/\{variant\}/,
      template,
    );
  }
  /* Un domaine personnalisé ne change que le gabarit. */
  assert.deepEqual(checkServerEnv({ ...SUPABASE, ...CLOUDFLARE, NEXT_PUBLIC_PHOTOS_URL: "https://bulktcg.example/cdn-cgi/imagedelivery/Hx9aB/{key}/{variant}" }), []);
  assert.deepEqual(checkServerEnv({ ...SUPABASE, ...CLOUDFLARE, NEXT_PUBLIC_PHOTOS_URL: "https://imagedelivery.net/ZWd9g1K7eljCn_KDTu_MWA/{key}/{variant}" }), []);
});

test("le ménage des photos a son secret dès que Cloudflare Images est configuré", () => {
  /* Sans lui, Vercel Cron ne pourrait pas appeler le ménage, et les fichiers
     qu'aucune photo n'affiche plus s'accumuleraient sans que rien ne le dise. */
  const { CRON_SECRET: _secret, ...withoutSecret } = CLOUDFLARE;
  assert.match(checkServerEnv(withoutSecret).join(" "), /CRON_SECRET est requis dès que Cloudflare Images est configuré/);
  assert.match(checkServerEnv({ ...CLOUDFLARE, CRON_SECRET: "trop-court" }).join(" "), /CRON_SECRET doit compter au moins 32 caractères/);
  /* En phase 1, rien n'est demandé. */
  assert.deepEqual(checkServerEnv({}), []);
});

test("le serveur lit Cloudflare Images d'un bloc, ou pas du tout", () => {
  assert.equal(readCloudflareImagesConfig({}), null);
  assert.deepEqual(readCloudflareImagesConfig({ ...SUPABASE, ...CLOUDFLARE }), {
    accountId: "a1b2",
    apiToken: "token",
    signingKey: "signing",
    photosUrl: "https://imagedelivery.net/Hx9aB/{key}/{variant}",
    cronSecret: "0123456789abcdef0123456789abcdef",
  });
  /* Une configuration fausse lève, comme au démarrage : on ne signe pas
     avec une clé absente. */
  assert.throws(() => readCloudflareImagesConfig({ CLOUDFLARE_ACCOUNT_ID: "a1b2" }), /Cloudflare Images est configuré à moitié/);
});

const PHOTOS_WITHOUT_DATABASE = /NEXT_PUBLIC_SUPABASE_URL est requis dès que Cloudflare Images est configuré/;
const DATABASE_WITHOUT_PHOTOS = /CLOUDFLARE_ACCOUNT_ID est requis en production dès que Supabase est configuré/;

test("Cloudflare ne va pas sans Supabase, et Supabase ne va pas en production sans Cloudflare", () => {
  /* Décidé en octobre 2026. Cloudflare sans Supabase : aucun téléversement
     ne s'inscrirait au registre, et les photos de démonstration seraient
     bloquées par la CSP. Supabase en production sans Cloudflare : tout
     s'afficherait « Sans photo », et un dépôt avec photos ne pourrait pas
     être publié — une prévisualisation ou un poste de développement
     l'admettent. Chaque état, à chaque endroit. */
  const PLACES = {
    "en local": {},
    "sur un poste de développement Vercel": { VERCEL_ENV: "development" },
    "en prévisualisation": { VERCEL_ENV: "preview" },
    "en production": { VERCEL_ENV: "production" },
  };
  const STATES = {
    "rien de configuré": [{}, () => null],
    "Supabase seul": [SUPABASE, (place) => (place.VERCEL_ENV === "production" ? DATABASE_WITHOUT_PHOTOS : null)],
    "Cloudflare seul": [CLOUDFLARE, () => PHOTOS_WITHOUT_DATABASE],
    "Supabase et Cloudflare": [{ ...SUPABASE, ...CLOUDFLARE }, () => null],
  };
  for (const [stateName, [variables, expected]] of Object.entries(STATES)) {
    for (const [placeName, place] of Object.entries(PLACES)) {
      const problems = checkServerEnv({ ...variables, ...place });
      const refusal = expected(place);
      if (refusal === null) assert.deepEqual(problems, [], `${stateName}, ${placeName} : refusé à tort`);
      else assert.ok(problems.length === 1 && refusal.test(problems[0]), `${stateName}, ${placeName} : ${problems.join(" ") || "accepté"}`);
    }
  }
  /* Un Cloudflare à moitié, sans Supabase : les deux problèmes à la fois,
     plutôt que l'un après l'autre, à chaque redéploiement. */
  const halfPhotos = checkServerEnv({ CLOUDFLARE_ACCOUNT_ID: "a1b2" }).join(" ");
  assert.match(halfPhotos, /Cloudflare Images est configuré à moitié/);
  assert.match(halfPhotos, PHOTOS_WITHOUT_DATABASE);
  /* Les deux refus disent pourquoi, en clair. */
  assert.match(checkServerEnv(CLOUDFLARE).join(" "), /aucun téléversement ne pourrait être inscrit au registre/);
  assert.match(checkServerEnv({ ...SUPABASE, VERCEL_ENV: "production" }).join(" "), /toutes les annonces s'afficheraient «\sSans photo\s»/);
});

test("le serveur refuse de démarrer sous une configuration fausse", async () => {
  const saved = { ...process.env };
  try {
    Object.assign(process.env, { NEXT_RUNTIME: "nodejs", VERCEL_ENV: "production", DEMO_USER_ID: "u-13" });
    await assert.rejects(register(), /Configuration refusée[\s\S]*DEMO_USER_ID/);
    delete process.env.DEMO_USER_ID;
    await register();
    /* Supabase sans les photos : refusé en production, admis en
       prévisualisation ; Cloudflare sans la base : refusé partout. */
    Object.assign(process.env, SUPABASE);
    await assert.rejects(register(), DATABASE_WITHOUT_PHOTOS);
    process.env.VERCEL_ENV = "preview";
    await register();
    for (const name of Object.keys(SUPABASE)) delete process.env[name];
    delete process.env.VERCEL_ENV;
    Object.assign(process.env, CLOUDFLARE);
    await assert.rejects(register(), PHOTOS_WITHOUT_DATABASE);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test("une erreur serveur laisse une ligne structurée, avec la référence montrée au visiteur", async () => {
  const lines = [];
  const original = console.error;
  console.error = (line) => lines.push(line);
  try {
    const error = Object.assign(new Error("relation « listings » introuvable"), { digest: "4242" });
    await onRequestError(
      error,
      { path: "/annonces/vrac", method: "GET", headers: {} },
      { routerKind: "App Router", routePath: "/annonces/[slug]", routeType: "render", renderSource: "react-server-components" },
    );
  } finally {
    console.error = original;
  }
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    level: "error",
    message: "relation « listings » introuvable",
    digest: "4242",
    method: "GET",
    path: "/annonces/vrac",
    routePath: "/annonces/[slug]",
    routeType: "render",
  });
});
