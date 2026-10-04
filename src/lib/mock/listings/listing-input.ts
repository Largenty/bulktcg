import type { GameId } from "@/types/game";
import type { CardCondition, CardLanguage, ListingAudience, ListingStatus, LotType, ProductTag } from "@/types/listing";

/* Une annonce de démonstration telle qu'on l'écrit : l'essentiel, en camelCase.
   listings.mock.ts en tire la ligne complète — commune du vendeur, photos,
   slug, tables de liaison. */
export type ListingInput = {
  id: string;
  sellerId: string;
  gameId: GameId;
  title: string;
  description: string;
  lotType: LotType;
  cardCount: number | null;
  weightKg: number | null;
  condition: CardCondition;
  language: CardLanguage;
  priceCents: number;
  previousPriceCents?: number;
  status: ListingStatus;
  /* « everyone » par défaut, comme en base. */
  audience?: ListingAudience;
  featuredDaysLeft?: number;
  urgentDaysLeft?: number;
  viewCount: number;
  photoCount: number;
  /* Identifiants du référentiel lib/editions.ts. Vide quand le vendeur n'a
     rien précisé — douze annonces sur trente-neuf sont dans ce cas, et c'est
     voulu : sans elles, le chemin « — » ne serait jamais exercé. */
  editions?: string[];
  tags?: ProductTag[];
  createdAt: string;
  /* Le dernier geste du vendeur ; le dépôt par défaut, comme en base.
     L'annonce expire quatre-vingt-dix jours plus tard. */
  renewedAt?: string;
  /* L'option « Remonter », commencée il y a tant d'heures : elle court
     BUMP_DURATION_DAYS jours. */
  bumpStartedHoursAgo?: number;
  soldAt?: string;
  /* Pour qui le lot est réservé, quand le vendeur l'a désigné. */
  reservedFor?: string;
  /* Ouvert à l'échange : true sans précision, ou ce que le vendeur accepte. */
  trade?: true | string;
};
