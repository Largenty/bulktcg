/* Lecture des tokens, pour tous les tests qui en ont besoin (pas de suffixe
   .test : le lanceur ne l'exécute pas).

   Trois tests relisaient tokens.css chacun à sa façon, et chacun n'acceptait
   qu'un hexadécimal ou un alias. Avec deux thèmes, un token peut valoir
   « var(--when-light, A) var(--when-dark, B) » : un seul lecteur, qui résout
   alias et interrupteurs pour un thème donné, évite trois réécritures qui
   divergeraient. */
import { readFileSync } from "node:fs";
import path from "node:path";

export const THEMES = ["light", "dark"];

/* On ne lit que le premier bloc :root, celui des valeurs sRGB — comme avant.
   Le bloc Display-P3 plus bas ne porte que les couleurs de jeu, qui ne
   changent pas de thème. */
export function readTokens(file = path.resolve(import.meta.dirname, "..", "src", "styles", "tokens.css")) {
  const source = readFileSync(file, "utf8");
  const block = source.slice(source.indexOf(":root {"), source.indexOf("@media"));
  const tokens = new Map();
  for (const [, name, value] of block.matchAll(/--([a-z0-9-]+):([^;]*);/g)) tokens.set(name, value.trim());
  return tokens;
}

function closingParenthesis(text, open) {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    if (text[index] === ")" && --depth === 0) return index;
  }
  throw new Error(`parenthèse non fermée : « ${text} »`);
}

function splitFallback(text) {
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    if (text[index] === ")") depth -= 1;
    if (text[index] === "," && depth === 0) return [text.slice(0, index).trim(), text.slice(index + 1)];
  }
  return [text.trim(), null];
}

/* Remplace chaque var() comme le ferait le navigateur sur :root : un
   interrupteur actif rend sa valeur de repli, l'autre ne rend rien. */
function substitute(text, tokens, theme, seen) {
  let output = "";
  let cursor = 0;
  for (let start = text.indexOf("var(", cursor); start !== -1; start = text.indexOf("var(", cursor)) {
    const end = closingParenthesis(text, start + 3);
    const [reference, fallback] = splitFallback(text.slice(start + 4, end));
    const name = reference.replace(/^--/, "");
    output += text.slice(cursor, start);
    if (name === "when-light" || name === "when-dark") {
      if ((name === "when-light") === (theme === "light")) output += substitute(fallback ?? "", tokens, theme, seen);
    } else if (tokens.has(name)) {
      output += resolve(tokens, name, theme, seen);
    } else if (fallback !== null) {
      output += substitute(fallback, tokens, theme, seen);
    } else {
      throw new Error(`--${name} est cité mais n'existe pas`);
    }
    cursor = end + 1;
  }
  return output + text.slice(cursor);
}

export function resolve(tokens, name, theme, seen = new Set()) {
  if (seen.has(name)) throw new Error(`alias circulaire sur --${name}`);
  if (!tokens.has(name)) throw new Error(`token --${name} introuvable dans tokens.css`);
  return substitute(tokens.get(name), tokens, theme, new Set(seen).add(name))
    .replace(/\s+/g, " ")
    .replace(/\s*([,()])\s*/g, "$1")
    .replace(/,/g, ", ")
    .trim();
}

/* Une couleur : hexadécimale, ou rgb() éventuellement translucide. */
export function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return { rgb: [0, 2, 4].map((offset) => parseInt(hex[1].slice(offset, offset + 2), 16)), alpha: 1 };
  const rgb = value.match(/^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/);
  if (rgb) return { rgb: [rgb[1], rgb[2], rgb[3]].map(Number), alpha: rgb[4] === undefined ? 1 : Number(rgb[4]) };
  return null;
}

const toHex = (rgb) => `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;

/* Une couleur opaque d'un thème, en hexadécimal : c'est ce que mesurent les
   audits. Une couleur translucide doit passer par composite(). */
export function color(tokens, name, theme) {
  const value = resolve(tokens, name, theme);
  const parsed = parseColor(value);
  if (!parsed || parsed.alpha !== 1) throw new Error(`--${name} (${theme}) n'est pas une couleur opaque : « ${value} »`);
  return toHex(parsed.rgb);
}

/* Compositing d'une couleur translucide sur un fond hexadécimal — l'équivalent
   de color-mix(in srgb, …) et de ce que peint le navigateur. */
export function composite(tokens, name, theme, backgroundHex) {
  const { rgb, alpha } = parseColor(resolve(tokens, name, theme));
  const back = [1, 3, 5].map((offset) => parseInt(backgroundHex.slice(offset, offset + 2), 16));
  return toHex(rgb.map((channel, index) => channel * alpha + back[index] * (1 - alpha)));
}

/* Les tokens de thème : ceux qui portent un interrupteur. */
export function themedTokens(tokens) {
  return [...tokens].filter(([name, value]) => value.includes("--when-") && !name.startsWith("when-"));
}
