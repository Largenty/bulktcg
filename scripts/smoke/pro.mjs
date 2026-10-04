/* Offre pro : les lots réservés ne sortent jamais du cercle des pros. */
import assert from "node:assert/strict";
import { BASE, check, page } from "./harness.mjs";
import { VISIBLE_CARDS, robotsOf, visit } from "./helpers.mjs";

/* Les trois lots de la démonstration réservés aux pros, et le début de leur
   titre : ni l'un ni l'autre ne doit paraître sur une page publique. */
const RESERVED = [
  { slug: "carton-de-vrac-pokemon-d-une-succession-12-kg-l-isle-sur-la-sorgue-34", title: "Carton de vrac Pokémon d'une succession" },
  { slug: "trois-classeurs-magic-des-annees-1996-a-2003-carpentras-35", title: "Trois classeurs Magic des années 1996" },
  { slug: "six-displays-one-piece-scelles-op-05-a-op-10-apt-36", title: "Six displays One Piece scellés" },
];

/* Le lot réservé dont le compte de démonstration avait parlé avant le
   passage aux pros (c-06) : il le garde, les autres restent introuvables. */
const DISCUSSED = RESERVED[1];

export async function offer() {
  await check("une annonce réservée aux pros est introuvable pour un particulier", async () => {
    /* Le compte de démonstration est un particulier. Répondre « réservée »
       confirmerait que l'annonce existe, et son titre aurait déjà fui dans les
       métadonnées : c'est un 404, comme une annonce qui n'est pas la sienne. */
    for (const { slug } of RESERVED.filter((lot) => lot.slug !== DISCUSSED.slug)) {
      const response = await visit(page, `/annonces/${slug}`);
      assert.equal(response.status(), 404, `/annonces/${slug} répond ${response.status()}`);
    }
  });

  await check("qui avait écrit avant le passage aux pros relit son fil et garde la fiche, sans pouvoir écrire", async () => {
    /* c-06 : le compte de démonstration avait écrit à propos de l-35, que sa
       vendeuse a ensuite réservé aux professionnels. La fiche lui reste
       lisible et dit pourquoi il ne peut plus écrire ; son fil aussi, sans
       champ de réponse. */
    const response = await visit(page, `/annonces/${DISCUSSED.slug}`);
    assert.equal(response.status(), 200);
    await page.getByText("Ce lot est désormais réservé aux professionnels.").first().waitFor();
    assert.equal(await page.getByRole("link", { name: /Contacter le vendeur/ }).count(), 0, "le contact est encore proposé");
    await page.getByRole("link", { name: "Relire votre conversation" }).click();
    await page.waitForURL(/\/messages\/c-06$/);
    await page.getByText("Ce lot est désormais réservé aux professionnels.").first().waitFor();
    assert.equal(await page.locator("main textarea").count(), 0, "le champ de réponse est encore là");
  });

  await check("aucune page publique ne laisse fuir un lot réservé", async () => {
    /* Accueil, liste, pages de jeu et de ville, plan de site, espace pro vu
       par un particulier : ni titre ni lien d'un lot réservé. */
    const pages = ["/", "/annonces", "/pokemon", "/magic", "/pokemon/l-isle-sur-la-sorgue", "/magic/carpentras", "/pro", "/pro/lots", "/sitemap.xml"];
    for (const path of pages) {
      const html = await (await fetch(`${BASE}${path}`)).text();
      for (const { slug, title } of RESERVED) {
        assert.ok(!html.includes(slug), `${path} contient le lien de ${slug}`);
        assert.ok(!html.includes(title.replace("'", "&#x27;")) && !html.includes(title), `${path} contient « ${title} »`);
      }
    }
  });

  await check("un particulier voit combien de lots sont réservés, jamais lesquels", async () => {
    await visit(page, "/pro/lots");
    await page.getByText(/3\s*lots réservés aux pros en ce moment/).waitFor();
    assert.equal(await page.locator("article.card").count(), 0, "l'espace pro montre des vignettes à un particulier");
    const robots = await robotsOf(page);
    assert.match(robots ?? "", /noindex/);

    /* Et sous la liste publique, la ligne qui dit ce qu'on ne voit pas. */
    await visit(page, "/annonces");
    await page.getByText(/autres lots sont réservés aux professionnels/).waitFor();
  });

  await check("le forfait pro a sa page, son prix, et un bouton qui ne ment pas", async () => {
    await visit(page, "/pro");
    await page.getByRole("heading", { level: 1, name: /qu.aux pros/i }).waitFor();
    await page.getByText(/HT par mois, sans engagement/).waitFor();
    /* Les paiements n'existent pas encore : le bouton est désactivé et
       l'écran le dit, plutôt qu'une souscription qui n'aurait rien souscrit. */
    assert.equal(await page.getByRole("button", { name: "Souscrire au forfait" }).isDisabled(), true);
    await page.getByText(/Rien n.est facturé aujourd.hui/).waitFor();
  });

  await check("l'accueil présente l'offre pro et y mène", async () => {
    await visit(page, "/");
    const section = page.locator("section", { hasText: "Vendre à un pro, en un clic" });
    await section.waitFor();
    await section.getByRole("link", { name: /Voir le forfait pro/ }).click();
    await page.waitForURL(/\/pro$/);
  });

  await check("une boutique porte son badge pro sur ses vignettes", async () => {
    await visit(page, "/pokemon");
    const card = page.locator(VISIBLE_CARDS, { hasText: "repaire_du_joueur" }).first();
    await card.waitFor();
    assert.match(await card.textContent(), /vendeur professionnel/);
    assert.match(await card.locator(".credit").textContent(), /PRO/);
    /* Un particulier, lui, n'en porte pas. */
    const person = page.locator(VISIBLE_CARDS, { hasText: "lecomptoirdukado" }).first();
    assert.doesNotMatch(await person.textContent(), /professionnel|PRO/);
  });
}
