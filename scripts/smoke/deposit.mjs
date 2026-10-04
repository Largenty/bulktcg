/* Le dépôt d'annonce : le formulaire et sa validation, les options de
   l'annonce — urgente, réservée aux pros, ouverte à l'échange —, et les
   défauts relevés à l'audit. */
import assert from "node:assert/strict";
import { check, page } from "./harness.mjs";
import { VISIBLE_CARDS, choose, chooseAll, pickCity, visit, declarePrivateSeller } from "./helpers.mjs";
import { PHOTO } from "./fixtures.mjs";

export async function listingForm() {
  await check("aucun champ ne sort de sa carte de formulaire", async () => {
    /* Une <legend> flottante n'est pas dégagée par un conteneur flex, qui se
       range à côté d'elle : les champs de la section 3 se retrouvaient hors de
       la carte. Invisible dans le DOM, ça se mesure. */
    await visit(page, "/deposer");
    const escaped = await page.evaluate(() => {
      const out = [];
      for (const section of document.querySelectorAll("fieldset.form-section")) {
        const box = section.getBoundingClientRect();
        for (const field of section.querySelectorAll("input, textarea, [role='combobox']")) {
          const rect = field.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) continue;
          if (rect.right > box.right + 1 || rect.left < box.left - 1 || rect.bottom > box.bottom + 1) {
            out.push(field.id || field.tagName);
          }
        }
      }
      return out;
    });
    assert.deepEqual(escaped, []);
  });

  await check("la case à cocher maison répond au clic et au clavier", async () => {
    const checkbox = page.locator("#isFeatured");
    assert.equal(await checkbox.isChecked(), false);

    await page.getByText("Mettre à la une pour").click();
    assert.equal(await checkbox.isChecked(), true);

    await checkbox.focus();
    await page.keyboard.press("Space");
    assert.equal(await checkbox.isChecked(), false);
  });

  await check("le formulaire vide refuse et déplace le focus sur le premier champ fautif", async () => {
    /* Les photos sont la première étape : c'est elles que le focus rejoint. */
    await visit(page, "/deposer");
    await page.getByRole("button", { name: "Publier l'annonce" }).click();
    await page.getByText(/champ.* demande.* une correction/).first().waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "photo-picker");
  });

  await check("le formulaire valide produit un lien permanent", async () => {
    await page.locator("#title").fill("Vrac 500 cartes Pokémon séries récentes");
    await chooseAll(page, [["#gameId", "Pokémon"], ["#lotType", "Vrac"], ["#condition", "États mêlés"], ["#language", "Français"]]);
    await page.locator("#priceEuros").fill("42,50");
    await page.locator("#city").fill("Carpentras");
    await page.locator("#description").fill("Cinq cents cartes des séries récentes, aucune carte pliée, remise à Carpentras.");
    await page.locator("#photo-files").setInputFiles(PHOTO);
    /* Sans la déclaration d'un particulier, le serveur refuse, et le focus
       va à la case. */
    await page.getByRole("button", { name: "Publier l'annonce" }).click();
    await page.locator("#privateSeller-error").waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "privateSeller");
    await declarePrivateSeller(page);
    await page.getByRole("button", { name: "Publier l'annonce" }).click();
    await page.getByText("Lien permanent").first().waitFor();
    const link = await page.locator("code").first().textContent();
    assert.match(link, /\/annonces\/vrac-500-cartes-pokemon-series-recentes-carpentras-apercu$/);
  });

  await check("la validation du dépôt annonce qui cherche déjà ce lot", async () => {
    /* Le formulaire vient d'être validé : la page est sur le récapitulatif.
       C'est le moment de plus forte intention du vendeur. */
    await page.getByText(/cherche.* ce que vous décrivez/).first().waitFor();
    const panel = page.locator("section", { hasText: "Demandes de recherche" }).first();
    assert.ok((await panel.locator("li").count()) > 0, "aucune demande listée");

    /* Le lot déposé n'est pas compté : la correspondance doit être annoncée
       comme à vérifier, pas comme certaine. */
    await panel.getByText(/À vérifier/).first().waitFor();
  });

  await check("un champ numérique laissé vide reste vide, il n'est pas transformé en zéro", async () => {
    const rows = await page.locator("dd").allTextContents();
    assert.ok(rows.some((row) => row.trim() === "—"), "aucun tiret pour les champs non mesurés");
    assert.ok(!rows.some((row) => row.trim() === "0 cartes"), "un champ vide est devenu zéro");
  });
}

