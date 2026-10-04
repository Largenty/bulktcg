/* Mode sombre : le réglage de l'appareil, le choix explicite, la première
   peinture, l'impression — et l'aplat d'encre réservé aux gestes. */
import assert from "node:assert/strict";
import { browser, check, page } from "./harness.mjs";
import { visit, waitForTransitions } from "./helpers.mjs";
import { OWN_LISTING } from "./fixtures.mjs";

/** @import { Page } from "playwright" */

/* La couleur du papier, lue sur le corps de la page, dit quel thème est
   peint. */
const LIGHT_PAPER = "rgb(233, 236, 239)";
const DARK_PAPER = "rgb(11, 14, 18)";
/** @param {Page} tab */
const paperOf = (tab) => tab.evaluate(() => getComputedStyle(document.body).backgroundColor);

/* Un visiteur neuf, sans choix enregistré, sur un appareil réglé en clair
   ou en sombre. */
function themedContext(colorScheme, options = {}) {
  return browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "fr-FR", colorScheme, ...options });
}

export async function darkMode() {
  await check("sans choix, la page suit le réglage de l'appareil", async () => {
    /* En « système », le script n'écrit rien : c'est la media query de
       tokens.css qui bascule, et elle suit l'appareil sans JavaScript. */
    for (const [colorScheme, expected] of [["light", LIGHT_PAPER], ["dark", DARK_PAPER]]) {
      const themed = await themedContext(colorScheme);
      const tab = await themed.newPage();
      await visit(tab, "/annonces");
      const attribute = await tab.evaluate(() => document.documentElement.getAttribute("data-theme"));
      const paper = await paperOf(tab);
      await themed.close();
      assert.equal(attribute, null, `réglage ${colorScheme} : un attribut est posé sans choix`);
      assert.equal(paper, expected, `réglage ${colorScheme}`);
    }
  });

  await check("sans JavaScript, la page suit encore l'appareil", async () => {
    const themed = await themedContext("dark", { javaScriptEnabled: false });
    const tab = await themed.newPage();
    await visit(tab, "/annonces");
    const paper = await paperOf(tab);
    await themed.close();
    assert.equal(paper, DARK_PAPER);
  });

  await check("un thème imposé est posé avant la première peinture", async () => {
    /* Lire l'attribut à « domcontentloaded » ne prouve rien sur la première
       peinture. On observe le document depuis sa naissance, et on lit la
       couleur de la page à la première image. */
    const themed = await themedContext("light");
    await themed.addInitScript(() => {
      window.__theme = { setAt: null, firstFrame: null, refused: [] };
      /* Le script de thème est en ligne : sans le nonce de la réponse, la CSP
         le refuse, et c'est ThemeSync qui pose le thème — après la peinture. */
      document.addEventListener("securitypolicyviolation", (event) => window.__theme.refused.push(`${event.effectiveDirective} ${event.sample}`));
      requestAnimationFrame(() => {
        window.__theme.firstFrame = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
      });
      new MutationObserver(() => {
        if (window.__theme.setAt === null && document.documentElement?.hasAttribute("data-theme")) window.__theme.setAt = performance.now();
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-theme"] });
    });
    const tab = await themed.newPage();
    await visit(tab, "/annonces");
    await tab.evaluate(() => localStorage.setItem("theme", "dark"));
    await tab.reload({ waitUntil: "load" });
    await tab.waitForFunction(() => performance.getEntriesByType("paint").some((entry) => entry.name === "first-paint"));
    const measured = await tab.evaluate(() => ({
      ...window.__theme,
      firstPaint: performance.getEntriesByType("paint").find((entry) => entry.name === "first-paint").startTime,
    }));
    await themed.close();
    assert.deepEqual(measured.refused, [], "la CSP refuse un script de la page, celui du thème peut-être");
    assert.ok(measured.setAt !== null && measured.setAt < measured.firstPaint, `posé à ${measured.setAt} ms, peint à ${measured.firstPaint} ms`);
    assert.equal(measured.firstFrame, "#0b0e12");
  });

  await check("le choix clair ou sombre change la page, survit au rechargement, et « Système » rend la main", async () => {
    const themed = await themedContext("light");
    const tab = await themed.newPage();
    const errors = [];
    tab.on("console", (message) => {
      if (message.type() === "error" && /hydrat/i.test(message.text())) errors.push(message.text());
    });
    await visit(tab, "/annonces");
    assert.equal(await paperOf(tab), LIGHT_PAPER);

    const toggle = tab.getByRole("button", { name: "Mode sombre" });
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    await toggle.click();
    assert.equal(await tab.evaluate(() => document.documentElement.dataset.theme), "dark");
    assert.equal(await paperOf(tab), DARK_PAPER, "le fond ne change pas en mode sombre");
    assert.equal(await toggle.getAttribute("aria-pressed"), "true");

    await tab.reload({ waitUntil: "load" });
    assert.equal(await tab.evaluate(() => document.documentElement.dataset.theme), "dark", "le choix ne survit pas au rechargement");
    const control = tab.getByRole("group", { name: "Thème d'affichage" });
    /* La page est sombre dès la première peinture ; le réglage, lui, lit le
       choix enregistré à l'hydratation — 270 ms sur le serveur de dev. Lu
       tout de suite, il disait encore « Système ». On attend l'état. */
    await control.getByRole("button", { name: "Sombre", pressed: true }).waitFor({ timeout: 5000 });

    /* « Système » rend la main à l'appareil, ici réglé en clair — puis
       l'appareil bascule, et la page le suit sans rechargement. */
    await control.getByRole("button", { name: "Système" }).click();
    assert.equal(await tab.evaluate(() => document.documentElement.getAttribute("data-theme")), null);
    assert.equal(await tab.evaluate(() => localStorage.getItem("theme")), null);
    assert.equal(await paperOf(tab), LIGHT_PAPER);
    await tab.emulateMedia({ colorScheme: "dark" });
    assert.equal(await paperOf(tab), DARK_PAPER, "la page ne suit pas l'appareil qui bascule");
    await themed.close();
    assert.deepEqual(errors, [], "désaccord d'hydratation");
  });

  await check("un choix fait dans un onglet s'applique dans l'autre", async () => {
    const themed = await themedContext("light");
    const [first, second] = [await themed.newPage(), await themed.newPage()];
    await visit(first, "/annonces");
    await visit(second, "/recherches");
    await first.getByRole("button", { name: "Mode sombre" }).click();
    await second.waitForFunction(() => document.documentElement.dataset.theme === "dark", null, { timeout: 5000 });
    await themed.close();
  });

  await check("une page imprimée reste claire, même en mode sombre imposé", async () => {
    const themed = await themedContext("dark");
    const tab = await themed.newPage();
    await visit(tab, `/annonces/${OWN_LISTING}`);
    await tab.evaluate(() => localStorage.setItem("theme", "dark"));
    await tab.reload({ waitUntil: "load" });
    await tab.emulateMedia({ media: "print", colorScheme: "dark" });
    const paper = await paperOf(tab);
    await themed.close();
    assert.equal(paper, LIGHT_PAPER);
  });
}

export async function inkRoles() {
  await check("un choix courant se cerne d'encre, l'aplat reste aux gestes", async () => {
    /* Le même noir disait « filtre actif » sur les pastilles et « à noter »
       dans le suivi. */
    const inkOf = () => {
      const probe = document.createElement("span");
      probe.style.background = "var(--ink)";
      document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    };
    await visit(page, "/annonces?type=bulk&page=1");
    const listing = await page.evaluate((probe) => {
      const ink = new Function(`return (${probe})()`)();
      const selected = [
        ...document.querySelectorAll('.pill[aria-pressed="true"], .divider[aria-pressed="true"], [role="tab"][aria-selected="true"], nav a[aria-current="page"]'),
      ].filter((node) => node.getBoundingClientRect().width > 0 && !node.closest(".on-slate"));
      return { count: selected.length, filled: selected.filter((node) => getComputedStyle(node).backgroundColor === ink).map((node) => node.textContent.trim()) };
    }, inkOf.toString());
    assert.ok(listing.count >= 3, `${listing.count} choix courant(s) trouvé(s)`);
    assert.deepEqual(listing.filled, []);
    await visit(page, "/mon-compte");
    const actions = await page.evaluate((probe) => {
      const ink = new Function(`return (${probe})()`)();
      return [...document.querySelectorAll(".pipeline-stage[data-needs-action]")].map((node) => getComputedStyle(node).backgroundColor === ink);
    }, inkOf.toString());
    assert.ok(actions.length > 0 && actions.every(Boolean), "une étape à faire n'est plus en aplat");
  });

  await check("l'intercalaire d'un jeu choisi prend sa couleur, et aucun onglet ne bouge", async () => {
    /* L'onglet actif se levait de 4 px, élargissait ses bords et passait en
       gras : il poussait ses voisins à chaque choix. Désormais seules les
       couleurs changent. */
    await visit(page, "/annonces");
    const boxes = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('[aria-label="Filtrer par jeu"] .divider')].map((node) => {
          const box = node.getBoundingClientRect();
          return [box.x, box.y, box.width, box.height].map((value) => Math.round(value));
        }),
      );
    const before = await boxes();
    await page.getByRole("navigation", { name: "Filtrer par jeu" }).getByRole("link", { name: /^Pokémon/ }).click();
    await page.waitForURL(/\/pokemon$/);
    /* L'onglet choisi est rendu, et ses couleurs ont fini leur transition :
       on compare l'état atteint, pas un instant de passage. */
    await page.locator('[aria-label="Filtrer par jeu"] .divider[aria-current="page"]', { hasText: "Pokémon" }).waitFor();
    await waitForTransitions(page);
    assert.deepEqual(await boxes(), before, "un intercalaire a bougé au choix d'un jeu");
    const fill = await page.evaluate(() => {
      const tab = document.querySelector('[aria-label="Filtrer par jeu"] .divider[aria-current="page"]');
      const probe = document.createElement("span");
      probe.style.background = "var(--pokemon)";
      document.body.append(probe);
      const pokemon = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { tab: getComputedStyle(tab).backgroundColor, pokemon };
    });
    assert.equal(fill.tab, fill.pokemon, "l'onglet Pokémon choisi n'a pas pris sa couleur");
  });
}
