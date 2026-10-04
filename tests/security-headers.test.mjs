import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";
import nextConfig from "../next.config.ts";
import { contentSecurityPolicy, policyEnvironment } from "../src/lib/csp.ts";
import { ICON_SIZES } from "../src/lib/icon-sizes.ts";

/* next/server attend du runtime de Next un AsyncLocalStorage global. */
globalThis.AsyncLocalStorage = AsyncLocalStorage;
const { NextRequest } = await import("next/server");
const { unstable_doesMiddlewareMatch: doesProxyMatch } = await import("next/experimental/testing/server.js");
/* Le lecteur de Next lui-même : c'est lui qui cherche le nonce dans l'en-tête
   de la requête avant de le poser sur ses scripts. */
const { getScriptNonceFromHeader } = await import("next/dist/server/app-render/get-script-nonce-from-header.js");
/* Et ce qui fait d'une requête du flux RSC plutôt qu'une page : « RSC » valant
   exactement 1. */
const { isRSCRequestHeader } = await import("next/dist/server/lib/is-rsc-request.js");
const { config: proxyConfig, proxy } = await import("../src/proxy.ts");
/* Le lecteur de motifs de Next, celui des règles d'en-têtes et de redirections. */
const { getPathMatch } = await import("next/dist/shared/lib/router/utils/path-match.js");

/* Le site ne posait aucun en-tête de sécurité (audit du front, M1) : ni CSP,
   ni protection contre l'encadrement, ni nosniff, et il annonçait
   « X-Powered-By: Next.js ». Puis sa CSP a gardé 'unsafe-inline' pour les
   scripts, ce qui la laissait passer n'importe quel script injecté dans la
   page — et plafonnait le site à B+ sur l'Observatory de Mozilla. */

const PRODUCTION = { isDev: false, isHttps: true, photosHost: null };
const directives = (policy) =>
  new Map(policy.split(";").map((directive) => directive.trim().split(/\s+/)).filter(([name]) => name).map(([name, ...sources]) => [name, sources]));

async function proxied(url, headers = {}) {
  const response = await proxy(new NextRequest(url, { headers }));
  return {
    policy: response.headers.get("content-security-policy"),
    /* Ce que le rendu reçoit : les en-têtes de requête réécrits par le proxy. */
    renderedWith: (name) => response.headers.get(`x-middleware-request-${name}`),
  };
}