export async function options() {
  await check("une annonce urgente le dit sur sa vignette et sur sa fiche", async () => {
    await visit(page, "/yu-gi-oh");
    const card = page.locator(VISIBLE_CARDS, { hasText: "Carton 5 kg vrac Yu-Gi-Oh" }).first();
    await card.locator(".lot-window .urgent-flag").waitFor();
    await card.locator("h3 a").click();
    await page.waitForURL(/\/annonces\/carton-5-kg-vrac-yu-gi-oh/);
    await page.locator("main .urgent-flag", { hasText: "Urgent" }).first().waitFor();
  });

  await check("cocher « Urgent » au dépôt le montre sur l'aperçu, et le récapitulatif le redit", async () => {
    await visit(page, "/deposer");
    await chooseAll(page, [["#gameId", "Magic"], ["#lotType", "Vrac"], ["#condition", /^LP/], ["#language", "Anglais"]]);
    const preview = page.locator("section", { hasText: "Aperçu de votre vignette" });
    assert.equal(await preview.locator(".urgent-flag").count(), 0, "l'aperçu est urgent avant qu'on coche");
    await page.locator('label[for="isUrgent"]').click();
    await preview.locator(".lot-window .urgent-flag").waitFor();
  });

  await check("au dépôt, le vendeur choisit qui voit son annonce, et le récapitulatif le redit", async () => {
    await visit(page, "/deposer");
    assert.equal(await page.locator('input[name="audience"][value="everyone"]').isChecked(), true, "« Tout le monde » n'est pas le choix par défaut");
    await page.locator("#photo-files").setInputFiles(PHOTO);
    await page.locator("#title").fill("Carton de vrac Magic à estimer sur place");
    await chooseAll(page, [["#gameId", "Magic"], ["#lotType", "Vrac"], ["#condition", /^MP/], ["#language", "Anglais"]]);
    await page.locator("#priceEuros").fill("120");
    await pickCity(page, "84000", /Avignon/);
    await page.locator("#description").fill("Un carton de vrac Magic de plusieurs kilos, à estimer sur place par une boutique qui connaît les prix.");
    await page.locator("label", { hasText: "Professionnels uniquement" }).click();
    await declarePrivateSeller(page);
    await page.getByRole("button", { name: "Publier l'annonce" }).click();
    const recap = page.locator("dl", { hasText: "Visible par" }).first();
    await recap.waitFor();
    assert.match(await recap.textContent(), /Professionnels uniquement/);
  });

  await check("« Ouvert à l'échange » s'ouvre sur « Contre quoi ? » et arrive au récapitulatif", async () => {
    await visit(page, "/deposer");
    assert.equal(await page.locator("#tradeNote").count(), 0, "le champ « Contre quoi ? » précède la case");
    await page.locator("#photo-files").setInputFiles(PHOTO);
    await page.locator("#title").fill("Classeur One Piece à échanger contre du Magic");
    await chooseAll(page, [["#gameId", "One Piece"], ["#lotType", "Classeur"], ["#condition", /^NM/], ["#language", "Anglais"]]);
    await page.locator("#priceEuros").fill("90");
    await pickCity(page, "84000", /Avignon/);
    await page.locator("#description").fill("Un classeur One Piece de 200 cartes, OP-01 à OP-05, à échanger contre des cartes Magic récentes.");
    await page.locator('label[for="openToTrade"]').click();
    await page.locator("#tradeNote").fill("des cartes Magic récentes");
    /* L'aperçu montre le repère dès qu'on coche. */
    await page.locator("section", { hasText: "Aperçu de votre vignette" }).locator(".lot-trade").waitFor();
    await declarePrivateSeller(page);
    await page.getByRole("button", { name: "Publier l'annonce" }).click();
    const recap = page.locator("dl", { hasText: "Échange" }).first();
    await recap.waitFor();
    assert.match(await recap.textContent(), /Ouvert, contre des cartes Magic récentes/);
  });

  await check("le filtre « Ouvert à l'échange » écrit dans l'URL et ne garde que ces lots", async () => {
    await visit(page, "/annonces");
    await page.locator('label[for="filtre-echange"]').click();
    await page.waitForURL(/echange=1/);
    const cards = page.locator(VISIBLE_CARDS);
    await cards.first().waitFor();
    const total = await cards.count();
    assert.ok(total > 0, "aucun lot ouvert à l'échange");
    assert.equal(await page.locator(`${VISIBLE_CARDS} .lot-trade`).count(), total);
    await page.goBack();
    await page.waitForURL((url) => !url.search.includes("echange"));
  });
}

