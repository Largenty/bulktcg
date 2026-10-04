import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { ListingCard } from "../src/components/listing/ListingCard.tsx";
import { getListings } from "../src/lib/data/listings.ts";
import { render } from "./markup.mjs";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* La photo qui fait le LCP se charge d'emblée et en priorité haute ; les
   autres attendent d'approcher de l'écran.

   Audit de performance de septembre 2026 : les images passaient `priority`,
   que Next 16 a déprécié — la photo de la fiche était préchargée par un
   <link> sans fetchpriority, et Lighthouse le relevait sur la fiche, la
   liste et le profil. L'accueil préchargeait quatre vignettes posées sous un
   héros de la hauteur de l'écran, donc hors du premier écran. */

/* Les props que Next déprécie sur next/image, lues dans ses déclarations
   (ImageProps). Le type publié du composant les recopie sans leur
   documentation : ni l'éditeur ni le lint typé ne barrent <Image priority>,
   c'est donc ce test qui le fait (voir eslint.config.mjs). */
function deprecatedImageProps() {
  const file = path.resolve(import.meta.dirname, "..", "node_modules", "next", "dist", "shared", "lib", "get-img-props.d.ts");
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const imageProps = source.statements.find((node) => ts.isTypeAliasDeclaration(node) && node.name.text === "ImageProps");
  const names = [];
  const visit = (node) => {
    if (ts.isPropertySignature(node) && ts.getJSDocDeprecatedTag(node)) names.push(node.name.getText(source));
    ts.forEachChild(node, visit);
  };
  if (imageProps) visit(imageProps);
  return names;
}

test("aucune image ne passe une prop que Next 16 déprécie", () => {
  const deprecated = deprecatedImageProps();
  /* Si Next réorganise ses déclarations, la liste ne doit pas se vider en
     silence : le test passerait alors sur n'importe quoi. */
  assert.ok(deprecated.includes("priority") && deprecated.includes("onLoadingComplete"), `props lues : ${deprecated.join(", ")}`);

  const offenders = collectFiles(SOURCE_ROOT, /\.tsx$/).flatMap((file) => {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const found = [];
    const visit = (node) => {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === "Image") {
        for (const attribute of node.attributes.properties) {
          const name = ts.isJsxAttribute(attribute) ? attribute.name.getText(source) : null;
          if (name && deprecated.includes(name)) found.push(`${path.relative(SOURCE_ROOT, file)} : ${name}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
  });
  assert.deepEqual(offenders, [], "loading=\"eager\" et fetchPriority=\"high\" plutôt que priority, onLoad plutôt que onLoadingComplete");
});

test("une vignette du premier écran se charge d'emblée et en priorité haute, les autres à l'approche", async () => {
  const [listing] = (await getListings({ limit: 30 })).filter((candidate) => candidate.photos[0]?.url);
  assert.ok(listing, "aucune annonce de démonstration avec photo");
  const first = render(ListingCard({ listing, isPriority: true, now: Date.now() }));
  assert.match(first, /<img[^>]*loading="eager"/);
  assert.match(first, /<img[^>]*fetchPriority="high"/i);
  const later = render(ListingCard({ listing, now: Date.now() }));
  assert.match(later, /<img[^>]*loading="lazy"/);
  assert.doesNotMatch(later, /fetchPriority/i);
});

test("rien n'est chargé d'emblée sous le héros de l'accueil", () => {
  /* Le héros fait la hauteur de l'écran : « Déposé récemment » commence
     dessous. */
  const hero = readFileSync(path.join(SOURCE_ROOT, "components", "home", "HomeHero.tsx"), "utf8");
  assert.match(hero, /<ListingGrid listings=\{recentListings\} priorityCount=\{0\}/);
});
