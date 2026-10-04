import type {
  CardCondition,
  CardLanguage,
  ListingAudience,
  ListingSort,
  ListingStatus,
  LotType,
  ProductTag,
} from "@/types/listing";
import { GAME_IDS, type GameId } from "@/types/game";
import type { AccountType } from "@/types/profile";
import type { WantedStatus } from "@/types/wanted";
import type { DealKind } from "@/types/deal";
import type { NotificationKind } from "@/types/notification";
import type { ReviewCriterion, ReviewRole } from "@/types/review";
import type { ReportReason, ReportTarget } from "@/types/report";

/* Unique point de traduction des valeurs métier.
   Aucun composant ne compare jamais une chaîne française à un statut. */

export const GAME_LABELS: Record<GameId, string> = {
  pokemon: "Pokémon",
  magic: "Magic",
  onepiece: "One Piece",
  lorcana: "Lorcana",
  yugioh: "Yu-Gi-Oh",
  riftbound: "Riftbound",
  naruto: "Naruto",
  other: "Autre",
};

/* Une table de libellés en options de liste, dans l'ordre de la table. Les
   listes déroulantes et les pastilles la recopiaient chacune. */
export function toLabelOptions<Value extends string>(labels: Readonly<Record<Value, string>>): Array<{ value: Value; label: string }> {
  return (Object.entries(labels) as Array<[Value, string]>).map(([value, label]) => ({ value, label }));
}

/* Les jeux en options, dans l'ordre de GAME_IDS — celui des intercalaires,
   du menu et du pied de page. Tirés de GAME_LABELS, les formulaires de dépôt
   rangeaient Yu-Gi-Oh avant Riftbound. */
export const GAME_OPTIONS: Array<{ value: GameId; label: string }> = GAME_IDS.map((gameId) => ({ value: gameId, label: GAME_LABELS[gameId] }));

/* Le nom d'un jeu dans une phrase. Un nom propre s'accole — « cartes
   Pokémon », « du Pokémon », « tout le Pokémon » — mais « Autre » n'en est
   pas un : « cartes Autre » ou « Où trouver du Autre » ne veulent rien dire.
   Chaque tournure du site passe par ici, et tests/french.test.mjs les relit
   pour tous les jeux. */
export type GamePhrases = {
  /* « cartes Pokémon », « cartes d'autres jeux » : titres, pied de page. */
  cards: string;
  /* « du Pokémon », « d'autres jeux » : « Où trouver… », « cherchent… ». */
  some: string;
  /* « tout le Pokémon », « tous les autres jeux » : « Voir… ». */
  all: string;
  /* Ce qui qualifie un lot : « lot Pokémon ». Vide pour « Autre » — sur sa
     page, « trois autres lots » se comprend, et « lots d'autres jeux »
     doublerait le mot. withGame l'accole. */
  qualifier: string;
};

export function gamePhrases(gameId: GameId): GamePhrases {
  if (gameId === "other") {
    return { cards: "cartes d'autres jeux", some: "d'autres jeux", all: "tous les autres jeux", qualifier: "" };
  }
  const label = GAME_LABELS[gameId];
  return { cards: `cartes ${label}`, some: `du ${label}`, all: `tout le ${label}`, qualifier: label };
}

/* « lot » + le jeu : « lot Pokémon », « autres lots Magic » — ou le nom seul
   pour « Autre ». */
export function withGame(noun: string, gameId: GameId): string {
  const { qualifier } = gamePhrases(gameId);
  return qualifier ? `${noun} ${qualifier}` : noun;
}

export const STATUS_LABELS: Record<ListingStatus, string> = {
  available: "Disponible",
  reserved: "Réservé",
  sold: "Vendu",
};

/* Le libellé d'une annonce que son vendeur n'a pas prolongée : ce n'est pas
   un statut — elle reste disponible ou réservée en base —, c'est une date
   passée (lib/listing-lifecycle). */
export const EXPIRED_LABEL = "Expirée";

export const LOT_TYPE_LABELS: Record<LotType, string> = {
  bulk: "Vrac",
  binder: "Classeur",
  deck: "Deck",
  sealed: "Scellé",
  mixed: "Lot mixte",
};

/* Le vocabulaire réel des vendeurs, pas une traduction littérale : personne
   n'écrit « boîte de boosters », tout le monde écrit « display ». Les sigles
   anglais qui sont devenus le nom du produit — ETB, UPC — sont donc gardés,
   avec leur forme longue en aide au dépôt. */
export const TAG_LABELS: Record<ProductTag, string> = {
  "booster-box": "Display",
  "booster-pack": "Boosters",
  etb: "Coffret Dresseur d'Élite",
  upc: "UPC",
  tin: "Boîte métal",
  coffret: "Coffret",
  bundle: "Bundle",
  precon: "Deck préconstruit",
  "structure-deck": "Structure Deck",
  promo: "Cartes promo",
  graded: "Cartes gradées",
  singles: "Cartes à l'unité",
  playmat: "Tapis de jeu",
  sleeves: "Protège-cartes",
  "binder-included": "Classeur fourni",
};

