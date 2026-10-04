import { NAMED_GAME_IDS, type GameId } from "@/types/game";

/* Satori, le moteur de rendu des images Open Graph, ne lit ni les variables
   CSS ni color-mix : il faut lui donner des valeurs littérales. Ce fichier
   est le seul endroit du projet où les tokens sont recopiés en dur, et il
   existe uniquement pour ça. tests/og-colors.test.mjs échoue si l'une de ces
   valeurs diverge de styles/tokens.css. */
export const OG_COLOR = {
  ink: "#0A0C10",
  inkSoft: "#343A44",
  muted: "#545B67",
  paper: "#E9ECEF",
  card: "#FFFFFF",
  line: "#CDD2D9",
  slate: "#0F1216",
  slateRaised: "#1A1E25",
  slateLine: "#343B46",
  chalk: "#F2F4F7",
  chalkSoft: "#C3C9D2",
  chalkMuted: "#8E96A3",
} as const;

/* La couleur de la barre du navigateur, par thème : celle de l'en-tête,
   qu'elle prolonge — l'étiquette blanche en clair, l'ardoise en sombre. */
export const THEME_COLOR = {
  light: "#FFFFFF",
  dark: "#05070A",
} as const;

export const OG_GAME_COLOR: Record<GameId, string> = {
  pokemon: "#EFA00B",
  magic: "#2563EB",
  onepiece: "#D01340",
  lorcana: "#A104A9",
  yugioh: "#A970FF",
  riftbound: "#0AC8B9",
  naruto: "#15A34A",
  other: "#62666C",
};

/* Encre posée sur chaque couleur de jeu : la même que --<jeu>-ink, qui est
   une couleur d'impression — l'encre ou le blanc, jamais un token de thème. */
export const OG_GAME_INK: Record<GameId, string> = {
  pokemon: OG_COLOR.ink,
  magic: OG_COLOR.card,
  onepiece: OG_COLOR.card,
  lorcana: OG_COLOR.card,
  yugioh: OG_COLOR.ink,
  riftbound: OG_COLOR.ink,
  naruto: OG_COLOR.ink,
  other: OG_COLOR.card,
};

/* Équivalent littéral de color-mix(in srgb, <couleur> <ratio>, <fond>) :
   Satori ne connaît pas color-mix. */
export function mixHex(foreground: string, background: string, ratio: number): string {
  const channel = (hex: string, offset: number) => parseInt(hex.slice(offset, offset + 2), 16);
  const mix = (offset: number) =>
    Math.round(channel(foreground, offset) * ratio + channel(background, offset) * (1 - ratio))
      .toString(16)
      .padStart(2, "0");
  /* Rouge, vert, bleu : les trois paires de chiffres après le « # ». */
  return `#${[1, 3, 5].map(mix).join("").toUpperCase()}`;
}

/* L'ordre de la tranche, celui du logo et de l'en-tête. */
export const OG_TRANCHE: string[] = NAMED_GAME_IDS.map((gameId) => OG_GAME_COLOR[gameId]);
