import "server-only";
import { cache } from "react";
import { GAME_IDS, type GameId } from "@/types/game";
import type { Listing } from "@/types/listing";
import type { WantedListing, WantedQuery, WantedSort } from "@/types/wanted";
import { getDistanceKm } from "@/lib/geo";
import { slugify } from "@/lib/slug";
import { isProRow, toWantedListing } from "@/lib/data/mappers";
import { narrow } from "@/lib/data/mappers/shared";
import type { WantedRowWithRelations } from "@/lib/data/rows";
import { getListings } from "@/lib/data/listings";
import { wantedRows } from "@/lib/data/source";
import {
  isWantedReachableFrom,
  matchListingAgainstWanted,
  matchesWantedCriteria,
  sortMatches,
  type MatchableListing,
  type MatchableWanted,
  type WantedMatch,
} from "@/lib/matching";

/* Même frontière que pour les annonces : filtrage sur les lignes, conversion
   au dernier moment. Phase 2, les lignes viennent de Supabase (source.ts),
   et le filtrage reste celui d'ici. */

const DEFAULT_LIMIT = 40;


function matchesQuery(row: WantedRowWithRelations, query: WantedQuery): boolean {
  if (query.gameId && row.game_id !== query.gameId) return false;
  if (query.buyerId && row.buyer_id !== query.buyerId) return false;
  if (query.city && slugify(row.city) !== slugify(query.city)) return false;
  if (query.departmentCode && row.department_code !== query.departmentCode) return false;
  if (query.lotType && row.lot_type !== query.lotType) return false;
  if (query.acceptsLotType && row.lot_type !== null && row.lot_type !== query.acceptsLotType) return false;
  if (query.minBudgetCents !== undefined) {
    if (row.max_price_cents === null || row.max_price_cents < query.minBudgetCents) return false;
  }
  /* Le statut, comme le badge PRO de la vignette — pas le forfait. */
  if (query.buyerKind && isProRow(row.buyer) !== (query.buyerKind === "pro")) return false;

  if (query.status) {
    if (row.status !== query.status) return false;
  } else if (!query.includeClosed && row.status !== "open") {
    return false;
  }

  if (query.origin) {
    if (query.reachableOnly && !isWantedReachableFrom(rowCoordinates(row), query.origin)) {
      return false;
    }
    if (query.maxDistanceKm !== undefined) {
      if (getDistanceKm(query.origin, rowCoordinates(row)) > query.maxDistanceKm) return false;
    }
  }

  return true;
}

function rowCoordinates(row: WantedRowWithRelations) {
  return { latitude: row.latitude, longitude: row.longitude, maxDistanceKm: row.max_distance_km };
}

function byRecency(left: WantedRowWithRelations, right: WantedRowWithRelations): number {
  return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
}

function resolveWantedSort(query: Pick<WantedQuery, "sort" | "origin">): WantedSort {
  const sort = query.sort ?? (query.origin ? "distance" : "recent");
  /* Sans origine, « les plus proches » n'a pas d'ordre à donner : on
     retombe sur les plus récentes plutôt que de rendre un ordre arbitraire. */
  return sort === "distance" && !query.origin ? "recent" : sort;
}

async function selectRows(query: WantedQuery): Promise<WantedRowWithRelations[]> {
  const matching = (await wantedRows()).filter((row) => matchesQuery(row, query));
  const sort = resolveWantedSort(query);

  if (sort === "distance" && query.origin) {
    const origin = query.origin;
    matching.sort(
      (left, right) =>
        getDistanceKm(origin, { latitude: left.latitude, longitude: left.longitude }) -
        getDistanceKm(origin, { latitude: right.latitude, longitude: right.longitude }),
    );
  } else if (sort === "budget-desc") {
    /* Les demandes sans budget en dernier : elles n'en annoncent aucun, pas
       un budget nul. */
    matching.sort((left, right) => (right.max_price_cents ?? -1) - (left.max_price_cents ?? -1) || byRecency(left, right));
  } else {
    matching.sort(byRecency);
  }

  return matching;
}

export async function getWantedListings(query: WantedQuery = {}): Promise<WantedListing[]> {
  const offset = query.offset ?? 0;
  return (await selectRows(query))
    .slice(offset, offset + (query.limit ?? DEFAULT_LIMIT))
    .map(toWantedListing);
}

export async function countWantedListings(query: WantedQuery = {}): Promise<number> {
  return (await selectRows({ ...query, limit: undefined, offset: undefined })).length;
}

