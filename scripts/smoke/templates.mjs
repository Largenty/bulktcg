/* Gabarits : l'accueil, les bords de page, la hiérarchie des titres et la
   manchette en unités de conteneur. */
import assert from "node:assert/strict";
import { check, page } from "./harness.mjs";
import { visit, withPage } from "./helpers.mjs";
import { LISTING_OF_OTHER, OWN_LISTING } from "./fixtures.mjs";

/* Un chemin par gabarit. */
const TEMPLATE_ROUTES = [
  "/", "/annonces", "/recherches", `/annonces/${OWN_LISTING}`,
  "/recherches/cherche-display-riftbound-scellee-vf-ou-vo-apt-14", "/deposer", "/deposer/recherche", "/messages", "/messages/c-01",
  "/mon-compte", "/pro", "/pro/lots", "/connexion", "/inscription", "/securite", "/mentions-legales",
  "/pokemon/avignon", "/profil/lecomptoirdukado", "/page-qui-n-existe-pas",
];

export async function rightEdge() {
  await check("aucune page ne s'arrête avant le bord droit du gabarit", async () => {
    /* Dix pages s'arrêtaient à 760, 800, 860, 880, 1 000, 1 040, 1 080 ou
       1 200 px et laissaient jusqu'à la moitié d'un écran de 1 600 px vide à
       droite. On mesure le bord droit du contenu réel — texte, image, champ,
       cadre — le plus à droite, contre celui du gabarit : une boîte de bloc fait
       toujours la largeur de son parent, même quand son contenu s'arrête avant. */
    const gaps = [];
    await withPage({ width: 1600, height: 900 }, async (wide) => {
      for (const path of [
        "/deposer",
        "/deposer/recherche",
        "/recherches/cherche-lots-one-piece-budget-large-l-isle-sur-la-sorgue-05",
        "/securite",
        "/mentions-legales",
        "/pro/lots",
        "/connexion",
        "/inscription",
        "/inscription/e-mail-envoye",
        "/mot-de-passe-oublie/e-mail-envoye",
        `/signaler?annonce=${LISTING_OF_OTHER}`,
        "/page-qui-n-existe-pas",
      ]) {
        await visit(wide, path);
        const gap = await wide.evaluate(() => {
          const container = document.querySelector("main .container");
          const style = getComputedStyle(container);
          const box = container.getBoundingClientRect();
          const left = box.left + parseFloat(style.paddingLeft);
          const right = box.right - parseFloat(style.paddingRight);
          let reached = 0;
          for (const node of container.querySelectorAll("*")) {
            const rect = node.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0 || rect.left < left - 2 || rect.right > right + 2) continue;
            const bearsContent =
              ["IMG", "INPUT", "BUTTON", "TEXTAREA", "ARTICLE", "svg"].includes(node.tagName) ||
              [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim() !== "") ||
              getComputedStyle(node).borderRightWidth !== "0px" ||
              getComputedStyle(node).backgroundColor !== "rgba(0, 0, 0, 0)";
            if (bearsContent) reached = Math.max(reached, rect.right);
          }
          return Math.round(right - reached);
        });
        if (gap > 4) gaps.push(`${path} : ${gap} px vides à droite`);
      }
    });
    assert.deepEqual(gaps, []);
  });
}

