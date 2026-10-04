import "server-only";
import { cache } from "react";
import type { Edition } from "@/types/edition";
import { GAME_IDS, type GameId } from "@/types/game";
import type { Listing, ListingQuery, ListingSort, ProductTag } from "@/types/listing";
import { getEditionById } from "@/lib/editions";
import { PRODUCT_TAG_IDS } from "@/lib/product-tags";
import { TAG_LABELS } from "@/lib/labels";
import { getCityByPair } from "@/lib/cities";
import { getDistanceKm } from "@/lib/geo";
import { getRankedAt, isOnMarket } from "@/lib/listing-lifecycle";
import { slugify } from "@/lib/slug";
import { isActiveProRow, toListing } from "@/lib/data/mappers";
import { narrow } from "@/lib/data/mappers/shared";
import type { ListingRowWithRelations } from "@/lib/data/rows";
import { conversationRows, profileRowById, proOnlyCountRows, publicListingRows, readableListingRows } from "@/lib/data/source";

/* Seule frontière avec la source de données.

   Phase 1 : les lignes viennent d'un tableau, le filtrage et le tri se font
   en mémoire, puis toListing convertit.
   Phase 2 : les mêmes lignes viennent de Supabase, chargées sous la RLS par
   source.ts ; le filtrage et le tri restent ceux d'ici, et toListing ne
   change pas d'une ligne. Quand le volume le demandera, les lectures
   lourdes passeront en SQL (supabase/README.md, § 4).

   C'est pour cela que tout ce fichier raisonne sur des ListingRow en
   snake_case et ne convertit qu'au tout dernier moment : ce sont les lignes
   de la table, quelle que soit leur source. */

const DEFAULT_LIMIT = 60;

/* Ce que voit un visiteur anonyme : les annonces ouvertes à tout le monde.
   Toutes les lectures publiques partent d'ici — pages de jeu et de ville, recherche,
   accueil, plan de site, images de partage. En phase 2 la politique RLS
   « annonces lisibles selon leur audience » fait déjà ce tri, et ce filtre
   la double ; ici, une annonce réservée aux pros ne peut pas fuir par une
   page qu'on aurait oublié de filtrer, puisqu'aucune ne part de la table
   entière. */
async function publicRows(): Promise<ListingRowWithRelations[]> {
  return (await publicListingRows()).filter((row) => row.audience === "everyone");
}

/* Un droit se lit à la base, jamais dans le cache des pages publiques : un
   forfait qui vient d'être payé ouvre l'espace pro tout de suite, et un
   compte qui vient de naître existe déjà (profileRowById). */
async function isActivePro(userId: string | null): Promise<boolean> {
  const profile = userId ? await profileRowById(userId) : null;
  return profile ? isActiveProRow(profile) : false;
}

/* Qui a déjà parlé d'un lot garde l'accès à sa fiche, même passée « pros »
   depuis : sa conversation y renvoie, et la page dit pourquoi il ne peut
   plus écrire. Le miroir de la clause « participant » de la politique de
   lecture des annonces. */
async function isParticipant(listingId: string, viewerId: string | null): Promise<boolean> {
  return viewerId !== null && (await conversationRows()).some(
    (row) => row.listing_id === listingId && (row.buyer_id === viewerId || row.seller_id === viewerId),
  );
}

function isFeaturedNow(row: ListingRowWithRelations, now: number): boolean {
  if (!row.featured_until) return false;
  return new Date(row.featured_until).getTime() > now;
}

/* En ligne : ni vendue, ni expirée — son vendeur l'a prolongée, modifiée ou
   en a changé le statut depuis moins de quatre-vingt-dix jours
   (lib/listing-lifecycle). Le miroir de listing_on_market (migration 15). */
function isRowOnMarket(row: ListingRowWithRelations, now: number): boolean {
  return isOnMarket({ status: row.status, renewedAt: row.renewed_at }, now);
}

/* Le rang dans le tri par défaut : la date de dépôt, ou celle de la
   dernière remontée payée. */
