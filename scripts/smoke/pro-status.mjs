/* Le statut professionnel et la qualité du vendeur : la déclaration du
   SIRET dans Paramètres — sa forme vérifiée dans le navigateur, sans
   appeler le répertoire —, et ce que chaque fiche dit de qui vend (Code de
   la consommation, D111-8). u-01, le compte de démonstration, est un
   particulier ; l-37 est déposée par une boutique. */
import assert from "node:assert/strict";
import { check, page } from "./harness.mjs";
import { visit } from "./helpers.mjs";

export async function proStatus() {
  await check("Paramètres : un SIRET mal tapé est refusé tout de suite, et le focus revient au champ", async () => {
    await visit(page, "/mon-compte/parametres");
    await page.locator("legend", { hasText: "Compte professionnel" }).waitFor();
    await page.locator("#siret").fill("552 032 534 00704");
    await page.locator('label[for="certifies"]').click();
    await page.getByRole("button", { name: "Vérifier et passer en professionnel" }).click();
    await page.locator("#siret-error", { hasText: /pas un SIRET valide/ }).waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "siret");
  });

  await check("Paramètres : sans la déclaration, rien ne part vers le répertoire", async () => {
    await page.locator('label[for="certifies"]').click();
    await page.locator("#siret").fill("552 032 534 00703");
    await page.getByRole("button", { name: "Vérifier et passer en professionnel" }).click();
    await page.locator("#certifies-error").waitFor();
    assert.equal(await page.locator("#siret-error").count(), 0, "un SIRET valide est encore refusé");
  });

  await check("une fiche dit qui vend : une vente entre particuliers, et ce qu'elle ne garantit pas", async () => {
    await visit(page, "/annonces/vrac-400-cartes-pokemon-series-eb-et-ecarlate-violet-avignon-01");
    const terms = page.locator("section", { has: page.getByRole("heading", { name: "Conditions de la vente" }) });
    assert.match(await terms.textContent(), /Vente entre particuliers[\s\S]*garantie des vices cachés/);
    assert.equal(await terms.locator('a[href*="legifrance.gouv.fr"]').count(), 1, "la garantie des vices cachés n'est pas reliée à son texte");
  });

  await check("une fiche de boutique dit « Vendu par un professionnel »", async () => {
    await visit(page, "/annonces/vrac-pokemon-au-kilo-communes-triees-par-energie-avignon-37");
    const terms = page.locator("section", { has: page.getByRole("heading", { name: "Conditions de la vente" }) });
    assert.match(await terms.textContent(), /Vendu par un professionnel/);
  });
}
