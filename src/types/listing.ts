import type { Edition } from "@/types/edition";
import type { GameId } from "@/types/game";
import type { SellerSummary } from "@/types/profile";

/* Les valeurs de chaque énumération, écrites une fois — dans l'ordre du
   cycle de vie, ou de l'échelle —, et le type qui en découle, comme GameId de
   GAME_IDS. La liste des formats était recopiée dans cinq fichiers :
   schémas, requêtes, mappers. Tous l'importent désormais d'ici. */
export const LISTING_STATUSES = ["available", "reserved", "sold"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LOT_TYPES = ["bulk", "binder", "deck", "sealed", "mixed"] as const;
export type LotType = (typeof LOT_TYPES)[number];

export const CARD_CONDITIONS = ["NM", "EX", "LP", "MP", "HP", "sealed", "mixed"] as const;
export type CardCondition = (typeof CARD_CONDITIONS)[number];

export const CARD_LANGUAGES = ["VF", "EN", "JP", "mixed"] as const;
export type CardLanguage = (typeof CARD_LANGUAGES)[number];

/* Qui voit l'annonce. « pros » : ni la recherche publique, ni Google, ni les
   particuliers — seulement les boutiques au forfait actif. Pour vendre vite
   et discrètement un gros lot, sans répondre à trente messages. */
export const LISTING_AUDIENCES = ["everyone", "pros"] as const;
export type ListingAudience = (typeof LISTING_AUDIENCES)[number];

/* Ce que le lot contient comme produit, en plus des cartes elles-mêmes :
   un display, un coffret dresseur d'élite, un tapis de jeu. Fermé et non
   libre, pour la même raison que les éditions — et parce que c'est ce que
   les acheteurs tapent en premier dans une recherche.

   Plusieurs valeurs par annonce : un lot mixte contient couramment un
   display, deux blisters et un tapis. */
export type ProductTag =
  | "booster-box"
  | "booster-pack"
  | "etb"
  | "upc"
  | "tin"
  | "coffret"
  | "bundle"
  | "precon"
  | "structure-deck"
  | "promo"
  | "graded"
  | "singles"
  | "playmat"
  | "sleeves"
  | "binder-included";

export type ListingPhoto = {
  id: string;
  position: number;
  /* Graine du bloc abstrait affiché tant que l'image n'est pas chargée, et
     seul rendu possible si l'annonce n'a aucune photo. */
  seed: number;
  /* URL affichable, résolue par lib/data/mappers depuis storage_path.
     Phase 1 : une photo Unsplash. Phase 2 : un objet Supabase Storage.
     Les composants ne voient que cette URL et ignorent d'où elle vient. */
  url: string | null;
};

export type Listing = {
  id: string;
  slug: string;
  /* Référence courte, lisible et citable : elle apparaît sur la fiche et
     dans le filigrane des photos. */
  reference: string;
  seller: SellerSummary;
  gameId: GameId;
  title: string;
  description: string;
  lotType: LotType;
  cardCount: number | null;
  weightKg: number | null;
  condition: CardCondition;
  language: CardLanguage;
  priceCents: number;
  previousPriceCents: number | null;
  city: string;
  postalCode: string;
  departmentCode: string;
  latitude: number;
  longitude: number;
  status: ListingStatus;
  /* Pour qui le lot est réservé, quand le vendeur l'a désigné. Seule cette
     personne continue de lui écrire à son sujet. */
  reservedForId: string | null;
  audience: ListingAudience;
  /* Le vendeur accepte aussi des cartes contre le lot ; le prix reste la
     valeur de référence. La note dit contre quoi, quand il l'a écrit. */
  openToTrade: boolean;
  tradeNote: string | null;
  /* Date ISO de fin de mise en avant payée, null si l'annonce n'est pas boostée. */
  featuredUntil: string | null;
  /* Option payante « Urgent », comme la mise à la une : une date de fin,
     jamais un booléen — une option qui expire ne se retire pas à la main. */
  urgentUntil: string | null;
  /* Option payante « 8 photos », achetée une fois pour toutes : trois photos
     sont gratuites, les cinq suivantes la demandent. Un booléen cette fois —
     elle n'expire pas, les photos restent. */
  hasExtraPhotos: boolean;
  /* Option payante « Remonter » : de son début à sa fin, l'annonce repasse
     en tête du tri par défaut une fois par jour (lib/listing-lifecycle). Deux
     dates, écrites par le service de paiement seul, null sans l'option. */
  bumpStartedAt: string | null;
  bumpUntil: string | null;
  /* Le dernier geste du vendeur — la prolonger, la modifier, changer son
     statut. L'annonce expire quatre-vingt-dix jours plus tard
     (lib/listing-lifecycle) ; posé par la base, jamais par le navigateur. */
  renewedAt: string;
  viewCount: number;
  photos: ListingPhoto[];
  /* Vide quand le vendeur n'a rien précisé — ce qui est une réponse
     honnête sur un carton de six kilos qui couvre vingt séries. On
     n'invente pas « toutes séries » à sa place. */
  editions: Edition[];
  tags: ProductTag[];
  createdAt: string;
  updatedAt: string;
  soldAt: string | null;
};

/* La vignette dessinée avant que tout soit choisi : l'aperçu du dépôt. Les
   quatre choix qui la structurent peuvent y manquer — ils s'affichent alors
   en emplacements vides, jamais en valeur supposée. Une annonce publiée les
   a toujours : Listing en est un cas particulier, et la grille le passe tel
   quel. */
export type ListingCardData = Omit<Listing, "gameId" | "lotType" | "condition" | "language"> & {
  gameId: GameId | null;
  lotType: LotType | null;
  condition: CardCondition | null;
  language: CardLanguage | null;
};

export const LISTING_SORTS = ["recent", "price-asc", "price-desc", "distance"] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

export type ListingQuery = {
  gameId?: GameId;
  sellerId?: string;
  /* Identifiant d'édition, pas code court : voir types/edition.ts. */
  editionId?: string;
  tag?: ProductTag;
  city?: string;
  /* La commune d'une page /[jeu]/[ville], par son slug : celle du couple
     (commune, code postal) de chaque annonce. Le nom seul ne suffit plus —
     trois communes s'appellent Valence. */
  communeSlug?: string;
  departmentCode?: string;
  lotType?: LotType;
  condition?: CardCondition;
  language?: CardLanguage;
  minPriceCents?: number;
  maxPriceCents?: number;
  /* Seulement les lots dont le vendeur accepte aussi un échange. */
  openToTrade?: boolean;
  /* Rayon en kilomètres autour de origin. Sans origin, il est ignoré. */
  maxDistanceKm?: number;
  origin?: { latitude: number; longitude: number };
  status?: ListingStatus;
  /* Sans ce drapeau la liste publique ne montre que available et reserved :
     personne ne vient chercher ce qui est déjà parti. */
  includeSold?: boolean;
  /* Sans lui, une annonce expirée — son vendeur ne l'a pas prolongée — ne
     sort d'aucune liste. Seul son vendeur la liste encore, pour la remettre
     en ligne (getListingsOwnedBy). */
  includeExpired?: boolean;
  search?: string;
  sort?: ListingSort;
  limit?: number;
  offset?: number;
};
