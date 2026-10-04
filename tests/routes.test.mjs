import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { CITIES } from "../src/lib/cities.ts";
import { readGameParam } from "../src/lib/listing-query.ts";
import { GAME_SEGMENT, MARKET_FRAGMENT, REVIEWS_ANCHOR, ROUTE_PARAM, gameFromSegment, routes, safeReturnPath } from "../src/lib/routes.ts";
import { signInSchema } from "../src/lib/schemas/auth-form.ts";
import { GAME_IDS } from "../src/types/game.ts";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* Les adresses du site sont écrites une fois, dans src/lib/routes.ts. Il y
   en avait deux cent soixante-dix, à la main, dans quatre-vingt-dix fichiers
   — /pokemon/lots a survécu dans des liens après sa suppression. Ce test
   vérifie que chaque adresse construite mène à une page réelle, et
   qu'aucune n'est réécrite ailleurs. */

const APP = path.join(SOURCE_ROOT, "app");

/* Ce qu'un segment dynamique accepte. [game] et [city] ne prennent que les
   jeux et les communes connus : sans cette limite, toute adresse d'un ou
   deux segments passerait pour une page de jeu — c'est ce qui rend
   typedRoutes aveugle ici. */
const DYNAMIC_VALUES = {
  game: new Set(GAME_IDS.map((gameId) => GAME_SEGMENT[gameId])),
  city: new Set(CITIES.map((city) => city.slug)),
};

/* Les fichiers que Next sert à une adresse fixe, à la racine de src/app :
   le plan du site, robots.txt, les icônes, l'image de partage du site. Lus
   sur le dossier : robots.ts écrivait « ${SITE_URL}/sitemap.xml » à la main,
   et rien ne le voyait. */
const METADATA_ADDRESS = new Map([
  ["sitemap", "sitemap.xml"],
  ["robots", "robots.txt"],
  ["manifest", "manifest.webmanifest"],
  ["icon", "icon"],
  ["apple-icon", "apple-icon"],
  ["opengraph-image", "opengraph-image"],
]);
const METADATA_ROUTES = readdirSync(APP).flatMap((name) => {
  const address = /\.tsx?$/.test(name) ? METADATA_ADDRESS.get(name.replace(/\.tsx?$/, "")) : undefined;
  return address ? [address] : [];
});

/* La page que sert un chemin, comme le routeur de Next : un fichier de
   métadonnées, puis un dossier statique, un segment dynamique sinon. null
   si aucune. */
function resolvePage(href) {
  const { pathname } = new URL(href, "https://bulktcg.invalid");
  if (METADATA_ROUTES.includes(pathname.slice(1))) return pathname;
  let directory = APP;
  for (const segment of pathname.split("/").filter(Boolean).map(decodeURIComponent)) {
    const folders = readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    const exact = folders.find((folder) => folder.name === segment);
    if (exact) {
      directory = path.join(directory, exact.name);
      continue;
    }
    const dynamic = folders.find((folder) => /^\[[a-zA-Z]+\]$/.test(folder.name));
    const allowed = dynamic ? DYNAMIC_VALUES[dynamic.name.slice(1, -1)] : undefined;
    if (!dynamic || (allowed && !allowed.has(segment))) return null;
    directory = path.join(directory, dynamic.name);
  }
  /* Une page, ou un gestionnaire de route qui y mène : le lien reçu par
     e-mail passe par /connexion/confirmation avant d'arriver sur une page. */
  const answers = existsSync(path.join(directory, "page.tsx")) || existsSync(path.join(directory, "route.ts"));
  return answers ? `/${path.relative(APP, directory)}` : null;
}

/* Un exemple d'arguments pour chaque adresse à paramètres. Une adresse
   ajoutée sans exemple fait échouer le test : elle doit être vérifiée
   comme les autres. */