test("toutes les réponses portent les en-têtes de sécurité, sauf la CSP qu'écrit le proxy", async () => {
  const rules = await nextConfig.headers();
  const everywhere = rules.find((rule) => rule.source === "/:path*");
  assert.ok(everywhere, "aucune règle d'en-têtes sur toutes les routes");
  const headers = Object.fromEntries(everywhere.headers.map(({ key, value }) => [key.toLowerCase(), value]));
  assert.equal(headers["x-frame-options"], "DENY");
  assert.equal(headers["x-content-type-options"], "nosniff");
  assert.equal(headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.match(headers["permissions-policy"], /geolocation=\(\)/);
  assert.equal(headers["cross-origin-opener-policy"], "same-origin");
  /* Une seconde CSP, sans nonce, serait appliquée en plus de la première : le
     navigateur refuserait alors tous les scripts de la page. */
  const everyHeader = rules.flatMap((rule) => rule.headers.map(({ key }) => key.toLowerCase()));
  assert.ok(!everyHeader.includes("content-security-policy"), "next.config.ts pose une CSP statique en plus de celle du proxy");
});

test("chaque réponse reçoit une CSP à nonce neuf, que le rendu reçoit aussi", async () => {
  const first = await proxied("http://localhost/pokemon");
  const second = await proxied("http://localhost/pokemon");
  const nonce = getScriptNonceFromHeader(first.policy);
  assert.ok(nonce && nonce.length >= 22, `nonce illisible pour Next : ${first.policy}`);
  assert.notEqual(getScriptNonceFromHeader(second.policy), nonce, "deux réponses partagent le même nonce");
  /* Next lit le nonce dans la CSP de la requête ; le gabarit racine, dans
     x-nonce. Les deux doivent être ceux de la réponse. */
  assert.equal(first.renderedWith("content-security-policy"), first.policy);
  assert.equal(first.renderedWith("x-nonce"), nonce);
});

test("un nonce ou une CSP envoyés par le client sont écrasés", async () => {
  const forged = await proxied("http://localhost/", { "x-nonce": "connu", "content-security-policy": "script-src 'nonce-connu'" });
  assert.notEqual(forged.renderedWith("x-nonce"), "connu");
  assert.doesNotMatch(forged.renderedWith("content-security-policy"), /nonce-connu/);
});

test("aucun script ne s'exécute sans le nonce : ni 'unsafe-inline', ni eval, ni domaine externe", () => {
  const scripts = directives(contentSecurityPolicy("abc", PRODUCTION)).get("script-src");
  assert.ok(!scripts.includes("'unsafe-inline'"), "'unsafe-inline' est revenu dans script-src");
  assert.ok(!scripts.includes("'unsafe-eval'"), "'unsafe-eval' en production");
  assert.ok(scripts.includes("'nonce-abc'") && scripts.includes("'strict-dynamic'"));
  assert.ok(!scripts.some((source) => /^(https?:|\*|data:|blob:)/.test(source)), `script-src ouvert à l'extérieur : ${scripts.join(" ")}`);
  /* En développement, React reconstruit ses piles d'erreur avec eval, et le
     rechargement à chaud passe par une WebSocket — jamais 'unsafe-inline'. */
  const development = directives(contentSecurityPolicy("abc", { ...PRODUCTION, isDev: true }));
  assert.ok(development.get("script-src").includes("'unsafe-eval'") && !development.get("script-src").includes("'unsafe-inline'"));
  assert.ok(development.get("connect-src").includes("ws:"));
  assert.ok(!directives(contentSecurityPolicy("abc", PRODUCTION)).get("connect-src").includes("ws:"), "WebSocket ouverte en production");
});

/* Pose des variables le temps d'un appel, et rend celles d'avant : une
   NEXT_PUBLIC_SITE_URL du shell masquerait le repli sur le domaine de Vercel. */
async function withEnv(values, run) {
  const saved = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  const assign = (entries) => {
    for (const [name, value] of Object.entries(entries)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  };
  assign(values);
  try {
    return await run();
  } finally {
    assign(saved);
  }
}

test("HSTS et upgrade-insecure-requests en HTTPS, domaine de Vercel compris, jamais en HTTP", async () => {
  /* L'adresse publique se résout comme dans lib/site.ts : sans
     NEXT_PUBLIC_SITE_URL, un déploiement Vercel prend son domaine de
     production, servi en HTTPS. Il partait sans HSTS — et l'A+ de
     l'Observatory en dépend : six mois au moins (15 768 000 s). */
  const cases = [
    ["vercel", { NEXT_PUBLIC_SITE_URL: undefined, VERCEL_PROJECT_PRODUCTION_URL: "bulktcg.example" }, true],
    ["explicit", { NEXT_PUBLIC_SITE_URL: "https://bulktcg.example", VERCEL_PROJECT_PRODUCTION_URL: undefined }, true],
    ["local", { NEXT_PUBLIC_SITE_URL: "http://localhost:3117", VERCEL_PROJECT_PRODUCTION_URL: undefined }, false],
  ];
  for (const [tag, env, https] of cases) {
    await withEnv(env, async () => {
      const policy = directives(contentSecurityPolicy("abc", policyEnvironment()));
      assert.equal(policy.has("upgrade-insecure-requests"), https, `${tag} : upgrade-insecure-requests`);
      const { SECURITY_HEADERS } = await import(`../next.config.ts?hsts-${tag}`);
      const hsts = SECURITY_HEADERS.find(({ key }) => key === "Strict-Transport-Security")?.value;
      if (!https) {
        assert.equal(hsts, undefined, `${tag} : HSTS servi en HTTP`);
        return;
      }
      assert.ok(hsts, `${tag} : HTTPS sans HSTS`);
      assert.ok(Number(hsts.match(/max-age=(\d+)/)?.[1]) >= 15_768_000, `${tag} : ${hsts}`);
      assert.match(hsts, /includeSubDomains/);
    });
  }
});

test("les styles gardent 'unsafe-inline', et aucun nonce ne l'annule", () => {
  /* React écrit des attributs style, qu'un nonce ne couvre pas. Un nonce ou
     une empreinte dans style-src ferait ignorer 'unsafe-inline' au
     navigateur : toutes les couleurs de jeu tomberaient. */
  const styles = directives(contentSecurityPolicy("abc", PRODUCTION)).get("style-src");
  assert.ok(styles.includes("'unsafe-inline'"));
  assert.ok(!styles.some((source) => /^'(nonce|sha\d+)-/.test(source)), `style-src : ${styles.join(" ")}`);
});

test("la CSP interdit l'encadrement, les objets, <base> et les formulaires vers l'extérieur", () => {
  const policy = directives(contentSecurityPolicy("abc", PRODUCTION));
  for (const [name, source] of [["frame-ancestors", "'none'"], ["object-src", "'none'"], ["base-uri", "'self'"], ["form-action", "'self'"], ["default-src", "'self'"]]) {
    assert.deepEqual(policy.get(name), [source], `${name} : ${policy.get(name)}`);
  }
  assert.ok(policy.has("upgrade-insecure-requests"), "HTTPS sans upgrade-insecure-requests");
  assert.ok(!directives(contentSecurityPolicy("abc", { ...PRODUCTION, isHttps: false })).has("upgrade-insecure-requests"));
});

test("le proxy couvre chaque document, et laisse les fichiers de _next et les préchargements du routeur", () => {
  const matches = (url, headers = {}) => doesProxyMatch({ config: proxyConfig, url, headers });
  for (const url of [
    "/",
    "/pokemon",
    "/pokemon/avignon",
    "/annonces/vrac-400-cartes-pokemon-avignon-01",
    "/profil/lecomptoirdukado",
    "/connexion",
    "/page-inexistante",
    "/favicon.ico",
    /* Une icône ou une image de partage qui n'existe pas répond par une page
       404 : un document comme un autre. */
    "/icon/999",
    "/annonces/vrac-400-cartes-pokemon-avignon-01/opengraph-image/ancienne-version",
  ]) {
    assert.ok(matches(url), `${url} sortirait sans CSP`);
  }
  /* Chrome prérend une page depuis la barre d'adresse (« Sec-Purpose:
     prefetch;prerender »), puis l'affiche telle quelle. */
  assert.ok(matches("/pokemon", { purpose: "prefetch", "sec-purpose": "prefetch;prerender" }), "une page prérendue par le navigateur sortirait sans CSP");
  for (const url of ["/_next/static/chunks/app.js", "/_next/image?url=%2Fphoto.jpg&w=640&q=75"]) {
    assert.ok(!matches(url), `${url} passe par le proxy sans raison`);
  }
  /* Le proxy ne s'écarte que de ce que Next tient lui-même pour un
     préchargement du routeur : « RSC » et « Next-Router-Prefetch » valant
     exactement 1. Toute autre combinaison reçoit la page entière, en HTML :
     elle partait sans CSP, avec le nonce glissé dans x-nonce. « 1, 1 » est
     ce que Node fait de deux en-têtes identiques. */
  for (const rsc of [undefined, "1", "0", "true", "1, 1", ""]) {
    for (const prefetch of [undefined, "1", "0", "1, 1"]) {
      const headers = Object.fromEntries(Object.entries({ rsc, "next-router-prefetch": prefetch }).filter(([, value]) => value !== undefined));
      const routerPrefetch = isRSCRequestHeader(rsc) && prefetch === "1";
      const verdict = routerPrefetch
        ? "un préchargement du routeur passe par le proxy"
        : isRSCRequestHeader(rsc)
          ? "une navigation du routeur échappe au proxy"
          : "une page sortirait sans CSP";
      assert.equal(!matches("/pokemon", headers), routerPrefetch, `${JSON.stringify(headers)} : ${verdict}`);
    }
  }
});

test("tout script en ligne du code porte le nonce, hors blocs de données", () => {
  /* Le script de thème est le seul aujourd'hui : sans nonce, la CSP le
     refuse et un thème imposé s'affiche après la première peinture. Un bloc
     application/ld+json ne s'exécute pas et n'en a pas besoin. */
  const unguarded = [];
  let seen = 0;
  for (const file of collectFiles(SOURCE_ROOT, /\.tsx$/)) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && /^script$/i.test(node.tagName.getText())) {
        seen += 1;
        const attributes = new Map(node.attributes.properties.filter(ts.isJsxAttribute).map((attribute) => [attribute.name.getText(), attribute.initializer?.getText() ?? ""]));
        const isDataBlock = attributes.get("type") === '"application/ld+json"';
        if (!isDataBlock && !attributes.has("nonce")) unguarded.push(`${path.relative(SOURCE_ROOT, file)} : ${node.getText().slice(0, 60)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.ok(seen >= 2, `seulement ${seen} balise(s) <script> trouvée(s) : le parcours ne voit plus rien`);
  assert.deepEqual(unguarded, []);
});

test("aucune page ne se fige au build : le nonce n'existe qu'au rendu à la demande", () => {
  /* Une page prérendue garde les scripts de son build, sans nonce : la CSP les
     refuse et la page ne s'hydrate plus. C'est le gabarit racine qui rend
     chaque page dynamique, en lisant la requête ; une page « force-static »
     y lirait des en-têtes vides, et les coquilles statiques de
     cacheComponents n'ont pas de nonce (voir supabase/README.md, § 7). */
  const layout = readFileSync(path.join(SOURCE_ROOT, "app", "layout.tsx"), "utf8");
  assert.match(layout, /\(await headers\(\)\)\.get\(NONCE_HEADER\)/, "le gabarit racine ne lit plus le nonce de la requête");
  const frozen = collectFiles(path.join(SOURCE_ROOT, "app"), /\.tsx?$/).filter((file) =>
    /export\s+const\s+dynamic\s*=\s*["']force-static["']/.test(readFileSync(file, "utf8")),
  );
  assert.deepEqual(frozen.map((file) => path.relative(SOURCE_ROOT, file)), []);
  assert.ok(!nextConfig.cacheComponents, "cacheComponents prérend des coquilles sans nonce");
});

test("generateStaticParams ne sert qu'à répondre 404 hors de la liste : rien ne se prérend", () => {
  /* Le build tente chaque page déclarée puis y renonce au premier en-tête
     lu : les paramètres des annonces, des profils et des demandes ne
     prérendaient rien — ni la page, ni son image de partage, gardée en cache
     après la première demande avec ou sans eux —, et coûtaient 68 rendus à
     chaque build, dix mille à dix mille annonces. Seule une page qui pose
     dynamicParams = false en a l'usage : hors de la liste, elle répond 404. */
  const pages = collectFiles(path.join(SOURCE_ROOT, "app"), /^(page|layout)\.tsx?$/);
  const declares = (source) => /^export\s+(async\s+function|const)\s+generateStaticParams\b/m.test(source);
  const withParams = pages.filter((file) => declares(readFileSync(file, "utf8"))).map((file) => path.relative(SOURCE_ROOT, file));
  const useless = withParams.filter((file) => !/^export\s+const\s+dynamicParams\s*=\s*false\b/m.test(readFileSync(path.join(SOURCE_ROOT, file), "utf8")));
  assert.deepEqual(useless, [], "generateStaticParams sans dynamicParams = false : des rendus au build, pour rien");
  /* Le garde voit celui qui reste : sans lui, /belote rendrait une page vide
     au lieu d'un 404. Les pages de ville l'ont quitté avec les 34 879
     communes — 8 × 34 879 rendus au build — et répondent 404 d'elles-mêmes
     hors du référentiel (notFound, parcours listings.servedAndIndexed). */
  assert.deepEqual(withParams, [path.join("app", "[game]", "page.tsx")]);
});

test("le serveur ne s'annonce plus", () => {
  assert.equal(nextConfig.poweredByHeader, false);
});

test("les pages ne se chargent pas depuis un autre site, les images partagées si", async () => {
  /* CORP same-site sur les pages et leurs ressources ; jamais sur ce que
     Facebook, WhatsApp ou une messagerie vont chercher : l'optimiseur
     d'images, les icônes, les images de partage de tous les gabarits. */
  const rules = await nextConfig.headers();
  const corp = rules.find((rule) => rule.headers.some(({ key }) => key === "Cross-Origin-Resource-Policy"));
  assert.ok(corp, "aucune règle CORP");
  const pattern = new RegExp(`^/${corp.source.match(/^\/:path\((.+)\)$/)[1]}$`);
  for (const path of ["/", "/pokemon", "/annonces/vrac-400-cartes-pokemon-avignon-01", "/_next/static/chunks/app.js"]) {
    assert.ok(pattern.test(path), `${path} n'est pas protégé`);
  }
  for (const path of [
    "/_next/image",
    "/icon/32",
    "/apple-icon",
    "/opengraph-image",
    "/annonces/vrac-400-cartes-pokemon-avignon-01/opengraph-image/3f2a",
    "/recherches/cherche-vrac-pokemon-avignon-01/opengraph-image",
    "/pokemon/avignon/opengraph-image",
  ]) {
    assert.ok(!pattern.test(path), `${path} ne pourrait plus s'afficher ailleurs`);
  }
});

test("les icônes, dont l'adresse porte l'empreinte, se gardent en cache — celles qui existent, et elles seules", async () => {
  /* Lu comme Next lit les règles d'en-têtes. Sur tout /icon/:size, la 404
     d'une taille inconnue partait « immutable » pour un an : ajoutée un jour,
     cette taille serait restée introuvable dans chaque navigateur qui l'avait
     demandée. */
  const rules = await nextConfig.headers();
  const immutable = (path) =>
    rules.some((rule) => getPathMatch(rule.source)(path) && rule.headers.some(({ key, value }) => key === "Cache-Control" && /immutable/.test(value)));
  const { generateImageMetadata } = await import("../src/app/icon.tsx");
  const drawn = generateImageMetadata().map(({ id }) => `/icon/${id}`);
  assert.deepEqual(drawn, ICON_SIZES.map((side) => `/icon/${side}`), "l'icône ne dessine pas les tailles de lib/icon-sizes.ts");
  for (const path of [...drawn, "/apple-icon"]) assert.ok(immutable(path), `${path} n'est pas gardée en cache`);
  for (const path of ["/icon/999", "/icon/3", "/icon/320", "/icon/32/x", "/icon"]) {
    assert.ok(!immutable(path), `${path} : une 404 gardée un an`);
  }
});

test("les photos de Cloudflare, et elles seules, entrent dans la CSP et l'optimiseur", async () => {
  /* Sans configuration, rien d'extérieur n'est ouvert ; configurées, le
     domaine de diffusion entre dans img-src et l'optimiseur d'images, celui
     du téléversement dans connect-src. Le navigateur ne parle jamais à
     Supabase. next.config.ts lit la configuration au chargement : un module
     neuf. */
  const configured = { NEXT_PUBLIC_PHOTOS_URL: "https://imagedelivery.net/abc123/{key}/{variant}" };
  assert.doesNotMatch(contentSecurityPolicy("abc", policyEnvironment({})), /imagedelivery|supabase/);
  const withPhotos = contentSecurityPolicy("abc", policyEnvironment(configured));
  assert.match(withPhotos, /img-src 'self' data: blob: https:\/\/imagedelivery\.net;/);
  assert.match(withPhotos, /connect-src 'self'[^;]* https:\/\/upload\.imagedelivery\.net/);
  assert.doesNotMatch(withPhotos, /supabase/);
  process.env.NEXT_PUBLIC_PHOTOS_URL = configured.NEXT_PUBLIC_PHOTOS_URL;
  const { default: config } = await import("../next.config.ts?photos-configured");
  delete process.env.NEXT_PUBLIC_PHOTOS_URL;
  assert.ok(config.images.remotePatterns.some((pattern) => pattern.hostname === "imagedelivery.net"));
  /* Et le chargeur Cloudflare se branche avec elles : une photo privée ne
     doit jamais passer par l'optimiseur de Next, dont le cache est commun. */
  assert.equal(config.images.loader, "custom");
  assert.equal(config.images.loaderFile, "./src/lib/photo-loader.ts");
});
