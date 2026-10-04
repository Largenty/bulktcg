/* La console : ce que le navigateur reproche aux pages sans qu'aucun écran
   ne le montre. */
import assert from "node:assert/strict";
import { check } from "./harness.mjs";
import { LISTING_OF_OTHER, OWN_LISTING, SOLD_WITH_DEAL } from "./fixtures.mjs";
import { visit, withPage } from "./helpers.mjs";

/* Un gabarit de chaque sorte, public comme privé. */
const PAGES = [
  "/",
  "/annonces",
  "/pokemon",
  "/pokemon/avignon",
  `/annonces/${OWN_LISTING}`,
  `/annonces/${LISTING_OF_OTHER}`,
  `/annonces/${SOLD_WITH_DEAL}`,
  "/recherches",
  "/pro",
  "/pro/lots",
  "/profil/lecomptoirdukado",
  "/deposer",
  "/deposer/recherche",
  "/messages",
  "/messages/c-01",
  "/mon-compte",
  "/mon-compte/annonces",
  "/mon-compte/transactions",
  "/notifications",
  "/connexion",
  "/inscription",
  "/securite",
  `/signaler?annonce=${LISTING_OF_OTHER}`,
];

export async function quiet() {
  await check("aucune page n'écrit d'erreur ni d'avertissement dans la console", async () => {
    /* Relevé par un script d'audit qui n'était pas dans la suite : l'en-tête
       Permissions-Policy citait « bluetooth », que Chrome ne connaît pas, et
       chaque page écrivait « Unrecognized feature » dans la console. Une
       violation de CSP, un désaccord d'hydratation (React #418) ou une
       exception y arrivent de la même façon. */
    const problems = [];
    await withPage({ width: 1440, height: 1000 }, async (tab) => {
      /* Chrome écrit aujourd'hui chaque violation de CSP dans la console ; on
         ne dépend pas de cette habitude : l'événement du document la porte
         jusqu'ici quoi qu'il arrive. */
      await tab.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (event) => {
          console.error(`CSP : ${event.effectiveDirective} refuse ${event.blockedURI || "un script en ligne"}`);
        });
      });
      let current = "";
      tab.on("console", (message) => {
        if (message.type() === "error" || message.type() === "warning") {
          problems.push(`${current} — ${message.type()} : ${message.text().slice(0, 200)}`);
        }
      });
      tab.on("pageerror", (error) => problems.push(`${current} — exception : ${error.message.slice(0, 200)}`));
      for (const path of PAGES) {
        current = path;
        await visit(tab, path);
        // eslint-disable-next-line bulktcg/playwright-locators -- prouver une absence de message : tout ce que la page charge doit avoir parlé
        await tab.waitForLoadState("networkidle");
      }
    });
    /* Sur une ligne : le rapport ne garde que la première du message. */
    assert.equal(problems.length, 0, `${problems.length} message(s) : ${problems.slice(0, 4).join(" | ")}`);
  });
}
