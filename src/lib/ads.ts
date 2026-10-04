/* Emplacements publicitaires.

   Les formats sont ceux de l'IAB, ceux que les régies savent livrer. Leur
   hauteur est réservée dans la page avant même que quoi que ce soit charge :
   une pub qui s'insère après coup pousse le contenu vers le bas et fait
   cliquer à côté. C'est la première cause de décalage de mise en page sur un
   site financé par la publicité, et npm run smoke le mesure.

   Ce qui est rendu ici est un gabarit, pas une vraie publicité : aucune
   marque n'est inventée. En production, le conteneur reçoit le script de la
   régie et garde exactement les mêmes dimensions. */

export type AdFormat = "leaderboard" | "rectangle" | "banner";

export type AdFormatSpec = {
  label: string;
  /* Dimensions nominales du format IAB. */
  width: number;
  height: number;
  /* Repli mobile, quand le format nominal ne tient pas dans 360 px. */
  mobileWidth: number;
  mobileHeight: number;
};

export const AD_FORMATS: Record<AdFormat, AdFormatSpec> = {
  leaderboard: { label: "Leaderboard", width: 728, height: 90, mobileWidth: 320, mobileHeight: 100 },
  rectangle: { label: "Pavé", width: 300, height: 250, mobileWidth: 300, mobileHeight: 250 },
  banner: { label: "Bannière", width: 468, height: 60, mobileWidth: 320, mobileHeight: 50 },
};

/* Mention d'identification. La loi impose que la publicité soit reconnaissable
   sans ambiguïté ; elle est donc toujours affichée, jamais au survol. */
export const AD_DISCLOSURE = "Publicité";