function rankOf(row: ListingRowWithRelations, now: number): number {
  return getRankedAt({ status: row.status, createdAt: row.created_at, bumpStartedAt: row.bump_started_at, bumpUntil: row.bump_until }, now);
}

function matchesSearch(row: ListingRowWithRelations, search: string): boolean {
  const needle = slugify(search);
  if (!needle) return true;
  /* Les séries et les produits entrent dans la recherche textuelle : taper
     « EV08 » ou « display » doit trouver le lot même si son titre ne les
     écrit pas. Le code et le nom y sont tous les deux — un acheteur tape
     l'un ou l'autre selon le jeu. */
  const editionWords = row.editions.flatMap((row) => {
    const edition = getEditionById(row.edition_id);
    return edition ? [edition.code, edition.name] : [];
  });
  const tagWords = row.tags.map((tag) => TAG_LABELS[narrow(tag.tag, PRODUCT_TAG_IDS, "listing_tags.tag")]);
  const haystack = slugify(
    [row.title, row.description, row.city, row.game_id, ...editionWords, ...tagWords].join(" "),
  );
  return needle
    .split("-")
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function matchesQuery(row: ListingRowWithRelations, query: ListingQuery, now: number): boolean {
  if (query.gameId && row.game_id !== query.gameId) return false;
  if (query.sellerId && row.seller_id !== query.sellerId) return false;
  /* Filtres stricts : un lot dont le vendeur n'a déclaré aucune édition ne
     peut pas être présenté comme contenant EV08. Il est donc écarté — mais
     la liste dit combien de lots elle écarte pour cette raison, sans quoi
     le filtre enterrerait silencieusement le carton de six kilos qui les
     contient sûrement. Voir countListingsWithoutEditions. */
  if (query.editionId && !row.editions.some((edition) => edition.edition_id === query.editionId)) {
    return false;
  }
  if (query.tag && !row.tags.some((tag) => tag.tag === query.tag)) return false;
  if (query.city && slugify(row.city) !== slugify(query.city)) return false;
  if (query.communeSlug && getCityByPair(row.city, row.postal_code)?.slug !== query.communeSlug) return false;
  if (query.departmentCode && row.department_code !== query.departmentCode) return false;
  if (query.lotType && row.lot_type !== query.lotType) return false;
  if (query.condition && row.condition !== query.condition) return false;
  if (query.language && row.language !== query.language) return false;
  if (query.minPriceCents !== undefined && row.price_cents < query.minPriceCents) return false;
  if (query.maxPriceCents !== undefined && row.price_cents > query.maxPriceCents) return false;
  if (query.openToTrade && !row.open_to_trade) return false;

  if (query.status) {
    if (row.status !== query.status) return false;
  } else if (!query.includeSold && row.status === "sold") {
    return false;
  }
  /* Une annonce que son vendeur n'a pas prolongée ne sort plus nulle part :
     ni les listes, ni la recherche, ni le plan du site, ni les croisements.
     Sa page répond encore, et son vendeur la retrouve dans son compte. */
  if (!query.includeExpired && row.status !== "sold" && !isRowOnMarket(row, now)) return false;

  if (query.origin && query.maxDistanceKm !== undefined) {
    const distanceKm = getDistanceKm(query.origin, {
      latitude: row.latitude,
      longitude: row.longitude,
    });
    if (distanceKm > query.maxDistanceKm) return false;
  }

  if (query.search && !matchesSearch(row, query.search)) return false;

  return true;
}

function compareRows(sort: ListingSort, query: ListingQuery, now: number) {
  return (left: ListingRowWithRelations, right: ListingRowWithRelations): number => {
    switch (sort) {
      case "price-asc":
        return left.price_cents - right.price_cents;
      case "price-desc":
        return right.price_cents - left.price_cents;
      case "distance": {
        if (!query.origin) return 0;
        return (
          getDistanceKm(query.origin, { latitude: left.latitude, longitude: left.longitude }) -
          getDistanceKm(query.origin, { latitude: right.latitude, longitude: right.longitude })
        );
      }
      /* Une annonce remontée se range à sa dernière remontée ; la vignette,
         elle, garde sa date de dépôt et dit qu'elle a été remontée. */
      case "recent":
      default:
        return rankOf(right, now) - rankOf(left, now);
    }
  };
}

function selectRows(query: ListingQuery, rows: ListingRowWithRelations[]): ListingRowWithRelations[] {
  const now = Date.now();
  /* Un tri par distance sans point d'origine n'a pas d'ordre : plutôt que de
     rendre le tableau dans l'ordre où il se trouvait, on retombe sur le tri
     par défaut. Le cas arrive dès qu'on partage une URL « tri=distance »
     sans le paramètre de ville. */
  const requestedSort = query.sort ?? "recent";
  const sort: ListingSort =
    requestedSort === "distance" && !query.origin ? "recent" : requestedSort;
  const matching = rows.filter((row) => matchesQuery(row, query, now));

  matching.sort(compareRows(sort, query, now));

  /* La mise en avant payée remonte en tête, mais seulement sur le tri par
     défaut : quelqu'un qui trie par prix a demandé un ordre précis et on ne
     le lui reprend pas. */
  if (sort === "recent") {
    matching.sort((left, right) => Number(isFeaturedNow(right, now)) - Number(isFeaturedNow(left, now)));
  }

  return matching;
}

export async function getListings(query: ListingQuery = {}): Promise<Listing[]> {
  const offset = query.offset ?? 0;
  const limit = query.limit ?? DEFAULT_LIMIT;
  return selectRows(query, await publicRows()).slice(offset, offset + limit).map(toListing);
}

/* Compte total avant pagination — l'équivalent de { count: "exact", head: true }. */
export async function countListings(query: ListingQuery = {}): Promise<number> {
  return selectRows({ ...query, offset: undefined, limit: undefined }, await publicRows()).length;
}

/* cache() dédoublonne l'appel dans la fenêtre d'un même rendu : une page
   d'annonce demande le même slug depuis generateMetadata puis depuis le
   composant, et sans lui la phase 2 enverrait deux fois la requête. La
   mémoïsation porte sur l'argument, ce qui n'a de sens que pour les lectures
   à clé scalaire — pas pour celles qui prennent un objet de requête, dont
   l'identité change à chaque appel. */
export const getListingBySlug = cache(
  async (slug: string): Promise<Listing | null> => {
    const row = (await publicRows()).find((candidate) => candidate.slug === slug);
    return row ? toListing(row) : null;
  },
);

/* La fiche telle qu'un visiteur donné a le droit de la voir. Une annonce
   réservée aux pros n'existe que pour son vendeur et pour les pros au
   forfait actif : pour tous les autres, elle répond introuvable — dire
   « réservée » confirmerait qu'elle existe, et son titre aurait déjà fui.
   Phase 2 : le même select, sous la session du visiteur ; la RLS tranche. */
export const getListingForViewer = cache(
  async (slug: string, viewerId: string | null): Promise<Listing | null> => {
    const row = (await readableListingRows()).find((candidate) => candidate.slug === slug);
    if (!row) return null;
    if (row.audience === "everyone" || row.seller_id === viewerId || (await isActivePro(viewerId)) || (await isParticipant(row.id, viewerId))) {
      return toListing(row);
    }
    return null;
  },
);

/* L'espace pro : les annonces réservées, pour un pro au forfait actif. Un
   autre visiteur reçoit une liste vide — la page le garde aussi, mais la
   couche données ne compte pas sur elle. */
export async function getProOnlyListings(viewerId: string | null, query: ListingQuery = {}): Promise<Listing[]> {
  if (!(await isActivePro(viewerId))) return [];
  const limit = query.limit ?? DEFAULT_LIMIT;
  const proOnlyRows = (await readableListingRows()).filter((row) => row.audience === "pros");
  return selectRows(query, proOnlyRows).slice(0, limit).map(toListing);
}

/* Ce qu'un particulier a le droit de savoir de l'espace pro : combien de
   lots y attendent, et de quels jeux. Jamais un titre, jamais un prix. */
export const getProOnlyCountByGame = cache(async (): Promise<Record<GameId, number>> => {
  const counts = Object.fromEntries(GAME_IDS.map((gameId) => [gameId, 0])) as Record<GameId, number>;
  for (const row of await proOnlyCountRows()) {
    counts[narrow(row.game_id, GAME_IDS, "listings.game_id")] += row.listing_count;
  }
  return counts;
});

export const isViewerActivePro = cache(async (viewerId: string | null): Promise<boolean> => {
  return isActivePro(viewerId);
});

/* Lecture par identifiant, pour les écritures : une mutation reçoit un id,
   jamais un slug, et vérifie d'abord à qui appartient l'annonce. */
export const getListingById = cache(async (listingId: string): Promise<Listing | null> => {
  const row = (await readableListingRows()).find((candidate) => candidate.id === listingId);
  return row ? toListing(row) : null;
});

/* Les annonces d'un vendeur telles que le public les voit : son profil. */
export async function getListingsBySeller(
  sellerId: string,
  query: Omit<ListingQuery, "sellerId"> = {},
): Promise<Listing[]> {
  return getListings({ ...query, sellerId, limit: query.limit ?? Number.MAX_SAFE_INTEGER });
}

/* Le compteur de l'onglet « Mes annonces » : les lots réservés en font
   partie, comme dans la liste qu'il annonce. */
export async function countListingsOwnedBy(ownerId: string, query: Omit<ListingQuery, "sellerId"> = {}): Promise<number> {
  return selectRows({ includeExpired: true, ...query, sellerId: ownerId }, await readableListingRows()).length;
}

/* Toutes les annonces de leur propriétaire, réservées aux pros et expirées
   comprises : son tableau de bord, d'où il les remet en ligne. Réservé aux
   pages qui ont vérifié que ownerId est bien la personne connectée. */
export async function getListingsOwnedBy(
  ownerId: string,
  query: Omit<ListingQuery, "sellerId"> = {},
): Promise<Listing[]> {
  return selectRows({ includeExpired: true, ...query, sellerId: ownerId }, await readableListingRows())
    .slice(0, query.limit ?? Number.MAX_SAFE_INTEGER)
    .map(toListing);
}

/* Appelé pour chaque profil rendu, et un profil apparaît plusieurs fois sur
   une même page — la fiche vendeur, la vignette, l'en-tête. */
export const countActiveListingsBySeller = cache(
  async (sellerId: string): Promise<number> => {
    const now = Date.now();
    return (await publicRows()).filter((row) => row.seller_id === sellerId && isRowOnMarket(row, now)).length;
  },
);

/* Les derniers dépôts, dans leur vrai ordre : sans la remontée payée du tri
   par défaut, et sans les annonces à la une, qui ont leur propre section sur
   l'accueil. Le classeur de l'accueil annonçait « Déposé récemment » avec
   des lots de 4 h, 3 j, 4 j, 6 j, 20 h — et répétait la section suivante. */
export const getLatestListings = cache(async (limit = 6): Promise<Listing[]> => {
  const now = Date.now();
  return (await publicRows()).filter((row) => isRowOnMarket(row, now) && !isFeaturedNow(row, now))
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, limit)
    .map(toListing);
});

