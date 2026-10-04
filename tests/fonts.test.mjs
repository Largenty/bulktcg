import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { convert } from "fontverter";
import { Blob, Face } from "harfbuzzjs";
import * as LABELS from "../src/lib/labels.ts";
import { CHARACTERS, OUTPUT } from "../scripts/fonts/science-gothic.config.mjs";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* Les polices préchargées pèsent sur chaque page. Audit de performance de
   septembre 2026 : 210 Ko de polices sur l'accueil, avant tout JavaScript,
   dont 94 Ko de Science Gothic — une police variable à deux axes complets,
   minuscules et cyrillique compris, pour des libellés tous en capitales —
   et 34 Ko de latin étendu que la page n'affichait pas. Science Gothic est
   désormais servie réduite (scripts/fonts/subset-science-gothic.mjs) ; ces
   tests disent si le fichier réduit suffit encore à ce que le site écrit. */

const ROOT = path.resolve(import.meta.dirname, "..");
const LAYOUT = readFileSync(path.join(SOURCE_ROOT, "app", "layout.tsx"), "utf8");
const woff2 = readFileSync(path.join(ROOT, OUTPUT));
const face = new Face(new Blob(new Uint8Array(await convert(woff2, "truetype"))));
const covered = new Set(face.collectUnicodes());
const axes = face.getAxisInfos();

const STYLESHEETS = [
  ...collectFiles(path.join(SOURCE_ROOT, "styles"), /\.css$/),
  path.join(SOURCE_ROOT, "app", "globals.css"),
].map((file) => readFileSync(file, "utf8"));

/* Les espaces ne sont pas exigées : la police n'a pas l'espace fine
   insécable (U+202F), que le navigateur prend dans la police de repli sans
   différence visible, comme avant la réduction. */
const missingFrom = (text) => [...new Set(text)].filter((char) => !/\s/.test(char) && !covered.has(char.codePointAt(0)));

test("le fichier servi est un WOFF2 de moins de 48 Ko", () => {
  assert.equal(woff2.subarray(0, 4).toString("latin1"), "wOF2");
  assert.ok(woff2.length <= 48_000, `${woff2.length} octets : le budget est de 48 000`);
});

test("il couvre tous les signes déclarés, et chaque libellé du site passé en capitales", () => {
  assert.deepEqual(missingFrom(CHARACTERS), []);
  /* Les libellés sont composés en text-transform: uppercase : c'est leur
     forme capitale qui doit exister dans la police. */
  const labels = Object.values(LABELS)
    .flatMap((value) => (typeof value === "string" ? [value] : typeof value === "object" ? Object.values(value) : []))
    .flatMap((value) => (typeof value === "string" ? [value] : Object.values(value)))
    .join(" ")
    .toUpperCase();
  assert.deepEqual(missingFrom(labels), [], "un libellé écrit un signe que Science Gothic ne sait plus dessiner");
});

test("les chiffres tabulaires et le crénage ont survécu à la réduction", () => {
  /* .label et .price demandent font-variant-numeric: tabular-nums : sans
     « tnum », les prix d'une rangée ne s'aligneraient plus. */
  assert.ok(face.getTableFeatureTags("GSUB").includes("tnum"), "tnum a disparu");
  assert.ok(face.getTableFeatureTags("GPOS").includes("kern"), "kern a disparu");
});

test("chaque largeur demandée par les feuilles de style existe dans la police", () => {
  const widths = STYLESHEETS.flatMap((css) => [
    ...[...css.matchAll(/"wdth"\s+(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])),
    ...[...css.matchAll(/--logo-width:\s*(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])),
  ]);
  assert.ok(widths.length >= 10, `seulement ${widths.length} largeurs trouvées`);
  for (const width of widths) {
    assert.ok(width >= axes.wdth.min && width <= axes.wdth.max, `wdth ${width} hors de ${axes.wdth.min}–${axes.wdth.max}`);
  }
});

test("chaque graisse posée sur un texte en Science Gothic existe dans la police", () => {
  /* Les classes qui choisissent Science Gothic, leurs variantes
     (.logo-word-light) et les utilitaires de graisse posés à côté d'elles
     dans les composants. */
  const classes = STYLESHEETS.flatMap((css) =>
    [...css.matchAll(/([^{}]+)\{([^{}]*var\(--font-display\)[^{}]*)\}/g)].flatMap((match) =>
      [...match[1].matchAll(/\.([a-z][a-z0-9-]*)/g)].map((className) => className[1]),
    ),
  );
  assert.ok(classes.includes("label") && classes.includes("price"), "classes Science Gothic introuvables");
  const weights = STYLESHEETS.flatMap((css) =>
    [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((match) => classes.some((name) => new RegExp(`\\.${name}(?:-[a-z0-9-]+)?\\b`).test(match[1])))
      .flatMap((match) => [...match[2].matchAll(/font-weight:\s*(\d+)/g)].map((weight) => Number(weight[1]))),
  );
  const UTILITIES = { thin: 100, extralight: 200, light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
  for (const file of collectFiles(SOURCE_ROOT, /\.tsx$/)) {
    for (const [, value] of readFileSync(file, "utf8").matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      const tokens = (value ?? "").split(/\s+/);
      if (!tokens.some((token) => classes.includes(token))) continue;
      for (const token of tokens) if (token.startsWith("font-") && token.slice(5) in UTILITIES) weights.push(UTILITIES[token.slice(5)]);
    }
  }
  assert.ok(weights.includes(380) && weights.includes(800), "graisses du logotype introuvables");
  for (const weight of weights) {
    assert.ok(weight >= axes.wght.min && weight <= axes.wght.max, `graisse ${weight} hors de ${axes.wght.min}–${axes.wght.max}`);
  }
});

test("seul le latin est préchargé, et Science Gothic vient du fichier réduit", () => {
  assert.doesNotMatch(LAYOUT, /subsets:\s*\[[^\]]*latin-ext/, "le latin étendu est de nouveau préchargé");
  assert.match(LAYOUT, /src:\s*"\.\/fonts\/science-gothic-caps\.woff2"/);
  assert.doesNotMatch(LAYOUT, /Science_Gothic\s*\(/, "Science Gothic est de nouveau téléchargée entière depuis Google");
});
