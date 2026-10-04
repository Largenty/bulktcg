import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { render, text } from "./markup.mjs";

/* L'accessibilité tenue composant par composant : la structure qu'exigent les
   lecteurs d'écran et le validateur HTML, sur le vrai JSX. Chaque test porte
   un défaut relevé par axe ou html-validate à l'audit de septembre 2026, et
   échoue si l'on remet l'ancien code. Ce qui ne se voit qu'une fois la page
   rendue — débordements, contraste forcé, plan des titres — est mesuré par
   scripts/smoke/accessibility.mjs. */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/* Un arbre minimal du HTML rendu : renderToStaticMarkup produit un HTML bien
   formé, sans balise implicite, et échappe « > » dans les attributs. */
function tree(markup) {
  const root = { tag: "#root", attributes: "", children: [] };
  const stack = [root];
  for (const [, closing, tag, attributes, selfClosing, content] of markup.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g)) {
    const parent = stack.at(-1);
    if (content !== undefined) parent.children.push({ tag: "#text", text: content, children: [] });
    else if (closing) stack.pop();
    else {
      const node = { tag: tag.toLowerCase(), attributes, children: [] };
      parent.children.push(node);
      if (!selfClosing && !VOID.has(node.tag)) stack.push(node);
    }
  }
  return root;
}

const elements = (node) => node.children.filter((child) => child.tag !== "#text");
function* walk(node) {
  for (const child of elements(node)) {
    yield child;
    yield* walk(child);
  }
}
const attribute = (node, name) => node?.attributes.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null;

/* Le modèle de contenu de <dl> : des groupes « un ou plusieurs dt, puis un ou
   plusieurs dd », posés tels quels ou chacun dans un <div> — rien d'autre. */
function definitionListErrors(root) {
  const letter = (node) => ({ dt: "t", dd: "d", div: "v" })[node.tag] ?? `<${node.tag}>`;
  const errors = [];
  for (const list of [...walk(root)].filter((node) => node.tag === "dl")) {
    const children = elements(list).filter((child) => child.tag !== "script" && child.tag !== "template");
    const sequence = children.map(letter).join("");
    if (/^v+$/.test(sequence)) {
      for (const group of children) {
        const inner = elements(group).map(letter).join("");
        if (!/^t+d+$/.test(inner)) errors.push(`groupe <div> : ${inner}`);
      }
    } else if (sequence !== "" && !/^(t+d+)+$/.test(sequence)) {
      errors.push(`<dl> : ${sequence}`);
    }
  }
  return errors;
}

test("la fiche d'une boutique est une liste de définitions valide : un groupe par ligne, rien que dt et dd", async () => {
  /* axe definition-list et dlitem, html-validate element-required-ancestor :
     l'icône et un <div> de trop séparaient chaque terme de sa liste. */
  const { ShopDetails } = await import("../src/components/profile/ShopDetails.tsx");
  const markup = render(
    createElement(ShopDetails, {
      shop: { address: "Rue Carnot, 84000 Avignon", hours: "Du mardi au samedi", website: "https://repaire.example", siret: null },
    }),
  );
  assert.deepEqual(definitionListErrors(tree(markup)), []);
  assert.match(text(markup), /Adresse Rue Carnot, 84000 Avignon/);
  assert.match(text(markup), /SIRET —/);
});

test("les chiffres du compte gardent leur explication dans la liste de définitions", async () => {
  /* axe definition-list : l'explication d'un chiffre était un <p> glissé
     dans le groupe dt/dd. */
  const { StatList } = await import("../src/components/account/StatList.tsx");
  const markup = render(
    createElement(StatList, {
      stats: [
        { label: "Vues", value: "1 234", hint: "Cumulées sur vos annonces en ligne." },
        { label: "Ventes", value: "3" },
      ],
    }),
  );
  assert.deepEqual(definitionListErrors(tree(markup)), []);
  assert.match(text(markup), /Cumulées sur vos annonces en ligne/);
});

