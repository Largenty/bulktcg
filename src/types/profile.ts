import type { RatingBreakdown } from "@/types/review";

export const ACCOUNT_TYPES = ["individual", "pro"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/* Vendeur tel qu'il apparaît accroché à une annonce. */
export type SellerSummary = {
  id: string;
  username: string;
  city: string;
  postalCode: string;
  avatarInitials: string;
  /* null tant qu'aucun avis n'a été laissé : un vendeur neuf n'a pas
     une note de 0, il n'a pas de note. */
  ratingAvg: number | null;
  ratingCount: number;
  /* Le statut professionnel — un SIRET déclaré et vérifié —, et non le
     forfait : une boutique reste une boutique quand son forfait expire, et
     l'acheteur doit le savoir (Code de la consommation, L111-7 et L121-4).
     C'est lui qui porte le badge PRO, l'enseigne et la fiche boutique. */
  isPro: boolean;
  /* Le forfait pro en cours : lui seul ouvre les lots réservés aux pros. */
  hasProPlan: boolean;
  /* Le nom de la boutique, pour un pro ; null pour un particulier. */
  companyName: string | null;
};

/* La fiche boutique d'un professionnel, publique tant que son statut l'est,
   forfait ou non. Chaque champ peut manquer : il s'affiche alors « — »,
   jamais inventé. */
export type ShopDetails = {
  siret: string | null;
  /* La raison sociale du répertoire, et la date où le SIRET a été vérifié :
     null pour une boutique d'avant la vérification, ou quand le répertoire
     masque le nom. */
  legalName: string | null;
  verifiedAt: string | null;
  address: string | null;
  hours: string | null;
  website: string | null;
  /* Déclarés par la boutique, non vérifiés : la fiche le dit. */
  cardmarketUrl: string | null;
  cardnexusUrl: string | null;
};

export type SellerProfile = SellerSummary & {
  bio: string | null;
  /* Fin du forfait, montrée au seul titulaire dans son compte. */
  proUntil: string | null;
  createdAt: string;
  activeListingCount: number;
  soldListingCount: number;
  /* Le détail de ratingAvg, critère par critère. */
  ratingBreakdown: RatingBreakdown;
  /* null pour un particulier. */
  shop: ShopDetails | null;
};
