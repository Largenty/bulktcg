/* Séries et produits : le filtre de la liste, et ce que le dépôt propose
   selon le jeu choisi. */
import assert from "node:assert/strict";
import { BASE, browser, check, page } from "./harness.mjs";
import { VISIBLE_CARDS, choose, chooseAll, visit, withPage, declarePrivateSeller } from "./helpers.mjs";
import { OWN_LISTING, PHOTO } from "./fixtures.mjs";

export async function filters() {
  await check("le filtre par série écrit dans l'URL et réduit la liste", async () => {
    await visit(page, "/magic");
    const before = await page.locator("article.card").count();

    await choose(page, "#filtre-serie", /Modern Horizons 3/);
    await page.waitForURL(/serie=magic-mh3/);

    const after = await page.locator("article.card").count();
    assert.ok(after > 0, "la grille est vide après filtrage par série");
    assert.ok(after < before, `le filtre n'a rien réduit (${before} → ${after})`);
  });

  await check("le filtre par série dit combien de lots il écarte faute de déclaration", async () => {
    /* Filtre strict : on ne peut pas affirmer qu'un carton non trié contient
       Modern Horizons. Mais l'enterrer en silence ferait croire à l'acheteur
       que rien d'autre n'existe. */
    /* Le panneau existe deux fois — colonne et feuille mobile — et un seul
       est visible selon la largeur. */
    const visibleNotice = page.getByText(/sans série déclarée/).filter({ visible: true });
    await visibleNotice.waitFor();
    const notice = await visibleNotice.textContent();
    assert.match(notice, /écarté/);
  });

  await check("le filtre par produit trouve les lots qui le contiennent", async () => {
    await visit(page, "/annonces");
    await choose(page, "#filtre-produit", /Tapis de jeu/);
    await page.waitForURL(/produit=playmat/);

    const cards = await page
      .locator(VISIBLE_CARDS)
      .evaluateAll((nodes) => nodes.map((node) => node.textContent));
    assert.ok(cards.length > 0, "aucun lot ne contient de tapis de jeu");
    for (const card of cards) {
      assert.match(card, /TAPIS DE JEU/i, "un lot sans tapis remonte dans le filtre");
    }
  });

  await check("les pastilles de série ne débordent jamais de leur vignette", async () => {
    /* Longueur variable, largeur fixe : c'est exactement la configuration qui
       produit une troncature invisible dans le DOM. */
    const escaped = await withPage({ width: 360, height: 900, mainContext: true }, async (narrow) => {
      await visit(narrow, "/annonces");
      return narrow.evaluate(() => {
        const out = [];
        for (const card of document.querySelectorAll("article.card")) {
          const box = card.getBoundingClientRect();
          for (const chip of card.querySelectorAll("ul li")) {
            const rect = chip.getBoundingClientRect();
            if (rect.width < 2) continue;
            if (rect.right > box.right + 1 || rect.left < box.left - 1) out.push(chip.textContent);
            if (chip.scrollWidth > chip.clientWidth + 1) out.push(`tronqué: ${chip.textContent}`);
          }
        }
        return out;
      });
    });
    assert.deepEqual(escaped, []);
  });

  await check("une série de la fiche mène à la recherche correspondante", async () => {
    await visit(page, "/annonces/classeur-magic-modern-horizons-3-180-cartes-romans-sur-isere-27");
    await page.getByRole("link", { name: /Modern Horizons 3/ }).first().click();
    await page.waitForURL(/serie=magic-mh3/);
    assert.ok((await page.locator("article.card").count()) > 0);
  });
}

