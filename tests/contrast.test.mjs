import assert from "node:assert/strict";
import test from "node:test";
import { GAME_IDS } from "../src/types/game.ts";
import { THEMES, color, composite, readTokens, resolve, themedTokens } from "./tokens.mjs";

/* Audit de contraste WCAG mesuré sur les valeurs réelles de tokens.css, dans
   les deux thèmes. Bloquant : si une paire passe sous son seuil, npm test
   échoue. Seuils AA — 4,5:1 pour le texte, 3:1 pour les éléments d'interface
   (bordures porteuses d'information, anneaux de focus).

   Chaque paire est écrite selon son sens, pas selon ses couleurs : le texte
   d'un bouton principal est --on-ink sur --ink, et non la craie sur l'encre.
   En rejouant les anciennes paires en sombre, dix tombaient sous le seuil —
   dont le bouton principal, à 1,00:1 — parce qu'un même token y tenait deux
   rôles qui s'inversent. */

const tokens = readTokens();

function luminance(hex) {
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const ratio = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground, background) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

/* Équivalent de color-mix(in srgb, <couleur> <percent>%, <fond>). */
function mix(foreground, background, percent) {
  const ratio = percent / 100;
  const channels = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
  const [front, back] = [channels(foreground), channels(background)];
  return `#${front.map((channel, index) => Math.round(channel * ratio + back[index] * (1 - ratio)).toString(16).padStart(2, "0")).join("")}`;
}

function report(pairs, threshold) {
  return pairs
    .filter(([, foreground, background]) => contrast(foreground, background) < threshold)
    .map(([label, foreground, background]) => `${label} : ${contrast(foreground, background).toFixed(2)}:1 (${foreground} sur ${background})`);
}

