/* La navigation : lien d'évitement, dépliant des jeux, onglets Ventes et
   Recherches, barre de recherche, et l'en-tête à toutes les largeurs. */
import assert from "node:assert/strict";
import { check, page } from "./harness.mjs";
import { VISIBLE_CARDS, VISIBLE_PANEL, announcedCount, selectTab, visit, waitForSelectedTab, withPage } from "./helpers.mjs";

/* Suit le lien d'évitement au clavier, où que soit le focus. */
async function followSkipLink() {
  await page.getByRole("link", { name: "Aller au contenu" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForURL((url) => url.hash === "#contenu");
}

export async function skipLink() {
  await check("le lien d'évitement apparaît à la première tabulation", async () => {
    await visit(page, "/");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    assert.equal(focused, "Aller au contenu");
  });

  await check("après le lien d'évitement, le retour arrière défait encore un filtre", async () => {
    /* Règle 6. Un lien d'ancre ajoute une entrée d'historique que le
       navigateur crée sans état, et le routeur de Next ignore le retour vers
       une entrée sans état : le filtre quittait l'adresse et restait sur la
       liste, côté ventes comme côté demandes. */
    const lists = [
      { path: "/annonces", cards: VISIBLE_CARDS, scope: VISIBLE_PANEL, group: "Format du lot", choice: "Classeur" },
      { path: "/recherches", cards: "article.card", scope: "main", group: "Acheteur", choice: "Boutiques pro" },
    ];
    for (const { path, cards, scope, group, choice } of lists) {
      await visit(page, path);
      const before = await page.locator(cards).count();
      await followSkipLink();

      await page.locator(scope).getByRole("group", { name: group }).getByRole("button", { name: choice }).click();
      await page.waitForURL((url) => url.search !== "");
      await page.waitForFunction(([selector, count]) => document.querySelectorAll(selector).length < count, [cards, before]);

      await page.goBack();
      await page.waitForURL((url) => url.search === "" && url.hash === "#contenu");
      await page
        .waitForFunction(([selector, count]) => document.querySelectorAll(selector).length === count, [cards, before], { timeout: 10_000 })
        .catch(() => assert.fail(`${path} : l'adresse a perdu le filtre, la liste le garde (${before} attendus)`));
    }
  });
}

export async function gamesMenu() {
  await check("le dépliant « Annonces » liste les sept jeux et « Autre », et se referme à Échap", async () => {
    await visit(page, "/annonces");
    const trigger = page.getByRole("button", { name: /^Annonces/ });
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");

    await trigger.click();
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    /* Cadré sur l'en-tête : le pied de page liste les mêmes liens.
       Riftbound a manqué jusqu'en septembre 2026 : c'est lui que ce parcours
       garde en vue, avec « Autre », arrivé en fin de liste. */
    const header = page.locator("header");
    for (const label of ["Pokémon", "Magic", "One Piece", "Lorcana", "Riftbound", "Yu-Gi-Oh", "Naruto", "Autre"]) {
      await header.getByRole("link", { name: new RegExp(`^${label}`) }).waitFor();
    }

    await page.keyboard.press("Escape");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  });

  await check("un clic dehors referme le dépliant des jeux", async () => {
    const trigger = page.getByRole("button", { name: /^Annonces/ });
    await trigger.click();
    /* Clic à distance du panneau, qui recouvre le titre de la page : viser le
       h1 reviendrait à cliquer sur le dépliant lui-même. */
    await page.mouse.click(1200, 500);
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
  });

  await check("le dépliant mène bien à la page du jeu choisi", async () => {
    await page.getByRole("button", { name: /^Annonces/ }).click();
    await page.locator("header").getByRole("link", { name: /^Magic/ }).click();
    await page.waitForURL(/\/magic$/);
    await page.getByRole("heading", { name: /Cartes Magic d'occasion/ }).waitFor();
  });
}

export async function marketTabs() {
  await check("les deux côtés du marché sont sur la même page, un seul visible", async () => {
    /* Les deux panneaux sont rendus par le serveur : la bascule ne va rien
       chercher. Le panneau caché porte `hidden`, ce qui le retire aussi de
       l'arbre d'accessibilité — sans quoi un lecteur d'écran annoncerait deux
       listes concurrentes. */
    const tablist = page.getByRole("tablist", { name: /Cartes Magic/ });
    await tablist.waitFor();
    assert.equal(await page.getByRole("tab").count(), 2);
    assert.equal(await page.getByRole("tabpanel").count(), 1, "les deux panneaux sont visibles");

    const sellTab = page.getByRole("tab", { name: /^Ventes/ });
    assert.equal(await sellTab.getAttribute("aria-selected"), "true");
  });

  await check("basculer sur les recherches change la grille sans quitter la page", async () => {
    const before = page.url();
    const buyTab = page.getByRole("tab", { name: /^Recherches/ });
    const announced = await announcedCount(buyTab);

    await selectTab(page, "Recherches");
    assert.equal(await buyTab.getAttribute("aria-selected"), "true");
    assert.equal(
      await page.getByRole("tab", { name: /^Ventes/ }).getAttribute("aria-selected"),
      "false",
    );
    assert.equal(page.url(), `${before}#recherches`, `URL inattendue : ${page.url()}`);

    /* Le compteur de l'onglet doit correspondre à ce que le panneau montre. */
    const shown = await page.getByRole("tabpanel").locator("article.card").count();
    assert.equal(shown, announced, `annoncé ${announced}, affiché ${shown}`);

    /* Une demande n'a pas de photo : si le panneau en contient une, c'est la
       grille des lots qui a été rendue par erreur. */
    assert.equal(await page.getByRole("tabpanel").locator("img").count(), 0);
  });

  await check("le retour arrière défait la bascule", async () => {
    await page.goBack();
    await waitForSelectedTab(page, "Ventes");
    assert.equal(
      await page.getByRole("tab", { name: /^Ventes/ }).getAttribute("aria-selected"),
      "true",
    );
  });

  await check("les onglets se pilotent aux flèches, comme le motif l'exige", async () => {
    const sellTab = page.getByRole("tab", { name: /^Ventes/ });
    await sellTab.focus();
    await page.keyboard.press("ArrowRight");
    await waitForSelectedTab(page, "Recherches");
    assert.equal(
      await page.getByRole("tab", { name: /^Recherches/ }).getAttribute("aria-selected"),
      "true",
    );
    await page.keyboard.press("ArrowLeft");
    await waitForSelectedTab(page, "Ventes");
    assert.equal(await sellTab.getAttribute("aria-selected"), "true");
    /* Fin et Début vont au dernier et au premier onglet. */
    await page.keyboard.press("End");
    await waitForSelectedTab(page, "Recherches");
    await page.keyboard.press("Home");
    await waitForSelectedTab(page, "Ventes");
    /* Tabindex mobile : un seul onglet est atteignable à la tabulation. */
    assert.equal(await page.locator('[role="tab"][tabindex="0"]').count(), 1);
  });

  await check("un lien partagé avec #recherches ouvre directement le bon onglet", async () => {
    /* Un vrai chargement : depuis /magic#ventes, aller à /magic#recherches
       ne serait qu'un changement de fragment dans la même page, et ne dirait
       rien de l'hydratation — le serveur, qui ne voit pas le fragment, rend
       les ventes. */
    await page.goto("about:blank");
    await visit(page, "/magic#recherches");
    await waitForSelectedTab(page, "Recherches");
    assert.equal(await page.getByRole("tabpanel").locator("img").count(), 0);
  });

  await check("le lien d'évitement laisse l'onglet Recherches ouvert", async () => {
    /* #contenu est un fragment comme un autre : la bascule lisait tout ce
       qui n'était pas #recherches comme « ventes », et renvoyait aux ventes
       la personne au clavier qui venait de choisir les recherches. Seuls les
       deux fragments de la bascule la pilotent. */
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "Aller au contenu");
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.hash === "#contenu");
    /* hashchange part après le changement d'adresse : deux images plus tard,
       la bascule a eu le temps d'y répondre. */
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)))));
    assert.equal(
      await page.getByRole("tab", { name: /^Recherches/ }).getAttribute("aria-selected"),
      "true",
      "le lien d'évitement a rouvert les ventes",
    );

    await page.goBack();
    await page.waitForURL((url) => url.hash === "#recherches");
    await waitForSelectedTab(page, "Recherches");
  });

  await check("la page de ville montre qui viendrait chercher jusque-là", async () => {
    await visit(page, "/pokemon/avignon");
    const buyTab = page.getByRole("tab", { name: /^Recherches/ });
    const announced = await announcedCount(buyTab);
    assert.ok(announced > 0, "aucun acheteur n'atteint Avignon");

    await selectTab(page, "Recherches");
    const shown = await page.getByRole("tabpanel").locator("article.card").count();
    assert.equal(shown, announced, `annoncé ${announced}, affiché ${shown}`);
  });

  await check("l'ancienne adresse d'une page de jeu redirige au lieu de casser", async () => {
    /* /pokemon/lots faisait doublon avec la page du jeu : un lien collé
       ailleurs doit continuer de tomber au bon endroit. */
    const response = await visit(page, "/pokemon/lots");
    assert.equal(response.status(), 200);
    assert.match(page.url(), /\/pokemon$/, `atterri sur ${page.url()}`);
    await page.getByRole("heading", { name: /Cartes Pokémon d'occasion/ }).waitFor();
  });

  await check("le retour arrière après un changement de jeu sur l'onglet Recherches revient au jeu quitté", async () => {
    /* L'intercalaire garde l'onglet ouvert. L'entrée d'historique de la
       bascule n'avait pas d'état que le routeur de Next sache restaurer : le
       retour ramenait l'adresse de Magic sous la page Pokémon. */
    await visit(page, "/magic");
    await selectTab(page, "Recherches");
    await page.getByRole("navigation", { name: "Filtrer par jeu" }).getByRole("link", { name: /^Pokémon/ }).click();
    await page.waitForURL(/\/pokemon#recherches$/);
    await page.getByRole("heading", { level: 1, name: /Cartes Pokémon/ }).waitFor();
    await waitForSelectedTab(page, "Recherches");

    await page.goBack();
    await page.waitForURL(/\/magic#recherches$/);
    await page
      .getByRole("heading", { level: 1, name: /Cartes Magic/ })
      .waitFor({ timeout: 10_000 })
      .catch(() => assert.fail("l'adresse est revenue à Magic, la page est restée sur Pokémon"));
    await waitForSelectedTab(page, "Recherches");
  });

  /* Un filtre et un intercalaire emportent le fragment de la bascule vers
     l'adresse suivante, et aucun autre : #contenu, posé par le lien
     d'évitement, voyageait avec eux et s'installait dans des adresses qu'on
     partage. L'onglet qu'il laisse ouvert, lui, doit suivre. */
  const fragmentAfter = async (navigate, arrived) => {
    await navigate();
    await page.waitForURL(arrived);
    return new URL(page.url()).hash;
  };
  const games = () => page.getByRole("navigation", { name: "Filtrer par jeu" });

  await check("après le lien d'évitement, ni un filtre ni un intercalaire n'emportent #contenu", async () => {
    await visit(page, "/annonces");
    await followSkipLink();
    const filtered = await fragmentAfter(
      () => page.locator(VISIBLE_PANEL).getByRole("group", { name: "Format du lot" }).getByRole("button", { name: "Classeur" }).click(),
      (url) => url.searchParams.get("type") === "binder",
    );
    assert.equal(filtered, "", `le filtre a emporté ${filtered}`);

    await followSkipLink();
    const switched = await fragmentAfter(() => games().getByRole("link", { name: /^Pokémon/ }).click(), (url) => url.pathname === "/pokemon");
    assert.equal(switched, "", `l'intercalaire a emporté ${switched}`);
  });

  await check("après le lien d'évitement, l'onglet Recherches survit au filtre et à l'intercalaire", async () => {
    await visit(page, "/annonces");
    await selectTab(page, "Recherches");
    await followSkipLink();
    const filtered = await fragmentAfter(
      () => page.locator(VISIBLE_PANEL).getByRole("group", { name: "Acheteur" }).getByRole("button", { name: "Boutiques pro" }).click(),
      (url) => url.searchParams.get("acheteur") === "pro",
    );
    assert.equal(filtered, "#recherches", `le filtre a emporté « ${filtered} »`);
    await waitForSelectedTab(page, "Recherches");

    await followSkipLink();
    const switched = await fragmentAfter(() => games().getByRole("link", { name: /^Pokémon/ }).click(), (url) => url.pathname === "/pokemon");
    assert.equal(switched, "#recherches", `l'intercalaire a emporté « ${switched} »`);
    await waitForSelectedTab(page, "Recherches");
  });

  await check("une bascule qui devance l'intégration de Next à l'historique ne casse pas le retour arrière", async () => {
    /* Next branche son intégration à history.pushState dans un effet : une
       bascule cliquée juste après l'hydratation passait avant elle, et son
       entrée partait sans état — le retour depuis Pokémon échouait une fois
       sur douze. On rejoue ce moment : le prochain pushState part sans Next,
       qui revient pour la suite, comme quand React a vidé ses effets. */
    await visit(page, "/magic");
    /* Attendre l'intégration avant de la retirer : posée après coup, elle
       écraserait le remplaçant, et le parcours ne rejouerait rien. */
    await page.waitForFunction(() => history.pushState !== History.prototype.pushState);
    await page.evaluate(() => {
      const integrated = history.pushState;
      history.pushState = function (data, unused, url) {
        history.pushState = integrated;
        return History.prototype.pushState.call(history, data, unused, url);
      };
    });
    await selectTab(page, "Recherches");
    await games().getByRole("link", { name: /^Pokémon/ }).click();
    await page.waitForURL(/\/pokemon#recherches$/);
    await page.getByRole("heading", { level: 1, name: /Cartes Pokémon/ }).waitFor();

    await page.goBack();
    await page.waitForURL(/\/magic#recherches$/);
    await page
      .getByRole("heading", { level: 1, name: /Cartes Magic/ })
      .waitFor({ timeout: 10_000 })
      .catch(() => assert.fail("l'entrée de la bascule est restée sans état : la page est restée sur Pokémon"));
  });

  /* Next n'écrit la nouvelle adresse qu'en affichant la page : pendant son
     rendu, la bascule lisait encore le fragment de la page quittée, et la
     page d'arrivée s'affichait un instant sur le mauvais onglet. Une capture
     image par image laisse passer un instant ; une note à chaque mutation du
     DOM, prise dès avant le clic, n'en laisse passer aucun. */
  const tabsWhile = async (navigate, arrived) => {
    await page.evaluate(() => {
      const visible = (selector) => [...document.querySelectorAll(selector)].find((node) => node.checkVisibility());
      const note = () => ({
        title: visible("h1")?.textContent?.trim() ?? "",
        tab: visible('[role="tab"][aria-selected="true"]')?.textContent?.trim() ?? "",
      });
      window.__tabNotes = [note()];
      new MutationObserver(() => window.__tabNotes.push(note())).observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    });
    await navigate();
    await arrived();
    return page.evaluate(() => window.__tabNotes);
  };

  await check("un lien ordinaire quitté sur les recherches n'ouvre pas la page suivante sur les recherches", async () => {
    await visit(page, "/pokemon#recherches");
    await waitForSelectedTab(page, "Recherches");
    const notes = await tabsWhile(
      () => page.locator("section", { has: page.getByRole("heading", { name: /^Où trouver/ }) }).getByRole("link", { name: "Avignon" }).click(),
      async () => {
        await page.getByRole("heading", { level: 1, name: /Avignon/ }).waitFor();
        await waitForSelectedTab(page, "Ventes");
      },
    );
    const wrong = notes.filter(({ title, tab }) => title.includes("Avignon") && tab !== "" && !tab.startsWith("Ventes"));
    assert.deepEqual(wrong, [], `la page d'Avignon s'est d'abord affichée sur « ${wrong[0]?.tab} »`);
  });

  await check("un intercalaire qui emporte #recherches n'ouvre pas la page suivante sur les ventes", async () => {
    await visit(page, "/pokemon#recherches");
    await waitForSelectedTab(page, "Recherches");
    const notes = await tabsWhile(
      () => games().getByRole("link", { name: /^Magic/ }).click(),
      async () => {
        await page.getByRole("heading", { level: 1, name: /Cartes Magic/ }).waitFor();
        await waitForSelectedTab(page, "Recherches");
      },
    );
    const wrong = notes.filter(({ title, tab }) => title.includes("Magic") && tab !== "" && !tab.startsWith("Recherches"));
    assert.deepEqual(wrong, [], `la page Magic s'est d'abord affichée sur « ${wrong[0]?.tab} »`);
  });
}

export async function searchBarFocus() {
  await check("la barre de recherche ne montre qu'un seul anneau de focus", async () => {
    /* L'anneau global traite chaque cellule comme un champ isolé et trace un
       rectangle à cheval sur le séparateur. On le rentre dans la cellule —
       mais la surcharge doit vivre hors de @layer components, sinon une
       déclaration non couchée l'emporte et les deux contours se superposent.
       Rien de tout ça ne se voit dans le DOM : les deux règles existent, seule
       la cascade décide. */
    await visit(page, "/annonces");
    await page.locator("#recherche-quoi").focus();

    const painted = await page.evaluate(() => {
      const input = document.querySelector("#recherche-quoi");
      const cell = input.closest(".search-cell");
      return {
        champ: getComputedStyle(input).outlineStyle,
        cellule: getComputedStyle(cell).outlineStyle,
        /* Rentré, pour ne pas chevaucher la bordure de la barre. */
        offset: getComputedStyle(cell).outlineOffset,
      };
    });
    assert.equal(painted.champ, "none", "le champ dessine encore son propre anneau");
    assert.equal(painted.cellule, "solid", "la cellule ne dessine aucun anneau");
    assert.equal(painted.offset, "-3px");
  });
}

export async function headerWidths() {
  await check("l'en-tête tient à toutes les largeurs, et son invite de recherche n'est pas coupée", async () => {
    /* Avec la cloche, il débordait à 1 024 px — « Déposer » sortait de l'écran
       et la recherche tombait à une icône — et coupait « EV08… » jusqu'à
       1 535 px. */
    for (const width of [360, 768, 1024, 1180, 1280, 1440, 1920]) {
      const fit = await withPage({ width, height: 800 }, async (sized) => {
        await visit(sized, "/annonces");
        return sized.evaluate(() => {
          const bar = document.querySelector("header .container");
          const inner = bar.getBoundingClientRect().right - parseFloat(getComputedStyle(bar).paddingRight);
          const overflow = Math.max(
            ...[...bar.querySelectorAll("a, button, input")]
              .filter((node) => node.getBoundingClientRect().width > 0)
              .map((node) => node.getBoundingClientRect().right - inner),
          );
          const input = document.querySelector("#recherche-entete");
          if (!input || input.getBoundingClientRect().width === 0) return { overflow, clipped: 0 };
          const style = getComputedStyle(input);
          const context = document.createElement("canvas").getContext("2d");
          context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          const available = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
          return { overflow, clipped: context.measureText(input.placeholder).width - available };
        });
      });
      assert.ok(fit.overflow <= 0.5, `${width} px : l'en-tête dépasse de ${Math.round(fit.overflow)} px`);
      assert.ok(fit.clipped <= 0, `${width} px : l'invite de recherche est coupée de ${Math.round(fit.clipped)} px`);
    }
  });
}
