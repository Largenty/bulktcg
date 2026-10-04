/* La carte du secteur d'une annonce : elle s'ouvre depuis le lieu, se ferme à
   Échap, et ses noms tiennent dans le cadre sans se chevaucher — mesuré, pas
   déduit du DOM : un nom qui déborde existe quand même. */
import assert from "node:assert/strict";
import { check, page } from "./harness.mjs";
import { visit } from "./helpers.mjs";
import { OWN_LISTING } from "./fixtures.mjs";

/* La taille du contexte commun (harness.mjs), rendue en sortant. */
const DESKTOP = { width: 1440, height: 1000 };

async function measureLabels() {
  return page.evaluate(() => {
    const frame = document.querySelector(".sector-map").getBoundingClientRect();
    const boxes = [...document.querySelectorAll(".sector-label")]
      .filter((node) => getComputedStyle(node).display !== "none")
      .map((node) => ({ name: node.textContent, box: node.getBoundingClientRect() }));
    const outside = boxes.filter(({ box }) => box.left < frame.left - 1 || box.right > frame.right + 1).map(({ name }) => name);
    const overlapping = [];
    boxes.forEach((first, index) => {
      for (const second of boxes.slice(index + 1)) {
        const { box: a } = first;
        const { box: b } = second;
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlapping.push(`${first.name} / ${second.name}`);
      }
    });
    return { count: boxes.length, outside, overlapping };
  });
}

export async function map() {
  for (const [label, viewport] of [["ordinateur", DESKTOP], ["téléphone", { width: 360, height: 780 }]]) {
    await check(`le lieu ouvre la carte de son secteur, dont les noms tiennent dans le cadre (${label})`, async () => {
      await page.setViewportSize(viewport);
      await visit(page, `/annonces/${OWN_LISTING}`);
      await page.getByRole("button", { name: /voir le secteur sur une carte/ }).click();
      const dialog = page.getByRole("dialog", { name: /Le secteur d.Avignon/ });
      await dialog.waitFor();
      const { count, outside, overlapping } = await measureLabels();
      assert.ok(count >= 1, "aucun nom sur la carte");
      assert.deepEqual(outside, [], `des noms débordent du cadre : ${outside.join(", ")}`);
      assert.deepEqual(overlapping, [], `des noms se chevauchent : ${overlapping.join(", ")}`);
      /* La liste sous la carte donne toutes les voisines, même celles dont
         le nom n'a pas trouvé de place. */
      await dialog.getByText(/À moins de 50/).waitFor();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
    });
  }
  await page.setViewportSize(DESKTOP);
}
