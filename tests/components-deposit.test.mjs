import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";

import { ListingCard } from "../src/components/listing/ListingCard.tsx";
import { getListingBySlug } from "../src/lib/data/listings.ts";
import { getWantedListings } from "../src/lib/data/wanted.ts";
import { SegmentedControl } from "../src/components/ui/SegmentedControl.tsx";
import { DeleteAction } from "../src/components/account/DeleteAction.tsx";
import { ActionList } from "../src/components/account/ActionList.tsx";
import { toListingFormDefaults, toWantedFormDefaults } from "../src/lib/form-defaults.ts";
import { render, text } from "./markup.mjs";
import { EMPTY_LISTING_DRAFT, NOW, SELLER } from "./fixtures.mjs";

/* Le dépôt et sa modification — aperçu, récapitulatif, valeurs par défaut —
   et les gestes du compte : statut, suppression, tableau de bord. */

test("l'aperçu d'un dépôt à peine commencé ne suppose ni jeu, ni format, ni prix", async () => {
  const { buildPreviewListing } = await import("../src/lib/listing-draft.ts");
  const { GAME_IDS } = await import("../src/types/game.ts");
  const seller = { ...SELLER, ratingAvg: null, ratingCount: 0 };
  const markup = render(ListingCard({ listing: buildPreviewListing(EMPTY_LISTING_DRAFT, [], seller, NOW, null, new Map()), priceLabel: "— €", now: Date.parse(NOW) }));
  assert.match(text(markup), /Jeu\s?\? — Format\s?\?/);
  for (const gameId of GAME_IDS) {
    assert.doesNotMatch(markup, new RegExp(`var\\(--${gameId}\\)`), `couleur ${gameId} supposée`);
  }
  assert.doesNotMatch(text(markup), /\b0 €|\b0 cartes/);
});