const SAMPLES = {
  game: [["pokemon"], ["other"]],
  gameCity: [["magic", "avignon"]],
  listingsFor: [[null], ["lorcana"]],
  listing: [["vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01"]],
  wanted: [["cherche-vrac-pokemon-300-cartes-minimum-avignon-01"]],
  profile: [["lecomptoirdukado"]],
  profileReviews: [["lecomptoirdukado"]],
  conversation: [["c-01"]],
  contactSeller: [["vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01"]],
  proposeListing: [["cherche-vrac-pokemon-300-cartes-minimum-avignon-01"]],
  depositFor: [["cherche-vrac-pokemon-300-cartes-minimum-avignon-01"]],
  editListing: [["vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01"]],
  editWanted: [["cherche-vrac-pokemon-300-cartes-minimum-avignon-01"]],
  deal: [["d-01"]],
  dealReviews: [["d-01"]],
  signInThenReturn: [["/deposer"], ["/mon-compte"]],
  signUpThenReturn: [["/deposer"], ["/mon-compte"]],
  communeSuggestions: [["avi"], ["Valence (82400)"]],
  gameEditions: [["pokemon"], ["onepiece"]],
};

test("chaque adresse du module mène à une page de src/app", () => {
  for (const [name, route] of Object.entries(routes)) {
    if (typeof route === "string") {
      assert.ok(resolvePage(route), `routes.${name} (${route}) ne mène à aucune page`);
      continue;
    }
    assert.ok(SAMPLES[name], `routes.${name} n'a pas d'exemple dans ce test`);
    for (const args of SAMPLES[name]) {
      const href = route(...args);
      assert.ok(resolvePage(href), `routes.${name}(${args.join(", ")}) → ${href} ne mène à aucune page`);
    }
  }
});

test("le résolveur refuse ce que typedRoutes aurait laissé passer", () => {
  /* Falsification du test précédent : une faute d'un ou deux segments
     n'est pas prise pour une page de jeu ou de ville. */
  for (const href of ["/deposerr", "/mon-compte/annonce", "/pokemon/atlantis", "/yugioh", "/other", "/a/x", "/annonces/x/y"]) {
    assert.equal(resolvePage(href), null, `${href} passe pour une page`);
  }
  assert.equal(resolvePage("/pokemon/avignon#ventes"), "/[game]/[city]");
});

test("un segment dynamique ne sort jamais du sien, et les paramètres s'encodent", () => {
  assert.equal(routes.listing("a/../../mon-compte"), "/annonces/a%2F..%2F..%2Fmon-compte");
  assert.equal(routes.profile("jo?x=1"), "/profil/jo%3Fx%3D1");
  assert.equal(routes.contactSeller("vrac & co"), `/messages/nouveau?${ROUTE_PARAM.aboutListing}=vrac+%26+co`);
  assert.equal(routes.dealReviews("d-01"), `/mon-compte/transactions/d-01#${REVIEWS_ANCHOR}`);
  /* Le retour par défaut ne s'écrit pas. */
  assert.equal(routes.signInThenReturn(routes.account), routes.signIn);
  assert.equal(routes.signInThenReturn("/deposer?pour=x"), "/connexion?suivant=%2Fdeposer%3Fpour%3Dx");
  assert.deepEqual(Object.values(MARKET_FRAGMENT), ["ventes", "recherches"]);
});

test("le chemin de retour après connexion ne mène jamais hors du site", () => {
  /* Une redirection ouverte : « ?suivant=//site-piege.example » renverrait
     l'utilisateur, fraîchement connecté et confiant, sur une page
     d'hameçonnage. */
  const hostile = [
    "//site-piege.example",
    "/\\site-piege.example",
    "https://site-piege.example/connexion",
    "javascript:alert(1)",
    "site-piege.example",
    " /deposer",
    "/deposer\u0000",
    "/\tsite-piege.example",
    `/${"a".repeat(600)}`,
    "",
    undefined,
    ["/deposer"],
  ];
  for (const value of hostile) assert.equal(safeReturnPath(value), routes.account, `« ${String(value)} » est accepté`);
  /* Revenir sur la connexion tournerait en rond. */
  assert.equal(safeReturnPath("/connexion?suivant=/deposer"), routes.account);
  for (const value of ["/deposer", "/deposer?pour=cherche-vrac", "/annonces/lot-01#photos", "/mon-compte/annonces?etape=reserve"]) {
    assert.equal(safeReturnPath(value), value);
  }
  /* Le schéma de connexion le filtre à l'arrivée : un formulaire se trafique. */
  const parsed = signInSchema.parse({ email: "a@b.fr", password: "x", returnTo: "//site-piege.example" });
  assert.equal(parsed.returnTo, routes.account);
});

