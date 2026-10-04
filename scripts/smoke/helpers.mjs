/* Les gestes que les parcours répètent : ouvrir un chemin, ouvrir une page à
   une taille donnée, choisir dans une liste déroulante maison, lire un
   compteur ou la consigne d'indexation, attendre l'onglet sélectionné. */
import { BASE, browser, context } from "./harness.mjs";

/* Les types de Playwright, lus par l'éditeur et par le lint typé : sans
   eux, une page reçue en paramètre est un « any », et un appel déprécié
   ou déconseillé y passerait inaperçu. */
/** @import { Locator, Page } from "playwright" */

/* Le panneau d'onglet affiché, et ses vignettes : le panneau inactif est
   rendu lui aussi, masqué par l'attribut hidden. */
export const VISIBLE_PANEL = '[role="tabpanel"]:not([hidden])';
export const VISIBLE_CARDS = `${VISIBLE_PANEL} article.card`;

/* Ouvre un chemin du site et attend « load ». Rend la réponse, dont certains
   parcours lisent le statut. */
/** @param {Page} tab @param {string} path */
export function visit(tab, path) {
  return tab.goto(`${BASE}${path}`, { waitUntil: "load" });
}

/* Ouvre une page à la taille voulue, la confie au parcours puis la ferme,
   même s'il échoue. Par défaut, elle naît dans un contexte à elle, comme
   avec browser.newPage : locale par défaut, requêtes hors du suivi. Avec
   `mainContext`, c'est un onglet de plus du contexte commun, redimensionné
   après coup. */
/**
 * @template T
 * @param {{ width: number, height: number, mainContext?: boolean }} size
 * @param {(tab: Page) => Promise<T>} run
 * @returns {Promise<T>}
 */
export async function withPage({ width, height, mainContext = false }, run) {
  const viewport = { width, height };
  const tab = mainContext ? await context.newPage() : await browser.newPage({ viewport });
  try {
    if (mainContext) await tab.setViewportSize(viewport);
    return await run(tab);
  } finally {
    await tab.close();
  }
}

/* Choisit une valeur dans une liste déroulante maison : l'ouvrir, puis
   cliquer l'option, nommée en toutes lettres ou par un motif. */
/** @param {Page} tab @param {string} field @param {string | RegExp} option */
export async function choose(tab, field, option) {
  await tab.locator(field).click();
  await tab.getByRole("option", { name: option }).click();
}

/* Plusieurs listes d'affilée, dans l'ordre donné. */
/** @param {Page} tab @param {Array<[string, string | RegExp]>} choices */
export async function chooseAll(tab, choices) {
  for (const [field, option] of choices) await choose(tab, field, option);
}

/* Tape dans le champ commune et retient la commune que la liste propose. */
/** @param {Page} tab @param {string} typed @param {string | RegExp} city */
export async function pickCity(tab, typed, city) {
  await tab.locator("#city").fill(typed);
  await tab.getByRole("option", { name: city }).click();
}

/* La consigne d'indexation de la page, lue sur sa balise robots. */
/** @param {Page} tab */
export function robotsOf(tab) {
  return tab.locator('meta[name="robots"]').getAttribute("content");
}

/* Le compteur qu'un onglet ou un lien affiche en fin de libellé. */
/** @param {Locator} locator */
export async function announcedCount(locator) {
  return Number((await locator.textContent()).match(/(\d+)\s*$/)[1]);
}

/* Un onglet se sélectionne en trois temps : l'action écrit le fragment, le
   navigateur émet hashchange, React re-rend. Attendre le fragment ne suffit
   donc pas — c'est l'état rendu qu'il faut attendre, sans quoi on lit encore
   l'ancien panneau. */
/** @param {Page} target @param {string} prefix */
export async function waitForSelectedTab(target, prefix) {
  await target.waitForFunction(
    (label) =>
      [...document.querySelectorAll('[role="tab"]')].some(
        (tab) =>
          tab.textContent.trim().startsWith(label) &&
          tab.getAttribute("aria-selected") === "true",
      ),
    prefix,
  );
}

/** @param {Page} target @param {string} prefix */
export async function selectTab(target, prefix) {
  await target.getByRole("tab", { name: new RegExp(`^${prefix}`) }).click();
  await waitForSelectedTab(target, prefix);
}

/* Attend que les transitions CSS en cours soient finies : on mesure l'état
   atteint, pas un instant de passage. Une attente fixe passait trop tôt sur
   une machine chargée et faisait attendre pour rien sur une machine rapide.
   Les animations sans fin (reflet holographique) ne sont pas des
   transitions : elles ne retiennent rien. */
/** @param {Page} tab */
export function waitForTransitions(tab) {
  return tab.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .map((animation) => animation.finished.catch(() => null)),
    ).then(() => undefined),
  );
}

/* Attend qu'un élément ne bouge plus : deux images de suite au même endroit.
   Une colonne épinglée recalcule sa position image par image après un
   défilement ; au-delà de deux secondes on rend la main, et c'est
   l'assertion qui dira où l'élément s'est arrêté. */
/** @param {Page} tab @param {string} selector */
export function waitForStillBox(tab, selector) {
  return tab.evaluate(
    (target) =>
      new Promise((resolve) => {
        let last = null;
        let stillFrames = 0;
        let frames = 0;
        const step = () => {
          const box = document.querySelector(target)?.getBoundingClientRect();
          const position = box ? `${box.top}:${box.left}:${box.height}` : "absent";
          stillFrames = position === last ? stillFrames + 1 : 0;
          last = position;
          frames += 1;
          if (stillFrames >= 2 || frames > 120) resolve(undefined);
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    selector,
  );
}

/* La déclaration d'un vendeur particulier, au dépôt : le compte de
   démonstration en est un, et le serveur refuse le dépôt sans elle
   (Code de la consommation, D111-8). */
export async function declarePrivateSeller(tab) {
  await tab.locator('label[for="privateSeller"]').click();
}
