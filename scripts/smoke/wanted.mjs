/* Les demandes de recherche : la liste publique, le filtre sur le rayon de
   l'acheteur, le dépôt d'une demande, et son panneau « Affiner ». */
import assert from "node:assert/strict";
import { BASE, check, page } from "./harness.mjs";
import { VISIBLE_CARDS, VISIBLE_PANEL, announcedCount, choose, chooseAll, pickCity, robotsOf, selectTab, visit, waitForSelectedTab } from "./helpers.mjs";

export async function publicList() {
  await check("la liste des recherches n'expose que les demandes ouvertes", async () => {
    await visit(page, "/recherches");
    const statuses = await page
      .locator("article.card")
      .evaluateAll((cards) => cards.map((card) => card.textContent));
    assert.ok(statuses.length > 0);
    assert.equal(
      statuses.some((text) => text.includes("Abandonnée") || text.includes("Trouvé")),
      false,
      "une demande close ou trouvée apparaît dans la liste publique",
    );
  });

  await check("une demande de recherche ne ressemble pas à une annonce", async () => {
    /* Pas de photo, pas de prix ferme : un acheteur qui parcourt les lots doit
       voir au premier coup d'œil que ceci n'en est pas un. */
    assert.equal(await page.locator("article.card img").count(), 0);
    await page.getByText("Budget").first().waitFor();
  });

  await check("le filtre par jeu s'applique aux recherches", async () => {
    const before = await page.locator("article.card").count();
    await page.getByRole("navigation", { name: "Filtrer par jeu" }).getByRole("link", { name: /^Pokémon/ }).click();
    await page.waitForURL(/jeu=pokemon/);
    const after = await page.locator("article.card").count();
    assert.ok(after > 0 && after < before, `filtre sans effet (${before} → ${after})`);
  });

  await check("la page d'une recherche montre les lots qui y répondent déjà", async () => {
    await visit(page, "/recherches");
    await page.locator("article.card h3 a").first().click();
    await page.waitForURL(/\/recherches\/[^/?#]+$/);

    await page.getByRole("heading", { name: "Ce qui correspond" }).waitFor();
    const robots = await robotsOf(page);
    assert.match(robots, /noindex/, "une demande de recherche ne doit pas être indexée");

    /* Soit des lots, soit un état vide nommé : jamais une section muette. */
    const hasListings = (await page.locator("article.card").count()) > 0;
    if (!hasListings) await page.getByText("Rien ne correspond aujourd'hui").waitFor();
  });
}

export async function cityAndDeposit() {
  await check("la ville filtre les recherches sur leur rayon, pas sur la commune", async () => {
    await visit(page, "/recherches");
    const before = await page.locator("article.card").count();

    await page.locator("#recherche-depuis").fill("Avignon");
    await page.getByRole("button", { name: /Qui vient jusqu/ }).click();
    await page.waitForURL(/ville=Avignon/);

    const after = await page.locator("article.card").count();
    assert.ok(after > 0, "aucune demande n'atteint Avignon");
    assert.ok(after < before, `le filtre n'a rien réduit (${before} → ${after})`);

    /* Le filtre ne se limite pas à la commune : au moins une demande retenue
       part d'une autre ville et accepte de faire le trajet. */
    const cities = await page
      .locator("article.card")
      .evaluateAll((cards) => cards.map((card) => card.textContent));
    assert.ok(
      cities.some((label) => !label.includes("Avignon")),
      "seules les demandes intra-muros sont retenues",
    );
  });

  await check("sans ville, aucune distance n'est affichée sur une demande", async () => {
    await visit(page, "/recherches");
    const labels = await page
      .locator("article.card")
      .evaluateAll((cards) => cards.map((card) => card.textContent));
    assert.equal(
      labels.some((label) => label.includes("de vous")),
      false,
      "une distance est affichée sans point d'origine",
    );
  });

  await check("déposer une recherche montre les lots qui y répondent déjà", async () => {
    await visit(page, "/deposer/recherche");
    await page.locator("#title").fill("Cherche vrac Pokémon pour le club");
    await page.locator("#description").fill(
      "Je récupère du volume pour dépanner des débutants au club, peu importe l'état des cartes.",
    );
    await page.locator("#city").fill("Avignon");
    await page.locator("#maxPriceEuros").fill("80");

    await chooseAll(page, [["#gameId", "Pokémon"], ["#maxDistanceKm", "Jusqu'à 50 km"]]);

    await page.getByRole("button", { name: /Publier la recherche/ }).click();
    await page.getByText(/correspondent déjà à ce que vous cherchez/).waitFor();
  });

  await check("déposer une recherche n'envoie au navigateur que ce que le croisement lit", async () => {
    /* Audit de sécurité, M2 : ces pages sérialisaient deux cents annonces
       complètes dans un composant client — pour qui chaque lot est réservé,
       combien de vues il a eues. Le croisement n'a besoin que du jeu, du
       format, du prix, de la position et de quoi montrer le lot. */
    const paths = ["/deposer/recherche", "/mon-compte/recherches/cherche-vrac-pokemon-300-cartes-minimum-avignon-01/modifier"];
    for (const path of paths) {
      const html = await (await fetch(`${BASE}${path}`)).text();
      for (const field of ["reservedForId", "viewCount"]) {
        assert.ok(!html.includes(field), `${path} envoie ${field} au navigateur`);
      }
    }
  });

  await check("déposer une recherche : l'aperçu suit la saisie et compte ce qui répond déjà", async () => {
    await visit(page, "/deposer/recherche");
    const preview = page.locator("section", { hasText: "Aperçu de votre demande" });
    await preview.locator("article").waitFor();
    await page.locator("#title").fill("Cherche vrac Pokémon pour le club");
    await preview.getByText("Cherche vrac Pokémon pour le club").waitFor();
    await choose(page, "#gameId", "Pokémon");
    await pickCity(page, "84000", /Avignon/);
    await preview.getByText(/lots? correspond(ent)? déjà/).waitFor();
  });
}

export async function filters() {
  await check("le côté recherches a son panneau « Affiner », et filtrer y reste sans toucher aux ventes", async () => {
    /* Demandé tel quel : le même gabarit que les ventes, seuls les vignettes
       et les critères changent. Les deux onglets vivent dans la même URL : le
       fragment doit survivre au filtre, et le compte des ventes ne pas bouger. */
    await visit(page, "/annonces#recherches");
    await waitForSelectedTab(page, "Recherches");
    const panel = page.locator(VISIBLE_PANEL);
    await panel.getByRole("heading", { name: "Affiner" }).waitFor();
    const sellTab = page.getByRole("tab", { name: /^Ventes/ });
    const sellBefore = await announcedCount(sellTab);
    const before = await panel.locator("article.card").count();

    await panel.getByRole("group", { name: "Acheteur" }).getByRole("button", { name: "Boutiques pro" }).click();
    await page.waitForURL((url) => url.searchParams.get("acheteur") === "pro" && url.hash === "#recherches");
    await waitForSelectedTab(page, "Recherches");
    const after = await page.locator(VISIBLE_CARDS).count();
    assert.ok(after > 0 && after < before, `filtre sans effet (${before} → ${after})`);
    assert.equal(await announcedCount(sellTab), sellBefore, "le filtre des demandes a changé le compte des ventes");
    const buyCount = await announcedCount(page.getByRole("tab", { name: /^Recherches/ }));
    assert.equal(buyCount, after, "le compteur de l'onglet ne suit pas le filtre");

    /* « Tout effacer » n'efface que les critères des demandes. */
    await visit(page, "/annonces?type=binder&acheteur=pro#recherches");
    /* Le serveur rend toujours l'onglet « Ventes » : le fragment n'existe que
       dans le navigateur. Sans attendre la bascule, le panneau visible était
       encore celui des ventes — une course perdue à chaque fois depuis que
       les pages se rendent à la requête. */
    await waitForSelectedTab(page, "Recherches");
    await page.locator(VISIBLE_PANEL).getByRole("button", { name: "Tout effacer" }).click();
    await page.waitForURL((url) => !url.searchParams.has("acheteur"));
    assert.equal(new URL(page.url()).searchParams.get("type"), "binder", "« Tout effacer » a vidé les filtres des ventes");
  });

  await check("le filtre de budget dit combien de demandes il écarte faute de budget", async () => {
    await visit(page, "/recherches?budget-min=50");
    await page.getByText(/sans budget annoncé (est écartée|sont écartées)/).first().waitFor();
  });

  await check("la bascule du hub renvoie vers la page du jeu, compteur à l'appui", async () => {
    /* /recherches reste le hub tous jeux confondus ; sa bascule mène à la page
       du jeu, onglet ventes. Le compteur doit correspondre à ce qu'on y
       trouvera, sinon il ment. */
    await visit(page, "/recherches?jeu=magic");
    const nav = page.getByRole("navigation", { name: /Ventes ou recherches/ });
    const sell = nav.getByRole("link", { name: /^Ventes/ });
    const announced = await announcedCount(sell);

    await sell.click();
    await page.waitForURL(/\/magic#ventes$/);
    await waitForSelectedTab(page, "Ventes");
    const shown = await page.getByRole("tabpanel").locator("article.card").count();
    assert.equal(shown, announced, `annoncé ${announced}, affiché ${shown}`);
  });

  await check("le retour arrière défait un filtre posé après avoir basculé sur les recherches", async () => {
    /* Règle 6, côté demandes. La bascule écrivait son fragment par
       location.assign : une entrée d'historique sans état, que le routeur de
       Next ignore au retour. Le filtre quittait l'adresse et restait appliqué
       à la liste. Arriver par un lien en #recherches ne le montrait pas : il
       faut basculer à la main, puis filtrer. */
    await visit(page, "/annonces");
    await selectTab(page, "Recherches");
    const before = await page.locator(VISIBLE_CARDS).count();
    const chip = () => page.locator(VISIBLE_PANEL).getByRole("group", { name: "Acheteur" }).getByRole("button", { name: "Boutiques pro" });

    await chip().click();
    await page.waitForURL((url) => url.searchParams.get("acheteur") === "pro" && url.hash === "#recherches");
    await page.waitForFunction(([cards, count]) => document.querySelectorAll(cards).length < count, [VISIBLE_CARDS, before]);

    await page.goBack();
    await page.waitForURL((url) => !url.searchParams.has("acheteur") && url.hash === "#recherches");
    await waitForSelectedTab(page, "Recherches");
    await page
      .waitForFunction(([cards, count]) => document.querySelectorAll(cards).length === count, [VISIBLE_CARDS, before], { timeout: 10_000 })
      .catch(() => assert.fail(`l'adresse a perdu le filtre, la liste le garde (${before} demandes attendues)`));
    assert.equal(await chip().getAttribute("aria-pressed"), "false", "le filtre défait reste coché");

    /* Un retour de plus défait la bascule elle-même. */
    await page.goBack();
    await waitForSelectedTab(page, "Ventes");
  });
}