/* Combien de demandes le filtre de budget écarte faute d'en annoncer un :
   sans ce chiffre, le vendeur croirait qu'aucun autre acheteur n'existe. */
export async function countWantedWithoutBudget(query: WantedQuery = {}): Promise<number> {
  return (await selectRows({ ...query, minBudgetCents: undefined, limit: undefined, offset: undefined })).filter(
    (row) => row.max_price_cents === null,
  ).length;
}

/* Un seul passage sur les lignes plutôt qu'une requête par jeu : la barre de
   filtres doit dire ce qu'elle filtre, pas ce que coûte son compteur. */
export async function getWantedCountByGame(
  query: WantedQuery = {},
): Promise<Record<GameId, number>> {
  const counts = Object.fromEntries(GAME_IDS.map((gameId) => [gameId, 0])) as Record<
    GameId,
    number
  >;
  for (const row of await selectRows({ ...query, gameId: undefined, limit: undefined, offset: undefined })) {
    counts[narrow(row.game_id, GAME_IDS, "wanted_listings.game_id")] += 1;
  }
  return counts;
}

/* Même mémoïsation par requête que getListingBySlug, pour la même raison :
   la page d'une demande la lit deux fois, une fois pour ses métadonnées et
   une fois pour son corps. */
export const getWantedBySlug = cache(
  async (slug: string): Promise<WantedListing | null> => {
    const row = (await wantedRows()).find((candidate) => candidate.slug === slug);
    return row ? toWantedListing(row) : null;
  },
);

export const getWantedById = cache(async (wantedId: string): Promise<WantedListing | null> => {
  const row = (await wantedRows()).find((candidate) => candidate.id === wantedId);
  return row ? toWantedListing(row) : null;
});

/* Les demandes d'un acheteur, closes comprises : c'est son tableau de bord,
   pas la liste publique. Elles y restent pour qu'il puisse les rouvrir. */
export const getWantedListingsByBuyer = cache(async (buyerId: string): Promise<WantedListing[]> => {
  return (await wantedRows()).filter((row) => row.buyer_id === buyerId)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .map(toWantedListing);
});

/* Qui cherche ce lot. C'est la seule raison d'être des demandes de
   recherche : sans ce croisement, elles ne seraient qu'un panneau
   d'affichage que personne ne relit. */
export async function getWantedMatches(
  listing: MatchableListing,
  limit = 6,
): Promise<WantedMatch[]> {
  /* Jamais soi-même : la demande de l'auteur du lot n'est pas un acheteur
     pour lui. Sans ce filtre, un compte qui vend et cherche le même genre
     de lot se voyait annoncer « 2 recherches correspondent », dont la sienne. */
  const matches = (await wantedRows()).map(toWantedListing)
    .filter((wanted) => wanted.buyer.id !== listing.seller?.id)
    .map((wanted) => matchListingAgainstWanted(listing, wanted))
    .filter((match): match is WantedMatch => match !== null);

  return sortMatches(matches).slice(0, limit);
}

export async function countWantedMatches(listing: MatchableListing): Promise<number> {
  return (await getWantedMatches(listing, Number.MAX_SAFE_INTEGER)).length;
}

/* Le croisement dans l'autre sens : ce qui est déjà en ligne et répond à la
   demande. Sans ça, l'acheteur repartirait sans rien alors que son lot
   existe peut-être déjà à vingt minutes.
   La forme minimale suffit en entrée : la page d'une demande publiée et le
   récapitulatif d'un dépôt encore à l'écran appellent la même fonction. */
export async function getListingsMatchingWanted(
  wanted: MatchableWanted,
  limit = 6,
): Promise<Listing[]> {
  const listings = await getListings({ gameId: wanted.gameId, limit: 500 });
  return listings
    .filter((listing) => listing.seller.id !== wanted.buyer?.id)
    .filter((listing) => matchesWantedCriteria(listing, wanted) !== null)
    .sort(
      (left, right) =>
        getDistanceKm(wanted, { latitude: left.latitude, longitude: left.longitude }) -
        getDistanceKm(wanted, { latitude: right.latitude, longitude: right.longitude }),
    )
    .slice(0, limit);
}

export async function countListingsMatchingWanted(wanted: MatchableWanted): Promise<number> {
  return (await getListingsMatchingWanted(wanted, Number.MAX_SAFE_INTEGER)).length;
}