test("le récapitulatif de dépôt n'affiche aucune valeur métier brute", async () => {
  const { ListingSummary } = await import("../src/components/deposit/ListingSummary.tsx");
  const { getEditionCatalog } = await import("../src/lib/editions.ts");
  const editions = new Map(getEditionCatalog("pokemon").blocks.flatMap((block) => block.editions).map((edition) => [edition.id, edition]));
  const markup = text(
    render(
      createElement(ListingSummary, {
        published: {
          values: {
            title: "Vrac 500 cartes Pokémon",
            gameId: "pokemon",
            lotType: "bulk",
            condition: "mixed",
            language: "mixed",
            cardCount: null,
            weightKg: null,
            priceEuros: 42.5,
            city: "Carpentras",
            postalCode: "84200",
            description: "Cinq cents cartes des séries récentes.",
            editions: ["pokemon-ev08", "pokemon-eb11"],
            tags: ["booster-pack"],
            photos: ["local:abc"],
          },
          result: { status: "not-persisted", data: { slug: "vrac-500-cartes-pokemon-carpentras-apercu", path: "/annonces/vrac-500-cartes-pokemon-carpentras-apercu" } },
        },
        photos: [],
        seller: SELLER,
        now: NOW,
        openWantedListings: [],
        options: { isFeatured: "", isUrgent: "on" },
        editions,
        onEdit: () => {},
      }),
    ),
  );

  assert.match(markup, /États mêlés/);
  /* L'option cochée au dépôt arrive au récapitulatif, et sur l'aperçu. */
  assert.match(markup, /Options Urgent/);
  assert.match(markup, /Langues mêlées/);
  /* L'écran dit que rien n'est enregistré, en premier. */
  assert.match(markup, /rien n'a été enregistré/);
  /* « mixed », « bulk », « pokemon » sont les valeurs de la base : les voir
     à l'écran signifie qu'un dictionnaire a été contourné. Le lien permanent
     est mis de côté — son slug est une adresse, pas un libellé.
     L'ancienne version de ce test écrivait « \\\\b » : elle cherchait un
     antislash littéral et ne pouvait donc jamais échouer. */
  const visible = markup.replace(/https?:\/\/\S+/g, "");
  for (const raw of ["mixed", "bulk", "pokemon"]) {
    assert.doesNotMatch(visible, new RegExp(`\\b${raw}\\b`), `valeur brute « ${raw} » affichée`);
  }
});

/* --- Compte : gestion des recherches, modification, suppression --- */
test("les trois états d'une recherche ont un libellé distinct, et l'état courant est marqué", () => {
  /* createElement et non un appel direct : ces composants tiennent un état,
     et les hooks n'existent que dans un vrai rendu React. */
  const markup = render(
    createElement(SegmentedControl, {
      label: "Statut de la recherche Cherche vrac Pokémon",
      value: "fulfilled",
      options: [
        { value: "open", label: "En recherche" },
        { value: "fulfilled", label: "Trouvé" },
        { value: "closed", label: "Abandonnée" },
      ],
      onChange: () => {},
    }),
  );
  const readable = text(markup);
  for (const label of ["En recherche", "Trouvé", "Abandonnée"]) {
    assert.match(readable, new RegExp(label));
  }
  assert.match(markup, /aria-pressed="true"[^>]*>Trouvé/);
  assert.match(readable, /Statut de la recherche Cherche vrac Pokémon : Trouvé/);
});

test("la suppression ne montre pas le bouton rouge avant d'avoir été demandée", () => {
  /* Deux temps : le premier écran ne porte aucune action irréversible, et il
     nomme ce qui serait supprimé plutôt que d'écrire « Supprimer » seul. */
  const markup = render(
    createElement(DeleteAction, {
      itemName: "Vrac 400 cartes",
      consequence: "Le lien cessera de répondre.",
      onConfirmAction: async () => ({ status: "not-persisted", data: null }),
    }),
  );
  assert.equal(markup.includes("btn-danger"), false, "le bouton rouge est offert d'emblée");
  assert.match(text(markup), /Supprimer Vrac 400 cartes/);
});

test("une ligne à zéro n'apparaît pas sur le tableau de bord, et le vide est nommé", () => {
  const markup = render(
    ActionList({
      actions: [
        { count: 0, sentence: "message sans réponse.", href: "/messages", linkLabel: "Ouvrir" },
        { count: 2, sentence: "annonces croisent une recherche.", href: "/a", linkLabel: "Voir" },
      ],
      emptyLabel: "Rien ne vous attend.",
    }),
  );
  const readable = text(markup);
  assert.doesNotMatch(readable, /message sans réponse/);
  assert.match(readable, /2 annonces croisent une recherche/);

  const empty = render(ActionList({ actions: [], emptyLabel: "Rien ne vous attend." }));
  assert.match(text(empty), /Rien ne vous attend/);
});

test("un aller-retour d'édition ne transforme pas « non compté » en zéro", async () => {
  /* La règle de données tient aussi dans l'autre sens : un champ vide doit
     revenir vide dans le formulaire, sinon la modification inventerait un
     comptage que le vendeur n'a jamais fait. */
  const listing = await getListingBySlug("carton-6-kg-de-vrac-pokemon-toutes-series-orange-02");
  assert.equal(listing.cardCount, null, "l'annonce de test est comptée, elle ne prouve rien");

  const defaults = toListingFormDefaults(listing);
  assert.equal(defaults.cardCount, "");
  assert.equal(defaults.priceEuros, String(listing.priceCents / 100).replace(".", ","));
});

test("une recherche sans budget ni format se pré-remplit sans inventer de valeur", async () => {
  const [wanted] = await getWantedListings({ limit: 100 }).then((list) => [
    list.find((candidate) => candidate.maxPriceCents !== null && candidate.lotType === null),
  ]);
  assert.ok(wanted, "aucune demande « tous formats » dans le jeu de test");

  const defaults = toWantedFormDefaults(wanted);
  assert.equal(defaults.lotType, "", "« peu importe » doit rester une chaîne vide");
  assert.equal(defaults.maxDistanceKm, String(wanted.maxDistanceKm));
});

test("le dépôt renvoie à l'étape qui porte vraiment le choix du jeu", async () => {
  /* « Choisissez d'abord un jeu, à l'étape 1 » : le numéro était écrit à la
     main, et resté faux quand les photos sont passées en tête — le jeu est
     à l'étape 2. On lit le numéro de la section qui contient le champ Jeu. */
  const { ListingFormFields } = await import("../src/components/deposit/ListingFormFields.tsx");
  const markup = render(
    createElement(ListingFormFields, {
      errors: {},
      choices: { gameId: "", lotType: "", condition: "", language: "" },
      editions: { blocks: [], failed: false, byId: new Map() },
      onChoiceChange: () => {},
      onCityChange: () => {},
    }),
  );
  const section = markup.split("<fieldset").find((chunk) => chunk.includes('id="gameId"'));
  assert.ok(section, "le champ Jeu est introuvable");
  const step = section.match(/<legend[^>]*>\s*<span[^>]*>(\d+)<\/span>/)?.[1];
  assert.ok(step, "la section du jeu n'est pas numérotée");
  const cited = text(markup).match(/Choisissez d'abord un jeu, à l'étape (\d+)/)?.[1];
  assert.equal(cited, step, `le message renvoie à l'étape ${cited}, le jeu est à l'étape ${step}`);
});