export const getFeaturedListings = cache(async (limit = 4): Promise<Listing[]> => {
  const now = Date.now();
  return (await publicRows()).filter((row) => isRowOnMarket(row, now) && isFeaturedNow(row, now))
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, limit)
    .map(toListing);
});

/* Annonces proches d'une annonce donnée : même jeu d'abord, puis même
   département. Sert de rattrapage en bas de la page annonce. */
export async function getRelatedListings(listing: Listing, limit = 4): Promise<Listing[]> {
  const now = Date.now();
  const rows = (await publicRows()).filter((row) => row.id !== listing.id && isRowOnMarket(row, now));
  const sameGame = rows.filter((row) => row.game_id === listing.gameId);
  const sameDepartment = rows.filter((row) => row.game_id !== listing.gameId && row.department_code === listing.departmentCode);

  const origin = { latitude: listing.latitude, longitude: listing.longitude };
  const byDistance = (left: ListingRowWithRelations, right: ListingRowWithRelations) =>
    getDistanceKm(origin, { latitude: left.latitude, longitude: left.longitude }) -
    getDistanceKm(origin, { latitude: right.latitude, longitude: right.longitude });

  return [...sameGame.sort(byDistance), ...sameDepartment.sort(byDistance)]
    .slice(0, limit)
    .map(toListing);
}

