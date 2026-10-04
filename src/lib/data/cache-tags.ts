import "server-only";

/* Les étiquettes du cache des lectures publiques (phase 2).

   Une lecture publique — ce qu'un visiteur anonyme voit — entre dans le
   cache de données de Next avec l'étiquette de ce qu'elle lit
   (publicClient({ tags })) ; une écriture l'invalide depuis son action
   serveur par updateTag(…). Une étiquette par domaine pour commencer : une
   par annonce, jeu ou commune viendra quand le volume le demandera. Ce qui
   dépend de la personne n'entre jamais dans ce cache. */
export const CACHE_TAGS = {
  listings: "listings",
  wanted: "wanted",
  profiles: "profiles",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
