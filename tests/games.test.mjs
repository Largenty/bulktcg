import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { GAME_IDS, NAMED_GAME_IDS } from "../src/types/game.ts";
import { GAME_LABELS, GAME_OPTIONS } from "../src/lib/labels.ts";
import { getEditionBlocks } from "../src/lib/editions.ts";
import { OG_GAME_COLOR, OG_TRANCHE } from "../src/lib/og-colors.ts";
import { render } from "./markup.mjs";
import { SOURCE_ROOT, collectFiles } from "./sources.mjs";

/* Riftbound manquait, et rien ne le signalait : la liste des jeux était
   recopiée dans onze fichiers — schémas, requêtes, mappers, filtres,
   tranche — et chacun se contentait des cinq qu'il connaissait. Elle vit
   désormais dans src/types/game.ts. Ce fichier refuse qu'on la recopie, et
   vérifie qu'un jeu ajouté là arrive avec tout ce qu'il lui faut. */

const tokens = readFileSync(path.join(SOURCE_ROOT, "styles", "tokens.css"), "utf8");
const rootBlock = tokens.slice(tokens.indexOf(":root {"), tokens.indexOf("@media"));
const p3Block = tokens.slice(tokens.indexOf("@supports (color: color(display-p3"));

test("la liste des jeux n'est écrite qu'à un seul endroit", () => {
  const ids = GAME_IDS.join("|");
  /* Trois identifiants de jeu à la suite dans un tableau : c'est une
     recopie. Deux restent permis — les produits propres à deux jeux. */
  const copied = new RegExp(`\\[\\s*"(?:${ids})"\\s*,\\s*"(?:${ids})"\\s*,\\s*"(?:${ids})"`);
  /* La même recopie en CSS : une règle par jeu, numérotée à la main. */
  const numbered = new RegExp(`nth-child\\(\\d\\)\\s*\\{\\s*background:\\s*var\\(--(?:${ids})\\)`);
  /* Et en alternative d'expression régulière : la redirection de
     /pokemon/lots, dans next.config.ts, listait cinq jeux sur huit. */
  const alternated = new RegExp(`(?:${ids})\\|(?:${ids})\\|(?:${ids})`);
  const copies = [...collectFiles(SOURCE_ROOT, /\.(tsx?|css)$/), path.join(SOURCE_ROOT, "..", "next.config.ts")]
    .filter((file) => !file.endsWith(path.join("types", "game.ts")))
    .filter((file) => {
      const text = readFileSync(file, "utf8");
      return copied.test(text) || numbered.test(text) || alternated.test(text);
    })
    .map((file) => path.relative(SOURCE_ROOT, file));
  assert.deepEqual(copies, [], "Importez GAME_IDS depuis @/types/game au lieu de recopier la liste.");
});

test("les listes de jeux suivent l'ordre de GAME_IDS, pas celui des libellés", () => {
  /* Les formulaires de dépôt parcouraient GAME_LABELS, écrit dans un autre
     ordre : Yu-Gi-Oh y passait avant Riftbound, à l'inverse des
     intercalaires, du menu et du pied de page. */
  assert.deepEqual(GAME_OPTIONS.map((option) => option.value), [...GAME_IDS]);
  const fromLabels = collectFiles(SOURCE_ROOT, /\.tsx?$/)
    .filter((file) => /Object\.(entries|keys|values)\(GAME_LABELS\)/.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(SOURCE_ROOT, file));
  assert.deepEqual(fromLabels, [], "Parcourez GAME_IDS (ou GAME_OPTIONS), pas GAME_LABELS.");
});

test("chaque jeu arrive avec son nom, sa couleur, son encre et sa version P3", () => {
  for (const gameId of GAME_IDS) {
    assert.ok(GAME_LABELS[gameId], `${gameId} : pas de libellé`);
    assert.match(rootBlock, new RegExp(`--${gameId}:\\s*#[0-9a-f]{6};`), `${gameId} : pas de couleur`);
    assert.match(rootBlock, new RegExp(`--${gameId}-ink:`), `${gameId} : pas d'encre compagnon`);
    assert.match(p3Block, new RegExp(`--${gameId}:\\s*color\\(display-p3`), `${gameId} : pas de version P3`);
    assert.ok(OG_GAME_COLOR[gameId], `${gameId} : absent de l'image de partage`);
  }
  assert.equal(OG_TRANCHE.length, NAMED_GAME_IDS.length, "la tranche de l'image de partage n'a pas tous les jeux nommés");
});