test("une feuille fermée ne laisse dans la page ni son titre ni son contenu", async () => {
  /* Le titre « Menu » du menu mobile fermé était le premier titre de chaque
     page, avant son h1, et son <nav> doublait celui de l'en-tête. */
  const { Sheet } = await import("../src/components/ui/Sheet.tsx");
  const markup = render(
    createElement(
      Sheet,
      { title: "Menu", trigger: "☰", triggerLabel: "Ouvrir le menu" },
      createElement("nav", { "aria-label": "Navigation principale" }, "Toutes les annonces"),
    ),
  );
  const root = tree(markup);
  assert.equal([...walk(root)].filter((node) => node.tag === "dialog").length, 1, "la feuille elle-même reste dans la page");
  assert.deepEqual([...walk(root)].filter((node) => /^h[1-6]$/.test(node.tag)).map((node) => node.tag), []);
  assert.doesNotMatch(markup, /Navigation principale|Toutes les annonces/);
  assert.doesNotMatch(markup, /aria-labelledby/, "une feuille fermée désignerait un titre absent");
  assert.match(markup, /aria-label="Ouvrir le menu"/);
});

test("une liste déroulante fermée ne désigne pas une liste absente, et relie son message", async () => {
  /* html-validate no-missing-references, axe aria-valid-attr-value :
     aria-controls visait une liste qui n'existe qu'une fois ouverte. */
  const { Select } = await import("../src/components/ui/Select.tsx");
  const props = {
    id: "tri",
    label: "Trier par",
    value: "recent",
    options: [
      { value: "recent", label: "Plus récentes" },
      { value: "price", label: "Prix croissant" },
    ],
    onChange: () => {},
  };
  for (const extra of [{ hint: "Consigne." }, { hint: "Consigne.", error: "Choisissez un ordre." }]) {
    const root = tree(render(createElement(Select, { ...props, ...extra })));
    const trigger = [...walk(root)].find((node) => attribute(node, "role") === "combobox");
    assert.equal(attribute(trigger, "aria-expanded"), "false");
    assert.equal(attribute(trigger, "aria-controls"), null);
    const ids = new Set([...walk(root)].map((node) => attribute(node, "id")).filter(Boolean));
    for (const id of (attribute(trigger, "aria-describedby") ?? "").split(" ").filter(Boolean)) {
      assert.ok(ids.has(id), `aria-describedby vise ${id}, absent`);
    }
  }
});

test("l'image d'une annonce n'est faite que de contenu phrasé : elle peut vivre dans un bouton", async () => {
  /* html-validate element-permitted-content : les miniatures de la galerie
     sont des boutons, et un <div> n'a pas sa place dans un <button>. */
  const { ListingImage } = await import("../src/components/listing/ListingImage.tsx");
  const FLOW = new Set(["div", "p", "section", "article", "aside", "ul", "ol", "dl", "figure", "h2", "h3", "header", "footer"]);
  for (const photo of [null, { id: "p-1", url: "https://images.unsplash.com/photo-1", seed: 7, credit: null }]) {
    const markup = render(createElement(ListingImage, { gameId: "pokemon", photo, alt: "", ratio: "1 / 1", sizes: "76px" }));
    const blocks = [...walk(tree(markup))].filter((node) => FLOW.has(node.tag)).map((node) => node.tag);
    assert.deepEqual(blocks, [], photo ? "avec photo" : "sans photo");
  }
});

test("deux encarts publicitaires d'une même page se distinguent par leur nom", async () => {
  /* axe landmark-unique : le bandeau et le pavé s'appelaient tous deux
     « Publicité ». La mention visible, elle, ne change pas. */
  const { AdSlot } = await import("../src/components/ads/AdSlot.tsx");
  const names = ["leaderboard", "rectangle", "banner"].map((format) => {
    const markup = render(createElement(AdSlot, { format, slotId: `test-${format}` }));
    assert.match(text(markup), /^Publicité/);
    return attribute(elements(tree(markup))[0], "aria-label");
  });
  assert.equal(new Set(names).size, names.length, names.join(" / "));
  for (const name of names) assert.match(name, /^Publicité/);
});