test("un chemin de retour se juge une fois normalisé : « . » et « .. » ne fabriquent pas une autre adresse", () => {
  /* « /..//site-piege.example » commence par une seule barre, mais devient
     « //site-piege.example » une fois les « .. » résolus — une adresse
     relative au protocole, qui mène hors du site. Le premier contrôle ne
     voyait que la saisie. */
  for (const value of ["/..//site-piege.example", "/.//site-piege.example", "/a/..//site-piege.example", "/a/b/../..//site-piege.example/p?q=1", "/%2e%2e//site-piege.example"]) {
    const returned = safeReturnPath(value);
    assert.equal(returned, routes.account, `« ${value} » rend « ${returned} »`);
  }
  /* Les points ordinaires se résolvent, et le chemin reste celui du site. */
  assert.equal(safeReturnPath("/./deposer"), "/deposer");
  assert.equal(safeReturnPath("/mon-compte/../deposer?pour=x"), "/deposer?pour=x");
  assert.equal(safeReturnPath("/a/../connexion"), routes.account);
});

/* Une adresse du site écrite telle quelle : la page d'un dossier de src/app,
   celle d'un jeu, ou une ancienne adresse qui redirige (/a/, /r/, /p/,
   /onepiece). Les dossiers se lisent sur le site lui-même : la liste écrite
   à la main oubliait /profil et les jeux en mots séparés. */
const ROUTE_FOLDERS = readdirSync(APP, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[a-z0-9-]+$/.test(entry.name))
  .filter((entry) => collectFiles(path.join(APP, entry.name), /^page\.tsx$/).length > 0)
  .map((entry) => entry.name);
const PREFIXES = new Set([...ROUTE_FOLDERS, ...METADATA_ROUTES, ...GAME_IDS.map((gameId) => GAME_SEGMENT[gameId]), ...GAME_IDS, "a", "r", "p"]);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const HAND_WRITTEN = new RegExp(`^/(${[...PREFIXES].map(escapeRegExp).join("|")})(/|\\?|#|$)`);

/* Une ancre qui a sa constante — #avis, #ventes, #recherches —, en lien
   comme en cible (id). Écrite à la main, elle ne suit pas un renommage :
   le lien d'un profil et ceux d'une vente visaient « #avis » à côté de
   REVIEWS_ANCHOR. */
const ANCHORS = new Set([REVIEWS_ANCHOR, ...Object.values(MARKET_FRAGMENT)]);
const HAND_WRITTEN_ANCHOR = new RegExp(`^#(${[...ANCHORS].join("|")})$`);

/* Les textes d'un fichier qui commencent une adresse : chaînes, attributs
   JSX, et chaque morceau d'un gabarit — sa tête, et ce qui suit chaque
   ${…}. « `${SITE_URL}/a/${slug}` » ne commence une adresse qu'après sa
   première substitution : ne lire que la tête laissait passer les liens
   absolus, ceux qu'on copie et qu'on colle ailleurs. Les commentaires n'en
   font pas partie. */
