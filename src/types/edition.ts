import type { GameId } from "@/types/game";

/* Une édition, c'est la série d'où sortent les cartes : EV08 chez Pokémon,
   Modern Horizons 3 chez Magic, OP-09 chez One Piece. Un lot peut en
   couvrir plusieurs — c'est même le cas courant sur du vrac.

   Ce n'est pas une chaîne libre. Un champ de texte libre donnerait
   « EV8 », « ev-08 », « Étincelles » et « surging sparks » pour la même
   série, et aucun filtre ne pourrait plus rien en faire. */
export type Edition = {
  /* Identifiant stable, unique tous jeux confondus : deux jeux peuvent
     porter le même code court — « NEO » désigne Neo Genesis chez Pokémon et
     la Dynastie Néon chez Magic. C'est cet identifiant qui circule en base
     et dans l'URL, jamais le code seul. */
  id: string;
  /* Ce que les vendeurs écrivent dans leurs titres. */
  code: string;
  gameId: GameId;
  name: string;
  year: number;
  /* Regroupement d'affichage : le bloc dont la série fait partie. Sans lui,
     la liste de dépôt serait quarante cases à cocher à plat. */
  block: string;
};
