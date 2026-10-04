/* La messagerie : contacter un vendeur, les fils d'un lot réservé, la liste
   d'attente, les notifications et la boîte de réception. */
import assert from "node:assert/strict";
import { check, page } from "./harness.mjs";
import { visit } from "./helpers.mjs";
import { LISTING_OF_OTHER, OWN_LISTING } from "./fixtures.mjs";

export async function contact() {
  await check("« Contacter le vendeur » ouvre un message sur ce lot, pas la boîte de réception", async () => {
    await visit(page, `/annonces/${LISTING_OF_OTHER}`);
    await page.getByRole("link", { name: "Contacter le vendeur" }).click();
    await page.waitForURL(new RegExp(`/messages/nouveau\\?annonce=${LISTING_OF_OTHER}`));
    const message = page.locator("#message");
    assert.match(await message.inputValue(), /Classeur One Piece complet/);
    await page.getByRole("button", { name: /Le prix est-il discutable/ }).click();
    assert.match(await message.inputValue(), /Le prix est-il discutable/);
    await page.getByRole("button", { name: "Envoyer le message" }).click();
    /* Rien ne part en phase 1, et l'écran le dit ; le texte reste. */
    await page.getByText(/rien n'est parti/).waitFor();
    assert.match(await message.inputValue(), /Le prix est-il discutable/);
  });

  await check("sur sa propre annonce, le vendeur voit ses outils et non « Contacter »", async () => {
    await visit(page, `/annonces/${OWN_LISTING}`);
    assert.equal(await page.getByRole("link", { name: "Contacter le vendeur" }).count(), 0);
    const group = page.getByRole("group", { name: /Statut de l'annonce Vrac 400 cartes/ });
    await group.getByRole("button", { name: "Réservé" }).click();
    await page.getByText(/rien n'est enregistré/).waitFor();
  });

  await check("« J'ai ce lot » propose l'un de ses lots à l'acheteur", async () => {
    await visit(page, "/recherches/recherche-gros-lot-magic-pour-un-cube-valence-02");
    await page.getByRole("link", { name: "J'ai ce lot" }).click();
    await page.waitForURL(/\/messages\/nouveau\?recherche=/);
    /* Soit des lots à proposer, soit l'invitation à déposer ce lot : jamais
       la boîte de réception. */
    const proposal = page.getByRole("button", { name: "Proposer ce lot" });
    const deposit = page.getByRole("link", { name: "Déposer ce lot" });
    await proposal.or(deposit).first().waitFor();
  });
}

export async function threads() {
  await check("le titre « Messages » garde sa taille, liste seule ou fil ouvert", async () => {
    /* Il sautait de 46 à 22 px en ouvrant une conversation. */
    const sizes = [];
    for (const route of ["/messages", "/messages/c-01"]) {
      await visit(page, route);
      sizes.push(await page.getByRole("heading", { name: "Messages", exact: true }).evaluate((node) => getComputedStyle(node).fontSize));
    }
    assert.equal(sizes[0], sizes[1], `« Messages » fait ${sizes[0]} puis ${sizes[1]}`);
  });

  await check("un fil réservé pour un autre se relit, mais ne se relance plus", async () => {
    /* c-04 : le compte de démonstration avait écrit avant que l-27 soit
       réservé pour quelqu'un d'autre. */
    await visit(page, "/messages/c-04");
    assert.equal(await page.getByRole("button", { name: /^Envoyer/ }).count(), 0, "le champ de réponse est encore là");
    await page.getByText("Ce lot est réservé pour un autre acheteur.").waitFor();
    await page.getByRole("button", { name: "Me prévenir s'il redevient disponible" }).click();
    await page.getByText(/rien n'est enregistré/).waitFor();
    /* Le vendeur, lui, garde son champ sur son lot réservé (c-02). */
    await visit(page, "/messages/c-02");
    await page.getByRole("button", { name: /^Envoyer/ }).waitFor();
  });

  await check("sur la fiche d'un lot réservé pour un autre, la liste d'attente remplace le contact", async () => {
    await visit(page, "/annonces/classeur-magic-modern-horizons-3-180-cartes-romans-sur-isere-27");
    assert.equal(await page.getByRole("link", { name: "Contacter le vendeur" }).count(), 0);
    await page.getByRole("button", { name: "Me prévenir s'il redevient disponible" }).first().waitFor();
    /* Et l'adresse d'écriture directe ne rouvre pas la porte. */
    await visit(page, "/messages/nouveau?annonce=display-scelle-foundations-jamais-ouvert-romans-sur-isere-16");
    await page.getByRole("heading", { name: "Ce lot est réservé" }).waitFor();
    assert.equal(await page.locator("#message").count(), 0);
  });

  await check("la cloche compte les notifications non lues et mène à leur liste", async () => {
    await visit(page, "/");
    const bell = page.getByRole("link", { name: /Notifications/ }).first();
    assert.match(await bell.textContent(), /2/);
    await bell.click();
    await page.waitForURL(/\/notifications$/);
    /* Une notification de chaque sorte, deux non lues. */
    const items = page.locator("main li");
    assert.equal(await items.count(), 5);
    assert.equal(await page.getByText("· Nouveau").count(), 2, "la cloche et la liste ne comptent pas les mêmes non lues");
    await page.getByRole("button", { name: "Tout marquer comme lu" }).click();
    await page.getByText(/rien n'est enregistré/).waitFor();
  });
}

export async function inbox() {
  await check("la boîte ne compte pas un fil verrouillé comme en attente, et chaque pseudo reste lisible", async () => {
    await visit(page, "/messages");
    const summary = await page.getByRole("heading", { name: "Messages", exact: true }).locator("xpath=following-sibling::p").textContent();
    assert.match(summary, /1\s+conversation attend votre réponse/);
    assert.match(summary, /sur un lot réservé à d'autres/);
    /* « Réservé pour ce contact » sur la ligne du pseudo le réduisait à rien. */
    const widths = await page.locator("nav ul li a p:first-child, section ul li a p:first-child").evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().width),
    );
    assert.ok(widths.length > 0 && widths.every((width) => width > 40), `pseudos écrasés : ${widths.map(Math.round).join(", ")}`);
  });
}