export async function formAudit() {
  await check("« Revenir au formulaire » retrouve tout ce qui avait été saisi", async () => {
    /* Le formulaire était démonté au récapitulatif : revenir rendait un
       formulaire vide, titre, prix, description et séries compris. */
    await visit(page, "/deposer");
    await page.locator("#photo-files").setInputFiles(PHOTO);
    await page.locator("#title").fill("Classeur Pokémon 180 cartes brillantes");
    await chooseAll(page, [["#gameId", "Pokémon"], ["#lotType", "Classeur"], ["#condition", /^NM/], ["#language", "Français"]]);
    await page.getByText(/EV08\s+Étincelles Déferlantes/).click();
    await page.locator("#cardCount").fill("180");
    await page.locator("#priceEuros").fill("60");
    await pickCity(page, "84000", /Avignon/);
    await page.locator("#description").fill("Un classeur complet, cartes en bon état, aucune abîmée, rendez-vous en semaine.");
    await declarePrivateSeller(page);
    await page.getByRole("button", { name: "Publier l'annonce" }).click();
    await page.getByRole("button", { name: "Revenir au formulaire" }).click();

    const kept = await page.evaluate(() =>
      Object.fromEntries(
        ["title", "cardCount", "priceEuros", "city", "postalCode", "description"].map((id) => [
          id,
          document.getElementById(id)?.value ?? null,
        ]),
      ),
    );
    assert.deepEqual(kept, {
      title: "Classeur Pokémon 180 cartes brillantes",
      cardCount: "180",
      priceEuros: "60",
      city: "Avignon",
      postalCode: "84000",
      description: "Un classeur complet, cartes en bon état, aucune abîmée, rendez-vous en semaine.",
    });
    assert.equal(await page.locator('input[name="editions"][value="pokemon-ev08"]').isChecked(), true);
    assert.equal(await page.getByRole("button", { name: /^Retirer la photo/ }).count(), 1, "la photo a disparu");
  });

  await check("un code postal tapé au dépôt devient le nom de sa commune", async () => {
    /* « 84000 » était reconnu : la liste se fermait, la coche verte annonçait
       Avignon, et la validation refusait ensuite la commune — le schéma lit le
       nom, pas le code. Le champ doit proposer la commune, puis la nommer. */
    await visit(page, "/deposer");
    await page.locator("#city").fill("84000");
    await page.getByRole("option", { name: /Avignon/ }).waitFor();
    await page.keyboard.press("Tab");
    assert.equal(await page.locator("#city").inputValue(), "Avignon");
    assert.equal(await page.locator("#postalCode").inputValue(), "84000");

    await page.getByRole("button", { name: "Publier l'annonce" }).click();
    assert.equal(await page.locator("#city-error").count(), 0, "la commune reconnue est refusée à la validation");
  });

  await check("l'aperçu de la vignette suit la saisie", async () => {
    /* Autonome : ce parcours ne doit pas dépendre de celui qui le précède. */
    await visit(page, "/deposer");
    await chooseAll(page, [["#gameId", "Pokémon"], ["#lotType", "Classeur"], ["#condition", /^NM/], ["#language", "Français"]]);
    const preview = page.locator("section", { hasText: "Aperçu de votre vignette" });
    await page.locator("#priceEuros").fill("60");
    await page.locator("#title").fill("Classeur Pokémon 200 cartes brillantes");
    await preview.getByText("Classeur Pokémon 200 cartes brillantes").waitFor();
    await page.locator("#priceEuros").fill("");
    await preview.getByText("— €").waitFor();
  });

  await check("l'aperçu est là dès l'arrivée, en emplacements vides plutôt qu'en valeurs supposées", async () => {
    /* Il attendait jeu, format, état et langue : un cadre vide pendant toute
       la première moitié du formulaire. */
    await visit(page, "/deposer");
    const preview = page.locator("section", { hasText: "Aperçu de votre vignette" });
    await preview.locator("article").waitFor();
    assert.match(await preview.locator(".lot-type").textContent(), /Jeu\s?\?/);
    await page.locator("#title").fill("Classeur Magic 300 cartes Modern Horizons");
    await preview.getByText("Classeur Magic 300 cartes Modern Horizons").waitFor();
    await choose(page, "#gameId", "Magic");
    await preview.locator(".lot-type", { hasText: "Magic" }).waitFor();
  });

  await check("un fichier qui n'est pas une photo est écarté, et l'écran dit pourquoi", async () => {
    await page.locator("#photo-files").setInputFiles({ name: "facture.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await page.getByText(/facture\.pdf : format non pris en charge/).waitFor();
  });

  await check("trois photos gratuites, puis l'option « 8 photos » ouvre les suivantes", async () => {
    await visit(page, "/deposer");
    const files = Array.from({ length: 4 }, (_, index) => ({ ...PHOTO, name: `lot-${index}.png` }));
    await page.locator("#photo-files").setInputFiles(files);
    await page.getByText(/lot-3\.png : la limite de photos est atteinte/).waitFor();
    /* Les photos sont converties avant d'arriver : on attend les trois. */
    await page.waitForFunction(() => document.querySelectorAll('[aria-labelledby="photos-label"] li img').length === 3);
    assert.equal(await page.locator("#photo-files").count(), 0, "la zone de dépôt accepte une quatrième photo sans l'option");
    await page.getByRole("button", { name: /Passer à 8 photos/ }).click();
    assert.equal(await page.locator("#extraPhotos").isChecked(), true, "le bouton n'a pas coché l'option");
    await page.locator("#photo-files").setInputFiles(files.slice(0, 2));
    const tiles = page.locator('[aria-labelledby="photos-label"] li img');
    await page.waitForFunction(() => document.querySelectorAll('[aria-labelledby="photos-label"] li img').length === 5);
    /* Décocher l'option marque les photos en trop, et la publication les
       refuse dès le premier envoi. */
    await page.locator('label[for="extraPhotos"]').click();
    assert.equal(await page.getByText("Hors forfait").count(), 2);
    assert.equal(await tiles.count(), 5, "des photos ont disparu en décochant l'option");
    await page.getByRole("button", { name: "Publier l'annonce" }).click();
    await page.locator("#photos-error", { hasText: /retirez-en 2/ }).waitFor();
  });

  await check("les photos partent en WebP, au format 4:3 du visuel, 1 600 px au plus", async () => {
    /* Converties dans le navigateur avant tout envoi : recadrées au centre
       comme l'affichage les taille, réduites, métadonnées retirées. */
    await visit(page, "/deposer");
    const wide = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 3200;
      canvas.height = 1000;
      canvas.getContext("2d").fillRect(0, 0, 3200, 1000);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    await page.locator("#photo-files").setInputFiles({ name: "IMG_2031.png", mimeType: "image/png", buffer: Buffer.from(wide, "base64") });
    await page.waitForFunction(() => document.querySelectorAll('[aria-labelledby="photos-label"] li img').length === 1);
    /* Relire le fichier par fetch(blob:) est interdit par la CSP
       (connect-src 'self'), et c'est très bien ainsi : la taille se lit sur
       l'image décodée, le format sur le nom, que convertedPhotoName ne
       termine par « .webp » que pour un fichier réellement encodé en WebP. */
    const photo = await page.evaluate(async () => {
      const image = document.querySelector('[aria-labelledby="photos-label"] li img');
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight, alt: image.alt };
    });
    assert.match(photo.alt, /IMG_2031\.webp/);
    assert.ok(Math.abs(photo.width / photo.height - 4 / 3) < 0.01, `format ${photo.width}×${photo.height}`);
    assert.ok(photo.width <= 1600, `${photo.width} px de large`);
  });
}
