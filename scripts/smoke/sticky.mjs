/* Les colonnes épinglées : le panneau « Affiner » d'une liste et la colonne
   d'action d'une fiche suivent la lecture, sans défiler sur elles-mêmes ni
   se laisser recouvrir par un encart. */
import assert from "node:assert/strict";
import { check, page } from "./harness.mjs";
import { visit, waitForStillBox, withPage } from "./helpers.mjs";
import { LISTING_OF_OTHER } from "./fixtures.mjs";

/** @import { Page } from "playwright" */

/* La colonne est hydratée : StickyColumn a posé son accroche. */
/** @param {Page} tab */
function waitForStickyColumn(tab) {
  return tab.waitForFunction(() => document.querySelector(".sticky-column")?.style.top !== "");
}

/* Fait défiler jusqu'à `y`, puis attend que la colonne épinglée se soit
   calée. */
/** @param {Page} tab @param {number} y */
async function scrollAndSettle(tab, y) {
  await tab.evaluate((top) => window.scrollTo(0, top), y);
  await waitForStillBox(tab, ".sticky-column");
}

export async function columns() {
  await check("le panneau « Affiner » suit le défilement", async () => {
    /* Sur dix-huit vignettes, remonter changer un critère est le geste qu'on
       refait le plus : le panneau doit rester à l'écran. Plus haut que la
       fenêtre, il défilait sur lui-même, barre de défilement comprise ; il colle
       désormais par le bas en descendant, et revient sous l'en-tête dès qu'on
       remonte, sans remonter toute la liste. */
    await visit(page, "/annonces");
    await waitForStickyColumn(page);
    const panel = page.locator(".panel", { hasText: "Affiner" }).first();
    const { height: windowHeight } = page.viewportSize();

    await page.evaluate(() => window.scrollBy(0, 1200));
    await page.waitForFunction(() => window.scrollY > 1000);
    await waitForStillBox(page, ".sticky-column");
    const after = await panel.boundingBox();
    const underHeader = after.y >= 68 && after.y < 200;
    const onBottom = Math.abs(after.y + after.height - (windowHeight - 16)) <= 2;
    assert.ok(underHeader || onBottom, `le panneau n'est calé ni sous l'en-tête ni au bas de l'écran (y = ${after.y})`);

    /* En remontant de 150 px, son haut revient — et il ne passe pas sous
       l'en-tête collant, qui fait 68 px avec sa tranche. */
    await page.evaluate(() => window.scrollBy(0, -150));
    await waitForStillBox(page, ".sticky-column");
    const up = await panel.boundingBox();
    assert.ok(up.y >= 68 && up.y < 200, `en remontant, le haut du panneau reste caché (y = ${up.y})`);
  });

  await check("aucun encart ne se dessine par-dessus le panneau épinglé", async () => {
    /* Un élément épinglé garde sa place dans le flux : ses voisins situés en
       dessous remontent et le recouvrent. C'est ainsi que le pavé
       publicitaire s'est retrouvé au milieu des filtres.

       On mesure l'ordre de peinture et non la géométrie : les boîtes se
       chevauchent bel et bien, ce qu'on exige c'est que le panneau soit
       devant. Un point pris au hasard dans le panneau doit toucher le
       panneau. */
    const covered = await page.evaluate(() => {
      const panel = [...document.querySelectorAll(".panel")].find((card) =>
        card.textContent.includes("Affiner"),
      );
      const box = panel.getBoundingClientRect();
      const hits = [];
      for (const ratio of [0.25, 0.5, 0.75, 0.95]) {
        const y = box.top + box.height * ratio;
        if (y < 0 || y > window.innerHeight) continue;
        const topmost = document.elementFromPoint(box.left + box.width / 2, y);
        if (!panel.contains(topmost)) {
          hits.push(`${Math.round(ratio * 100)}% : ${topmost?.closest("aside,section,div")?.textContent?.trim().slice(0, 30)}`);
        }
      }
      return hits;
    });
    assert.deepEqual(covered, []);
  });

  await check("aucun encart ne passe sous le panneau de filtres quand on descend la liste", async () => {
    /* Les encarts vivaient sous le panneau, dans sa colonne : en défilant, le
       panneau épinglé passait par-dessus eux, et l'on voyait les filtres
       recouvrir l'offre « À la une ». On mesure ici la géométrie, à plusieurs
       hauteurs de défilement : aucun encart ne croise plus le panneau. */
    await visit(page, "/annonces");
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const overlaps = [];
    for (const y of [0, 600, 1200, 1800, 2400, height]) {
      await scrollAndSettle(page, y);
      overlaps.push(
        ...(await page.evaluate(() => {
          const panel = document.querySelector(".sticky-column").getBoundingClientRect();
          return [...document.querySelectorAll("main aside")]
            .map((aside) => ({ aside, box: aside.getBoundingClientRect() }))
            .filter(({ box }) => box.width > 0 && box.height > 0)
            .filter(({ box }) => Math.min(box.bottom, panel.bottom) - Math.max(box.top, panel.top) > 1 && Math.min(box.right, panel.right) - Math.max(box.left, panel.left) > 1)
            .map(({ aside }) => `${window.scrollY} px : ${aside.getAttribute("aria-label") ?? aside.textContent.trim().slice(0, 30)}`);
        })),
      );
    }
    assert.deepEqual(overlaps, []);
  });

  await check("le prix et le bouton de contact suivent la lecture de la fiche", async () => {
    /* La colonne de gauche porte la photo puis toute la description : c'est
       donc l'autre qu'on épingle, pour garder sous la main ce qui déclenche
       l'action. Elle doit tenir jusqu'au bout de la description : quand elle
       portait aussi le pavé publicitaire, haute de 900 px, elle ne collait que
       sur 600 px et repassait sous l'en-tête en pleine lecture. */
    /* Une annonce d'un autre vendeur : sur la sienne, le compte de
       démonstration voit ses outils de vendeur et pas de bouton de contact. */
    await visit(page, `/annonces/${LISTING_OF_OTHER}`);
    /* On descend jusqu'à lire la fin de la description. */
    const target = await page.evaluate(() => {
      const details = [...document.querySelectorAll("h2")]
        .find((node) => node.textContent.includes("Description"))
        .closest(".panel");
      return Math.round(details.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 40);
    });
    await page.evaluate((y) => window.scrollTo(0, y), target);
    await page.waitForFunction((y) => Math.abs(window.scrollY - y) < 2, target);

    const measured = await page.evaluate(() => {
      const column = document.querySelector(".sticky-column");
      const contact = [...document.querySelectorAll("a")].find((node) =>
        node.textContent.includes("Contacter le vendeur"),
      );
      const ad = document.querySelector("aside[data-ad-slot]");
      const box = column.getBoundingClientRect();
      const adBox = ad.getBoundingClientRect();
      const overlapY = Math.min(box.bottom, adBox.bottom) - Math.max(box.top, adBox.top);
      const overlapX = Math.min(box.right, adBox.right) - Math.max(box.left, adBox.left);
      return {
        top: Math.round(box.top),
        contactVisible: contact.getBoundingClientRect().top < window.innerHeight,
        /* Rien à faire défiler à l'intérieur : la colonne tient dans l'écran. */
        scrollsInside: column.scrollHeight > column.clientHeight + 1,
        adInsideColumn: column.contains(ad),
        overlaps: overlapY > 1 && overlapX > 1,
      };
    });
    assert.ok(measured.top >= 68 && measured.top < 200, `colonne à y = ${measured.top}`);
    assert.ok(measured.contactVisible, "le bouton de contact est sorti de l'écran");
    assert.equal(measured.scrollsInside, false, "la colonne épinglée défile à l'intérieur d'elle-même");
    assert.equal(measured.adInsideColumn, false, "le pavé publicitaire est revenu dans la colonne épinglée");
    assert.equal(measured.overlaps, false, "l'encart chevauche la colonne épinglée");
  });

  await check("la description est sous la photo, dans son propre bloc", async () => {
    const layout = await page.evaluate(() => {
      const gallery = document.querySelector("figure, img")?.closest("div");
      const specs = [...document.querySelectorAll("h2")].find((node) =>
        node.textContent.includes("Caractéristiques"),
      );
      const card = specs.closest(".panel");
      return {
        hasCard: card !== null,
        background: card ? getComputedStyle(card).backgroundColor : null,
        belowGallery: gallery
          ? card.getBoundingClientRect().top > gallery.getBoundingClientRect().top
          : null,
      };
    });
    assert.ok(layout.hasCard, "les caractéristiques ne sont pas dans une carte");
    assert.equal(layout.background, "rgb(255, 255, 255)", "la carte n'est pas blanche");
    assert.ok(layout.belowGallery, "le bloc n'est pas sous la photo");
  });

  await check("le panneau collant reste intégralement atteignable", async () => {
    /* Plus haut que la fenêtre, il colle par le bas : ses derniers champs
       arrivent à l'écran en faisant défiler la page, sans défilement interne. */
    const measured = await withPage({ width: 1440, height: 700, mainContext: true }, async (short) => {
      await visit(short, "/annonces");
      await waitForStickyColumn(short);
      await short.evaluate(() => window.scrollBy(0, 1200));
      await waitForStillBox(short, ".sticky-column");
      return short.evaluate(() => {
        const panel = document.querySelector(".sticky-column");
        const rect = document.querySelector("#filtre-prix-max").getBoundingClientRect();
        return {
          reachable: rect.top >= 0 && rect.bottom <= window.innerHeight,
          scrollsInside: panel.scrollHeight > panel.clientHeight + 1,
        };
      });
    });
    assert.ok(measured.reachable, "le dernier champ du panneau reste hors d'écran");
    assert.equal(measured.scrollsInside, false, "le panneau défile sur lui-même");
  });

  await check("aucune colonne épinglée ne porte sa propre barre de défilement", async () => {
    /* Une annonce réservée : sa colonne porte la liste d'attente, la
       conversation, le lien, le vendeur et les conseils, 850 px en tout. Sur un
       écran de 860 px elle défilait sur elle-même, barre de défilement
       comprise. Elle doit suivre la page, puis coller par le bas. */
    const states = [];
    await withPage({ width: 1440, height: 760, mainContext: true }, async (short) => {
      await visit(short, "/annonces/classeur-magic-modern-horizons-3-180-cartes-romans-sur-isere-27");
      await waitForStickyColumn(short);
      for (const y of [0, 450]) {
        await scrollAndSettle(short, y);
        states.push(
          await short.evaluate(() => {
            const column = document.querySelector(".sticky-column");
            const box = column.getBoundingClientRect();
            return {
              taller: box.height > window.innerHeight - 90,
              scrollsInside: column.scrollHeight > column.clientHeight + 1,
              overflow: getComputedStyle(column).overflowY,
              bottom: Math.round(box.bottom),
            };
          }),
        );
      }
    });
    assert.ok(states[0].taller, "la colonne tient dans l'écran : le cas à tester n'existe plus");
    for (const state of states) {
      assert.equal(state.scrollsInside, false, "la colonne épinglée défile sur elle-même");
      assert.equal(state.overflow, "visible", `overflow-y: ${state.overflow}`);
    }
    assert.ok(states[1].bottom <= 760, `le bas de la colonne reste sous l'écran (${states[1].bottom} px)`);
  });
}
