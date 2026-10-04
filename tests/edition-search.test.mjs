import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";

import { editionSearchKey, filterEditions, matchesEditionQuery } from "../src/lib/edition-search.ts";
import { CheckboxGroup } from "../src/components/ui/CheckboxGroup.tsx";
import { EditionPicker } from "../src/components/deposit/EditionPicker.tsx";
import { render, text } from "./markup.mjs";

/* La recherche dans la liste des séries du dépôt : par code ou par nom,
   sans accents, casse ni ponctuation, et jamais au prix d'une case cochée. */

const MH3 = { id: "magic-mh3", code: "MH3", name: "Modern Horizons 3" };
const BLB = { id: "magic-blb", code: "BLB", name: "Bloomburrow" };
const EV08 = { id: "pokemon-ev08", code: "EV08", name: "Étincelles Déferlantes" };
const EV085 = { id: "pokemon-ev08-5", code: "EV08.5", name: "Évolutions Prismatiques" };
const DSK = { id: "magic-dsk", code: "DSK", name: "Duskmourn : la Maison de l'Horreur" };

test("la recherche trouve une série par son code ou son nom, sans accents, casse ni ponctuation", () => {
  assert.ok(matchesEditionQuery(MH3, "mh3"));
  assert.ok(matchesEditionQuery(MH3, "MODERN"));
  assert.ok(matchesEditionQuery(MH3, "modern 3"), "chaque mot cherché ailleurs dans le nom");
  assert.ok(matchesEditionQuery(BLB, "bloom"));
  assert.ok(matchesEditionQuery(EV08, "etincelles"));
  assert.ok(matchesEditionQuery(EV08, "Étincelles déferl"));
  assert.ok(matchesEditionQuery(EV085, "ev08.5"));
  assert.ok(matchesEditionQuery(EV085, "ev085"));
  assert.ok(matchesEditionQuery(DSK, "horreur"));
  assert.ok(matchesEditionQuery(DSK, "l'horreur"));
  assert.ok(matchesEditionQuery(MH3, "   "), "une recherche vide garde tout");

  assert.ok(!matchesEditionQuery(MH3, "bloom"));
  assert.ok(!matchesEditionQuery(EV08, "ev085"));
  assert.ok(!matchesEditionQuery(MH3, "modern 2"));
  assert.equal(editionSearchKey("  Évolutions — Prismatiques  "), "evolutions prismatiques");
});

test("une série cochée reste visible quelle que soit la recherche, et seules les autres sont masquées", () => {
  const blocks = [{ editions: [MH3, BLB] }, { editions: [DSK] }];
  const { hidden, matching, total } = filterEditions(blocks, "bloom", new Set(["magic-mh3"]));
  assert.equal(total, 3);
  assert.equal(matching, 1);
  assert.deepEqual([...hidden], ["magic-dsk"], "la série cochée MH3 a été masquée, ou BLB l'a été");

  const nothing = filterEditions(blocks, "zzz", new Set());
  assert.equal(nothing.matching, 0);
  assert.equal(nothing.hidden.size, 3);
  assert.equal(filterEditions(blocks, "", new Set()).hidden.size, 0);
});

test("une case écartée par la recherche est masquée, jamais retirée du formulaire", () => {
  const markup = render(
    createElement(CheckboxGroup, {
      name: "editions",
      legend: "Séries",
      sections: [
        { title: "Récentes", options: [{ value: "magic-mh3", label: "MH3" }, { value: "magic-blb", label: "BLB", hidden: true }] },
        { title: "Anciennes", options: [{ value: "magic-dsk", label: "DSK", hidden: true }] },
      ],
      defaultSelected: ["magic-blb"],
      emptyLabel: "rien",
      toolbar: createElement("input", { type: "search", "aria-label": "Rechercher une série" }),
    }),
  );
  for (const value of ["magic-mh3", "magic-blb", "magic-dsk"]) {
    assert.match(markup, new RegExp(`value="${value}"`), `${value} a quitté le formulaire`);
  }
  assert.match(markup, /<div hidden=""><label for="editions-magic-blb"/, "la case écartée n'est pas masquée");
  assert.match(markup, /<input[^>]*checked=""[^>]*value="magic-blb"/, "la case écartée n'est plus cochée");
  assert.doesNotMatch(markup, /<div hidden=""><label for="editions-magic-mh3"/, "une case retenue est masquée");
  assert.match(markup, /<div hidden=""[^>]*><p[^>]*>Anciennes</, "une section sans case visible reste affichée");
  assert.doesNotMatch(markup, /<div hidden=""[^>]*><p[^>]*>Récentes</);
  assert.match(markup, /type="search"/, "la barre d'outils n'est pas posée");
});

test("sans JavaScript, la liste des séries ne montre pas une recherche qui ne servirait à rien", () => {
  const blocks = [{ block: "Extensions récentes", editions: [MH3, BLB] }];
  const markup = render(
    createElement(EditionPicker, {
      blocks,
      description: (canSearch) => (canSearch ? "Cherchez par code ou par nom" : "la liste défile"),
      defaultEditions: ["magic-blb"],
      emptyLabel: "rien",
    }),
  );
  assert.doesNotMatch(markup, /type="search"/, "le champ de recherche est rendu par le serveur");
  assert.match(text(markup), /la liste défile/, "l'explication promet une recherche absente");
  assert.match(markup, /<input[^>]*checked=""[^>]*value="magic-blb"/);
  assert.doesNotMatch(markup, /hidden=""/, "une série est masquée sans recherche");
});
