/* Le harnais des parcours : le navigateur et sa page principale, `check`,
   qui consigne un parcours sans arrêter la suite quand il échoue, le suivi
   des requêtes, et le rapport final. L'importer lance le navigateur. */
import assert from "node:assert/strict";
import { chromium } from "playwright";

export const BASE = process.env.SMOKE_BASE ?? "http://localhost:3117";
const results = [];

export async function check(name, run) {
  try {
    await run();
    results.push(["ok", name]);
  } catch (error) {
    results.push(["ÉCHEC", `${name} — ${error.message.split("\n")[0]}`]);
  }
}

export const browser = await chromium.launch();
export const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "fr-FR" });

/* Les polices sont auto-hébergées et il n'y a aucun CDN de script ni de
   style. Le seul domaine externe admis est celui des photos de
   démonstration ; toute autre fuite doit faire échouer la suite. */
const ALLOWED_HOSTS = new Set(["images.unsplash.com"]);
const foreignRequests = [];
context.on("request", (request) => {
  const url = request.url();
  if (url.startsWith(BASE) || url.startsWith("data:") || url.startsWith("blob:")) return;
  if (ALLOWED_HOSTS.has(new URL(url).hostname)) return;
  foreignRequests.push(url);
});

/* Un serveur lancé sur un build précédent sert un HTML à jour mais des chunks
   qui n'existent plus : le JavaScript client ne démarre pas et tous les
   parcours interactifs échouent par timeout, sans dire pourquoi. On le
   détecte explicitement. */
const brokenAssets = [];
context.on("response", (response) => {
  const url = response.url();
  if (response.status() >= 400 && /\/_next\/static\/.*\.(js|css)$/.test(url)) {
    brokenAssets.push(`${response.status()} ${url}`);
  }
});

export const page = await context.newPage();

/* Ce que le suivi a relevé jusqu'à ce point de la suite : seules les pages du
   contexte commun y passent. */
export async function trackedRequests() {
  await check("les ressources statiques du build servi sont toutes disponibles", async () => {
    assert.deepEqual(
      brokenAssets,
      [],
      "le serveur tourne sur un build périmé — relancez next start après le build",
    );
  });

  await check("aucune requête ne sort du domaine hors photos de démonstration", async () => {
    assert.deepEqual(foreignRequests, []);
  });
}

/* Ferme le navigateur, imprime le rapport, et sort en échec dès qu'un
   parcours a échoué. */
export async function finish() {
  await browser.close();

  for (const [status, name] of results) console.log(`${status === "ok" ? "✔" : "✖"} ${name}`);
  const failed = results.filter(([status]) => status !== "ok").length;
  console.log(`\n${results.length - failed}/${results.length} parcours vérifiés`);
  process.exit(failed > 0 ? 1 : 0);
}