export const getListingCountByGame = cache(async (): Promise<Record<GameId, number>> => {
  const counts = Object.fromEntries(GAME_IDS.map((gameId) => [gameId, 0])) as Record<GameId, number>;
  const now = Date.now();
  for (const row of await publicRows()) {
    if (!isRowOnMarket(row, now)) continue;
    counts[narrow(row.game_id, GAME_IDS, "listings.game_id")] += 1;
  }
  return counts;
});

/* Combien de lots le filtre par édition met de côté faute de déclaration.
   C'est le chiffre qu'il faut afficher à côté du filtre : sans lui,
   l'acheteur croit que rien d'autre n'existe. */
export async function countListingsWithoutEditions(
  query: Omit<ListingQuery, "editionId"> = {},
): Promise<number> {
  return selectRows({ ...query, editionId: undefined, offset: undefined, limit: undefined }, await publicRows()).filter(
    (row) => row.editions.length === 0,
  ).length;
}

/* Les éditions réellement présentes dans les annonces en ligne, avec leur
   nombre de lots. Le filtre ne propose que ce qui existe : une liste de
   quatre-vingts séries dont soixante-quinze ne ramènent rien n'est pas un
   filtre, c'est un piège. */
export async function getEditionFacets(
  query: Omit<ListingQuery, "editionId"> = {},
): Promise<Array<{ edition: Edition; count: number }>> {
  const counts = new Map<string, number>();
  for (const row of selectRows({ ...query, editionId: undefined, offset: undefined, limit: undefined }, await publicRows())) {
    for (const edition of row.editions) {
      counts.set(edition.edition_id, (counts.get(edition.edition_id) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([editionId, count]) => {
      const edition = getEditionById(editionId);
      if (!edition) throw new Error(`Édition inconnue en base : « ${editionId} ».`);
      return { edition, count };
    })
    .sort((left, right) => right.edition.year - left.edition.year || left.edition.code.localeCompare(right.edition.code));
}

export async function getTagFacets(
  query: Omit<ListingQuery, "tag"> = {},
): Promise<Array<{ tag: ProductTag; count: number }>> {
  const counts = new Map<string, number>();
  for (const row of selectRows({ ...query, tag: undefined, offset: undefined, limit: undefined }, await publicRows())) {
    for (const tag of row.tags) counts.set(tag.tag, (counts.get(tag.tag) ?? 0) + 1);
  }

  return PRODUCT_TAG_IDS.filter((tag) => counts.has(tag)).map((tag) => ({
    tag,
    count: counts.get(tag) ?? 0,
  }));
}

/* Villes qui ont réellement au moins une annonce en ligne : la page
   d'accueil ne propose pas une ville vide. */
export const getActiveCityNames = cache(async (): Promise<string[]> => {
  const now = Date.now();
  const cities = new Set(
    (await publicRows()).filter((row) => isRowOnMarket(row, now)).map((row) => row.city),
  );
  return [...cities].sort((left, right) => left.localeCompare(right, "fr"));
});

/* Les communes — par le slug de leur page — qui ont au moins une annonce en
   ligne : la carte du secteur les montre avant les plus peuplées. Un couple
   que le référentiel ne connaît pas n'en fait pas partie. */
export const getActiveCommuneSlugs = cache(async (): Promise<ReadonlySet<string>> => {
  const now = Date.now();
  const slugs = (await publicRows())
    .filter((row) => isRowOnMarket(row, now))
    .map((row) => getCityByPair(row.city, row.postal_code)?.slug);
  return new Set(slugs.filter((slug) => slug !== undefined));
});
