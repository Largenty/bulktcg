/* La liste des annonces : filtres, pagination, recherche autour d'une ville,
   bandeau des vignettes, pages de jeu et de ville, et ce qui en est indexé. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BASE, check, context, page } from "./harness.mjs";
import { VISIBLE_CARDS, VISIBLE_PANEL, announcedCount, choose, robotsOf, visit } from "./helpers.mjs";

/** @import { Page } from "playwright" */

/* Les valeurs du bandeau des vignettes qui débordent de leur case, avec leur
   largeur mesurée contre celle qui leur est offerte. */
/** @param {Page} tab */
function clippedBandValues(tab) {
  return tab.locator("article.card dd").evaluateAll((nodes) =>
    nodes
      .filter((node) => node.scrollWidth > node.clientWidth + 1)
      .map((node) => `${node.textContent} (${node.scrollWidth} > ${node.clientWidth})`),
  );
}

export async function searchFiltersAndPagination() {
  await check("l'intercalaire d'un jeu mène à sa page et réduit la grille", async () => {
    await visit(page, "/annonces");
    const before = await page.locator("article.card").count();
    const tabs = page.getByRole("navigation", { name: "Filtrer par jeu" });
    await tabs.getByRole("link", { name: /^Magic/ }).click();
    await page.waitForURL(/\/magic$/);
    const after = await page.locator("article.card").count();
    assert.ok(after > 0, "la grille est vide après filtrage");
    assert.ok(after < before, `le filtre n'a rien réduit (${before} → ${after})`);
    assert.equal(await tabs.getByRole("link", { name: /^Magic/ }).getAttribute("aria-current"), "page");
  });

  await check("le retour arrière du navigateur rétablit la recherche précédente", async () => {
    await page.goBack();
    await page.waitForURL(/\/annonces$/);
    const all = page.getByRole("navigation", { name: "Filtrer par jeu" }).getByRole("link", { name: /Tous les jeux/ });
    assert.equal(await all.getAttribute("aria-current"), "page");
  });

  await check("la pagination navigue et marque la page courante", async () => {
    await visit(page, "/annonces");
    const pagination = page.getByRole("navigation", { name: "Pagination" });
    assert.equal(await pagination.count(), 1, "la pagination ne s'affiche pas");
    const firstTitle = await page.locator("article.card h3").first().textContent();

    await pagination.getByRole("link", { name: "Suivante" }).click();
    await page.waitForURL(/page=2/);
    assert.equal(
      await page.getByRole("link", { name: "Page 2" }).getAttribute("aria-current"),
      "page",
    );
    const secondTitle = await page.locator("article.card h3").first().textContent();
    assert.notEqual(firstTitle, secondTitle, "la page 2 montre les mêmes annonces que la page 1");
  });

  await check("la pagination conserve les filtres actifs", async () => {
    await visit(page, "/annonces?prix-min=1&page=2");
    const links = await page
      .getByRole("navigation", { name: "Pagination" })
      .getByRole("link")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
    assert.ok(links.length > 0);
    assert.ok(
      links.every((href) => href.includes("prix-min=1")),
      `un lien de pagination a perdu le filtre : ${links.join(" ")}`,
    );
  });

  await check("une page au-delà du total est un état à part entière, avec une action", async () => {
    await visit(page, "/annonces?page=99");
    await page.getByText("Cette page n'existe pas").first().waitFor();
    await page.getByText("Revenir à la première page").first().waitFor();
  });

  await check("le tri par distance n'apparaît qu'avec une ville, et ordonne vraiment", async () => {
    await visit(page, "/annonces");
    await page.getByText(/Indiquez une ville dans la recherche/).first().waitFor();
    assert.equal(await page.locator("#filtre-rayon").count(), 0);

    await visit(page, "/annonces?ville=Avignon&tri=distance");
    assert.equal(await page.locator("#filtre-rayon").count(), 1);
    const firstCity = await page.locator("article.card p.mono").first().textContent();
    assert.match(firstCity, /Avignon/);
    /* Le nombre et « km » sont liés par une insécable (formatDistance). */
    assert.match(firstCity, /à (moins d'1|\d[\d,]*)\u00a0km/);
  });

  await check("chercher une ville ramène ce qui se vend autour, pas seulement dedans", async () => {
    await visit(page, "/annonces?ville=Avignon");
    const cities = await page
      .locator("article.card p.mono")
      .evaluateAll((nodes) => nodes.map((node) => node.textContent));
    assert.ok(cities.length > 2, `seulement ${cities.length} résultats autour d'Avignon`);
    assert.ok(
      cities.some((city) => !city.includes("Avignon")),
      "la recherche s'est limitée à la commune d'Avignon",
    );
    await page.getByText(/à moins de 50 km d'Avignon/).first().waitFor();
  });

  await check("le rayon réduit réellement le nombre de résultats", async () => {
    await visit(page, "/annonces?ville=Avignon&rayon=100");
    const wide = await page.locator("article.card").count();
    await visit(page, "/annonces?ville=Avignon&rayon=10");
    const narrow = await page.locator("article.card").count();
    assert.ok(narrow > 0, "le rayon de 10 km ne laisse rien");
    assert.ok(narrow < wide, `le rayon n'a rien exclu (${wide} → ${narrow})`);
  });
}

export async function cardBand() {
  await check("aucune valeur du bandeau de vignette n'est coupée à l'écran", async () => {
    /* Le DOM contient toujours le texte complet : seule une mesure de
       débordement révèle une troncature CSS. Une capture ne suffit pas non
       plus, elle ne couvre qu'un jeu de données. */
    await visit(page, "/annonces");
    assert.deepEqual(await clippedBandValues(page), []);
  });

  await check("le bandeau tient aussi sur les annonces aux libellés les plus longs", async () => {
    for (const slug of [
      "lot-3-boosters-scelles-op-09-et-un-playmat-monteux-08",
      "classeur-one-piece-complet-op-01-a-op-04-l-isle-sur-la-sorgue-14",
      "carton-8-kg-de-vrac-magic-tri-entierement-a-faire-valence-13",
    ]) {
      await visit(page, `/annonces/${slug}`);
      assert.deepEqual(await clippedBandValues(page), [], `troncature sur la page ${slug}`);
    }
  });
}

export async function customSelect() {
  await check("la liste déroulante maison se pilote entièrement au clavier", async () => {
    await visit(page, "/annonces");
    const combobox = page.locator("#filtre-serie");
    await combobox.focus();
    assert.equal(await combobox.getAttribute("aria-expanded"), "false");
    await page.keyboard.press("Enter");
    assert.equal(await combobox.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.waitForURL(/serie=/);
    assert.equal(await combobox.getAttribute("aria-expanded"), "false");
    assert.notEqual((await combobox.textContent()).trim(), "Toutes les séries");
  });

  await check("Échap referme la liste sans rien sélectionner", async () => {
    await visit(page, "/annonces");
    const combobox = page.locator("#filtre-produit");
    const before = (await combobox.textContent()).trim();
    await combobox.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    assert.equal(await combobox.getAttribute("aria-expanded"), "false");
    assert.equal((await combobox.textContent()).trim(), before);
  });
}

export async function servedAndIndexed() {
  await check("l'annonce vendue reste consultable et annoncée comme vendue", async () => {
    const response = await visit(page, "/annonces/carton-6-kg-de-vrac-pokemon-toutes-series-orange-02");
    assert.equal(response.status(), 200);
    await page.getByText("Ce lot est parti").first().waitFor();
    assert.equal(await page.getByRole("button", { name: "Contacter le vendeur" }).count(), 0);
  });

  await check("une ville SEO sans annonce reste servie, en noindex, avec une action", async () => {
    const response = await visit(page, "/pokemon/lille");
    assert.equal(response.status(), 200);
    const robots = await robotsOf(page);
    assert.match(robots, /noindex/);
    await page.getByText("Déposer la première").first().waitFor();
  });

  await check("une ville SEO avec des annonces est indexable", async () => {
    await visit(page, "/pokemon/avignon");
    const robots = await robotsOf(page);
    assert.ok(!/noindex/.test(robots ?? ""), `robots vaut « ${robots} »`);
  });

  await check("toute commune a sa page, un homonyme y porte son département, une adresse inconnue répond 404", async () => {
    /* Un village de 115 habitants : servi, hors de l'index tant qu'il n'a
       aucun lot. */
    const village = await visit(page, "/pokemon/ambleon");
    assert.equal(village.status(), 200);
    assert.match(await robotsOf(page), /noindex/);
    assert.match(await page.locator("h1").first().textContent(), /à Ambléon/);
    /* Trois communes s'appellent Valence : celle du Tarn-et-Garonne a sa
       page, et les lots de la Drôme n'y montent pas. */
    const homonym = await visit(page, "/magic/valence-82");
    assert.equal(homonym.status(), 200);
    assert.match(await page.locator("h1").first().textContent(), /Valence \(Tarn-et-Garonne\)/);
    assert.match(await robotsOf(page), /noindex/);
    assert.equal((await visit(page, "/pokemon/atlantide")).status(), 404);
  });

  await check("les 112 adresses de ville d'origine répondent comme avant, sur leur propre adresse", async () => {
    /* Les communes de la migration 2, qui avaient leur page avant le
       référentiel complet : aucune n'a changé d'adresse. */
    const referentials = readFileSync(new URL("../../supabase/migrations/20260929120100_referentials.sql", import.meta.url), "utf8");
    /* Un nom à apostrophe s'écrit doublée en SQL : « L''Isle-sur-la-Sorgue ». */
    const slugs = [...referentials.matchAll(/^ {2}\('([a-z0-9-]+)', '(?:[^']|'')+', '\d{5}'/gm)].map((match) => match[1]);
    assert.equal(slugs.length, 112);
    const failures = [];
    for (const slug of slugs) {
      const response = await fetch(`${BASE}/pokemon/${slug}`);
      const html = await response.text();
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? "";
      if (response.status !== 200 || !canonical.endsWith(`/pokemon/${slug}`)) failures.push(`${slug} : ${response.status} ${canonical}`);
    }
    assert.deepEqual(failures, []);
  });
}

export async function otherGame() {
  await check("« Autre » a son intercalaire et sa page, et le dépôt n'y propose pas de séries", async () => {
    await visit(page, "/autres-jeux");
    assert.match(await page.locator("h1").first().textContent(), /Cartes d.autres jeux d.occasion/);
    assert.equal(await page.locator("#filtre-serie").count(), 0, "un filtre « Série » vide est proposé");
    const types = await page.locator("main article .lot-type").allTextContents();
    assert.ok(types.length > 0, "la page « Autre » ne montre aucun lot");
    assert.ok(types.every((text) => /Autre/.test(text)), `un lot d'un autre jeu s'est glissé : ${types.join(" | ")}`);
    /* La tranche signe le site avec les jeux nommés : « Autre » n'y entre pas. */
    assert.equal(await page.locator(".tranche").first().locator("span").count(), 7);

    await visit(page, "/deposer");
    await choose(page, "#gameId", "Autre");
    await page.getByText(/Pas de liste de séries pour/).waitFor();
    assert.equal(await page.locator('input[name="editions"]').count(), 0, "des séries à cocher pour « Autre »");
  });
}

export async function gamePageFilters() {
  await check("la page d'un jeu porte le panneau « Affiner » et filtre pour de vrai", async () => {
    await visit(page, "/pokemon");
    const before = await page.getByRole("tabpanel").locator("article.card").count();

    /* Le format se choisit en pastilles : cinq valeurs visibles d'un coup. */
    await page.getByRole("group", { name: "Format du lot" }).getByRole("button", { name: "Classeur" }).click();
    await page.waitForURL(/type=binder/);

    const after = await page.getByRole("tabpanel").locator("article.card").count();
    assert.ok(after > 0, "la grille est vide après filtrage");
    assert.ok(after < before, `le filtre n'a rien réduit (${before} → ${after})`);
    /* Le filtre n'a pas quitté le jeu. */
    assert.match(page.url(), /\/pokemon\?/);
  });

  await check("le jeu de la page est imposé : « Tout effacer » ne le retire pas", async () => {
    await page.getByRole("button", { name: /Tout effacer/ }).click();
    await page.waitForURL(/\/pokemon$/);
    const cards = await page
      .getByRole("tabpanel")
      .locator("article.card")
      .evaluateAll((nodes) => nodes.map((node) => node.textContent));
    assert.ok(cards.length > 0);
    for (const card of cards) assert.match(card, /POKÉMON/i, "un lot d'un autre jeu est remonté");
  });

  await check("un jeu sélectionné borne bien la grille", async () => {
    await visit(page, "/pokemon?tri=recent");
    const cards = await page
      .getByRole("tabpanel")
      .locator("article.card")
      .evaluateAll((nodes) => nodes.map((node) => node.textContent));
    assert.ok(cards.length > 0, "la grille est vide");
    for (const card of cards) assert.match(card, /POKÉMON/i);
  });

  await check("la pagination d'une page de jeu reste sur cette page", async () => {
    await visit(page, "/pokemon?page=99");
    await page.getByText("Revenir à la première page").waitFor();
    await page.getByRole("link", { name: "Revenir à la première page" }).click();
    await page.waitForURL(/\/pokemon$/);
  });
}

export async function gamePageSearchAndIndexing() {
  await check("chercher depuis une page de jeu ne perd pas le jeu", async () => {
    await visit(page, "/pokemon");
    await page.locator("#recherche-quoi").fill("classeur");
    await page.getByRole("button", { name: "Chercher" }).click();
    await page.waitForURL(/q=classeur/);
    assert.match(page.url(), /\/pokemon\?/, "la recherche a quitté le jeu courant");
  });

  await check("l'ancienne adresse d'un jeu redirige vers sa page, filtres compris", async () => {
    /* La page d'un jeu a vécu sous /annonces?jeu=… : un lien partagé à
       l'époque doit tomber sur /magic, avec ses critères. */
    const response = await visit(page, "/annonces?jeu=magic&type=bulk");
    assert.equal(response.status(), 200);
    assert.match(page.url(), /\/magic\?type=bulk$/, `atterri sur ${page.url()}`);
    await page.getByRole("heading", { name: /Cartes Magic d'occasion/ }).waitFor();
  });

  await check("les anciennes adresses d'une lettre et des jeux redirigent en permanence", async () => {
    /* /a/, /r/ et /p/ sont devenus des mots, /onepiece, /yugioh et /other
       des noms qui se lisent : un lien collé avant le changement tombe
       au bon endroit, d'une redirection permanente, et un ?jeu= d'avant
       garde son sens. */
    const expected = {
      "/a/vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01": "/annonces/vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01",
      "/r/cherche-vrac-pokemon-300-cartes-minimum-avignon-01": "/recherches/cherche-vrac-pokemon-300-cartes-minimum-avignon-01",
      "/p/lecomptoirdukado": "/profil/lecomptoirdukado",
      "/onepiece/avignon": "/one-piece/avignon",
      "/yugioh": "/yu-gi-oh",
      "/other": "/autres-jeux",
    };
    for (const [from, to] of Object.entries(expected)) {
      const response = await fetch(`${BASE}${from}`, { redirect: "manual" });
      assert.equal(response.status, 308, `${from} répond ${response.status}`);
      assert.equal(new URL(response.headers.get("location"), BASE).pathname, to, `${from} mène ailleurs`);
      assert.equal((await fetch(`${BASE}${to}`)).status, 200, `${to} ne répond pas`);
    }
    await visit(page, "/annonces?jeu=onepiece");
    assert.match(new URL(page.url()).pathname, /^\/one-piece$/, `atterri sur ${page.url()}`);
  });

  await check("seule l'URL du jeu est indexable, pas ses combinaisons de filtres", async () => {
    /* Tri, série, prix et pagination produisent des milliers d'URL qui
       diraient toutes la même chose : elles restent servies, en noindex. */
    await visit(page, "/pokemon");
    const bare = await robotsOf(page);
    assert.ok(!/noindex/.test(bare ?? ""), `robots vaut « ${bare} » sur l'URL du jeu`);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    assert.match(canonical, /\/pokemon$/);

    await visit(page, "/pokemon?tri=price-asc");
    const filtered = await robotsOf(page);
    assert.match(filtered, /noindex/, "une combinaison de filtres est déclarée indexable");
  });

  await check("le plan de site déclare l'URL du jeu, pas l'ancienne", async () => {
    const sitemap = await (await context.request.get(`${BASE}/sitemap.xml`)).text();
    assert.match(sitemap, /\/pokemon<\/loc>/);
    assert.doesNotMatch(sitemap, /\/pokemon\/lots/, "l'ancienne URL est encore déclarée");
    assert.doesNotMatch(sitemap, /annonces\?jeu=/, "l'adresse d'avant /pokemon est encore déclarée");
  });
}

export async function searchAudit() {
  await check("« Tout effacer » vide aussi les champs de prix", async () => {
    /* Le champ gardait « 50 » alors que la liste n'en filtrait plus aucun. */
    await visit(page, "/annonces");
    await page.locator("#filtre-prix-min").fill("50");
    await page.locator("#filtre-prix-min").press("Enter");
    await page.waitForURL(/prix-min=50/);
    await page.getByRole("button", { name: "Tout effacer" }).click();
    await page.waitForURL((url) => !url.search.includes("prix-min"));
    await page.waitForFunction(() => document.querySelector("#filtre-prix-min")?.value === "");
  });

  await check("un filtre actif se retire d'un clic sur sa pastille", async () => {
    await visit(page, "/annonces?type=binder&etat=NM");
    await page.getByRole("link", { name: "Retirer le filtre Classeur" }).click();
    await page.waitForURL((url) => !url.search.includes("type=") && url.search.includes("etat=NM"));
  });

  await check("un code postal cherche autour de sa commune", async () => {
    /* « 84000 » rendait zéro résultat, et le panneau répondait
       « indiquez une ville ». */
    await visit(page, "/annonces?ville=84000");
    await page.getByText(/à moins de 50 km d'Avignon/).waitFor();
    assert.ok((await page.locator(VISIBLE_CARDS).count()) > 0);
  });

  await check("une ville inconnue ne vide pas la liste et propose des pistes", async () => {
    await visit(page, "/annonces?ville=Avigon");
    /* Les deux onglets le disent, chacun pour sa liste : on lit le visible. */
    await page.locator(VISIBLE_PANEL).getByText(/n'est pas une commune que nous connaissons/).waitFor();
    assert.ok((await page.locator(VISIBLE_CARDS).count()) > 0);
    await page.getByRole("link", { name: /Avignon \(84000\)/ }).click();
    await page.waitForURL(/ville=Avignon/);
  });

  await check("aucune préposition n'est collée à un nom qui ne la supporte pas", async () => {
    /* « à moins de 50 km d'Valence », « les 1 critères ». */
    await visit(page, "/annonces?ville=Valence");
    await page.getByText(/à moins de 50 km de Valence/).waitFor();
    const body = await page.locator("main").textContent();
    assert.doesNotMatch(body, /d'Valence|les 1 critères/);
  });

  await check("la page d'une ville montre aussi les lots à côté, et les compte", async () => {
    /* Carpentras annonçait deux ventes quand dix lots attendaient à vingt
       minutes. */
    await visit(page, "/pokemon/carpentras");
    await page.getByRole("heading", { name: /À moins de 30 km/ }).waitFor();
    const sellTab = page.getByRole("tab", { name: /^Ventes/ });
    const announced = await announcedCount(sellTab);
    const shown = await page.getByRole("tabpanel").locator("article.card").count();
    assert.equal(shown, announced, `annoncé ${announced}, affiché ${shown}`);
    const distances = await page.getByRole("tabpanel").locator("article.card p.mono").allTextContents();
    assert.ok(distances.some((line) => /à \d/.test(line)), "les lots voisins n'affichent pas leur distance");
  });
}
