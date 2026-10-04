import type { GameId } from "@/types/game";

/* La couleur de jeu ne circule jamais en hexadécimal dans les composants :
   seulement sous forme de référence au token. */

export function gameColorVariable(gameId: GameId): string {
  return `var(--${gameId})`;
}

/* Couleur de texte compagnon, mesurée pour tenir le 4,5:1 sur son fond.
   Elle change d'un jeu à l'autre — blanc sur le bleu et le rouge, encre sur
   les autres — et c'est justement pour ça qu'elle est un token et pas une
   décision prise dans un composant. */
export function gameInkVariable(gameId: GameId): string {
  return `var(--${gameId}-ink)`;
}
