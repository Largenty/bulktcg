import { GAME_IDS, type GameId } from "@/types/game";
import type { ProductTag } from "@/types/listing";

/* Quels produits existent chez quel jeu. « UPC » et « Coffret Dresseur
   d'Élite » sont du vocabulaire Pokémon, « Structure Deck » du vocabulaire
   Yu-Gi-Oh : les proposer sur une annonce Magic ajouterait douze cases à
   cocher dont onze seraient du bruit.

   Les libellés français vivent dans lib/labels.ts, comme toutes les valeurs
   métier du projet. Ici on ne décrit que l'applicabilité. */

const ALL_GAMES: GameId[] = [...GAME_IDS];

type ProductTagInfo = {
  id: ProductTag;
  games: GameId[];
  /* Ce que le tag recouvre, quand le libellé seul peut prêter à confusion. */
  hint?: string;
};

const PRODUCT_TAGS: ProductTagInfo[] = [
  { id: "booster-box", games: ALL_GAMES, hint: "Boîte complète de boosters, scellée ou entamée." },
  { id: "booster-pack", games: ALL_GAMES, hint: "Boosters à l'unité." },
  { id: "etb", games: ["pokemon"], hint: "Elite Trainer Box." },
  { id: "upc", games: ["pokemon"], hint: "Ultra Premium Collection." },
  { id: "tin", games: ["pokemon", "yugioh"] },
  { id: "coffret", games: ALL_GAMES },
  { id: "bundle", games: ["magic"], hint: "Bundle, anciennement Fat Pack." },
  { id: "precon", games: ALL_GAMES, hint: "Deck vendu monté par l'éditeur : Commander, deck de champion Riftbound…" },
  { id: "structure-deck", games: ["yugioh"] },
  { id: "promo", games: ALL_GAMES },
  { id: "graded", games: ALL_GAMES, hint: "Cartes sous coque PSA, BGS ou équivalent." },
  /* Des cartes choisies qui partent avec le lot — jamais une annonce pour une
     seule carte : le site vend des lots, la carte à l'unité reste à Cardmarket. */
  { id: "singles", games: ALL_GAMES, hint: "Quelques cartes choisies, vendues avec le lot : les plus belles d'un classeur, par exemple." },
  { id: "playmat", games: ALL_GAMES },
  { id: "sleeves", games: ALL_GAMES },
  { id: "binder-included", games: ALL_GAMES, hint: "Le classeur part avec les cartes." },
];

const TAGS_BY_ID: ReadonlyMap<string, ProductTagInfo> = new Map(PRODUCT_TAGS.map((tag) => [tag.id, tag]));

export function getProductTagsByGame(gameId: GameId): ProductTagInfo[] {
  return PRODUCT_TAGS.filter((tag) => tag.games.includes(gameId));
}

/* Reçoit n'importe quelle chaîne — une case cochée, un paramètre d'URL — et
   dit en même temps au typeur qu'elle est un produit connu : les appelants
   filtrent sans affirmer par un cast ce qu'ils n'ont pas vérifié. */
export function isTagAllowedForGame(tag: string, gameId: GameId): tag is ProductTag {
  return TAGS_BY_ID.get(tag)?.games.includes(gameId) ?? false;
}

export const PRODUCT_TAG_IDS: ProductTag[] = PRODUCT_TAGS.map((tag) => tag.id);
