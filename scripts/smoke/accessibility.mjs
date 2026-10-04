/* L'accessibilité mesurée sur les pages rendues : ce qu'axe, html-validate
   et un parcours au clavier ont relevé à l'audit de septembre 2026, chaque
   défaut tenu par un parcours. Les composants, eux, sont tenus par
   tests/accessibility.test.mjs. */
import assert from "node:assert/strict";
import { check } from "./harness.mjs";
import { visit, withPage } from "./helpers.mjs";
import { OWN_LISTING } from "./fixtures.mjs";

/* Les titres affichés, dans l'ordre du document : un niveau ne se saute pas
   en descendant, et le premier titre du document — affiché ou non — est le
   h1. Un titre masqué (feuille fermée, onglet inactif) ne compte pas dans
   l'ordre, mais il ne doit pas précéder le h1 dans le HTML. */
const outline = () => {
  const all = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")];
  const shown = all.filter((heading) => heading.getClientRects().length > 0);
  const skips = [];
  shown.forEach((heading, index) => {
    const level = Number(heading.tagName[1]);
    const previous = index > 0 ? Number(shown[index - 1].tagName[1]) : 1;
    if (level > previous + 1) skips.push(`h${previous} → ${heading.tagName.toLowerCase()} « ${heading.textContent.trim().slice(0, 40)} »`);
  });
  return { first: all[0]?.tagName.toLowerCase() ?? null, skips };
};

/* Chaque identifiant cité par un attribut ARIA désigne un élément présent. */
const brokenReferences = () => {
  const broken = [];
  for (const attribute of ["aria-controls", "aria-labelledby", "aria-describedby", "aria-activedescendant"]) {
    for (const element of document.querySelectorAll(`[${attribute}]`)) {
      for (const id of element.getAttribute(attribute).split(/\s+/).filter(Boolean)) {
        if (!document.getElementById(id)) broken.push(`${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""} ${attribute}=${id}`);
      }
    }
  }
  return broken;
};

/* Deux repères de même rôle affichés sur la page portent deux noms distincts. */
const duplicateLandmarks = () => {
  const nameOf = (node) =>
    node.getAttribute("aria-label") ?? document.getElementById(node.getAttribute("aria-labelledby") ?? "")?.textContent.trim() ?? "";
  const duplicates = [];
  for (const selector of ['[role="search"]', "aside", "nav"]) {
    const names = [...document.querySelectorAll(selector)].filter((node) => node.getClientRects().length > 0).map(nameOf);
    const seen = new Set();
    for (const name of names) {
      if (seen.has(name)) duplicates.push(`${selector} « ${name} »`);
      seen.add(name);
    }
  }
  return duplicates;
};

/* Une zone qui défile se parcourt au clavier : elle reçoit le focus, ou
   contient de quoi le recevoir. */
