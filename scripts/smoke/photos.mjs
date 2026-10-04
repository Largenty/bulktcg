/* Les photos : galerie de la fiche, chargement, texte alternatif, filigrane,
   crédit des photographes, et la mention « Sans photo ». */
import assert from "node:assert/strict";
import { check, page } from "./harness.mjs";
import { VISIBLE_CARDS, visit } from "./helpers.mjs";
import { OWN_LISTING } from "./fixtures.mjs";

export async function gallery() {
  await check("la galerie photo change de vue au clic sur une miniature", async () => {
    await visit(page, `/annonces/${OWN_LISTING}`);
    await page.getByRole("button", { name: "Afficher la photo 3" }).click();
    await page.getByText(/Photo 3 sur 6/).first().waitFor();
    assert.equal(await page.getByRole("button", { name: "Afficher la photo 3" }).getAttribute("aria-pressed"), "true");
  });
}

export async function loadingAndWatermark() {
  await check("les photos d'annonce se chargent réellement", async () => {
    const failures = [];
    page.on("response", (response) => {
      if (response.url().includes("/_next/image") && response.status() >= 400) {
        failures.push(`${response.status()} ${response.url().slice(0, 120)}`);
      }
    });
    await visit(page, "/annonces");
    // eslint-disable-next-line bulktcg/playwright-locators -- prouver une absence d'échec : chaque photo doit avoir chargé ou échoué
    await page.waitForLoadState("networkidle").catch(() => {});
    const broken = await page.locator("article.card img").evaluateAll((nodes) =>
      nodes.filter((node) => !node.complete || node.naturalWidth === 0).map((node) => node.src),
    );
    assert.deepEqual(broken, [], "des photos ne se sont pas chargées");
    assert.deepEqual(failures, []);
    /* Chaque vignette montre sa photo ou dit qu'elle n'en a pas : un
       emplacement muet ferait attendre une image qui ne viendra pas. Le
       plancher garde contre une grille sans aucune image ; ce n'est pas un
       quota — One Piece, Naruto, Riftbound et « Autre », sans photo honnête,
       tiennent huit des dix-huit places de la première page. */
    const cards = await page.locator(VISIBLE_CARDS).evaluateAll((nodes) =>
      nodes.map((card) => ({ hasPhoto: card.querySelector("img") !== null, saysNone: /Sans photo/.test(card.textContent) })),
    );
    assert.deepEqual(cards.filter((card) => card.hasPhoto === card.saysNone), [], "une vignette sans photo ne le dit pas");
    assert.ok(cards.filter((card) => card.hasPhoto).length >= 8, "trop peu de photos rendues dans la grille");
  });

  await check("chaque photo porte un texte alternatif utile", async () => {
    const alts = await page
      .locator("article.card img")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("alt")));
    assert.ok(alts.length > 0);
    assert.deepEqual(
      alts.filter((alt) => !alt || alt.trim().length < 8),
      [],
      "une vignette a un alt vide ou inutilisable",
    );
  });

  await check("le filigrane d'une photo nomme bien le vendeur de son annonce", async () => {
    /* C'est tout l'intérêt du filigrane : une photo dont la marque ne
       correspond pas au vendeur affiché est une photo reprise ailleurs.
       Deux annonces d'un même vendeur portent la même marque, et c'est
       normal — ce qu'on vérifie, c'est la correspondance, pas l'unicité. */
    await visit(page, "/annonces");
    /* Cadré sur le panneau visible : l'onglet des recherches est rendu lui
       aussi, et ses vignettes n'ont ni photo ni filigrane. */
    const cards = await page.locator(VISIBLE_CARDS).evaluateAll((nodes) =>
      nodes.map((card) => ({
        hasPhoto: card.querySelector("img") !== null,
        mark: card.querySelector(".watermark")?.textContent?.trim() ?? null,
        seller: card.querySelector("[data-seller]")?.dataset.seller ?? null,
      })),
    );

    const withPhoto = cards.filter((card) => card.hasPhoto);
    assert.ok(withPhoto.length >= 8, "trop peu de vignettes avec photo pour que la vérification dise quelque chose");
    const mismatched = withPhoto.filter(({ mark, seller }) => mark !== `@${seller}`);
    assert.deepEqual(
      mismatched,
      [],
      "un filigrane ne correspond pas au vendeur affiché sur la même vignette",
    );
    /* Sans photo, pas de filigrane : il marque une photo contre la reprise,
       posé sur l'emplacement aux couleurs du jeu il ne protégerait rien. */
    assert.deepEqual(
      cards.filter((card) => !card.hasPhoto && card.mark !== null),
      [],
      "une vignette sans photo porte un filigrane",
    );
  });

  await check("le filigrane ne recouvre aucune donnée de la vignette", async () => {
    /* Un chevauchement se voit sur une capture mais pas dans le DOM : les deux
       éléments existent, l'un est simplement caché derrière l'autre. */
    const overlaps = await page.locator("article.card").evaluateAll((cards) =>
      cards
        .map((card) => {
          const mark = card.querySelector(".watermark")?.getBoundingClientRect();
          const band = card.querySelector("dl")?.getBoundingClientRect();
          if (!mark || !band) return null;
          const overlap =
            Math.max(0, Math.min(mark.bottom, band.bottom) - Math.max(mark.top, band.top)) *
            Math.max(0, Math.min(mark.right, band.right) - Math.max(mark.left, band.left));
          return overlap > 1 ? `${card.querySelector("h3")?.textContent?.slice(0, 30)}` : null;
        })
        .filter(Boolean),
    );
    assert.deepEqual(overlaps, []);
  });

  await check("le filigrane reste dans le cadre de la photo, sans la masquer", async () => {
    const overflow = await page.locator("article.card .watermark").evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const mark = node.getBoundingClientRect();
          const photo = node.parentElement.getBoundingClientRect();
          return mark.right > photo.right || mark.width > photo.width * 0.7
            ? `${node.textContent.trim()} (${Math.round(mark.width)} / ${Math.round(photo.width)})`
            : null;
        })
        .filter(Boolean),
    );
    assert.deepEqual(overflow, []);
  });

  await check("les miniatures de la galerie ne portent pas de filigrane", async () => {
    await visit(page, `/annonces/${OWN_LISTING}`);
    assert.equal(await page.locator("figure .watermark").count(), 1, "photo principale");
    assert.equal(
      await page.locator("button[aria-label^='Afficher la photo'] .watermark").count(),
      0,
      "une miniature porte un filigrane illisible à sa taille",
    );
  });
}

