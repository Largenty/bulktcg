import { OTHER_GAME_ID, type GameId } from "@/types/game";
import type { ListingStatus, LotType } from "@/types/listing";
import type { WantedListing, WantedStatus } from "@/types/wanted";
import { formatPrice } from "@/lib/format";
import { getDistanceKm } from "@/lib/geo";

/* Croisement entre un lot et une demande de recherche.

   Les deux côtés sont décrits par leur forme minimale, et pas par le type du
   domaine : elles sont satisfaites aussi bien par un objet publié que par un
   formulaire encore à l'écran. C'est ce qui permet d'annoncer au vendeur qui
   le cherche avant même qu'il publie — et à l'acheteur ce qui existe déjà
   avant même qu'il dépose sa demande. */
export type MatchableListing = {
  gameId: GameId;
  lotType: LotType;
  cardCount: number | null;
  priceCents: number;
  latitude: number;
  longitude: number;
  status?: ListingStatus;
  /* Le vendeur, quand il est connu : un compte n'est jamais croisé avec
     lui-même. */
  seller?: { id: string };
};

export type MatchableWanted = {
  gameId: GameId;
  lotType: LotType | null;
  maxPriceCents: number | null;
  minCardCount: number | null;
  latitude: number;
  longitude: number;
  maxDistanceKm: number;
  /* Absent sur un brouillon : une demande qu'on est en train d'écrire est
     ouverte par construction. */
  status?: WantedStatus;
  buyer?: { id: string };
};

/* Une correspondance « à vérifier » est une correspondance dont un critère
   n'est pas vérifiable : l'acheteur demande 300 cartes minimum, le vendeur
   n'a pas compté. On ne la déclare pas certaine — mais on ne la cache pas
   non plus, parce qu'un carton de six kilos dépasse évidemment 300 cartes.
   C'est à l'humain de trancher, pas à un filtre qui ferait semblant de
   savoir. */
export type MatchCertainty = "certain" | "probable";

export type MatchOutcome = {
  distanceKm: number;
  certainty: MatchCertainty;
  unverified: string | null;
};

export type WantedMatch = MatchOutcome & {
  wanted: WantedListing;
};

/* Le croisement lui-même, sur les deux formes minimales. Tout le reste du
   fichier n'est qu'un habillage autour de cette fonction : elle est le seul
   endroit du projet qui décide si un lot répond à une demande. */
export function matchesWantedCriteria(
  listing: MatchableListing,
  wanted: MatchableWanted,
): MatchOutcome | null {
  if (wanted.status !== undefined && wanted.status !== "open") return null;
  if (listing.status === "sold") return null;
  if (listing.gameId !== wanted.gameId) return null;

  /* Format exact demandé : on n'élargit pas. Une correspondance approximative
     répétée détruit la confiance dans la notification, et le vendeur cesse
     de la lire. */
  if (wanted.lotType !== null && listing.lotType !== wanted.lotType) return null;

  if (wanted.maxPriceCents !== null && listing.priceCents > wanted.maxPriceCents) return null;

  const distanceKm = getDistanceKm(wanted, listing);
  if (distanceKm > wanted.maxDistanceKm) return null;

  const unverified: string[] = [];
  /* « Autre » regroupe des jeux différents : un lot Digimon et une demande
     Star Wars Unlimited y portent le même jeu. On ne peut pas l'affirmer —
     ni l'exclure, le titre le dira. À vérifier, jamais certain. */
  if (wanted.gameId === OTHER_GAME_ID) {
    unverified.push("« Autre » ne dit pas de quel jeu il s'agit, le titre le précise");
  }
  if (wanted.minCardCount !== null) {
    if (listing.cardCount === null) {
      unverified.push(`l'acheteur demande ${wanted.minCardCount} cartes minimum, ce lot n'est pas compté`);
    } else if (listing.cardCount < wanted.minCardCount) {
      return null;
    }
  }

  return unverified.length > 0
    ? { distanceKm, certainty: "probable", unverified: unverified.join(" ; ") }
    : { distanceKm, certainty: "certain", unverified: null };
}

export function matchListingAgainstWanted(
  listing: MatchableListing,
  wanted: WantedListing,
): WantedMatch | null {
  const outcome = matchesWantedCriteria(listing, wanted);
  return outcome ? { ...outcome, wanted } : null;
}

/* Une demande est atteignable depuis un point quand son auteur accepte de
   venir jusque-là. La question d'un vendeur n'est pas « qui habite près de
   moi » mais « qui viendrait jusqu'à moi » : les deux ne se recouvrent pas.
   Un acheteur à 60 km qui accepte d'en faire 100 est atteignable ; un voisin
   à 15 km qui ne bouge pas de 10 km ne l'est pas. */
export function isWantedReachableFrom(
  wanted: Pick<MatchableWanted, "latitude" | "longitude" | "maxDistanceKm">,
  origin: { latitude: number; longitude: number },
): boolean {
  return getDistanceKm(wanted, origin) <= wanted.maxDistanceKm;
}

/* Les plus proches d'abord, et les correspondances certaines avant celles à
   vérifier : c'est l'ordre dans lequel un vendeur a intérêt à les traiter.
   [...].sort et non toSorted : l'aperçu d'une demande trie dans le
   navigateur, et Firefox 111, du socle de Next, ne le connaît pas
   (tests/browser-support.test.mjs). */
export function sortMatches(matches: WantedMatch[]): WantedMatch[] {
  return [...matches].sort((left, right) => {
    if (left.certainty !== right.certainty) return left.certainty === "certain" ? -1 : 1;
    return left.distanceKm - right.distanceKm;
  });
}

/* Pourquoi un lot ne répond pas à une demande, dit en clair et en chiffres :
   « à 118 km, au-delà des 40 km acceptés » plutôt que « hors critères ». Le
   vendeur peut toujours proposer, mais il sait ce qu'il propose. null quand
   le lot répond. */
export function explainMismatch(listing: MatchableListing, wanted: MatchableWanted): string | null {
  if (listing.gameId !== wanted.gameId) return "un autre jeu que celui demandé";
  if (wanted.lotType !== null && listing.lotType !== wanted.lotType) return "un autre format que celui demandé";
  if (wanted.maxPriceCents !== null && listing.priceCents > wanted.maxPriceCents) {
    return `au-dessus du budget de ${formatPrice(wanted.maxPriceCents)}`;
  }
  const distanceKm = getDistanceKm(wanted, listing);
  if (distanceKm > wanted.maxDistanceKm) {
    return `à ${Math.round(distanceKm)} km, au-delà des ${wanted.maxDistanceKm} km acceptés`;
  }
  if (wanted.minCardCount !== null && listing.cardCount !== null && listing.cardCount < wanted.minCardCount) {
    return `${listing.cardCount} cartes, sous le minimum de ${wanted.minCardCount}`;
  }
  return null;
}