function routeLikeStrings(file, text = readFileSync(file, "utf8")) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found = [];
  const report = (node, piece) => found.push(`${path.relative(SOURCE_ROOT, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} « ${piece} »`);
  /* Les noms qui tiennent une adresse du module : « const gamePath =
     routes.game(gameId) ». */
  const routeNames = new Set();
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer?.getText().startsWith("routes.")) routeNames.add(node.name.text);
    ts.forEachChild(node, collect);
  };
  collect(source);
  const holdsRoute = (expression) => expression.getText().startsWith("routes.") || (ts.isIdentifier(expression) && routeNames.has(expression.text));
  const visit = (node) => {
    const pieces = [];
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) pieces.push(node.text);
    else if (ts.isTemplateExpression(node)) {
      pieces.push(node.head.text, ...node.templateSpans.map((span) => span.literal.text));
      /* Un segment collé à une adresse du module : la page d'une commune
         bâtie sur celle de son jeu, quand routes.gameCity existe. Un motif
         de robots.txt (« /*? ») n'est pas une adresse. */
      for (const span of node.templateSpans) {
        if (holdsRoute(span.expression) && /^\/(?!\*)/.test(span.literal.text)) report(node, `\${${span.expression.getText()}}${span.literal.text}`);
      }
    }
    if (ts.isJsxAttribute(node) && node.name.getText() === "id" && node.initializer && ts.isStringLiteral(node.initializer) && ANCHORS.has(node.initializer.text)) {
      report(node, `id="${node.initializer.text}"`);
    }
    for (const piece of pieces.filter((candidate) => HAND_WRITTEN.test(candidate) || HAND_WRITTEN_ANCHOR.test(candidate))) report(node, piece);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

test("aucune adresse du site n'est écrite à la main hors de lib/routes.ts", () => {
  const files = collectFiles(SOURCE_ROOT, /\.tsx?$/).filter((file) => path.relative(SOURCE_ROOT, file) !== path.join("lib", "routes.ts"));
  assert.deepEqual(files.flatMap((file) => routeLikeStrings(file)), []);
});

/* Les appels à routes.gameCity dont la commune est tirée d'un nom :
   « routes.gameCity(gameId, slugify(listing.city)) ». */
