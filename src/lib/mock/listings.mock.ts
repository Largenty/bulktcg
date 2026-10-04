import { GAME_IDS, type GameId } from "@/types/game";
import type { ConversationRowWithRelations, ListingRowWithRelations } from "@/lib/data/rows";
import { toLocationColumns } from "@/lib/data/mappers";
import { isArchived } from "@/lib/listing-lifecycle";
import { buildSlug } from "@/lib/slug";
import { BUMP_DURATION_DAYS, FREE_PHOTOS } from "@/lib/site";
import type { ListingInput } from "@/lib/mock/listings/listing-input";
import { LORCANA_LISTINGS } from "@/lib/mock/listings/lorcana";
import { MAGIC_LISTINGS } from "@/lib/mock/listings/magic";
import { NARUTO_LISTINGS } from "@/lib/mock/listings/naruto";
import { ONEPIECE_LISTINGS } from "@/lib/mock/listings/onepiece";
import { OTHER_LISTINGS } from "@/lib/mock/listings/other";
import { POKEMON_LISTINGS } from "@/lib/mock/listings/pokemon";
import { RIFTBOUND_LISTINGS } from "@/lib/mock/listings/riftbound";
import { YUGIOH_LISTINGS } from "@/lib/mock/listings/yugioh";
import { mockHomeCity, mockProfileRow } from "@/lib/mock/profiles.mock";
import { buildPhotoRows, daysFromNow, hoursAgo } from "@/lib/mock/seed";

/* Les annonces de démonstration, un fichier par jeu dans lib/mock/listings/ :
   le type impose qu'un jeu ajouté à GAME_IDS arrive avec le sien. Parmi
   elles, trois lots réservés aux pros déposés par des particuliers (l-34,
   l-35, l-36) — aucune liste publique ne les montre, seuls leur vendeur et
   les boutiques au forfait actif les voient —, et une boutique qui vend
   aussi au public (l-37). */
const LISTINGS_BY_GAME: Record<GameId, ListingInput[]> = {
  pokemon: POKEMON_LISTINGS,
  magic: MAGIC_LISTINGS,
  onepiece: ONEPIECE_LISTINGS,
  lorcana: LORCANA_LISTINGS,
  riftbound: RIFTBOUND_LISTINGS,
  yugioh: YUGIOH_LISTINGS,
  naruto: NARUTO_LISTINGS,
  other: OTHER_LISTINGS,
};

/* L'ordre des identifiants est l'ordre de dépôt, et il compte : il fixe le
   rang de chaque annonce dans le pool de photos de son jeu, et départage
   deux annonces de même date dans les listes. */
const depositOrder = (input: ListingInput) => Number(input.id.slice("l-".length));

const LISTING_INPUTS = GAME_IDS.flatMap((gameId) =>
  LISTINGS_BY_GAME[gameId].map((input) => {
    if (input.gameId !== gameId) throw new Error(`Mock incohérent : ${input.id} est rangée avec les annonces ${gameId}.`);
    return input;
  }),
).sort((left, right) => depositOrder(left) - depositOrder(right));

/* Rang de l'annonce dans le pool de photos de son jeu, pour que deux
   vignettes voisines n'ouvrent pas sur la même image. */
const rankByGame = new Map<GameId, number>();

function nextRank(gameId: GameId): number {
  const rank = rankByGame.get(gameId) ?? 0;
  rankByGame.set(gameId, rank + 1);
  return rank;
}

function toListingRow(input: ListingInput): ListingRowWithRelations {
  const seller = mockProfileRow(input.sellerId);
  const city = mockHomeCity(seller);
  const renewedAt = input.renewedAt ?? input.createdAt;
  /* Archivée — trente jours après sa vente ou son expiration —, l'annonce
     n'a plus de photos : la tâche quotidienne les a retirées en base, et la
     démonstration montre la base telle qu'elle est alors. Elle ne prend
     donc pas de rang dans le pool de son jeu, que les annonces en ligne
     épuisent avant d'en répéter une. */
  const isPastArchive = isArchived({ status: input.status, renewedAt, soldAt: input.soldAt ?? null }, Date.now());
  const photos = isPastArchive ? [] : buildPhotoRows(input.id, input.photoCount, input.gameId, nextRank(input.gameId));

  return {
    id: input.id,
    slug: buildSlug(input.title, city.name, input.id.replace("l-", "")),
    seller_id: seller.id,
    game_id: input.gameId,
    title: input.title,
    description: input.description,
    lot_type: input.lotType,
    card_count: input.cardCount,
    weight_kg: input.weightKg,
    condition: input.condition,
    language: input.language,
    price_cents: input.priceCents,
    previous_price_cents: input.previousPriceCents ?? null,
    ...toLocationColumns(city),
    status: input.status,
    reserved_for: input.reservedFor ?? null,
    audience: input.audience ?? "everyone",
    open_to_trade: input.trade !== undefined,
    trade_note: typeof input.trade === "string" ? input.trade : null,
    featured_until:
      input.featuredDaysLeft === undefined ? null : daysFromNow(input.featuredDaysLeft),
    urgent_until: input.urgentDaysLeft === undefined ? null : daysFromNow(input.urgentDaysLeft),
    /* Au-delà de trois photos, l'option a été payée : la base refuserait
       sinon la quatrième. Comptée sur les lignes réelles — un jeu sans photo
       honnête n'en a aucune, quel que soit photoCount. */
    extra_photos: photos.length > FREE_PHOTOS,
    bump_started_at: input.bumpStartedHoursAgo === undefined ? null : hoursAgo(input.bumpStartedHoursAgo),
    bump_until:
      input.bumpStartedHoursAgo === undefined ? null : daysFromNow(BUMP_DURATION_DAYS - input.bumpStartedHoursAgo / 24),
    renewed_at: renewedAt,
    view_count: input.viewCount,
    created_at: input.createdAt,
    updated_at: input.soldAt ?? input.createdAt,
    sold_at: input.soldAt ?? null,
    seller,
    photos,
    /* Deux tables de liaison, comme les photos. La position tient l'ordre de
       saisie : un vendeur cite ses séries dans l'ordre où elles lui viennent,
       pas dans l'ordre chronologique, et son annonce doit les relire ainsi. */
    editions: (input.editions ?? []).map((editionId, index) => ({
      listing_id: input.id,
      edition_id: editionId,
      position: index,
    })),
    tags: (input.tags ?? []).map((tag) => ({ listing_id: input.id, tag })),
  };
}

export const MOCK_LISTING_ROWS: ListingRowWithRelations[] = LISTING_INPUTS.map(toListingRow);

/* Les colonnes d'une annonce que joignent une conversation et une vente :
   la requête de la phase 2 fera la même jointure. */
export function toJoinedListingRow(row: ListingRowWithRelations): ConversationRowWithRelations["listing"] {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    price_cents: row.price_cents,
    status: row.status,
    reserved_for: row.reserved_for,
    game_id: row.game_id,
    audience: row.audience,
    photos: row.photos,
  };
}