export async function inListingForm() {
  await check("les séries proposées au dépôt suivent le jeu choisi", async () => {
    await visit(page, "/deposer");

    /* Tant qu'aucun jeu n'est choisi, on ne propose pas quatre-vingts séries
       dont soixante-dix ne concernent pas le vendeur. */
    await page.getByText(/Choisissez d'abord un jeu/).first().waitFor();

    await choose(page, "#gameId", "Pokémon");
    await page.getByText(/EV08\s+Étincelles Déferlantes/).waitFor();
    assert.equal(
      await page.getByText(/MH3\s+Modern Horizons 3/).count(),
      0,
      "une série Magic est proposée sur une annonce Pokémon",
    );

    /* Le produit suit la même règle : « UPC » est du vocabulaire Pokémon. */
    await page.getByText("UPC", { exact: true }).waitFor();
    assert.equal(await page.getByText("Structure Deck", { exact: true }).count(), 0);
  });

  await check("changer de jeu remplace les séries au lieu de les empiler", async () => {
    await choose(page, "#gameId", "Magic");
    await page.getByText(/MH3\s+Modern Horizons 3/).waitFor();
    assert.equal(
      await page.getByText(/EV08\s+Étincelles Déferlantes/).count(),
      0,
      "les séries Pokémon survivent au changement de jeu",
    );
    assert.equal(await page.getByText("UPC", { exact: true }).count(), 0);
  });

  await check("plusieurs séries cochées arrivent ensemble au récapitulatif", async () => {
    /* Object.fromEntries n'aurait gardé que la dernière : c'est le bug que ce
       parcours attrape. */
    await page.locator("#title").fill("Lot mixte Magic, plusieurs extensions");
    await page.locator("#priceEuros").fill("60");
    await page.locator("#city").fill("Avignon");
    await page.locator("#photo-files").setInputFiles(PHOTO);
    await page.locator("#description").fill(
      "Deux classeurs et une boîte de vrac, contenu mélangé sur plusieurs extensions récentes.",
    );
    await chooseAll(page, [["#lotType", "Lot mixte"], ["#condition", /États mêlés/], ["#language", "Anglais"]]);

    await page.getByText(/MH3\s+Modern Horizons 3/).click();
    await page.getByText(/MH2\s+Modern Horizons 2/).click();
    await page.getByText("Display", { exact: true }).click();

    await declarePrivateSeller(page);
    await page.getByRole("button", { name: /Publier l'annonce/ }).click();
    await page.getByText(/rien n'a été enregistré/).waitFor();

    const summary = await page.locator("dl", { hasText: "Séries" }).first().textContent();
    assert.match(summary, /MH3/, "la première série cochée est perdue");
    assert.match(summary, /MH2/, "la seconde série cochée est perdue");
    assert.match(summary, /Display/);
    assert.doesNotMatch(summary, /magic-mh3/, "un identifiant de base atteint l'écran");
  });

  await check("la modification restitue les séries déjà cochées", async () => {
    await visit(page, `/mon-compte/annonces/${OWN_LISTING}/modifier`);
    const checked = await page
      .locator('input[name="editions"]:checked')
      .evaluateAll((nodes) => nodes.map((node) => node.value).sort());
    assert.deepEqual(checked, ["pokemon-eb", "pokemon-ev"]);
  });
}

/* Le référentiel des séries reste sur le serveur : le formulaire demande
   celles du jeu choisi à /series. */
export async function fromServer() {
  await check("les séries arrivent du serveur au choix du jeu, jamais avec la page", async () => {
    await withPage({ width: 1440, height: 1000 }, async (tab) => {
      const response = await tab.goto(`${BASE}/deposer`, { waitUntil: "load" });
      const html = (await response?.text()) ?? "";
      assert.ok(html.length > 0);
      assert.doesNotMatch(html, /Flamme Blanche|pokemon-ev10-5w/, "le référentiel part avec la page");
      const series = tab.waitForResponse((answer) => answer.url().includes("/series?jeu=pokemon"));
      await choose(tab, "#gameId", "Pokémon");
      const answer = await series;
      assert.equal(answer.status(), 200);
      assert.match(answer.headers()["cache-control"] ?? "", /^public/);
      await tab.getByText(/EV10\.5W\s+Flamme Blanche/).waitFor();
    });
  });

  await check("sans JavaScript, la modification rend les séries de l'annonce, cochées", async () => {
    const noScript = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 }, locale: "fr-FR" });
    try {
      const tab = await noScript.newPage();
      await tab.goto(`${BASE}/mon-compte/annonces/${OWN_LISTING}/modifier`, { waitUntil: "load" });
      const checked = await tab.locator('input[name="editions"]:checked').evaluateAll((nodes) => nodes.map((node) => node.value).sort());
      assert.deepEqual(checked, ["pokemon-eb", "pokemon-ev"]);
      assert.ok((await tab.locator('input[name="editions"]').count()) > 40, "la liste du jeu est rendue avec la page");
      assert.equal(
        await tab.locator('input[aria-label="Rechercher une série"]').count(),
        0,
        "sans JavaScript, la page rend une recherche qui ne filtre rien",
      );
    } finally {
      await noScript.close();
    }
  });
}


/* La recherche dans la liste des séries du dépôt. */
export async function search() {
  /** @param {import("playwright").Page} tab */
  const searchbox = (tab) => tab.getByRole("searchbox", { name: "Rechercher une série" });
  /** @param {import("playwright").Page} tab @param {RegExp} name */
  const series = (tab, name) => tab.locator("label", { hasText: name }).first();

  await check("la recherche filtre les séries par code ou par nom, et dit combien il en reste", async () => {
    await withPage({ width: 1440, height: 1000 }, async (tab) => {
      await visit(tab, "/deposer");
      await choose(tab, "#gameId", "Magic");
      await series(tab, /MH3\s+Modern Horizons 3/).waitFor();
      await tab.getByText(/Cherchez par code ou par nom/).waitFor();

      await searchbox(tab).fill("bloom");
      await series(tab, /BLB\s+Bloomburrow/).waitFor();
      assert.equal(await series(tab, /MH3\s+Modern Horizons 3/).isVisible(), false, "la recherche ne filtre pas");
      await tab.getByText(/^1 série sur \d+$/).waitFor();

      await searchbox(tab).fill("zzzz");
      await tab.getByText(/Aucune série ne correspond à «\s?zzzz\s?»/).waitFor();
      await tab.getByRole("button", { name: "Effacer la recherche" }).click();
      await series(tab, /MH3\s+Modern Horizons 3/).waitFor();
      assert.equal(await searchbox(tab).inputValue(), "");
    });
  });

  await check("une série cochée reste visible quand la recherche l'écarte, et part avec l'annonce", async () => {
    await withPage({ width: 1440, height: 1000 }, async (tab) => {
      await visit(tab, "/deposer");
      await choose(tab, "#gameId", "Magic");
      await series(tab, /MH3\s+Modern Horizons 3/).click();
      await searchbox(tab).fill("bloom");
      assert.equal(await series(tab, /MH3\s+Modern Horizons 3/).isVisible(), true, "la série cochée a disparu");
      assert.equal(await tab.locator('input[name="editions"][value="magic-mh3"]').isChecked(), true);
      await series(tab, /BLB\s+Bloomburrow/).click();

      await tab.locator("#title").fill("Lot Magic, deux extensions récentes");
      await tab.locator("#priceEuros").fill("45");
      await tab.locator("#city").fill("Avignon");
      await tab.locator("#photo-files").setInputFiles(PHOTO);
      await tab.locator("#description").fill("Un classeur et une boîte de vrac, cartes de deux extensions récentes, bien rangées.");
      await chooseAll(tab, [["#lotType", "Lot mixte"], ["#condition", /États mêlés/], ["#language", "Anglais"]]);
      await declarePrivateSeller(tab);
      await tab.getByRole("button", { name: /Publier l'annonce/ }).click();
      await tab.getByText(/rien n'a été enregistré/).waitFor();
      const summary = await tab.locator("dl", { hasText: "Séries" }).first().textContent();
      assert.match(summary ?? "", /MH3/, "la série écartée par la recherche n'est pas partie");
      assert.match(summary ?? "", /BLB/);
    });
  });

  await check("Entrée dans la recherche ne publie pas, Échap l'efface, et changer de jeu la remet à zéro", async () => {
    await withPage({ width: 1440, height: 1000 }, async (tab) => {
      await visit(tab, "/deposer");
      await choose(tab, "#gameId", "Magic");
      await series(tab, /MH3\s+Modern Horizons 3/).waitFor();
      await searchbox(tab).fill("mh");
      await searchbox(tab).press("Enter");
      assert.equal(
        await searchbox(tab).evaluate((input) => input === document.activeElement),
        true,
        "Entrée a envoyé le formulaire : le focus est parti sur le champ fautif",
      );
      assert.equal(await searchbox(tab).inputValue(), "mh");
      await searchbox(tab).press("Escape");
      assert.equal(await searchbox(tab).inputValue(), "", "Échap n'efface pas la recherche");

      await searchbox(tab).fill("bloom");
      await choose(tab, "#gameId", "Pokémon");
      await series(tab, /EV08\s+Étincelles Déferlantes/).waitFor();
      assert.equal(await searchbox(tab).inputValue(), "", "la recherche d'un autre jeu survit au changement");
    });
  });
}
