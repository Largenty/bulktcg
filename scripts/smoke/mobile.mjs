/* Sur téléphone : ce qui doit tenir dans le premier écran, aucune page plus
   large que l'écran, et la feuille de filtres. */
import assert from "node:assert/strict";
import { browser, check } from "./harness.mjs";
import { VISIBLE_CARDS, visit } from "./helpers.mjs";
import { LISTING_OF_OTHER } from "./fixtures.mjs";

/** @import { Locator } from "playwright" */

const PHONE = { width: 390, height: 844 };

/* Le haut de l'élément tient dans le premier écran du téléphone. */
/** @param {Locator} locator @param {string} what */
async function assertInFirstScreen(locator, what) {
  const box = await locator.boundingBox();
  assert.ok(box && box.y < PHONE.height, `${what} à y = ${Math.round(box?.y ?? -1)}`);
}

export async function phoneScreens() {
  const phone = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 2,
    locale: "fr-FR",
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await phone.newPage();

  await check("sur téléphone, la première annonce apparaît dans le premier écran", async () => {
    /* Elle arrivait à 1 866 px : panneau de filtres et encarts la précédaient. */
    await visit(mobile, "/annonces");
    await assertInFirstScreen(mobile.locator(VISIBLE_CARDS).first(), "première annonce");
  });

  await check("sur téléphone, le titre, le prix et le contact d'une fiche sont dans le premier écran", async () => {
    /* Le titre arrivait à 2 133 px, sous toute la description. */
    await visit(mobile, `/annonces/${LISTING_OF_OTHER}`);
    await assertInFirstScreen(mobile.locator("h1"), "titre");
    const bar = mobile.locator(".action-bar");
    assert.equal(await bar.isVisible(), true, "la barre d'action mobile est absente");
    await bar.getByRole("link", { name: "Contacter" }).waitFor();
    assert.match(await bar.textContent(), /150/);
  });

  await check("sur téléphone, l'aperçu de la vignette précède le bouton de publication", async () => {
    /* Il arrivait à 4 312 px, sous « Publier l'annonce » : on ne voyait sa
       vignette qu'après avoir publié. */
    await visit(mobile, "/deposer");
    const preview = await mobile.getByRole("heading", { name: "Aperçu de votre vignette" }).boundingBox();
    const publish = await mobile.getByRole("button", { name: "Publier l'annonce" }).boundingBox();
    assert.ok(preview && publish, "aperçu ou bouton introuvable");
    assert.ok(preview.y < publish.y, `aperçu à y = ${Math.round(preview.y)}, bouton à y = ${Math.round(publish.y)}`);
  });

  await check("sur téléphone, le champ du nouveau message est dans le premier écran", async () => {
    /* La fiche du lot, photo comprise, le repoussait sous le premier écran. */
    await visit(mobile, `/messages/nouveau?annonce=${LISTING_OF_OTHER}`);
    await assertInFirstScreen(mobile.locator("textarea").first(), "champ");
  });

  await check("aucune page ne déborde en largeur sur un téléphone de 360 px", async () => {
    /* Messages et Mon compte débordaient de l'en-tête : deux utilitaires
       d'affichage sur le même élément, arbitrés par la feuille générée.

       La mesure se fait contre clientWidth, pas innerWidth : en émulation
       mobile, le navigateur élargit la fenêtre jusqu'à la largeur du contenu,
       et innerWidth valait 1 000 quand l'accueil débordait de 640 px. Le test
       comparait le débordement à lui-même et passait. */
    await mobile.setViewportSize({ width: 360, height: 800 });
    const routes = [
      "/",
      "/annonces",
      `/annonces/${LISTING_OF_OTHER}`,
      "/deposer",
      "/recherches",
      "/recherches/cherche-display-riftbound-scellee-vf-ou-vo-apt-14",
      "/pokemon/avignon",
      "/pro",
      "/pro/lots",
      "/mon-compte",
      "/mon-compte/annonces",
      "/messages",
      `/messages/nouveau?annonce=${LISTING_OF_OTHER}`,
    ];
    for (const route of routes) {
      await visit(mobile, route);
      const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `${route} déborde de ${overflow}px`);
    }
    /* Le menu ouvert aussi : son sélecteur de thème en sortait de 7 px. */
    await visit(mobile, "/");
    await mobile.getByRole("button", { name: /menu/i }).first().click();
    const menuOverflow = await mobile.evaluate(() => {
      const sheet = document.querySelector("dialog[open]");
      return sheet ? sheet.scrollWidth - sheet.clientWidth : 0;
    });
    assert.ok(menuOverflow <= 0, `le menu ouvert déborde de ${menuOverflow}px`);
    await mobile.keyboard.press("Escape");
    await mobile.setViewportSize(PHONE);
  });

  await check("sur téléphone, les filtres s'ouvrent dans une feuille et s'appliquent en direct", async () => {
    await visit(mobile, "/annonces");
    await mobile.getByRole("button", { name: /^Filtres/ }).click();
    const sheet = mobile.getByRole("dialog", { name: "Filtres" });
    await sheet.waitFor();
    await sheet.getByRole("group", { name: "Format du lot" }).getByRole("button", { name: "Classeur" }).click();
    await mobile.waitForURL(/type=binder/);
    /* La feuille reste ouverte : on règle plusieurs critères d'affilée. */
    assert.equal(await sheet.isVisible(), true);
    const footer = sheet.getByRole("button", { name: /^Voir \d+ annonce/ });
    await footer.click();
    await sheet.waitFor({ state: "hidden" });
    assert.match(await mobile.getByRole("button", { name: /^Filtres/ }).textContent(), /1/);
  });

  await phone.close();
}
