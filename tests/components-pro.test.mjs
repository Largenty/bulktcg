import assert from "node:assert/strict";
import test from "node:test";

import { ProStatusSection } from "../src/components/account/ProStatusSection.tsx";
import { SellerStatusSection } from "../src/components/deposit/SellerStatusSection.tsx";
import { SaleTerms } from "../src/components/listing/SaleTerms.tsx";
import { ShopDetails } from "../src/components/profile/ShopDetails.tsx";
import { getProfileById } from "../src/lib/data/profiles.ts";
import { LEGAL_LINKS } from "../src/lib/legal.ts";
import { routes } from "../src/lib/routes.ts";
import { render, text } from "./markup.mjs";

/* Ce que le statut professionnel montre : la déclaration au dépôt et sa
   mise en garde, les conditions de la vente sur la fiche, la fiche boutique
   et ses pages déclarées, la section de Paramètres. u-01 est un
   particulier, u-13 une boutique au forfait actif, u-15 une boutique au
   forfait échu. text() remplace chaque balise par une espace : la
   ponctuation qui suit un <strong> ou un <time> s'y lit précédée d'une
   espace. */

test("au dépôt, un particulier déclare vendre à titre personnel, après avoir lu ce qu'il risque", () => {
  const markup = render(SellerStatusSection({ seller: { isPro: false, companyName: null }, isEdit: false, error: undefined }));
  assert.match(markup, /<input[^>]*id="privateSeller"[^>]*required=""/);
  assert.match(text(markup), /Je vends à titre personnel, en dehors de toute activité professionnelle\./);
  assert.match(text(markup), /jusqu'à cinq ans d'emprisonnement et 750 000 € d'amende quand elle a lieu en ligne/);
  assert.ok(markup.includes(`href="${LEGAL_LINKS.misleadingPractices}"`), "la peine n'est pas reliée à son texte");
  assert.ok(markup.includes(`href="${routes.accountSettings}"`), "le chemin vers le statut professionnel manque");
  /* À la modification, la déclaration est faite : plus de case. */
  assert.doesNotMatch(render(SellerStatusSection({ seller: { isPro: false, companyName: null }, isEdit: true })), /id="privateSeller"/);
});

test("au dépôt, une boutique n'a rien à déclarer de plus", () => {
  const markup = render(SellerStatusSection({ seller: { isPro: true, companyName: "Le Repaire du Joueur" }, isEdit: false }));
  assert.doesNotMatch(markup, /privateSeller/);
  assert.match(text(markup), /Le Repaire du Joueur ?, compte professionnel\./);
});

test("la fiche dit qui vend, et ce qu'une vente entre particuliers ne garantit pas", () => {
  const individual = render(SaleTerms({ seller: { isPro: false, companyName: null, username: "lecomptoirdukado" } }));
  assert.match(text(individual), /Vente entre particuliers/);
  assert.match(text(individual), /Ni droit de rétractation ni garantie légale de conformité/);
  assert.match(text(individual), /la garantie des vices cachés s'applique/);
  assert.match(text(individual), /ne prélève aucun frais/);
  assert.ok(individual.includes(`href="${LEGAL_LINKS.hiddenDefects}"`), "la garantie des vices cachés n'est pas reliée au Code civil");
  const shop = text(render(SaleTerms({ seller: { isPro: true, companyName: "Le Repaire du Joueur", username: "repaire_du_joueur" } })));
  assert.match(shop, /Vendu par un professionnel ?, Le Repaire du Joueur\./);
  assert.doesNotMatch(shop, /vices cachés/);
});

test("la fiche boutique dit ce qui est vérifié et ce qui est seulement déclaré", () => {
  const markup = render(
    ShopDetails({
      shop: {
        siret: "55203253400703",
        legalName: "DANONE",
        verifiedAt: "2026-10-02T08:00:00.000Z",
        address: null,
        hours: null,
        website: null,
        cardmarketUrl: "https://www.cardmarket.com/fr/Magic/Users/ChezPaul",
        cardnexusUrl: null,
      },
    }),
  );
  assert.match(markup, /<time dateTime="2026-10-02T08:00:00.000Z">/);
  assert.match(text(markup), /SIRET 552\s032\s534\s00703 \(vérifié le 2 octobre 2026 ?\)/);
  assert.match(text(markup), /Raison sociale DANONE/);
  assert.match(text(markup), /Cardmarket Page vendeur \(déclaré par la boutique\)/);
  assert.match(text(markup), /CardNexus —/);
  assert.match(markup, /rel="nofollow ugc noopener"/);
});

test("Paramètres : un particulier déclare son SIRET, une boutique lit son statut et son forfait", async () => {
  const individual = render(ProStatusSection({ profile: await getProfileById("u-01") }));
  assert.match(individual, /id="siret"/);
  assert.match(individual, /id="certifies"/);

  const active = text(render(ProStatusSection({ profile: await getProfileById("u-13") })));
  assert.match(active, /Enseigne Le Repaire du Joueur/);
  assert.match(active, /Vérifié le — Pas encore vérifié auprès du répertoire/);
  assert.match(active, /Forfait pro jusqu'au/);
  assert.match(active, /le forfait se résilie d'abord/);
  assert.doesNotMatch(active, /Repasser en compte particulier/);

  /* Forfait échu : toujours professionnelle, et libre de repasser en
     particulier. */
  const lapsed = text(render(ProStatusSection({ profile: await getProfileById("u-15") })));
  assert.match(lapsed, /Forfait pro Aucun/);
  assert.match(lapsed, /Repasser en compte particulier/);
});