test("un formulaire de recherche porte un nom : la page en compte jusqu'à trois", async () => {
  /* axe landmark-unique : la recherche de l'en-tête et celle de la page
     étaient deux « search » sans nom. */
  const { SearchBar } = await import("../src/components/search/SearchBar.tsx");
  const markup = render(
    createElement(SearchBar, {
      action: "/annonces",
      submitLabel: "Chercher",
      fields: [{ id: "recherche-q", name: "q", label: "Quoi", placeholder: "Vrac, display…" }],
    }),
  );
  const form = [...walk(tree(markup))].find((node) => attribute(node, "role") === "search");
  assert.ok(attribute(form, "aria-label"), "la recherche de la page n'a pas de nom");
});

test("un lien permanent passe à la ligne au lieu de défiler hors de portée du clavier", async () => {
  /* axe scrollable-region-focusable : le <code> défilait horizontalement
     sans pouvoir recevoir le focus. */
  const { PermalinkSection } = await import("../src/components/home/PermalinkSection.tsx");
  const code = [...walk(tree(render(createElement(PermalinkSection))))].find((node) => node.tag === "code");
  const classes = (attribute(code, "class") ?? "").split(" ");
  assert.ok(!classes.includes("overflow-x-auto") && !classes.includes("whitespace-nowrap"), classes.join(" "));
});

test("des segments trop larges pour l'écran passent à la ligne", async () => {
  /* WCAG 1.4.10 : « En recherche / Trouvé / Abandonnée » sortait de 33 px
     d'un écran de 320 px. Mesuré aussi par le smoke. */
  const { SegmentedControl } = await import("../src/components/ui/SegmentedControl.tsx");
  const markup = render(
    createElement(SegmentedControl, {
      label: "Statut",
      value: "open",
      options: [
        { value: "open", label: "En recherche" },
        { value: "fulfilled", label: "Trouvé" },
        { value: "closed", label: "Abandonnée" },
      ],
      onChange: () => {},
    }),
  );
  const group = [...walk(tree(markup))].find((node) => attribute(node, "role") === "group");
  assert.ok((attribute(group, "class") ?? "").split(" ").includes("flex-wrap"));
});

test("un menu ou une liste de communes fermés ne désignent pas un panneau absent", async () => {
  /* Le panneau et la liste n'existent que dépliés : un aria-controls vers un
     identifiant absent était la dernière erreur html-validate du site. */
  const { GameMenu } = await import("../src/components/layout/GameMenu.tsx");
  const { CityCombobox } = await import("../src/components/city/CityCombobox.tsx");
  const menu = render(createElement(GameMenu, { games: [] }));
  assert.match(menu, /aria-expanded="false"/);
  assert.doesNotMatch(menu, /aria-controls=/);
  const city = render(createElement(CityCombobox, { id: "city", label: "Commune" }));
  assert.doesNotMatch(city, /aria-controls=/);
});

test("un champ qui demande la commune de la personne elle-même dit son rôle au navigateur", async () => {
  /* WCAG 1.3.5 : le profil et l'inscription demandent la commune de celui qui
     remplit ; le dépôt, celle d'un rendez-vous, qui peut être ailleurs. */
  const { CityCombobox } = await import("../src/components/city/CityCombobox.tsx");
  const own = render(createElement(CityCombobox, { id: "city", label: "Commune", autoComplete: "address-level2" }));
  assert.match(own, /autoComplete="address-level2"/);
  const meeting = render(createElement(CityCombobox, { id: "city", label: "Commune" }));
  assert.match(meeting, /autoComplete="off"/);
  const { SignUpForm } = await import("../src/components/auth/SignUpForm.tsx");
  assert.match(render(createElement(SignUpForm)), /id="city"[^>]*autoComplete="address-level2"/);
});
