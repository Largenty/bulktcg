import { chromium } from "playwright";

const BASE = "http://localhost:3117";
const OUT = process.argv[2];

const ROUTES = [
  ["accueil", "/"],
  ["annonces", "/annonces"],
  ["annonce", "/annonces/vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01"],
  ["annonce-vendue", "/annonces/carton-6-kg-de-vrac-pokemon-toutes-series-orange-02"],
  ["deposer", "/deposer"],
  ["deposer-recherche", "/deposer/recherche"],
  ["recherches", "/recherches"],
  ["recherches-depuis-avignon", "/recherches?ville=Avignon"],
  ["recherche", "/recherches/cherche-vrac-pokemon-300-cartes-minimum-avignon-01"],
  ["mon-compte", "/mon-compte"],
  ["mon-compte-annonces", "/mon-compte/annonces"],
  ["mon-compte-recherches", "/mon-compte/recherches"],
  ["mon-compte-profil", "/mon-compte/profil"],
  ["mon-compte-parametres", "/mon-compte/parametres"],
  ["mon-compte-modifier", "/mon-compte/annonces/vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01/modifier"],
  ["messages", "/messages"],
  ["conversation", "/messages/c-01"],
  ["profil-veteran", "/profil/lecomptoirdukado"],
  ["profil-neuf", "/profil/lemasqueetlaplume"],
  ["seo-ville-pleine", "/pokemon/avignon"],
  ["seo-ville-vide", "/pokemon/lille"],
  ["annonces-jeu", "/magic"],
  ["securite", "/securite"],
  ["connexion", "/connexion"],
  ["introuvable", "/cette-page-nexiste-pas"],
];

const browser = await chromium.launch();

for (const [viewportName, width, height] of [
  ["desktop", 1440, 1000],
  ["mobile", 390, 844],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    locale: "fr-FR",
  });
  const page = await context.newPage();

  for (const [name, route] of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${OUT}/${viewportName}-${name}.png`,
      fullPage: viewportName === "desktop",
    });
  }
  await context.close();
}

await browser.close();
console.log("captures terminées");