for (const theme of THEMES) {
  const T = (name) => color(tokens, name, theme);
  const FOIL_STOPS = [1, 2, 3, 4, 5].map((index) => [`arrêt holographique ${index}`, T(`foil-${index}`)]);

  /* Ligne de crédit : le fond du filigrane, composé sur le pire cas, une
     photo blanche. On lit --watermark-bg lui-même : l'ancien modèle (l'encre
     à 82 %) suivait --ink, qui devient claire en sombre. */
  const CREDIT_ON_WHITE = composite(tokens, "watermark-bg", theme, "#ffffff");

  /* Tampon posé sur la photo : son fond est translucide. Le pire cas est une
     photo noire en clair (le fond blanc s'y assombrit), une photo blanche en
     sombre. On mesure les deux dans chaque thème. */
  const STAMP_ON_BLACK = composite(tokens, "stamp-bg", theme, "#000000");
  const STAMP_ON_WHITE = composite(tokens, "stamp-bg", theme, "#ffffff");

  /* --- Niveau 1 : texte, seuil AA 4,5:1. Aucune exemption. --- */
  const TEXT_PAIRS = [
    ["texte principal sur la page", T("ink"), T("paper")],
    ["texte secondaire sur la page", T("ink-soft"), T("paper")],
    ["texte tertiaire sur la page", T("muted"), T("paper")],
    ["texte principal sur une carte", T("ink"), T("card")],
    ["texte secondaire sur une carte", T("ink-soft"), T("card")],
    ["texte tertiaire sur une carte", T("muted"), T("card")],
    ["texte secondaire sur une surface creusée", T("ink-soft"), T("tint")],
    ["texte tertiaire sur une surface creusée", T("muted"), T("tint")],
    ["texte de l'en-tête", T("ink"), T("header-bg")],
    ["texte secondaire de l'en-tête", T("ink-soft"), T("header-bg")],
    /* Un aplat d'encre porte --on-ink : la craie en clair, l'encre
       d'impression en sombre, où l'aplat devient clair. C'est aussi le pavé
       du prix sur chaque vignette. */
    ["texte de bouton principal, prix en pavé", T("on-ink"), T("ink")],
    ["bouton principal au survol", T("on-ink"), T("ink-soft")],
    ["horodatage d'une bulle émise", T("on-ink-muted"), T("ink")],
    ["texte sur l'ardoise", T("chalk"), T("slate")],
    ["texte secondaire sur l'ardoise", T("chalk-soft"), T("slate")],
    ["texte tertiaire sur l'ardoise", T("chalk-muted"), T("slate")],
    ["texte sur une surface d'ardoise relevée", T("chalk"), T("slate-raised")],
    ["texte secondaire sur l'ardoise relevée", T("chalk-soft"), T("slate-raised")],
    ["texte tertiaire sur l'ardoise relevée", T("chalk-muted"), T("slate-raised")],
    /* Un aplat de craie porte --on-chalk, dans les deux thèmes. */
    ["bouton inversé sur l'ardoise", T("on-chalk"), T("chalk")],
    ["bouton inversé au survol", T("on-chalk"), T("print-white")],
    ["statut disponible", T("status-available"), T("success-soft")],
    ["statut disponible sur une carte", T("status-available"), T("card")],
    ["statut réservé", T("status-reserved"), T("notice-soft")],
    ["statut réservé sur une carte", T("status-reserved"), T("card")],
    ["statut vendu", T("status-sold"), T("tint")],
    ["message d'erreur sur une carte", T("danger"), T("card")],
    ["encadré d'erreur", T("danger"), T("danger-soft")],
    ["texte dans un encadré d'erreur", T("ink"), T("danger-soft")],
    ["texte du bouton de suppression", T("danger-ink"), T("danger")],
    ["bouton de suppression au survol", T("on-ink"), T("ink")],
    ["confirmation de réussite", T("success"), T("card")],
    ["encadré de réussite", T("success"), T("success-soft")],
    ["texte dans un encadré de réussite", T("ink"), T("success-soft")],
    ["encadré d'avertissement", T("ink"), T("notice-soft")],
    ["texte tertiaire d'une conversation non lue", T("muted"), T("notice-soft")],
    ["pseudo sur la ligne de crédit, photo blanche", T("watermark-ink"), CREDIT_ON_WHITE],
    ["note du vendeur sur la ligne de crédit, photo blanche", T("watermark-ink-soft"), CREDIT_ON_WHITE],
    ["tampon « Vendu » sur photo noire", T("ink"), STAMP_ON_BLACK],
    ["tampon « Vendu » sur photo blanche", T("ink"), STAMP_ON_WHITE],
    ["tampon « Réservé » sur photo noire", T("status-reserved"), STAMP_ON_BLACK],
    ["tampon « Réservé » sur photo blanche", T("status-reserved"), STAMP_ON_WHITE],
    /* Holographique : le texte du sceau peut tomber sur n'importe quel point
       du dégradé, chaque arrêt est donc mesuré. */
    ...FOIL_STOPS.map(([label, stop]) => [`sceau « À la une » sur l'${label}`, T("foil-ink"), stop]),
    /* Chaque couleur de jeu porte son encre compagnon : intercalaire actif,
       pastille pleine. */
    ...GAME_IDS.map((game) => [`texte sur la couleur ${game}`, T(`${game}-ink`), T(game)]),
    /* Un aplat teinté à 16 % de la couleur du jeu, sous du texte. */
    ...GAME_IDS.map((game) => [`teinte ${game} sous du texte`, T("ink"), mix(T(game), T("card"), 16)]),
  ];

  /* --- Niveau 2 : contours porteurs d'information, seuil 3:1. --- */
  const CONTROL_PAIRS = [
    ["contour de champ sur la page", T("line-strong"), T("paper")],
    ["contour de champ sur une carte", T("line-strong"), T("card")],
    ["contour de champ sur une surface creusée", T("line-strong"), T("tint")],
    ["anneau de focus", T("ink"), T("paper")],
    ["anneau de focus sur une carte", T("ink"), T("card")],
    ["anneau de focus sur une surface creusée", T("ink"), T("tint")],
    ["anneau de focus sur l'ardoise", T("chalk"), T("slate")],
    ["anneau de focus sur l'ardoise relevée", T("chalk"), T("slate-raised")],
    ["contour d'erreur", T("danger"), T("card")],
    ["case cochée", T("ink"), T("card")],
    /* La jauge d'état : ses crans allumés se lisent contre la carte. Les
       crans éteints sont décoratifs — le texte à côté dit l'état. */
    ["cran allumé de la jauge d'état", T("ink"), T("card")],
    ["cadre du champ de recherche", T("ink"), T("card")],
  ];

  /* --- Niveau 3 : séparateurs décoratifs, sous 3:1 par construction.
     Exemptés au titre du WCAG 1.4.11 parce que l'information qu'ils
     suggèrent est déjà portée autrement — jamais parce que le test gênait.
     Le plancher existe pour qu'une régression vers l'invisible échoue
     quand même. --- */
  const DECORATIVE_PAIRS = [
    ["cadre de vignette", T("frame"), T("paper"), "le titre lien et le contenu délimitent la vignette ; en clair, le cadre est l'encre"],
    ["séparateur interne de carte", T("line"), T("card"), "sépare deux blocs déjà distincts par leur contenu"],
    ["cran éteint de la jauge d'état", T("line"), T("card"), "l'état est écrit en toutes lettres à côté de la jauge"],
    ["filet de l'en-tête", T("header-rule"), T("paper"), "sépare l'en-tête de la page, que la tranche borde déjà"],
    ["contour de bouton sur l'ardoise", T("slate-line"), T("slate"), "le libellé en craie identifie le bouton, le contour n'ajoute qu'un relief"],
    ["séparateur sur l'ardoise relevée", T("slate-line"), T("slate-raised"), "sépare des lignes déjà distinctes"],
  ];

  test(`[${theme}] le texte atteint le seuil AA de 4,5:1`, () => {
    const failures = report(TEXT_PAIRS, 4.5);
    assert.deepEqual(failures, [], `\n  ${failures.join("\n  ")}\n`);
  });

  test(`[${theme}] les contours porteurs d'information atteignent 3:1`, () => {
    const failures = report(CONTROL_PAIRS, 3);
    assert.deepEqual(failures, [], `\n  ${failures.join("\n  ")}\n`);
  });

  test(`[${theme}] les couleurs de jeu se distinguent de leur fond, la couleur n'étant jamais seule porteuse du sens`, () => {
    /* Chaque carré de jeu est suivi du nom du jeu : la couleur n'y est
       jamais seule. On exige seulement qu'elle se voie sur une carte et sur
       l'ardoise, là où elle sert de repère. */
    const failures = report(
      GAME_IDS.flatMap((game) => [
        [`${game} sur une carte`, T(game), T("card")],
        [`${game} sur l'ardoise`, T(game), T("slate")],
      ]),
      2,
    );
    assert.deepEqual(failures, [], `\n  ${failures.join("\n  ")}\n`);
  });

  test(`[${theme}] les séparateurs décoratifs restent au-dessus du plancher de visibilité`, () => {
    const failures = report(DECORATIVE_PAIRS, 1.2);
    assert.deepEqual(failures, [], `\n  ${failures.join("\n  ")}\n`);
  });

  test(`[${theme}] les deux tons s'inversent vraiment : l'ardoise n'est pas un gris moyen`, () => {
    assert.ok(contrast(T("chalk"), T("slate")) >= 12, "l'ardoise et la craie doivent rester un vrai contraste de bloc inversé");
    assert.ok(contrast(T("ink"), T("paper")) >= 14);
  });
}

