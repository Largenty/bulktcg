import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";
import { ListingCard } from "../src/components/listing/ListingCard.tsx";
import { WantedCard } from "../src/components/wanted/WantedCard.tsx";
import { getListings } from "../src/lib/data/listings.ts";
import { getWantedListings } from "../src/lib/data/wanted.ts";
import { render } from "./markup.mjs";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* Une date affichée se lit aussi par une machine. « il y a 3 h » ne dit rien
   à un moteur de recherche ni à un lecteur d'écran qui voudrait la date
   exacte : chaque date écrite pour un humain est posée dans un
   <time dateTime="…"> qui porte l'instant ISO. Relevé par l'audit SEO de
   septembre 2026 : aucune date du site n'était balisée. La première version
   de ce test tenait une liste de huit gabarits, et huit autres affichaient
   une date sans balise — le récapitulatif d'une vente, le fil de messages,
   le profil. Il relit désormais tous les composants. */

const FORMATTERS = new Set(["formatRelativeTime", "formatAge", "formatDate", "formatTime"]);

const COMPONENTS = collectFiles(SOURCE_ROOT, /\.tsx$/);

/* Le dateTime qui accompagne un appel : celui de l'élément <time> qui
   l'entoure, ou celui d'une ligne de DefinitionList — { value, dateTime } —
   qui le pose elle-même dans un <time>. null si l'appel n'en a pas. */
function machineDate(node) {
  const property = node.parent;
  if (ts.isPropertyAssignment(property) && property.name.getText() === "value" && ts.isObjectLiteralExpression(property.parent)) {
    const sibling = property.parent.properties.find(
      (candidate) => ts.isPropertyAssignment(candidate) && candidate.name.getText() === "dateTime",
    );
    return sibling ? sibling.initializer.getText() : null;
  }
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isJsxElement(current)) {
      if (current.openingElement.tagName.getText() !== "time") return null;
      const attribute = current.openingElement.attributes.properties.find(
        (candidate) => ts.isJsxAttribute(candidate) && candidate.name.getText() === "dateTime",
      );
      return attribute?.initializer && ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression.getText() : "";
    }
  }
  return null;
}

/* Les appels d'un formateur de date dans un fichier. */
function dateCalls(file) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const calls = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && FORMATTERS.has(node.expression.text)) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return calls.map((call) => ({ call, line: source.getLineAndCharacterOfPosition(call.getStart()).line + 1 }));
}

test("chaque date affichée est posée dans un <time> qui porte son instant", () => {
  let checked = 0;
  for (const file of COMPONENTS) {
    const where = path.relative(SOURCE_ROOT, file);
    for (const { call, line } of dateCalls(file)) {
      checked += 1;
      const dateTime = machineDate(call);
      assert.ok(dateTime !== null, `${where}:${line} : ${call.getText()} n'est pas dans un <time>`);
      assert.equal(dateTime, call.arguments[0].getText(), `${where}:${line} : le dateTime ne porte pas la date affichée`);
    }
  }
  /* Le test tomberait à vide si les formateurs changeaient de nom. */
  assert.ok(checked >= 15, `seulement ${checked} dates trouvées : les formateurs ont-ils changé de nom ?`);
});

test("la vignette d'un lot et celle d'une demande écrivent l'instant ISO à côté de l'âge", async () => {
  const [listing] = await getListings({ limit: 1 });
  const listingMarkup = render(ListingCard({ listing, now: Date.parse(listing.createdAt) + 3 * 3_600_000 }));
  assert.match(listingMarkup, new RegExp(`<time dateTime="${listing.createdAt.replace(/[.]/g, "\\.")}">3 h</time>`, "i"));

  const wanted = (await getWantedListings({ limit: 20 })).find((candidate) => candidate.status === "open");
  const wantedMarkup = render(WantedCard({ wanted, now: Date.parse(wanted.createdAt) + 2 * 86_400_000 }));
  assert.match(wantedMarkup, new RegExp(`<time dateTime="${wanted.createdAt.replace(/[.]/g, "\\.")}">2 j</time>`, "i"));
});
