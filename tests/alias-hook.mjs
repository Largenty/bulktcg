/* Trois ajustements pour le lanceur de tests de Node :
   1. il ne lit pas les « paths » de tsconfig.json, donc l'alias @/ est résolu
      ici — et un import relatif sans extension depuis un fichier TypeScript
      (next.config.ts importe ./src/types/game), comme le fait TypeScript ;
   2. le retrait de types natif ne transforme pas le JSX, donc les .tsx passent
      par esbuild ;
   3. il ne sait pas charger une feuille de style, alors que global-error.tsx
      doit importer globals.css — il remplace le gabarit racine et ne peut donc
      hériter d'aucun style. Le rendu HTML ne dépend pas du CSS : on charge un
      module vide plutôt que d'amputer le composant de son import.
   Le build Next, lui, fait les trois tout seul. */
import { existsSync, readFileSync, statSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const SOURCE_ROOT = path.resolve(import.meta.dirname, "..", "src");
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    /* « server-only » est résolu par le compilateur de Next, qui fait
       échouer le build si un composant client importe la couche données.
       Node, lui, ne connaît pas le module : les tests tournent côté serveur
       par construction, on lui donne donc un module vide. */
    if (specifier === "server-only") {
      return nextResolve(
        pathToFileURL(path.join(import.meta.dirname, "stubs", "server-only.mjs")).href,
        context,
      );
    }
    /* next/image dépend du runtime Next : on lui substitue un stub qui rend
       une <img>. Voir tests/stubs/next-image.mjs. */
    if (specifier === "next/image") {
      return nextResolve(
        pathToFileURL(path.join(import.meta.dirname, "stubs", "next-image.mjs")).href,
        context,
      );
    }
    /* Next expose next/link sans extension ; le résolveur ESM de Node, lui,
       en réclame une. */
    if (/^next\/[a-z-]+$/.test(specifier)) {
      return nextResolve(`${specifier}.js`, context);
    }
    /* Le chemin du parent, sans sa requête : un module rechargé sous une autre
       adresse (« next.config.ts?variante ») reste un fichier TypeScript. */
    const parentPath = context.parentURL ? new URL(context.parentURL).pathname : "";
    const isRelativeFromTypeScript = specifier.startsWith(".") && path.extname(specifier) === "" && /\.tsx?$/.test(parentPath);
    if (!specifier.startsWith("@/") && !isRelativeFromTypeScript) return nextResolve(specifier, context);

    /* Un fichier passe avant un dossier du même nom, comme pour TypeScript :
       lib/data/mappers.ts est le point d'entrée de lib/data/mappers/. */
    const base = specifier.startsWith("@/")
      ? path.join(SOURCE_ROOT, specifier.slice(2))
      : path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    for (const extension of EXTENSIONS) {
      const candidate = `${base}${extension}`;
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        return nextResolve(pathToFileURL(candidate).href, context);
      }
    }
    return nextResolve(specifier, context);
  },

  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", shortCircuit: true, source: "export default undefined;" };
    }
    if (!url.endsWith(".tsx")) return nextLoad(url, context);

    const filePath = fileURLToPath(url);
    const { code } = transformSync(readFileSync(filePath, "utf8"), {
      loader: "tsx",
      format: "esm",
      target: "es2022",
      jsx: "automatic",
      sourcefile: filePath,
    });
    return { format: "module", shortCircuit: true, source: code };
  },
});