export async function credit() {
  await check("le crédit photographe est présent sur la page d'annonce", async () => {
    await visit(page, `/annonces/${OWN_LISTING}`);
    await page.getByText(/Photos de démonstration/).first().waitFor();
    const links = await page
      .locator('a[href^="https://unsplash.com"]')
      .evaluateAll((nodes) => nodes.length);
    assert.ok(links >= 2, `seulement ${links} lien(s) de crédit`);
  });
}

export async function noPhotoLabel() {
  await check("« Sans photo » n'est jamais coupé, même dans une miniature", async () => {
    /* Il s'affichait dès 640 px d'écran, y compris dans les miniatures de
       64 px des listes du compte, où il ne restait que « PHOTO ». */
    for (const route of ["/mon-compte/transactions", "/annonces", "/messages"]) {
      await visit(page, route);
      const clipped = await page.evaluate(() =>
        [...document.querySelectorAll(".lot-window-empty")]
          .filter((label) => getComputedStyle(label).display !== "none")
          .filter((label) => label.getBoundingClientRect().right > label.closest(".photo-frame").getBoundingClientRect().right + 0.5)
          .length,
      );
      assert.equal(clipped, 0, `${route} : ${clipped} mention(s) « Sans photo » coupée(s)`);
    }
  });
}
