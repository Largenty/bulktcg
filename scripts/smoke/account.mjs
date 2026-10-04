/* Le compte : statuts, tableau de bord, suppression et modification, profil
   public, connexion et inscription, ventes et avis. */
import assert from "node:assert/strict";
import { check, page } from "./harness.mjs";
import { pickCity, visit, withPage } from "./helpers.mjs";
import { OWN_LISTING, SOLD_WITH_DEAL } from "./fixtures.mjs";

export async function statusSwitch() {
  await check("le changement de statut répond et l'annonce vocale suit", async () => {
    await visit(page, "/mon-compte/annonces");
    const group = page.getByRole("group", { name: /Statut de l'annonce/ }).first();
    const reserved = group.getByRole("button", { name: "Réservé" });
    assert.equal(await reserved.getAttribute("aria-pressed"), "false");
    await reserved.click();
    assert.equal(await reserved.getAttribute("aria-pressed"), "true");
    assert.equal(await group.getByRole("button", { name: "Disponible" }).getAttribute("aria-pressed"), "false");
    assert.match(await group.locator("output").textContent(), /Réservé/);
  });
}

export async function dashboard() {
  await check("le tableau de bord signale les recherches qui correspondent", async () => {
    await visit(page, "/mon-compte/annonces");
    const badges = await page
      .getByText(/recherche(s?) correspond/)
      .evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()));
    assert.ok(badges.length > 0, "aucun croisement signalé sur le tableau de bord");
  });

  await check("l'ancien lien du tableau de bord redirige au lieu de casser", async () => {
    const response = await visit(page, "/mes-annonces");
    assert.equal(response.status(), 200);
    assert.match(page.url(), /\/mon-compte\/annonces$/, `atterri sur ${page.url()}`);
  });

  await check("la navigation du compte marque l'onglet courant, une seule fois", async () => {
    const nav = page.getByRole("navigation", { name: "Sections du compte" });
    const current = nav.locator('[aria-current="page"]');
    assert.equal(await current.count(), 1, "zéro ou plusieurs onglets marqués « page actuelle »");
    assert.match(await current.textContent(), /Mes annonces/);
  });

  await check("une recherche se ferme en un clic, sans quitter la page", async () => {
    /* La promesse entière des demandes de recherche : plus besoin de repasser
       fermer cinq posts dans cinq groupes. */
    await visit(page, "/mon-compte/recherches");
    const group = page.getByRole("group", { name: /Statut de la recherche/ }).first();
    const found = group.getByRole("button", { name: "Trouvé" });
    assert.equal(await found.getAttribute("aria-pressed"), "false");
    await found.click();
    assert.equal(await found.getAttribute("aria-pressed"), "true");
    assert.equal(
      await group.getByRole("button", { name: "En recherche" }).getAttribute("aria-pressed"),
      "false",
    );
    assert.match(await group.locator("output").textContent(), /Trouvé/);
  });

  await check("la suppression demande confirmation et ne supprime rien", async () => {
    await visit(page, "/mon-compte/recherches");
    const remove = page.getByRole("button", { name: /^Supprimer / }).first();
    const itemName = (await remove.textContent()).replace("Supprimer", "").trim();

    await remove.click();
    const panel = page.getByRole("group", { name: new RegExp("Supprimer") }).first();
    await panel.waitFor();

    /* Le focus doit être sur le bouton sûr : une touche Entrée d'un doigt trop
       rapide ne doit pas déclencher l'irréversible. */
    const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    assert.equal(focused, "Annuler", `le focus est sur « ${focused} »`);
    assert.ok(itemName.length > 0, "la confirmation ne nomme pas ce qui serait supprimé");

    await panel.getByRole("button", { name: /définitivement/ }).click();
    await page.getByText(/Rien n'a été supprimé/).waitFor();
    assert.ok(
      (await page.getByRole("listitem").count()) > 0,
      "la ligne a disparu alors que rien n'est enregistré",
    );
  });

  await check("annuler une suppression rend la ligne intacte", async () => {
    await visit(page, "/mon-compte/annonces");
    const before = await page.getByRole("button", { name: /^Supprimer / }).count();
    await page.getByRole("button", { name: /^Supprimer / }).first().click();
    await page.getByRole("button", { name: "Annuler" }).first().click();
    assert.equal(await page.getByRole("button", { name: /^Supprimer / }).count(), before);
  });

  await check("le formulaire de modification est pré-rempli avec l'annonce réelle", async () => {
    await visit(page, "/mon-compte/annonces");
    const title = await page.locator("main li h3 a").first().textContent();
    await page.getByRole("link", { name: /^Modifier / }).first().click();
    await page.waitForURL(/\/modifier$/);

    assert.equal(await page.locator("#title").inputValue(), title.trim());
    const price = await page.locator("#priceEuros").inputValue();
    assert.match(price, /^[0-9]+([,.][0-9]+)?$/, `prix pré-rempli illisible : « ${price} »`);
    /* La liste déroulante maison porte l'état : elle doit afficher le vrai jeu
       du lot, pas « Choisir ». */
    const game = await page.locator("#gameId").textContent();
    assert.doesNotMatch(game, /Choisir/, "le jeu n'est pas pré-sélectionné");
  });

  await check("un champ non mesuré revient vide à la modification, jamais à zéro", async () => {
    /* Ce vrac est compté mais pas pesé. Un « 0 » dans le poids inventerait
       une mesure que le vendeur n'a jamais faite, et l'enregistrement la
       figerait en base. */
    await visit(page, `/mon-compte/annonces/${OWN_LISTING}/modifier`);
    assert.equal(await page.locator("#weightKg").inputValue(), "");
    assert.equal(await page.locator("#cardCount").inputValue(), "400");
    assert.notEqual(await page.locator("#priceEuros").inputValue(), "");
  });

  await check("modifier ne change pas le lien permanent", async () => {
    await page.getByRole("button", { name: /Enregistrer les modifications/ }).click();
    await page.getByText(/rien n'a été enregistré/).waitFor();
    const permalink = await page.locator("code").first().textContent();
    assert.ok(permalink.endsWith(`/annonces/${OWN_LISTING}`), `le lien a changé : ${permalink}`);
    /* Et le récapitulatif ne doit pas avoir rempli les trous au passage. Le
       formulaire reste monté, masqué, sous le récapitulatif : on vise la liste
       de définitions, pas le libellé du champ. */
    const recap = page.locator("dl", { hasText: "Poids" }).first();
    await recap.waitFor();
    const summary = await recap.textContent();
    assert.match(summary, /—/, "une valeur absente a été remplacée dans le récapitulatif");
  });

  await check("une annonce dont la vente est clôturée ne se modifie plus, et ne le propose pas", async () => {
    /* Audit de sécurité, M4. l-07 : vendue par le compte de démonstration à
       u-02, qui l'a notée. Les avis s'y rapportent : la page le dit, sans
       formulaire, et la ligne du tableau de bord n'offre plus « Modifier ». */
    await visit(page, `/mon-compte/annonces/${SOLD_WITH_DEAL}/modifier`);
    await page.locator("[data-frozen-listing]").waitFor();
    assert.equal(await page.locator("form#listing-form").count(), 0, "le formulaire est encore proposé");
    assert.ok(
      await page.locator("[data-frozen-listing] a[href^='/mon-compte/transactions/']").count(),
      "le récapitulatif de la vente n'est pas relié",
    );
    await visit(page, "/mon-compte/annonces");
    const row = page.locator("main li", { has: page.locator(`a[href='/annonces/${SOLD_WITH_DEAL}']`) }).first();
    await row.waitFor();
    assert.equal(await row.getByRole("link", { name: /^Modifier / }).count(), 0, "« Modifier » reste proposé");
  });

  await check("une annonce qui n'est pas la sienne est introuvable, pas interdite", async () => {
    /* Répondre « interdit » confirmerait que l'annonce existe. */
    const response = await visit(page, "/mon-compte/annonces/classeur-360-cartes-pokemon-triees-par-serie-carpentras-03/modifier");
    assert.equal(response.status(), 404);
  });
}

export async function longPseudo() {
  await check("un pseudo long ne déborde jamais de sa carte, sur aucun écran", async () => {
    /* Un pseudo est du texte saisi, sans espace, dans une graisse display
       condensée : « lecomptoirdukado » demandait 339 px là où la carte en
       offrait 272. Une troncature de ce genre est invisible dans le DOM comme
       dans une capture — l'élément existe, il est juste trop large. */
    await withPage({ width: 360, height: 800, mainContext: true }, async (narrow) => {
      for (const path of ["/mon-compte", "/profil/lecomptoirdukado", "/profil/tcg_du_ventoux"]) {
        await visit(narrow, path);
        /* Le pseudo vit maintenant dans un bandeau d'ardoise pleine largeur : on
           le mesure contre son conteneur et contre la fenêtre. */
        const overflow = await narrow.evaluate(() => {
          const title = document.querySelector("h1");
          const box = title.closest(".container").getBoundingClientRect();
          const rect = title.getBoundingClientRect();
          return {
            clipped: title.scrollWidth - title.clientWidth,
            escaped: Math.round(Math.max(rect.right - box.right, rect.right - window.innerWidth)),
          };
        });
        assert.ok(overflow.clipped <= 1, `${path} : titre tronqué de ${overflow.clipped}px`);
        assert.ok(overflow.escaped <= 1, `${path} : titre hors de sa carte de ${overflow.escaped}px`);
      }
    });
  });
}

export async function signInPages() {
  await check("connexion et inscription offrent Google et l'e-mail, et valident pour de vrai", async () => {
    for (const [route, provider] of [
      ["/connexion", /Se connecter avec Google/],
      ["/inscription", /Continuer avec Google/],
    ]) {
      await visit(page, route);
      /* Google n'est pas encore branché et le dit ; l'e-mail, lui, valide
         la saisie avec le schéma du serveur. */
      assert.equal(await page.getByRole("button", { name: provider }).isDisabled(), true);
      await page.getByText(/La connexion par Google n.est pas encore ouverte/).waitFor();
      assert.equal(await page.getByRole("button", { name: /^(Se connecter|Créer mon compte)$/ }).isDisabled(), false);
      /* Jamais en GET : sans JavaScript, le mot de passe finirait dans
         l'adresse et dans les journaux. */
      assert.equal((await page.locator("form.panel").getAttribute("method"))?.toUpperCase(), "POST");
    }
  });

  await check("un envoi vide place le focus sur le premier champ fautif", async () => {
    await visit(page, "/connexion");
    await page.getByRole("button", { name: /^Se connecter$/ }).click();
    await page.waitForFunction(() => document.activeElement?.id === "email");
    await page.getByText(/Indiquez votre adresse e-mail/).waitFor();
    assert.equal(await page.locator("#email").getAttribute("aria-invalid"), "true");
  });

  await check("le mot de passe s'affiche d'un bouton, et ne revient jamais après l'envoi", async () => {
    await page.locator("#email").fill("  Julie@Example.fr ");
    await page.locator("#password").fill("une phrase de passe");
    await page.getByRole("button", { name: "Afficher le mot de passe" }).click();
    assert.equal(await page.locator("#password").getAttribute("type"), "text");
    await page.getByRole("button", { name: "Masquer le mot de passe" }).click();
    assert.equal(await page.locator("#password").getAttribute("type"), "password");

    await page.getByRole("button", { name: /^Se connecter$/ }).click();
    await page.getByText(/rien n'est vérifié/).waitFor();
    assert.notEqual(await page.locator("#email").inputValue(), "", "l'adresse est perdue après l'envoi");
    assert.equal(await page.locator("#password").inputValue(), "", "le mot de passe revient dans la page");
  });

  await check("mot de passe oublié : un lien depuis la connexion, et la même page pour toute adresse", async () => {
    await page.getByRole("link", { name: /Mot de passe oublié/ }).click();
    await page.waitForURL(/\/mot-de-passe-oublie$/);
    /* Dire « aucun compte pour cette adresse » dirait qui en a un : la page
       qui suit est la même pour une adresse inscrite et pour une inconnue. */
    const pages = [];
    for (const email of ["julie@example.fr", "personne@example.fr"]) {
      await visit(page, "/mot-de-passe-oublie");
      await page.locator("#email").fill(email);
      await page.getByRole("button", { name: "Recevoir le lien" }).click();
      await page.waitForURL(/\/mot-de-passe-oublie\/e-mail-envoye$/);
      await page.getByRole("heading", { level: 1, name: "Vérifiez vos e-mails" }).waitFor();
      assert.doesNotMatch(page.url(), /@|example/, "l'adresse est passée dans l'URL");
      pages.push(await page.locator("main").innerText());
    }
    assert.equal(pages[1], pages[0], "la page diffère selon l'adresse");
    assert.match(pages[0], /Si un compte existe pour l'adresse saisie/);
    /* La démonstration n'envoie rien, et la page le dit. */
    assert.match(pages[0], /Site de démonstration\s*: aucun e-mail ne part/);
    await page.getByRole("link", { name: "Redemander un lien" }).waitFor();
  });

  await check("une inscription acceptée mène à la page qui dit qu'un lien part, et quoi faire s'il n'arrive pas", async () => {
    /* La réponse tenait sous le bouton, et l'on croyait que rien ne s'était
       passé. */
    await visit(page, "/inscription");
    await page.locator("#username").fill("julie_cartes");
    await page.locator("#email").fill("julie.cartes@example.fr");
    await page.locator("#password").fill("trois classeurs magic");
    await pickCity(page, "84000", /Avignon/);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await page.waitForURL(/\/inscription\/e-mail-envoye$/);
    assert.doesNotMatch(page.url(), /@|julie|classeurs/, "la saisie est passée dans l'URL");
    const text = await page.locator("main").innerText();
    assert.match(text, /un lien de confirmation vient d'y partir/);
    assert.match(text, /pendant une heure/);
    assert.match(text, /indésirables/);
    assert.match(text, /Site de démonstration\s*: aucun compte n'est créé et aucun e-mail ne part/);
    for (const [name, href] of [
      ["Recommencer l'inscription", "/inscription"],
      ["Déjà confirmé ? Se connecter", "/connexion"],
    ]) {
      assert.equal(await page.getByRole("link", { name }).getAttribute("href"), href);
    }
  });

  await check("la connexion ramène là où l'on allait, et jamais hors du site", async () => {
    /* ?suivant= vient de l'URL : filtré, il devient le champ caché que
       l'action relira, et suit le lien vers l'inscription. Une adresse
       d'un autre site redevient l'accueil du compte — sinon, une
       redirection ouverte. */
    await visit(page, "/connexion?suivant=%2Fdeposer%3Fpour%3Dcherche-vrac");
    assert.equal(await page.locator('input[name="returnTo"]').inputValue(), "/deposer?pour=cherche-vrac");
    const signUp = new URL(await page.getByRole("link", { name: "Créer un compte" }).evaluate((link) => link.href));
    assert.equal(signUp.searchParams.get("suivant"), "/deposer?pour=cherche-vrac");
    for (const hostile of ["//site-piege.example", "/\\site-piege.example", "https://site-piege.example"]) {
      await visit(page, `/connexion?suivant=${encodeURIComponent(hostile)}`);
      assert.equal(await page.locator('input[name="returnTo"]').inputValue(), "/mon-compte", `« ${hostile} » est gardé`);
    }
  });

  await check("le logo Google est tracé sur place, sans requête vers Google", async () => {
    /* Un logo servi depuis un CDN Google serait un mouchard posé sur une page
       de connexion. Le contrôle des requêtes sortantes le verrait, mais autant
       vérifier aussi que le tracé est bien là. */
    await visit(page, "/inscription");
    const paths = await page.locator("form svg path").count();
    assert.ok(paths >= 4, `le logo Google compte ${paths} tracés`);
  });

  await check("l'inscription dit ce qui sera public avant de le devenir", async () => {
    /* Le pseudo finit dans le filigrane des photos : le découvrir après coup
       ne serait pas une bonne surprise. */
    await page.getByText(/Ce qui sera public/i).waitFor();
    await page.getByText(/filigrane de vos photos/).first().waitFor();
    await page.getByText(/jamais votre adresse/).waitFor();
  });
}

export async function slateTab() {
  await check("l'onglet courant du compte se voit aussi sur l'ardoise", async () => {
    /* Même spécificité que la règle générique des pastilles sur l'ardoise :
       l'onglet courant avait perdu son remplissage. */
    await visit(page, "/mon-compte/annonces");
    const current = page.getByRole("navigation", { name: "Sections du compte" }).locator('[aria-current="page"]');
    const background = await current.evaluate((node) => getComputedStyle(node).backgroundColor);
    assert.notEqual(background, "rgba(0, 0, 0, 0)", "l'onglet courant n'a pas de fond");
  });
}

export async function dealsAndProfiles() {
  await check("« Réservé » demande pour qui, « Vendu » à qui", async () => {
    await visit(page, "/mon-compte/annonces");
    const row = page.locator("li", { hasText: "Vrac 400 cartes Pokémon" }).first();
    await row.getByRole("button", { name: "Réservé" }).click();
    await row.getByText("Pour qui réservez-vous").waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("type")), "radio", "le focus n'est pas sur le premier choix");
    await row.getByRole("button", { name: "Annuler" }).click();
    assert.equal(await row.getByRole("button", { name: "Disponible" }).getAttribute("aria-pressed"), "true");
    await row.getByRole("button", { name: "Vendu" }).click();
    await row.getByText("À qui avez-vous vendu").waitFor();
    await row.getByRole("button", { name: "Clôturer la vente" }).click();
    await row.getByText(/rien n'est enregistré/).waitFor();
  });

  await check("un avis envoyé vide renvoie le focus sur le premier critère, puis passe", async () => {
    await visit(page, "/mon-compte/transactions/d-02");
    await page.getByRole("button", { name: "Publier l'avis" }).click();
    await page.getByText("Choisissez une note de 1 à 5.").first().waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "punctuality");
    for (const name of ["punctuality", "responsiveness", "reliability"]) {
      await page.locator(`label:has(input[name="${name}"][value="4"])`).click();
    }
    await page.getByRole("button", { name: "Publier l'avis" }).click();
    await page.getByText("Avis reçu.").waitFor();
  });

  await check("une boutique affiche sa fiche, un particulier non", async () => {
    await visit(page, "/profil/repaire_du_joueur");
    await page.getByText("SIRET", { exact: true }).waitFor();
    await page.getByRole("link", { name: "repaire-du-joueur.example" }).waitFor();
    await visit(page, "/profil/lecomptoirdukado");
    assert.equal(await page.getByText("SIRET", { exact: true }).count(), 0);
    /* La note y est détaillée critère par critère. */
    await page.getByText("Délai de réponse", { exact: true }).waitFor();
  });

  await check("chaque étape du suivi mène à une liste qui compte autant de lignes", async () => {
    await visit(page, "/mon-compte");
    const stage = page.locator(".pipeline-stage", { hasText: "Réservé" }).first();
    const announced = Number((await stage.locator(".price").textContent()).trim());
    await stage.click();
    await page.waitForURL(/etape=reserve/);
    const shown = await page.getByRole("group", { name: /Statut de l'annonce/ }).count();
    assert.equal(shown, announced, `annoncé ${announced}, affiché ${shown}`);
  });
}
