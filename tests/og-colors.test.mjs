import assert from "node:assert/strict";
import test from "node:test";
import { OG_COLOR, OG_GAME_COLOR, OG_GAME_INK, THEME_COLOR } from "../src/lib/og-colors.ts";
import { color, readTokens } from "./tokens.mjs";

/* L'image de partage ne lit pas les variables CSS : ses couleurs sont
   recopiées à la main. Ce test échoue dès qu'une copie diverge de
   tokens.css — c'est ce qui rendait l'ancienne image jaune alors que le
   site ne l'était plus. L'image est toujours dans le thème clair : elle
   s'affiche dans un fil qu'on ne contrôle pas. */

const tokens = readTokens();
const token = (name, theme = "light") => color(tokens, name, theme);

const EXPECTED = {
  ink: "ink",
  inkSoft: "ink-soft",
  muted: "muted",
  paper: "paper",
  card: "card",
  line: "line",
  slate: "slate",
  slateRaised: "slate-raised",
  slateLine: "slate-line",
  chalk: "chalk",
  chalkSoft: "chalk-soft",
  chalkMuted: "chalk-muted",
};

test("les couleurs de base de l'image de partage sont celles des tokens", () => {
  for (const [key, name] of Object.entries(EXPECTED)) {
    assert.equal(OG_COLOR[key].toLowerCase(), token(name), `OG_COLOR.${key} ≠ --${name}`);
  }
});

test("les couleurs et encres de jeu de l'image sont celles des tokens", () => {
  for (const game of Object.keys(OG_GAME_COLOR)) {
    assert.equal(OG_GAME_COLOR[game].toLowerCase(), token(game), `couleur ${game}`);
    assert.equal(OG_GAME_INK[game].toLowerCase(), token(`${game}-ink`), `encre ${game}`);
  }
});

test("la barre du navigateur prend la couleur de l'en-tête, dans chaque thème", () => {
  for (const theme of ["light", "dark"]) {
    assert.equal(THEME_COLOR[theme].toLowerCase(), token("header-bg", theme), `THEME_COLOR.${theme} ≠ --header-bg`);
  }
});