export const CONDITION_LABELS: Record<CardCondition, string> = {
  NM: "Near Mint",
  EX: "Excellent",
  LP: "Légèrement joué",
  MP: "Moyennement joué",
  HP: "Très joué",
  sealed: "Scellé",
  mixed: "États mêlés",
};

export const LANGUAGE_LABELS: Record<CardLanguage, string> = {
  VF: "Français",
  EN: "Anglais",
  JP: "Japonais",
  mixed: "Langues mêlées",
};

export const SORT_LABELS: Record<ListingSort, string> = {
  recent: "Plus récentes",
  "price-asc": "Prix croissant",
  "price-desc": "Prix décroissant",
  distance: "Les plus proches",
};

export const AUDIENCE_LABELS: Record<ListingAudience, string> = {
  everyone: "Tout le monde",
  pros: "Professionnels uniquement",
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  individual: "Particulier",
  pro: "Professionnel",
};

export const WANTED_STATUS_LABELS: Record<WantedStatus, string> = {
  open: "En recherche",
  fulfilled: "Trouvé",
  closed: "Abandonnée",
};

/* Formes courtes réservées au bandeau de la vignette, où la place manque.
   Les formes longues restent celles de CONDITION_LABELS. */
export const CONDITION_SHORT_LABELS: Record<CardCondition, string> = {
  NM: "NM",
  EX: "EX",
  LP: "LP",
  MP: "MP",
  HP: "HP",
  sealed: "Scellé",
  mixed: "Mixte",
};

/* « Langues mêlées » fait 110 px dans le bandeau de la vignette, qui en
   offre 75 : la forme longue y est intenable. « Multi » se distingue en plus
   du « Mixte » de l'état, qui occupe la case voisine. */
export const LANGUAGE_SHORT_LABELS: Record<CardLanguage, string> = {
  VF: "VF",
  EN: "EN",
  JP: "JP",
  mixed: "Multi",
};

/* Valeur affichée quand l'information n'existe pas.
   Jamais remplacée par 0 ni par une estimation. */
export const UNKNOWN_VALUE = "—";

export const DEAL_KIND_LABELS: Record<DealKind, string> = {
  sale: "Vente",
  trade: "Échange",
};

/* Le nom de chaque sorte de notification, pour la page qui les liste. */
export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  listing_available: "De nouveau disponible",
  deal_closed: "Vente clôturée",
  review_received: "Avis reçu",
  wanted_match: "Pour votre recherche",
  listing_expiring: "Bientôt expirée",
};

export const REVIEW_ROLE_LABELS: Record<ReviewRole, string> = {
  seller: "Vendeur",
  buyer: "Acheteur",
};

export const REVIEW_CRITERION_LABELS: Record<ReviewCriterion, string> = {
  punctuality: "Ponctualité",
  responsiveness: "Délai de réponse",
  reliability: "Fiabilité",
};

/* Ce que mesure chaque critère, tous rôles confondus : la définition écrite
   sous la note d'un profil. */
export const REVIEW_CRITERION_DEFINITIONS: Record<ReviewCriterion, string> = {
  punctuality: "À l'heure au rendez-vous, ou prévenu à temps d'un retard.",
  responsiveness: "Des réponses rapides et claires aux messages.",
  reliability: "Comme vendeur, un lot conforme à l'annonce ; comme acheteur, le prix convenu tenu sans renégocier sur place.",
};

/* Ce que mesure chaque critère, selon le rôle de la personne notée : le
   formulaire le pose en consigne, le profil l'explique sous la note. */
export const REVIEW_CRITERION_HINTS: Record<ReviewRole, Record<ReviewCriterion, string>> = {
  seller: {
    punctuality: "À l'heure au rendez-vous, ou prévenu à temps d'un retard.",
    responsiveness: "Des réponses rapides et claires aux messages.",
    reliability: "Un lot conforme à l'annonce : quantité, état, contenu.",
  },
  buyer: {
    punctuality: "À l'heure au rendez-vous, ou prévenu à temps d'un retard.",
    responsiveness: "Des réponses rapides et claires aux messages.",
    reliability: "Le prix et les conditions convenus, tenus sans renégocier sur place.",
  },
};

/* Dans l'ordre où la modération les traite : l'argent d'abord. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  scam: "Arnaque, ou paiement à distance demandé",
  counterfeit: "Contrefaçon ou cartes truquées",
  misleading: "Annonce trompeuse : photos, état ou contenu",
  stolen_photos: "Photos reprises d'une autre annonce",
  harassment: "Propos insultants ou harcèlement",
  other: "Autre chose",
};

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  listing: "cette annonce",
  profile: "ce compte",
  conversation: "cette conversation",
  wanted: "cette demande",
};