const unreachableScrollers = () =>
  [...document.querySelectorAll("body *")]
    .filter((node) => {
      const style = getComputedStyle(node);
      const scrolls =
        (["auto", "scroll"].includes(style.overflowX) && node.scrollWidth > node.clientWidth + 1) ||
        (["auto", "scroll"].includes(style.overflowY) && node.scrollHeight > node.clientHeight + 1);
      if (!scrolls || node.tabIndex >= 0) return false;
      return !node.querySelector('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    })
    .map((node) => `${node.tagName.toLowerCase()}.${node.className.toString().split(" ")[0]}`);

/* Le modèle de contenu de <dl> : des groupes dt puis dd, nus ou chacun dans
   un <div>, et rien d'autre. */
const malformedLists = () => {
  const errors = [];
  const letter = (node) => ({ DT: "t", DD: "d", DIV: "v" })[node.tagName] ?? `<${node.tagName.toLowerCase()}>`;
  for (const list of document.querySelectorAll("dl")) {
    const children = [...list.children].filter((child) => !["SCRIPT", "TEMPLATE"].includes(child.tagName));
    const sequence = children.map(letter).join("");
    if (/^v+$/.test(sequence)) {
      for (const group of children) {
        const inner = [...group.children].map(letter).join("");
        if (!/^t+d+$/.test(inner)) errors.push(`${list.className.toString().split(" ")[0] || "dl"} : groupe ${inner}`);
      }
    } else if (sequence !== "" && !/^(t+d+)+$/.test(sequence)) {
      errors.push(`${list.className.toString().split(" ")[0] || "dl"} : ${sequence}`);
    }
  }
  return errors;
};

export async function audit() {
  await check("aucune page ne déborde à 320 px, la largeur du critère WCAG 1.4.10", async () => {
    /* L'en-tête débordait de 24 px sur toutes les pages ; l'accueil, les
       listes et le tableau des recherches, de 2 à 33 px de plus. Le reste
       de la suite ne mesure qu'à partir de 360 px. */
    await withPage({ width: 320, height: 800 }, async (tab) => {
      for (const path of ["/", "/annonces", "/pokemon", "/recherches", "/mon-compte/recherches", `/annonces/${OWN_LISTING}`, "/deposer", "/messages/c-01", "/connexion"]) {
        await visit(tab, path);
        const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, `${path} déborde de ${overflow} px à 320 px`);
      }
    });
  });

  await check("le plan des titres commence au h1 et ne saute aucun niveau, liste repliée ou non", async () => {
    /* Sur téléphone, « Affiner » replié dans sa feuille, rien ne séparait le
       h1 de la première vignette, un h3 ; et le titre « Menu » de la feuille
       fermée précédait le h1 de chaque page. */
    for (const width of [360, 1280]) {
      await withPage({ width, height: 900 }, async (tab) => {
        for (const path of ["/", "/annonces", "/pokemon", "/recherches", "/pokemon/avignon", "/pokemon/avignon#recherches", `/annonces/${OWN_LISTING}`, "/mon-compte"]) {
          await visit(tab, path);
          const { first, skips } = await tab.evaluate(outline);
          assert.equal(first, "h1", `${width} px ${path} : le premier titre est un ${first}`);
          assert.deepEqual(skips, [], `${width} px ${path}`);
        }
      });
    }
  });

  await check("chaque identifiant cité par un attribut ARIA désigne un élément présent", async () => {
    /* aria-controls visait une liste ou un panneau qui n'existe qu'ouvert. */
    await withPage({ width: 1280, height: 900 }, async (tab) => {
      for (const path of ["/", "/annonces", "/recherches", "/deposer", "/mon-compte/profil", "/connexion", "/inscription"]) {
        await visit(tab, path);
        assert.deepEqual(await tab.evaluate(brokenReferences), [], path);
      }
    });
  });

  await check("deux repères de même rôle se distinguent par leur nom", async () => {
    /* Recherche de l'en-tête et recherche de la page, bandeau et pavé
       publicitaires : deux « search », deux « Publicité ». */
    await withPage({ width: 1280, height: 900 }, async (tab) => {
      for (const path of ["/", "/annonces", "/pokemon", "/recherches", `/annonces/${OWN_LISTING}`]) {
        await visit(tab, path);
        assert.deepEqual(await tab.evaluate(duplicateLandmarks), [], path);
      }
    });
  });

  await check("une zone qui défile se parcourt au clavier", async () => {
    /* Le lien permanent de l'accueil défilait sans recevoir le focus. */
    for (const width of [360, 1280]) {
      await withPage({ width, height: 900 }, async (tab) => {
        for (const path of ["/", "/annonces", `/annonces/${OWN_LISTING}`]) {
          await visit(tab, path);
          assert.deepEqual(await tab.evaluate(unreachableScrollers), [], `${width} px ${path}`);
        }
      });
    }
  });

  await check("une liste de définitions ne contient que ses groupes de termes", async () => {
    /* La fiche boutique glissait une icône et un <div> entre la liste et ses
       termes ; le compte, un <p> dans un groupe. */
    await withPage({ width: 1280, height: 900 }, async (tab) => {
      for (const path of ["/profil/repaire_du_joueur", "/profil/lecomptoirdukado", "/mon-compte", `/annonces/${OWN_LISTING}`, "/recherches"]) {
        await visit(tab, path);
        assert.deepEqual(await tab.evaluate(malformedLists), [], path);
      }
    });
  });

  await check("en contraste forcé, l'intercalaire ouvert et le segment choisi restent distincts", async () => {
    /* Windows en contraste élevé efface l'aplat et l'ombre portée : l'onglet
       ouvert ne se distinguait plus des autres. */
    await withPage({ width: 1280, height: 900 }, async (tab) => {
      await tab.emulateMedia({ forcedColors: "active" });
      const outlined = (selector) =>
        tab.evaluate((target) => {
          const node = document.querySelector(target);
          if (!node) return null;
          const style = getComputedStyle(node);
          return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
        }, selector);
      await visit(tab, "/pokemon");
      assert.equal(await outlined('.divider[aria-current="page"]'), true, "l'intercalaire ouvert n'a pas de contour");
      assert.equal(await outlined('.divider:not([aria-current]):not([data-active])'), false, "un intercalaire fermé a un contour");
      await visit(tab, "/mon-compte/annonces");
      assert.equal(await outlined('[role="group"] button[aria-pressed="true"]'), true, "le segment choisi n'a pas de contour");
      assert.equal(await outlined('[role="group"] button[aria-pressed="false"]'), false, "un segment libre a un contour");
    });
  });
}