/* Ce qui est imprimé ne change pas avec la lumière de la pièce : une
   pastille de jeu, le holographique, le filigrane posé sur une photo. Un
   alias vers un token de thème ferait basculer l'encre d'une pastille sans
   que la pastille bascule — c'est exactement ce qui arrivait à
   --pokemon-ink: var(--ink). */
test("les couleurs d'impression ne changent pas de thème", () => {
  const PRINTED = [
    "print-ink", "print-white", "chalk", "chalk-soft", "chalk-muted", "on-chalk",
    ...GAME_IDS, ...GAME_IDS.map((game) => `${game}-ink`),
    "foil-1", "foil-2", "foil-3", "foil-4", "foil-5", "foil", "foil-ink",
    "watermark-bg", "watermark-ink", "watermark-ink-soft", "sleeve-gloss",
  ];
  const moving = PRINTED.filter((name) => resolve(tokens, name, "light") !== resolve(tokens, name, "dark"));
  assert.deepEqual(moving, [], "ces tokens d'impression suivent le thème");
});

/* Une branche oubliée ne produit aucune erreur : la déclaration devient
   invalide, la couleur tombe à « transparent », en silence. */
test("chaque couleur de thème a ses deux branches", () => {
  const malformed = themedTokens(tokens).filter(([name, value]) => {
    const lights = (value.match(/var\(--when-light,/g) ?? []).length;
    const darks = (value.match(/var\(--when-dark,/g) ?? []).length;
    return lights === 0 || lights !== darks || THEMES.some((theme) => resolve(tokens, name, theme) === "");
  });
  assert.deepEqual(malformed.map(([name]) => `--${name}`), []);
  assert.ok(themedTokens(tokens).length >= 20, "aucun token de thème trouvé — le test ne vérifie rien");
});

/* Le sombre n'est pas le clair : un interrupteur mal écrit (une virgule en
   trop, un nom tapé de travers) laisserait les deux thèmes identiques sans
   qu'aucune paire n'échoue. */
test("le thème sombre change réellement la page", () => {
  for (const name of ["paper", "card", "ink", "on-ink"]) {
    assert.notEqual(color(tokens, name, "light"), color(tokens, name, "dark"), `--${name} est identique dans les deux thèmes`);
  }
});
