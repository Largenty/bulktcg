import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* Zod n'entre dans le projet que par src/lib/schemas/zod.ts, et sous une
   forme qui s'élague.

   Audit de performance de septembre 2026 : `import { z } from "zod"`, répété
   dans quatorze fichiers, liait l'espace de noms entier — quarante locales
   comprises —, et les pages de dépôt chargeaient 62 Ko gzip de Zod quand 14
   suffisaient. Le même audit a relevé une violation de CSP sur chaque page
   de formulaire : Zod sondait `new Function` pour compiler ses analyseurs,
   faute de `jitless`. */

const ENTRY = path.join(SOURCE_ROOT, "lib", "schemas", "zod.ts");

const zodImports = (text) =>
  [...text.matchAll(/^\s*import\s+(type\s+)?([^;]*?)\s+from\s+["']zod(?:\/[^"']*)?["']/gm)].map((match) => ({
    isTypeOnly: Boolean(match[1]),
    clause: match[2].trim(),
  }));

test("aucun fichier n'importe Zod ailleurs que par src/lib/schemas/zod.ts", () => {
  const offenders = collectFiles(SOURCE_ROOT, /\.tsx?$/)
    .filter((file) => file !== ENTRY)
    .filter((file) => zodImports(readFileSync(file, "utf8")).length > 0)
    .map((file) => path.relative(SOURCE_ROOT, file));
  assert.deepEqual(offenders, [], `importez z depuis @/lib/schemas/zod : ${offenders.join(", ")}`);
});

test("le point d'entrée n'importe que des noms, jamais l'espace de noms de Zod", () => {
  /* Un espace de noms, par défaut ou par étoile, retient tout ce qu'il
     exporte ; seul un import de type, effacé à la compilation, peut le
     désigner. */
  const imports = zodImports(readFileSync(ENTRY, "utf8"));
  assert.ok(imports.some(({ isTypeOnly }) => !isTypeOnly), "le point d'entrée n'importe plus rien de Zod");
  for (const { isTypeOnly, clause } of imports.filter((entry) => !entry.isTypeOnly)) {
    assert.match(clause, /^\{[^}]*\}$/, `import de valeur qui n'est pas nommé : ${clause}`);
    assert.doesNotMatch(clause, /(^|[{,\s])(z|default|locales)(\s*[,}]|\s+as\b)/, `« ${clause} » retient l'espace de noms`);
    assert.equal(isTypeOnly, false);
  }
});

test("jitless est posé dès le chargement : aucune sonde new Function sous la CSP", async () => {
  const { z } = await import("../src/lib/schemas/zod.ts");
  assert.equal(globalThis.__zod_globalConfig?.jitless, true);
  /* Et les schémas analysent toujours, sans compilation à la volée. */
  const schema = z.object({ title: z.string().min(2), game: z.enum(["pokemon", "magic"]) });
  assert.equal(schema.safeParse({ title: "Vrac", game: "magic" }).success, true);
  assert.equal(schema.safeParse({ title: "V", game: "uno" }).success, false);
});
