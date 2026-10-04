import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";

import { Rating } from "../src/components/ui/Rating.tsx";
import { Field } from "../src/components/ui/Field.tsx";
import { Input } from "../src/components/ui/Input.tsx";
import { EmptyState } from "../src/components/ui/EmptyState.tsx";
import { StatusBadge } from "../src/components/listing/StatusBadge.tsx";
import { Checkbox } from "../src/components/ui/Checkbox.tsx";
import ErrorScreen from "../src/app/error.tsx";
import GlobalError from "../src/app/global-error.tsx";
import { render, text } from "./markup.mjs";

/* Les composants d'interface communs, rendus par react-dom/server : notes,
   champs, statuts, états vides, emplacements publicitaires, écrans d'erreur. */

test("un vendeur sans avis lit « Pas encore d'avis », pas cinq étoiles vides", () => {
  const markup = render(Rating({ ratingAvg: null, ratingCount: 0 }));
  assert.match(text(markup), /Pas encore d'avis/);
  assert.equal(markup.includes("<svg"), false, "des étoiles sont rendues pour un vendeur sans note");
});

test("un vendeur noté affiche sa note et le nombre d'avis", () => {
  const markup = render(Rating({ ratingAvg: 4.9, ratingCount: 156 }));
  assert.match(text(markup), /4,9/);
  assert.match(text(markup), /\(156\)/);
  assert.match(markup, /aria-label="Note de 4,9 sur 5, 156 avis"/);
});

test("chaque champ a un vrai label lié, jamais un placeholder en guise d'étiquette", () => {
  const markup = render(
    Input({ id: "titre", label: "Titre de l'annonce", placeholder: "Vrac 400 cartes" }),
  );
  assert.match(markup, /<label[^>]*for="titre"/);
  assert.match(text(markup), /Titre de l'annonce/);
});

test("la mention « facultatif » disparaît quand on la désactive", () => {
  const withHint = render(Field({ id: "a", label: "Tri", children: null }));
  const withoutHint = render(
    Field({ id: "a", label: "Tri", hasOptionalHint: false, children: null }),
  );
  assert.match(text(withHint), /facultatif/);
  assert.doesNotMatch(text(withoutHint), /facultatif/);
});

test("un champ en erreur est marqué aria-invalid et décrit par son message", () => {
  const markup = render(Input({ id: "prix", label: "Prix", error: "Indiquez un prix." }));
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /aria-describedby="prix-error"/);
  assert.match(text(markup), /Indiquez un prix\./);
});

test("les trois statuts ont un libellé français distinct", () => {
  const labels = ["available", "reserved", "sold"].map((status) =>
    text(render(StatusBadge({ status }))),
  );
  assert.deepEqual(labels, ["Disponible", "Réservé", "Vendu"]);
});

test("un état vide nomme la cause et propose une action", () => {
  const markup = render(
    EmptyState({
      title: "Rien ici",
      reason: "Aucune annonce ne correspond aux filtres.",
      action: "ACTION",
    }),
  );
  assert.match(text(markup), /Aucune annonce ne correspond aux filtres\./);
  assert.match(text(markup), /ACTION/);
});

test("la case à cocher garde un input natif, lié à son label", () => {
  const markup = render(
    Checkbox({ id: "isFeatured", label: "Mettre en avant", description: "Sept jours." }),
  );
  assert.match(markup, /<input[^>]*type="checkbox"/);
  assert.match(markup, /id="isFeatured"/);
  assert.match(markup, /name="isFeatured"/);
  assert.match(markup, /<label[^>]*for="isFeatured"/);
  assert.match(text(markup), /Mettre en avant/);
  assert.match(text(markup), /Sept jours\./);
});

test("un emplacement publicitaire réserve sa boîte avant tout chargement", async () => {
  const { AdSlot } = await import("../src/components/ads/AdSlot.tsx");
  const markup = render(AdSlot({ format: "leaderboard", slotId: "test" }));

  /* Le ratio réserve la place ; une hauteur fixe unique ne conviendrait pas,
     le repli mobile du leaderboard étant plus haut que le format desktop. */
  assert.match(markup, /--ad-width:728/);
  assert.match(markup, /--ad-height:90/);
  assert.match(markup, /--ad-mobile-width:320/);
  assert.match(markup, /--ad-mobile-height:100/);
  assert.match(markup, /class="ad-slot/);
});

test("un emplacement publicitaire s'annonce et ne se fait pas passer pour une annonce", async () => {
  const { AdSlot } = await import("../src/components/ads/AdSlot.tsx");
  const markup = render(AdSlot({ format: "rectangle", slotId: "test" }));
  assert.match(markup, /^<aside/);
  /* Le nom commence par « Publicité » et porte le format : deux encarts
     d'une même page se distinguent (tests/accessibility.test.mjs). */
  assert.match(markup, /aria-label="Publicité — Pavé"/);
  assert.match(text(markup), /Publicité/);
  assert.doesNotMatch(markup, /<article/);
});

test("l'encart maison est signé du site et renvoie vers le dépôt", async () => {
  const { HouseAd } = await import("../src/components/ads/HouseAd.tsx");
  const markup = render(HouseAd({}));
  const { SITE_NAME } = await import("../src/lib/site.ts");
  assert.ok(text(markup).includes(SITE_NAME), "l'encart maison ne nomme pas le site");
  assert.match(text(markup), /pour passer devant/);
  assert.match(markup, /href="\/deposer"/);
  assert.doesNotMatch(text(markup), /Publicité/);
});

/* Les mappers lèvent volontairement sur une dérive de schéma — c'est la
   bonne décision, et elle n'avait aucun écran en face : Next rendait sa page
   blanche. Ces trois contrôles tiennent ce qu'un écran d'erreur doit faire :
   dire ce qui s'est passé, donner de quoi le signaler, offrir une sortie. */
test("l'écran d'erreur explique le refus au lieu d'afficher une donnée fausse", () => {
  const markup = render(
    createElement(ErrorScreen, { error: new Error("boum"), reset: () => {} }),
  );
  const content = text(markup);
  assert.match(content, /Page interrompue/);
  assert.match(content, /plutôt que d'afficher une annonce dont un champ serait faux/);
  assert.match(content, /Réessayer/);
  assert.match(markup, /href="\/annonces"/);
});

test("l'écran d'erreur ne montre une référence d'incident que s'il en a une", () => {
  const withoutDigest = render(
    createElement(ErrorScreen, { error: new Error("boum"), reset: () => {} }),
  );
  assert.equal(/Référence de l'incident/.test(text(withoutDigest)), false);

  const error = Object.assign(new Error("boum"), { digest: "a1b2c3" });
  const withDigest = render(createElement(ErrorScreen, { error, reset: () => {} }));
  assert.match(text(withDigest), /Référence de l'incident : a1b2c3/);
});

/* global-error remplace le gabarit racine : il doit porter lui-même son
   <html lang="fr">, sans quoi la page de secours perdrait la langue du
   document — et un lecteur d'écran lirait le français à l'anglaise. */
test("l'écran d'erreur global se suffit à lui-même", () => {
  const markup = render(createElement(GlobalError, { error: new Error("racine") }));
  assert.match(markup, /<html lang="fr">/);
  assert.match(markup, /<body/);
  assert.match(text(markup), /Le site n'a pas pu se charger/);
  assert.match(markup, /href="\/"/);
});