export async function home() {
  await check("le héros de l'accueil fait l'écran entier, navigation comprise, et ouvre sur les derniers lots", async () => {
    /* Demandé tel quel : la manchette sur toute la largeur, la recherche et la
       phrase d'accroche dessous, le tout sur la hauteur de la fenêtre avec
       l'en-tête. Les intercalaires des jeux ferment l'écran, les derniers
       dépôts commencent juste dessous. */
    for (const [width, height] of [[1280, 800], [1440, 1000], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await visit(page, "/");
      const measured = await page.evaluate(() => {
        const hero = document.querySelector(".hero-screen").getBoundingClientRect();
        const header = document.querySelector("header").getBoundingClientRect();
        /* L'étendue du texte, pas celle de la boîte : un h1 est un bloc, sa
           boîte fait toujours la largeur du parent, même bridé à 20ch. */
        const range = document.createRange();
        range.selectNodeContents(document.querySelector("h1"));
        const title = range.getBoundingClientRect();
        const card = document.querySelector('section[aria-labelledby="derniers-depots"] article.card').getBoundingClientRect();
        return { heroTop: hero.top, heroBottom: hero.bottom, headerBottom: header.bottom, titleWidth: title.width, heroWidth: hero.width, cardTop: card.top };
      });
      assert.ok(Math.abs(measured.heroTop - measured.headerBottom) <= 1, "le héros ne commence pas sous l'en-tête");
      if (width >= 1024) {
        assert.ok(Math.abs(measured.heroBottom - height) <= 2, `${width}×${height} : le héros finit à ${Math.round(measured.heroBottom)} px`);
        /* Le titre court sur toute la largeur de la colonne. */
        assert.ok(measured.titleWidth >= measured.heroWidth * 0.94, `titre de ${Math.round(measured.titleWidth)} px sur ${Math.round(measured.heroWidth)}`);
      } else {
        assert.ok(measured.heroBottom >= height - 2, `sur téléphone, le héros finit à ${Math.round(measured.heroBottom)} px`);
      }
      assert.ok(measured.cardTop >= measured.heroBottom, "une vignette remonte dans le héros");
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  await check("« Déposé récemment » ne répète pas « À la une »", async () => {
    /* Les quatre premières pochettes de l'ancien classeur étaient exactement
       les quatre lots à la une de la section suivante. */
    await visit(page, "/");
    const titles = (selector) =>
      page.locator(selector).evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
    const latest = await titles('section[aria-labelledby="derniers-depots"] article.card h3');
    const featured = await titles('section:has(h2:text-is("À la une")) article.card h3');
    assert.ok(latest.length > 0 && featured.length > 0);
    assert.deepEqual(latest.filter((title) => featured.includes(title)), []);
  });

  await check("aucune vignette ne coupe son prix ni sa ligne de type", async () => {
    /* Une troncature ne se voit pas dans le DOM : le texte est là, il déborde.
       Le prix et le type partagent la tête de la vignette ; le type passe à la
       ligne plutôt que de se couper. */
    for (const path of ["/", "/annonces", "/annonces?page=2"]) {
      await visit(page, path);
      const cut = await page.locator("article.card.lot").evaluateAll((cards) =>
        cards.flatMap((card) =>
          [".lot-price", ".lot-type-text > span", ".lot-title"]
            .map((selector) => card.querySelector(selector))
            .filter((node) => node && node.scrollWidth > node.clientWidth + 1)
            .map((node) => node.textContent.trim()),
        ),
      );
      assert.deepEqual(cut, [], `troncature sur ${path}`);
      /* Et les titres d'une rangée s'alignent : la tête de chaque vignette a
         la même hauteur, quel que soit le libellé du jeu et du format. */
      const titleTops = await page.locator('[role="tabpanel"]:not([hidden]) article.card.lot .lot-title, section[aria-labelledby="derniers-depots"] article.card.lot .lot-title').evaluateAll((titles) =>
        titles.map((title) => {
          const box = title.getBoundingClientRect();
          return { top: Math.round(box.top), left: Math.round(box.left), row: Math.round(title.closest("article").getBoundingClientRect().top) };
        }),
      );
      const rows = new Map();
      for (const { top, row } of titleTops) rows.set(row, [...(rows.get(row) ?? []), top]);
      const ragged = [...rows.values()].filter((tops) => Math.max(...tops) - Math.min(...tops) > 1);
      assert.deepEqual(ragged, [], `titres désalignés sur ${path}`);
    }
  });

  await check("l'accueil montre une section recherches, distincte de la grille des lots", async () => {
    await visit(page, "/");
    const section = page.locator("section").filter({ hasText: "Ce qu'on cherche en ce moment" });
    await section.waitFor();

    /* Une demande de recherche n'a pas de photo : si la section en contient
       une, c'est que la grille des lots a été réutilisée par erreur. */
    const cards = section.locator("article.card");
    assert.ok((await cards.count()) > 0, "la section est vide");
    assert.equal(await cards.locator("img").count(), 0, "une demande affiche une photo");
    assert.ok(
      (await section.getByText(/Recherche ·/).count()) > 0,
      "les vignettes ne s'annoncent pas comme des recherches",
    );
  });
}

export async function edgesAndHeadings() {
  await check("toutes les pages partagent le bord gauche de l'en-tête", async () => {
    /* Treize gabarits centraient une colonne étroite : leur contenu
       commençait à 300 px quand le logo commence à 113. On mesure le premier
       élément qui porte du texte ou une image, pas une boîte : un conteneur
       commence toujours au même endroit, c'est son contenu qui se décale. */
    const offenders = [];
    for (const route of TEMPLATE_ROUTES) {
      await visit(page, route);
      const { logo, content } = await page.evaluate(() => {
        const logoLeft = document.querySelector("header a[aria-label$='accueil']").getBoundingClientRect().left;
        const bearsContent = (node) =>
          ["IMG", "SVG", "INPUT", "BUTTON"].includes(node.tagName.toUpperCase()) ||
          [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim() !== "");
        const first = [...document.querySelectorAll("main *")].find((node) => {
          const box = node.getBoundingClientRect();
          return box.width > 1 && box.height > 1 && bearsContent(node) && getComputedStyle(node).visibility !== "hidden";
        });
        return { logo: logoLeft, content: first?.getBoundingClientRect().left ?? -1 };
      });
      if (Math.abs(logo - content) > 1) offenders.push(`${route} : contenu à ${Math.round(content)} px, logo à ${Math.round(logo)} px`);
    }
    assert.deepEqual(offenders, []);
  });

  await check("aucun titre de section n'est plus grand que le titre de sa page", async () => {
    /* « Autres lots dans le secteur » s'affichait plus grand que le titre de
       l'annonce elle-même : la hiérarchie se lit à la taille, pas seulement au
       balisage. */
    const offenders = [];
    for (const route of TEMPLATE_ROUTES) {
      await visit(page, route);
      const sizes = await page.evaluate(() => {
        const visible = (node) => node.getClientRects().length > 0 && node.getBoundingClientRect().width > 1;
        const size = (node) => parseFloat(getComputedStyle(node).fontSize);
        const title = [...document.querySelectorAll("main h1")].find(visible);
        const sections = [...document.querySelectorAll("main h2")].filter(visible);
        return { title: title ? size(title) : null, largest: Math.max(0, ...sections.map(size)), text: sections.sort((a, b) => size(b) - size(a))[0]?.textContent.trim().slice(0, 40) };
      });
      if (sizes.title !== null && sizes.largest > sizes.title + 0.5) offenders.push(`${route} : « ${sizes.text} » ${sizes.largest} px > titre ${sizes.title} px`);
    }
    assert.deepEqual(offenders, []);
  });
}

export async function pageTitleStep() {
  await check("tous les titres de page ont le même pas, messagerie comprise", async () => {
    /* « Messages » faisait 26 px quand toutes les autres pages titraient à
       46. L'accueil et /pro ont un héros, une fiche un titre écrit par son
       vendeur : ils ont leur propre échelle, et ne sont pas mesurés ici. */
    const sizes = {};
    for (const route of ["/annonces", "/recherches", "/notifications", "/messages", "/messages/c-01", "/mon-compte", "/deposer", "/pokemon/avignon"]) {
      await visit(page, route);
      sizes[route] = await page.locator("h1").first().evaluate((node) => getComputedStyle(node).fontSize);
    }
    const distinct = [...new Set(Object.values(sizes))];
    assert.equal(distinct.length, 1, JSON.stringify(sizes));
  });
}

export async function containerHeadline() {
  await check("la manchette en unités de conteneur a toujours un conteneur", async () => {
    /* Sans parent @container, 6.1cqi se rapporte à la fenêtre : sur /pro, 109 px
       de corps dans une colonne de 826 px, un mot par ligne. */
    for (const route of ["/", "/pro", "/annonces", "/mon-compte"]) {
      await visit(page, route);
      const orphans = await page.evaluate(() =>
        [...document.querySelectorAll(".display-hero")].filter((node) => {
          for (let parent = node.parentElement; parent; parent = parent.parentElement) {
            if (getComputedStyle(parent).containerType !== "normal") return false;
          }
          return true;
        }).length,
      );
      assert.equal(orphans, 0, `${route} : ${orphans} manchette(s) sans conteneur`);
    }
    /* Et le titre de /pro tient dans sa colonne en trois lignes au plus. */
    await visit(page, "/pro");
    const lines = await page.locator("h1").evaluate((node) => Math.round(node.getBoundingClientRect().height / parseFloat(getComputedStyle(node).lineHeight)));
    assert.ok(lines <= 3, `le titre de /pro s'étale sur ${lines} lignes`);
  });
}
