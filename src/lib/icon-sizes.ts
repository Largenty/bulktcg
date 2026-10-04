/* Les côtés du favicon, en pixels : 32 pour l'onglet, 192 pour Google et
   l'écran d'accueil d'Android. Google n'affiche dans ses résultats qu'une
   icône dont le côté est un multiple de 48 px : seule, celle de 32 px n'y
   paraissait pas.

   Écrits une fois, lus deux fois : src/app/icon.tsx dessine chacun à
   l'adresse /icon/<côté>, et next.config.ts garde en cache un an ces
   adresses-là, et aucune autre. La règle valait pour tout /icon/:size, et la
   404 d'une taille inconnue restait figée un an. Aucun import : next.config.ts
   charge ce module hors du bundler. */
export const ICON_SIZES = [32, 192] as const;