function communePathsFromNames(file, text = readFileSync(file, "utf8")) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText() === "routes.gameCity" && node.arguments[1]?.getText().includes("slugify(")) {
      found.push(`${path.relative(SOURCE_ROOT, file)}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} « ${node.getText()} »`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

test("aucune page de commune ne se retrouve par le seul nom de la commune", () => {
  /* L'adresse d'une commune sur neuf n'est pas son nom : « valence-82 »,
     « apremont-01 ». Le fil d'Ariane d'une fiche, ses données structurées et
     la revalidation la tiraient du nom, et menaient à un homonyme ou à une
     404 — invisible sur la démonstration, dont les 112 communes portent leur
     nom nu. Le couple commune et code postal la retrouve (communePagePath). */
  const files = collectFiles(SOURCE_ROOT, /\.tsx?$/);
  assert.deepEqual(files.flatMap((file) => communePathsFromNames(file)), []);
  assert.equal(communePathsFromNames("sonde.tsx", "const city = routes.gameCity(gameId, slugify(listing.city));").length, 1, "le détecteur ne voit rien");
  assert.deepEqual(communePathsFromNames("sonde.tsx", "const city = routes.gameCity(gameId, commune.slug);"), []);
});

test("le détecteur voit une adresse écrite à la main", () => {
  /* Falsification : sans elle, un détecteur cassé passerait le test
     précédent sans rien trouver. */
  const probe = path.join(SOURCE_ROOT, "lib", "routes.ts");
  assert.ok(routeLikeStrings(probe).length > 10, "le détecteur ne voit pas les adresses du module lui-même");
  /* Les liens absolus qu'on partage : le vendeur copiait /a/…, qui ne
     répond plus que par une redirection. */
  const written = [
    "const share = `${SITE_URL}/a/${listing.slug}`;",
    "const share = `${SITE_URL}/recherches/${wanted.slug}?page=2`;",
    'const profile = "/profil/lecomptoirdukado";',
    "const game = `${origin}/one-piece?etat=NM`;",
    'const link = <a href="/autres-jeux">Autres jeux</a>;',
    /* Un fichier de métadonnées, une page bâtie sur une autre, une ancre. */
    "const sitemap = `${SITE_URL}/sitemap.xml`;",
    "const city = `${routes.game(gameId)}/${slugify(city)}`;",
    "const gamePath = routes.game(gameId);\nconst city = `${gamePath}/${slugify(city)}`;",
    'const link = <a href="#avis">Détail de la note</a>;',
    "const review = `${routes.deal(dealId)}#avis`;",
    'const section = <section id="avis" />;',
  ];
  for (const line of written) {
    assert.equal(routeLikeStrings("sonde.tsx", line).length, 1, `le détecteur ne voit pas : ${line}`);
  }
  const allowed = [
    "const share = `${SITE_URL}${routes.listing(listing.slug)}`;",
    "const label = `${count} annonces`;",
    "const image = `/_next/image?url=${url}`;",
    "const city = routes.gameCity(gameId, slugify(city));",
    "const tab = `${routes.game(gameId)}#${MARKET_FRAGMENT.buy}`;",
    "const coordinates = `${city.latitude}/${city.longitude}`;",
    'const title = <h2 id="avis-titre">Avis</h2>;',
    "const filtered = `${routes.listings}?${params}`;",
    "const robotsRule = `${routes.game(gameId)}/*?`;",
  ];
  for (const line of allowed) assert.deepEqual(routeLikeStrings("sonde.tsx", line), [], `faux positif : ${line}`);
});

test("chaque jeu a une adresse lisible, unique, qui ne masque aucune route", () => {
  /* /one-piece et non /onepiece, /autres-jeux et non /other : l'adresse
     d'un jeu se lit comme son nom. */
  const topLevel = new Set(readdirSync(APP, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  const segments = GAME_IDS.map((gameId) => GAME_SEGMENT[gameId]);
  assert.equal(new Set(segments).size, segments.length, "deux jeux partagent une adresse");
  for (const gameId of GAME_IDS) {
    const value = GAME_SEGMENT[gameId];
    assert.match(value, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${gameId} : « ${value} »`);
    assert.ok(!topLevel.has(value), `${value} masquerait le dossier src/app/${value}`);
    assert.equal(gameFromSegment(value), gameId);
  }
  assert.deepEqual([GAME_SEGMENT.onepiece, GAME_SEGMENT.yugioh, GAME_SEGMENT.other], ["one-piece", "yu-gi-oh", "autres-jeux"]);
  /* Le chemin est strict — l'ancien redirige —, mais un ?jeu= partagé
     avant le changement garde son sens. */
  assert.equal(gameFromSegment("onepiece"), null);
  assert.equal(readGameParam({ jeu: "onepiece" }), "onepiece");
  assert.equal(readGameParam({ jeu: "one-piece" }), "onepiece");
  assert.equal(readGameParam({ jeu: "belote" }), undefined);
});

test("les anciennes adresses redirigent en permanence vers une page réelle", async () => {
  /* Un lien déjà collé dans un groupe ne casse pas : /a/, /r/ et /p/
     suivent vers leurs mots, et un jeu vers son nouveau segment. */
  const { default: config } = await import("../next.config.ts");
  const redirects = await config.redirects();
  const bySource = new Map(redirects.map((redirect) => [redirect.source, redirect]));
  const expected = {
    "/a/:path*": "/annonces/:path*",
    "/r/:path*": "/recherches/:path*",
    "/p/:path*": "/profil/:path*",
    "/onepiece/:path*": "/one-piece/:path*",
    "/other": "/autres-jeux",
  };
  for (const [source, destination] of Object.entries(expected)) {
    assert.equal(bySource.get(source)?.destination, destination, `${source} ne redirige pas vers ${destination}`);
  }
  for (const redirect of redirects) {
    assert.equal(redirect.permanent, true, `${redirect.source} n'est pas permanente`);
    const sample = redirect.destination.replace(":path*", "avignon").replace(":game", "pokemon");
    assert.ok(resolvePage(sample), `${redirect.source} → ${redirect.destination} ne mène à aucune page`);
  }
});
