/* Écrit « BulkTCG » dans le texte courant ; le logotype l'affiche en
   capitales, « BULK » plein et « TCG » léger (components/layout/Logo). */
export const SITE_NAME = "BulkTCG";

export const SITE_TAGLINE = "Lots, vrac et scellé, de la main à la main";

export const SITE_DESCRIPTION =
  "Petites annonces de cartes à collectionner entre particuliers : lots, vrac et scellé, remis en main propre près de chez vous. Pas d'envoi postal, pas de commission.";

/* L'adresse publique du site, d'où partent tous les liens absolus : balise
   canonique, og:url, og:image, plan de site, robots.txt, données
   structurées. Un build de production sans elle écrivait
   « http://localhost:3000 » dans chacun — Facebook ne peut pas aller
   chercher une image sur localhost, et Google aurait reçu des canoniques
   fausses (audit SEO, P0-1).

   Dans l'ordre :
   1. NEXT_PUBLIC_SITE_URL, qui gagne toujours ;
   2. sur Vercel, le domaine de production du projet — le même en
      prévisualisation, pour qu'une préversion ne se déclare jamais
      canonique ;
   3. dans un vrai déploiement — Vercel, ou une CI (variable CI) — sans rien
      de tout ça : le build échoue, avec la consigne. Une CI qui ne fait que
      jouer les tests pose NEXT_PUBLIC_SITE_URL, n'importe laquelle ;
   4. sinon, localhost : npm run build, npm run verify et le smoke (next
      start -p 3117) tournent sans aucune variable.

   Chaque variable est lue par son nom complet : Next ne remplace dans le
   code du navigateur que les process.env.NEXT_PUBLIC_… écrits en toutes
   lettres. Lire process.env d'un bloc donnerait une autre adresse côté
   client — et un désaccord d'hydratation sur le lien permanent affiché au
   dépôt. */
export type SiteUrlEnv = {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL?: string;
  CI?: string;
};

export function resolveSiteUrl(env: SiteUrlEnv): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    if (!/^https?:\/\/[^/\s]+/.test(explicit)) {
      throw new Error(`NEXT_PUBLIC_SITE_URL doit être une adresse absolue (https://…) : « ${explicit} ».`);
    }
    return explicit.replace(/\/+$/, "");
  }
  const vercelDomain = (env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_PROJECT_PRODUCTION_URL)?.trim();
  if (vercelDomain) return `https://${vercelDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  if (env.VERCEL || env.CI) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL manque : sans elle, les liens de partage, la balise canonique et le plan de site pointeraient sur localhost. Renseignez l'adresse publique du site (https://…).",
    );
  }
  return "http://localhost:3000";
}

export const SITE_URL = resolveSiteUrl({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  /* Absentes du code du navigateur : le contrôle n'y a lieu qu'au build et
     sur le serveur, ce qui suffit à faire échouer un déploiement mal
     configuré avant qu'il ne serve quoi que ce soit. */
  VERCEL: typeof window === "undefined" ? process.env.VERCEL : undefined,
  CI: typeof window === "undefined" ? process.env.CI : undefined,
});

export const FEATURED_PRICE_CENTS = 200;

/* L'option « Urgent » : la mention rouge sur la vignette et la fiche, pour
   dire qu'on veut vendre vite. Moins chère que la mise à la une — elle ne
   fait pas passer devant, elle signale. Montant provisoire, comme les deux
   autres : une décision commerciale, à confirmer avant les paiements. */
export const URGENT_PRICE_CENTS = 100;
export const URGENT_DURATION_DAYS = 7;

/* Le forfait pro : un prix mensuel hors taxes, sans engagement. Montant
   provisoire, posé pour dessiner l'offre — c'est une décision commerciale,
   à confirmer avant l'ouverture des paiements. */
export const PRO_PLAN_PRICE_CENTS = 2900;
export const FEATURED_DURATION_DAYS = 7;

/* La remontée : chaque jour pendant sept jours, l'annonce repasse en tête du
   tri par défaut, sous les annonces à la une, sans que sa date de dépôt
   change. Moins chère que la mise à la une, qui tient la tête sept jours
   d'affilée ; plus chère que « Urgent », qui ne déplace rien. Montant
   provisoire, comme les autres. */
export const BUMP_PRICE_CENTS = 150;
export const BUMP_DURATION_DAYS = 7;

/* Trois photos gratuites ; l'option « 8 photos » ouvre les cinq suivantes,
   une fois pour toutes. La base tient la même règle (listing_photos). */
export const FREE_PHOTOS = 3;
export const MAX_PHOTOS = 8;
export const EXTRA_PHOTOS_PRICE_CENTS = 300;

/* Taille de page de la liste publique. Multiple de 2, 3 et 6 : quel que soit
   le nombre de colonnes que la grille auto-fill décide, la dernière rangée
   n'est jamais orpheline. */
export const LISTINGS_PER_PAGE = 18;