test("chaque jeu nommé propose au moins une série au dépôt, « Autre » aucune", () => {
  for (const gameId of NAMED_GAME_IDS) {
    assert.ok(getEditionBlocks(gameId).length > 0, `${gameId} n'a aucune série dans lib/editions.ts`);
  }
  /* « Autre » regroupe des jeux différents d'une annonce à l'autre : une
     liste de séries y serait celle d'un seul d'entre eux. */
  assert.deepEqual(getEditionBlocks("other"), []);
});

test("« Autre » n'est pas un jeu : couleur neutre, absent de la tranche et du logo", async () => {
  /* Les seules couleurs vives du site veulent dire « ce jeu-là ». Une couleur
     vive pour « Autre » en dirait un qui n'existe pas. */
  const [, a, b] = toOklab(toLinearRgb(gameColor("other")));
  assert.ok(Math.hypot(a, b) < 0.03, `chroma de « Autre » : ${Math.hypot(a, b).toFixed(3)}`);
  assert.deepEqual(NAMED_GAME_IDS, GAME_IDS.filter((gameId) => gameId !== "other"));
  assert.ok(!OG_TRANCHE.includes(OG_GAME_COLOR.other), "le graphite est entré dans la tranche de partage");

  const { Tranche } = await import("../src/components/layout/Tranche.tsx");
  const { Logo } = await import("../src/components/layout/Logo.tsx");
  const tranche = render(Tranche({}));
  assert.equal((tranche.match(/<span/g) ?? []).length, NAMED_GAME_IDS.length);
  for (const markup of [tranche, render(Logo({}))]) {
    assert.doesNotMatch(markup, /var\(--other\)/, "« Autre » est entré dans la signature du site");
  }
});

/* --- Les couleurs de jeu se distinguent, y compris pour un daltonien ---

   Le README promettait « cinq teintes séparées d'au moins 60° ». C'était
   faux (bleu Magic 221°, violet Yu-Gi-Oh 262° : 41°), et surtout ce n'était
   pas la bonne mesure : la teinte ne dit rien de ce que voit un daltonien.
   L'ancien violet avait la même clarté que le bleu ; pour un deutéranope —
   environ 6 % des hommes — les deux se confondaient (distance 0,004).

   On mesure donc la distance perceptuelle OKLab entre chaque paire, en
   vision normale et sous les trois simulations de Machado, Oliveira et
   Fernandes (2009, sévérité maximale). Le jeu reste toujours écrit en toutes
   lettres — la couleur n'est jamais seule à porter l'information — mais la
   tranche, les bandeaux et les tuiles doivent garder leur sens pour tous.

   Rouge et vert (One Piece, Naruto) restent la paire la plus proche sous
   daltonisme : c'est la limite de toute palette qui garde un rouge et un
   vert. Les seuils sont posés juste sous les valeurs mesurées : une couleur
   qui glisse vers sa voisine fait échouer le test. */

const THRESHOLDS = { normal: 0.15, deuteranopie: 0.06, protanopie: 0.06, tritanopie: 0.08 };

const SIMULATIONS = {
  normal: null,
  deuteranopie: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopie: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritanopie: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

function toLinearRgb(hex) {
  return [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
}

function simulate(matrix, rgb) {
  if (!matrix) return rgb;
  return matrix.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])));
}

function toOklab([red, green, blue]) {
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function gameColor(gameId) {
  return rootBlock.match(new RegExp(`--${gameId}:\\s*(#[0-9a-f]{6});`))[1];
}

for (const [mode, matrix] of Object.entries(SIMULATIONS)) {
  test(`les couleurs de jeu se distinguent — ${mode}`, () => {
    const tooClose = [];
    for (const [index, left] of GAME_IDS.entries()) {
      for (const right of GAME_IDS.slice(index + 1)) {
        const [a, b] = [left, right].map((gameId) => toOklab(simulate(matrix, toLinearRgb(gameColor(gameId)))));
        const distance = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        if (distance < THRESHOLDS[mode]) tooClose.push(`${left}/${right} : ${distance.toFixed(3)}`);
      }
    }
    assert.deepEqual(tooClose, [], `sous le seuil de ${THRESHOLDS[mode]}`);
  });
}
