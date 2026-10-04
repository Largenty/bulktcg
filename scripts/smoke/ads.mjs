/* Les emplacements publicitaires : identifiés comme tels, à leur taille
   nominale, sans décaler la page, et absents des pages où ils n'ont rien à
   faire. */
import assert from "node:assert/strict";
import { check, page } from "./harness.mjs";
import { visit, withPage } from "./helpers.mjs";

export async function slots() {
  await check("les emplacements publicitaires sont identifiés comme tels", async () => {
    await visit(page, "/annonces");
    const slots = page.locator("[data-ad-slot]");
    assert.ok((await slots.count()) >= 2, "aucun emplacement sur la liste");

    const labels = await slots.evaluateAll((nodes) =>
      nodes.map((node) => ({
        aria: node.getAttribute("aria-label"),
        visible: node.textContent.includes("Publicité"),
        tag: node.tagName,
      })),
    );
    /* Le nom commence par « Publicité » et porte le format : deux encarts
       d'une même page ne s'appellent pas pareil (smoke/accessibility.mjs). */
    assert.equal(
      labels.every((slot) => /^Publicité — /.test(slot.aria ?? "") && slot.visible),
      true,
      "un emplacement n'affiche pas sa mention Publicité",
    );
    /* Un encart déguisé en annonce serait trompeur : aucun ne doit être un
       <article>, la balise des vignettes. */
    assert.equal(
      labels.every((slot) => slot.tag === "ASIDE"),
      true,
    );
  });

  await check("chaque emplacement fait sa taille nominale, sans être écrasé", async () => {
    /* Une régie livre des créations aux dimensions IAB exactes : un pavé servi
       dans une colonne de 280 px n'affiche rien de correct. La colonne des
       filtres a été portée à 300 px pour cette raison. */
    await visit(page, "/annonces");
    const measured = await page.locator("[data-ad-slot] .ad-slot").evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          expected: `${style.getPropertyValue("--ad-width").trim()}×${style.getPropertyValue("--ad-height").trim()}`,
          actual: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
        };
      }),
    );
    /* Deux emplacements depuis septembre 2026 : le pavé de la colonne et la
       bannière de la grille. Le leaderboard de tête, qui coupait la page entre
       la recherche et ses résultats, a été retiré. */
    assert.ok(measured.length >= 2, `${measured.length} emplacement(s) mesuré(s)`);
    assert.deepEqual(
      measured.filter((slot) => slot.expected !== slot.actual),
      [],
    );
  });

  await check("la publicité ne décale pas la mise en page", async () => {
    /* Une pub dont la hauteur n'est pas réservée pousse la grille vers le bas
       au moment où elle arrive, et l'acheteur clique à côté de ce qu'il visait.
       C'est la première nuisance d'un site financé par la publicité. */
    for (const route of ["/", "/annonces"]) {
      await visit(page, route);
      const shift = await page.evaluate(
        () =>
          new Promise((resolve) => {
            let total = 0;
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) total += entry.value;
              }
            }).observe({ type: "layout-shift", buffered: true });
            setTimeout(() => resolve(total), 2500);
          }),
      );
      assert.ok(shift < 0.1, `${route} : décalage cumulé de ${shift.toFixed(3)}, seuil 0,1`);
    }
  });

  await check("la bannière de la grille suit toujours deux rangées pleines", async () => {
    /* Elle était insérée après la sixième vignette, un calcul fait pour trois
       colonnes : à quatre, la deuxième rangée finissait sur deux annonces et
       un trou. On compte, à plusieurs largeurs, les vignettes posées au-dessus
       d'elle : deux rangées pleines, quel que soit le nombre de colonnes. */
    for (const width of [700, 1280, 1640, 1920]) {
      const layout = await withPage({ width, height: 1000 }, async (wide) => {
        await visit(wide, "/annonces");
        return wide.evaluate(() => {
          const insert = document.querySelector(".grid-insert");
          if (!insert) return null;
          const cards = [...insert.parentElement.children].filter((item) => item !== insert);
          const adTop = insert.getBoundingClientRect().top;
          const firstTop = cards[0].getBoundingClientRect().top;
          return {
            above: cards.filter((card) => card.getBoundingClientRect().bottom <= adTop + 1).length,
            columns: cards.filter((card) => Math.abs(card.getBoundingClientRect().top - firstTop) < 2).length,
          };
        });
      });
      assert.ok(layout, `pas de bannière dans la grille à ${width} px`);
      assert.equal(layout.above, layout.columns * 2, `${width} px : ${layout.above} vignettes au-dessus pour ${layout.columns} colonnes`);
    }
  });

  await check("aucune publicité dans le tunnel de dépôt ni dans les messages", async () => {
    for (const route of ["/deposer", "/messages", "/messages/c-01", "/connexion", "/inscription", "/securite"]) {
      await visit(page, route);
      assert.equal(
        await page.locator("[data-ad-slot]").count(),
        0,
        `un emplacement publicitaire est présent sur ${route}`,
      );
    }
  });
}

export async function noneOnAccount() {
  await check("aucune publicité sur le compte", async () => {
    for (const path of ["/mon-compte", "/mon-compte/annonces", "/mon-compte/recherches"]) {
      await visit(page, path);
      assert.equal(await page.locator("aside").count(), 0, `un encart traîne sur ${path}`);
    }
  });
}
