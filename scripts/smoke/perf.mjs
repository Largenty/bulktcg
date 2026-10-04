/* Performance : ce que la page télécharge sans qu'on le lui demande. */
import assert from "node:assert/strict";
import { check } from "./harness.mjs";
import { visit, withPage } from "./helpers.mjs";

/* Une requête de préchargement de Next vers l'un des chemins donnés : le
   rendu serveur d'une page, reconnu à son paramètre _rsc ou à son en-tête. */
const prefetchOf = (paths) => (request) => {
  const url = new URL(request.url());
  return paths.has(url.pathname) && (url.searchParams.has("_rsc") || request.headers()["next-router-prefetch"] === "1");
};

export async function prefetch() {
  await check("les intercalaires de l'accueil ne préchargent aucune page avant l'intention", async () => {
    /* Audit de performance de septembre 2026 : la rangée d'intercalaires,
       entière à l'écran, téléchargeait neuf pages de jeu à chaque visite de
       l'accueil. IntentLink attend le survol, le doigt posé ou le focus. */
    await withPage({ width: 1440, height: 1000 }, async (tab) => {
      const requests = [];
      tab.on("request", (request) => requests.push(request));
      await visit(tab, "/");
      const dividers = tab.locator("a.divider");
      const paths = new Set(await dividers.evaluateAll((links) => links.map((link) => new URL(link.href).pathname)));
      assert.ok(paths.size >= 8, `seulement ${paths.size} intercalaires trouvés`);
      /* Next précharge ce qui est à l'écran une fois la page au repos, dans un
         rappel d'inactivité. Une absence ne se prouve qu'en observant pendant
         un temps donné : c'est la seule attente fixe voulue du smoke, et la
         moitié « survol » ci-dessous prouve que l'observation voit bien un
         préchargement quand il a lieu. */
      // eslint-disable-next-line bulktcg/playwright-locators -- Next précharge une fois la page au repos : ce repos précède l'observation
      await tab.waitForLoadState("networkidle");
      // eslint-disable-next-line bulktcg/playwright-locators -- on observe une absence : aucun état à attendre
      await tab.waitForTimeout(1500);
      const early = requests.filter(prefetchOf(paths)).map((request) => new URL(request.url()).pathname);
      assert.deepEqual(early, [], `pages préchargées sans intention : ${early.join(", ")}`);

      /* L'intention suffit : survoler un intercalaire précharge sa page. Sans
         cette seconde moitié, le parcours passerait aussi avec des liens
         morts, ou si Next ne préchargeait plus rien du tout. */
      const target = dividers.nth(1);
      const targetPath = new URL(await target.evaluate((link) => link.href)).pathname;
      const hovered = tab.waitForRequest(prefetchOf(new Set([targetPath])), { timeout: 5000 });
      await target.hover();
      await hovered;
    });
  });

  await check("le pied de page ne précharge aucune page avant l'intention", async () => {
    /* Une vingtaine de liens, préchargés dès que le pied de page arrivait à
       l'écran : sur chaque page courte, et au bas de chaque page longue. On
       défile jusqu'en bas pour qu'il y soit, et on ne surveille que les pages
       qu'il est seul à viser — « Déposer » vit aussi dans l'en-tête. */
    await withPage({ width: 1440, height: 1000 }, async (tab) => {
      const requests = [];
      tab.on("request", (request) => requests.push(request));
      await visit(tab, "/connexion");
      const footerOnly = await tab.evaluate(() => {
        const pathOf = (link) => new URL(link.href).pathname;
        const elsewhere = new Set([...document.querySelectorAll("a:not(footer a)")].map(pathOf));
        return [...new Set([...document.querySelectorAll("footer a")].map(pathOf))].filter((path) => !elsewhere.has(path));
      });
      assert.ok(footerOnly.length >= 10, `seulement ${footerOnly.length} liens propres au pied de page`);
      const paths = new Set(footerOnly);
      await tab.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      // eslint-disable-next-line bulktcg/playwright-locators -- même repos que ci-dessus, avant la même observation
      await tab.waitForLoadState("networkidle");
      // eslint-disable-next-line bulktcg/playwright-locators -- même fenêtre d'observation que ci-dessus
      await tab.waitForTimeout(1500);
      const early = requests.filter(prefetchOf(paths)).map((request) => new URL(request.url()).pathname);
      assert.deepEqual(early, [], `pages préchargées sans intention : ${early.join(", ")}`);

      /* Et l'intention suffit, sans quoi le parcours passerait aussi avec des
         liens morts. */
      const target = tab.locator(`footer a[href="${footerOnly[0]}"]`).first();
      const hovered = tab.waitForRequest(prefetchOf(new Set([footerOnly[0]])), { timeout: 5000 });
      await target.hover();
      await hovered;
    });
  });
}
