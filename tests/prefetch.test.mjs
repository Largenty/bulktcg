import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { SOURCE_ROOT } from "./sources.mjs";

/* Les liens répétés à l'écran ne préchargent leur page qu'à l'intention.

   Audit de performance de septembre 2026 : Next précharge chaque lien qui
   entre à l'écran. Sur l'accueil, la rangée d'intercalaires, entière à
   l'écran, téléchargeait neuf pages de jeu ; une grille, une fiche par
   vignette à mesure qu'on défilait — 22 à 54 Ko par page vue, en
   arrière-plan, et en phase 2 autant de requêtes à la base. IntentLink
   attend le survol, le doigt posé ou le focus. */

const read = (file) => readFileSync(path.join(SOURCE_ROOT, file), "utf8");

/* Les liens qui arrivent à l'écran en nombre : intercalaires, vignettes,
   menus dépliés, tuiles de jeux, communes voisines, croisements, avis — et
   le pied de page, une vingtaine de liens sur chaque page. */
const REPEATED_LINKS = [
  "components/listing/ListingCard.tsx",
  "components/wanted/WantedCard.tsx",
  "components/market/HashPreservingLink.tsx",
  "components/layout/GameMenu.tsx",
  "components/layout/MobileNav.tsx",
  "components/home/GameTiles.tsx",
  "components/market/CityMarket.tsx",
  "components/market/CitySellPanel.tsx",
  "components/wanted/MatchingListings.tsx",
  "components/wanted/MatchingWanted.tsx",
  "components/listing/SellerCard.tsx",
  "components/review/ReviewList.tsx",
  "components/layout/SiteFooter.tsx",
];

test("les liens répétés passent par IntentLink, jamais par next/link directement", () => {
  for (const file of REPEATED_LINKS) {
    const text = read(file);
    assert.doesNotMatch(text, /^import Link from "next\/link";/m, `${file} importe next/link et précharge à l'écran`);
    assert.match(text, /<IntentLink\b/, `${file} n'utilise pas IntentLink`);
  }
});

test("IntentLink ne précharge rien avant l'intention, puis rend la main au comportement de Next", () => {
  const text = read("components/ui/IntentLink.tsx");
  assert.match(text, /prefetch=\{hasIntent \? \(prefetch \?\? "auto"\) : false\}/);
  for (const signal of ["onMouseEnter", "onTouchStart", "onFocus"]) {
    assert.match(text, new RegExp(`${signal}=\\{\\(event\\) => \\{\\s*setHasIntent\\(true\\);`), `${signal} ne signale pas l'intention`);
  }
});
