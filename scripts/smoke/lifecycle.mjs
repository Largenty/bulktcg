/* Le cycle de vie d'une annonce : le décompte et le geste qui la prolonge,
   l'annonce expirée rangée à part et remise en ligne d'un clic, sa page qui
   répond hors de l'index, l'annonce archivée qui ne montre plus de photo, et
   la vignette remontée qui le dit. La démonstration porte chaque cas : l-40
   expire dans quatre jours, l-41 a expiré, l-07 est vendue et archivée, l-06
   est remontée. */
import assert from "node:assert/strict";
import { check, page } from "./harness.mjs";
import { visit } from "./helpers.mjs";

const EXPIRED = "/annonces/deck-commander-magic-monte-100-cartes-sous-pochettes-avignon-41";
const ARCHIVED = "/annonces/display-scelle-ecarlate-et-violet-151-avignon-07";

export async function expiryAndArchive() {
  await check("le décompte d'une annonce qui expire propose de la prolonger, et dit ce qui est enregistré", async () => {
    await visit(page, "/mon-compte/annonces");
    const expiring = page.locator('[data-lifecycle="expiring"]');
    assert.equal(await expiring.count(), 1, "l'annonce qui expire dans quatre jours n'a pas son décompte");
    assert.match(await expiring.textContent(), /Expire dans 4\s+jours/);
    await expiring.getByRole("button", { name: /Prolonger de 90 jours/ }).click();
    await expiring.getByText(/rien n'est enregistré/).waitFor();
  });

  await check("l'annonce expirée se range à part, sans sélecteur de statut, et se remet en ligne d'un clic", async () => {
    await page.getByRole("heading", { name: "Expirées" }).waitFor();
    const expired = page.locator('[data-lifecycle="expired"]');
    assert.equal(await expired.count(), 1);
    assert.match(await expired.textContent(), /Expirée le .+ses photos seront supprimées le/s);
    const row = page.locator("li", { has: expired });
    assert.equal(await row.getByRole("group", { name: /Statut de l'annonce/ }).count(), 0, "une annonce expirée garde son sélecteur de statut");
    await expired.getByRole("button", { name: /Remettre en ligne/ }).click();
    await expired.getByText(/rien n'est enregistré/).waitFor();
  });

  await check("l'étape « Expirée » du suivi compte autant de lignes que sa liste", async () => {
    await visit(page, "/mon-compte");
    const stage = page.locator(".pipeline-stage", { hasText: "Expirée" }).first();
    const announced = Number((await stage.locator(".price").textContent()).trim());
    await stage.click();
    await page.waitForURL(/etape=expiree/);
    assert.equal(await page.locator('[data-lifecycle="expired"]').count(), announced);
  });

  await check("la page d'une annonce expirée répond, hors de l'index, avec son badge et sans contact", async () => {
    const response = await visit(page, EXPIRED);
    assert.equal(response.status(), 200);
    assert.match(await page.locator('meta[name="robots"]').getAttribute("content"), /noindex/);
    await page.getByText("Expirée", { exact: true }).first().waitFor();
    assert.equal(await page.getByRole("link", { name: /Contacter le vendeur/ }).count(), 0);
    assert.equal(await page.locator('script[type="application/ld+json"]').filter({ hasText: '"Offer"' }).count(), 0, "une annonce expirée décrit encore une offre");
  });

  await check("une annonce archivée ne montre plus de photo, et dit qu'elles ont été retirées", async () => {
    await visit(page, ARCHIVED);
    const gallery = page.locator("main figure").first();
    await gallery.getByText("Photos retirées").waitFor();
    assert.equal(await gallery.locator("img").count(), 0, "une photo d'une annonce archivée s'affiche encore");
    const clipped = await gallery.getByText("Photos retirées").evaluate((node) => node.scrollWidth > node.clientWidth + 1);
    assert.equal(clipped, false, "« Photos retirées » est coupé");
  });

  await check("une vignette remontée le dit à côté de sa date de dépôt, sans déborder", async () => {
    await visit(page, "/magic");
    const card = page.locator("article.card", { hasText: "Vrac 2000 cartes Magic" }).first();
    const foot = card.locator(".lot-foot");
    assert.match(await foot.textContent(), /Remontée.*\d+\s?j/s);
    assert.equal(await foot.evaluate((node) => node.scrollWidth > node.clientWidth + 1), false, "le pied de la vignette remontée déborde");
  });
}
