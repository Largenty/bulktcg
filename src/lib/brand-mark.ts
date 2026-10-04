import { NAMED_GAME_IDS } from "@/types/game";

/* Le symbole de BulkTCG : une brique de cartes vue en perspective — le
   « bulk », tel que les joueurs l'empilent. Une carte posée sur le dessus, et
   sur les deux faces visibles la tranche aux couleurs des jeux, du premier au
   dernier des jeux nommés (NAMED_GAME_IDS, « Autre » exclu) : la même
   signature que la bande sous l'en-tête.

   La géométrie vit ici, sans couleur : le composant React la remplit avec
   les variables CSS, les images générées (favicon, icône, partage) avec les
   valeurs littérales de lib/og-colors — Satori ne lit pas les variables. Une
   seule définition, deux rendus qui ne peuvent pas diverger. */

export const MARK_VIEWBOX = "0 0 32 32";

/* Face supérieure, et la carte posée dessus (son liseré). */
export const MARK_TOP = "3.5,13 18.5,13 28.5,5.5 13.5,5.5";
export const MARK_TOP_CARD = "7.4,12 17.6,12 24.6,6.6 14.4,6.6";

/* Silhouette complète, pour le contour sur fond clair. */
export const MARK_OUTLINE = "3.5,13 13.5,5.5 28.5,5.5 28.5,18.5 18.5,26 3.5,26";

export const MARK_CARD_STROKE = 0.9;
export const MARK_OUTLINE_STROKE = 1.2;

/* La face de côté est plus sombre : la couleur du jeu mêlée d'encre. */
export const MARK_SIDE_SHADE = 0.68;

const FRONT_LEFT = 3.5;
const FRONT_RIGHT = 18.5;
const DEPTH_X = 10;
const DEPTH_Y = 7.5;
const STACK_TOP = 13;
const STACK_HEIGHT = 13;

/* Une couche par jeu nommé, du premier au dernier. Chaque couche déborde
   d'un vingtième sur la suivante : sans ce recouvrement, l'anticrénelage
   dessine un fil clair entre deux couleurs. Chaque couche porte son jeu :
   les deux rendus la colorent sans recoller deux listes par leur rang. */
const LAYER_HEIGHT = STACK_HEIGHT / NAMED_GAME_IDS.length;

export const MARK_LAYERS = NAMED_GAME_IDS.map((gameId, index) => {
  const top = STACK_TOP + index * LAYER_HEIGHT;
  const bottom = top + LAYER_HEIGHT + 0.05;
  return {
    gameId,
    front: { x: FRONT_LEFT, y: top, width: FRONT_RIGHT - FRONT_LEFT, height: LAYER_HEIGHT + 0.05 },
    side: [
      `${FRONT_RIGHT},${top}`,
      `${FRONT_RIGHT + DEPTH_X},${top - DEPTH_Y}`,
      `${FRONT_RIGHT + DEPTH_X},${bottom - DEPTH_Y}`,
      `${FRONT_RIGHT},${bottom}`,
    ].join(" "),
  };
});
