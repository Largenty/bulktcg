import { globSync, readFileSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import ts from "typescript";

/* Le lint de Next.js 16 — `next lint` n'existe plus, et `next build` ne lint
   plus : c'est `npm run lint`, joué par `npm run verify`. Les règles sont
   celles de Next (Core Web Vitals), de React (hooks, et les règles du
   React Compiler) et de typescript-eslint ; chaque exception ci-dessous dit
   pourquoi elle est juste, fichier par fichier, plutôt que de couper une
   règle partout. */

/* Les composants clients, relus à chaque lancement : la règle de pureté du
   rendu ne vaut que pour eux (voir plus bas). Les crochets des routes
   dynamiques sont échappés, sans quoi « [slug] » se lirait comme un motif. */
const CLIENT_FILES = globSync("src/**/*.{ts,tsx}")
  .filter((file) => /^["']use client["']/.test(readFileSync(file, "utf8").trimStart()))
  .map((file) => file.replace(/[[\]{}()*?!+@]/g, "\\$&"));

/* Une clé dépréciée dans un objet remis à une API : `{ message }` dans les
   paramètres d'un schéma Zod 4 (`error` le remplace), `images.domains` dans
   next.config.ts, `themeColor` dans les métadonnées d'une page. La règle de
   typescript-eslint compare la clé au type de l'objet écrit, qui ne porte
   aucune documentation ; celle-ci la compare au type que TypeScript attend
   à cet endroit, qui dit ce qui est déprécié. Seuls ses membres objet
   comptent : dans `string | { link: string }`, le membre `string` prêterait
   à `{ link: "/x" }` la méthode String.prototype.link, dépréciée, qu'aucun
   littéral objet ne désigne. */
const OBJECT_TYPES = ts.TypeFlags.Object | ts.TypeFlags.Intersection;

const noDeprecatedKeys = {
  meta: {
    type: "problem",
    schema: [],
    messages: { deprecated: "`{{name}}` est déprécié. {{reason}}" },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    const checker = services.program.getTypeChecker();
    return {
      Property(node) {
        if (node.parent.type !== "ObjectExpression" || node.computed || node.key.type !== "Identifier") return;
        const expected = checker.getContextualType(services.esTreeNodeToTSNodeMap.get(node.parent));
        const deprecated = (expected?.isUnion() ? expected.types : [expected])
          .filter((type) => type && type.flags & OBJECT_TYPES)
          .map((type) => type.getProperty(node.key.name)?.getJsDocTags(checker).find((tag) => tag.name === "deprecated"))
          .find(Boolean);
        if (deprecated) {
          const reason = (deprecated.text ?? []).map((part) => part.text).join("");
          context.report({ node: node.key, messageId: "deprecated", data: { name: node.key.name, reason } });
        }
      },
    };
  },
};

/* Ce que Playwright déconseille sans le déprécier, et que le lint de
   typescript-eslint ne voit donc pas. Les méthodes de Page et de Frame qui
   prennent un sélecteur — page.fill("#title", …), page.waitForSelector(…),
   page.$(…) — agissent sur le premier élément venu ; un localisateur refuse
   l'ambiguïté et se relit à chaque tentative. page.locator() et
   page.frameLocator() fabriquent justement ces localisateurs. Une attente
   fixe ne prouve que le temps passé, et un ElementHandle fige un élément que
   React remplace. « networkidle » non plus ne dit pas qu'une page est
   prête, seulement que le réseau s'est tu ; il sert pourtant à prouver une
   absence — aucun préchargement, aucune violation de CSP, rien dans la
   console —, qui n'a pas d'état à attendre, et la ligne le désactive alors,
   la raison à côté. Seuls les types distinguent une page d'un localisateur :
   la règle lit la déclaration de la méthode appelée, pas le nom de la
   variable. */
const isPlaywrightDeclaration = (declaration) => declaration?.getSourceFile().fileName.includes("/playwright-core/") ?? false;

function discouragedPlaywrightCall(declaration, name) {
  const owner = declaration?.parent?.name?.text;
  if (!owner || !isPlaywrightDeclaration(declaration)) return null;
  if (owner === "ElementHandle" || (owner === "Locator" && /^elementHandles?$/.test(name))) return "handle";
  if (owner !== "Page" && owner !== "Frame") return null;
  if (name === "waitForTimeout") return "timeout";
  if (name === "locator" || name === "frameLocator") return null;
  const firstParameter = declaration.parameters[0]?.name.getText();
  return firstParameter === "selector" || name === "dragAndDrop" ? "selector" : null;
}

const playwrightLocators = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      selector: "`{{name}}(sélecteur, …)` est déconseillé par Playwright : passer par un localisateur (locator, getByRole, getByText).",
      timeout: "Une attente fixe est déconseillée par Playwright : attendre un état (waitFor, waitForURL, waitForFunction).",
      handle: "Les ElementHandle sont déconseillés par Playwright : passer par un localisateur.",
      networkidle: "« networkidle » est déconseillé par Playwright : attendre un état (expect, waitFor, waitForURL) ou une réponse (waitForResponse).",
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    const checker = services.program.getTypeChecker();
    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression" || node.callee.property.type !== "Identifier") return;
        const name = node.callee.property.name;
        const signature = checker.getResolvedSignature(services.esTreeNodeToTSNodeMap.get(node));
        const kind = discouragedPlaywrightCall(signature?.getDeclaration(), name);
        if (kind) context.report({ node: node.callee.property, messageId: kind, data: { name } });
      },
      /* waitForLoadState("networkidle"), ou { waitUntil: "networkidle" }
         passé à goto, reload, waitForURL… */
      Literal(node) {
        if (node.value !== "networkidle") return;
        const call = node.parent.type === "Property" ? node.parent.parent.parent : node.parent;
        if (call?.type !== "CallExpression") return;
        const signature = checker.getResolvedSignature(services.esTreeNodeToTSNodeMap.get(call));
        if (isPlaywrightDeclaration(signature?.getDeclaration())) context.report({ node, messageId: "networkidle" });
      },
    };
  },
};

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /* Retirer des clés sans muter l'objet passe par une déstructuration :
         `const { slug: _slug, ...fields } = row`. Un paramètre qu'une
         signature impose et qu'on n'utilise pas porte aussi le tiret bas. */
      "@typescript-eslint/no-unused-vars": [
        "error",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      /* `export declare namespace z` (lib/schemas/zod.ts) ne porte que des
         types, effacés à la compilation : rien n'y est exécuté. */
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
      /* Sous verbatimModuleSyntax, `import { type A } from "./a"` s'efface en
         `import "./a"` : le module est chargé quand même, et un module
         serveur entrerait ainsi dans le paquet client. `import type` efface
         tout. */
      "@typescript-eslint/no-import-type-side-effects": "error",
    },
  },
  {
    /* Aucune API dépréciée. React, Next, Zod, Node, le DOM, TypeScript et
       Playwright marquent @deprecated ce qu'ils vont retirer, et
       typescript-eslint le lit dans leurs types, props des composants
       comprises : le lint est donc typé, sur tout le code que l'on écrit —
       src/, next.config.ts, et les tests et scripts .mjs — le banc SQL de
       supabase/tests compris — que tsconfig.json inclut pour cette raison.
       Une dépréciation qu'on ne peut pas éviter se désactive à la ligne, la
       raison écrite à côté.

       Deux angles morts connus. Les types publiés de next/image recopient
       ses props sans leur documentation : <Image priority> n'y paraît pas
       déprécié, et tests/image-priority.test.mjs le tient, depuis les
       déclarations mêmes de Next. Et une clé d'objet n'y est comparée qu'à
       l'objet écrit, pas au type attendu : bulktcg/no-deprecated-keys
       (noDeprecatedKeys, plus haut) s'en charge.

       tests/deprecations.test.mjs vérifie que les règles couvrent ces
       dossiers et qu'elles voient réellement un appel et une clé
       dépréciés. */
    files: ["src/**/*.{ts,tsx}", "tests/**/*.{mjs,tsx}", "scripts/**/*.mjs", "supabase/**/*.mjs", "*.ts"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { bulktcg: { rules: { "no-deprecated-keys": noDeprecatedKeys, "playwright-locators": playwrightLocators } } },
    rules: {
      "@typescript-eslint/no-deprecated": "error",
      "bulktcg/no-deprecated-keys": "error",
    },
  },
  {
    /* Les parcours du smoke et des captures passent par les localisateurs
       (voir playwrightLocators, plus haut). */
    files: ["scripts/**/*.mjs"],
    rules: { "bulktcg/playwright-locators": "error" },
  },
  {
    /* Lire l'heure pendant le rendu n'est une faute que pour un composant
       client, rendu deux fois — au build, puis à l'hydratation — qui ne
       donnerait pas deux fois le même texte (React #418). Un composant
       serveur est rendu une fois : c'est là que l'heure doit se lire, et
       qu'elle se lit (CLAUDE.md, règle 8). tests/render-purity.test.mjs
       tient la même règle pour les composants clients. */
    files: ["src/**/*.{ts,tsx}"],
    ignores: CLIENT_FILES,
    rules: { "react-hooks/purity": "off" },
  },
  {
    /* Satori, qui dessine les images de partage et les icônes, ne connaît
       que <img>. La vignette d'une photo encore sur l'appareil est une URL
       blob: que next/image ne sait pas servir. */
    files: [
      "src/components/og/**",
      "src/app/**/opengraph-image.tsx",
      "src/app/icon.tsx",
      "src/app/apple-icon.tsx",
      "src/components/deposit/PhotoTile.tsx",
    ],
    rules: { "@next/next/no-img-element": "off" },
  },
  {
    /* global-error remplace le layout racine : le routeur client est tombé
       avec lui, et seul un vrai rechargement ramène une page saine. */
    files: ["src/app/global-error.tsx"],
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "captures/**"]),
]);
