import "server-only";
import type {
  ConversationRow,
  ConversationRowWithRelations,
  DealRow,
  ListingPhotoRow,
  ListingRow,
  ListingRowWithRelations,
  ListingTagRow,
  ProfileRow,
  ReviewRow,
  ReviewRowWithRelations,
  WantedRow,
  WantedRowWithRelations,
} from "@/lib/data/rows";
import { PRODUCT_TAG_IDS } from "@/lib/product-tags";

/* Les réponses de Supabase, ramenées à la forme exacte des lignes de la
   démonstration — celle que lisent les modules de lib/data et les mappers.

   Le select nomme déjà les jointures comme les lignes de la démonstration
   (seller, photos, editions, tags…). Restent trois écarts, que ces
   fonctions referment :
   - une relation à une seule ligne arrive en objet, ou en tableau quand
     PostgREST ne la sait pas unique ;
   - une relation à plusieurs lignes vide peut arriver null ;
   - l'ordre des lignes jointes n'est pas garanti : les produits suivent
     l'ordre du référentiel, celui où le formulaire les propose. Les photos
     et les séries ont leur position, que les mappers lisent déjà.
   Une jointure obligatoire qui manque lève, comme une énumération inconnue :
   une ligne incomplète est une dérive de la base, pas une donnée à taire.

   Pures et sans réseau : tests/data-supabase-rows.test.mjs les exerce sur
   des réponses de PostgREST enregistrées. */

export type RawRow = Record<string, unknown>;

/* Une relation à plusieurs lignes : toujours un tableau. */
function many<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/* Une relation à une ligne : un objet ou null, quelle que soit sa forme. */
function one<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value === undefined || value === null ? null : (value as T);
}

function required<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`Ligne incomplète en base : ${what} manque.`);
  return value;
}

const TAG_ORDER = new Map<string, number>(PRODUCT_TAG_IDS.map((tag, index) => [tag, index]));

function inCatalogueOrder(tags: ListingTagRow[]): ListingTagRow[] {
  return tags.toSorted((left, right) => (TAG_ORDER.get(left.tag) ?? TAG_ORDER.size) - (TAG_ORDER.get(right.tag) ?? TAG_ORDER.size));
}

/* listings.select("*, seller:profiles!seller_id(*), photos:listing_photos(*),
   editions:listing_editions(*), tags:listing_tags(*)") */
export function toListingRowWithRelations(raw: RawRow): ListingRowWithRelations {
  const { seller, photos, editions, tags, ...listing } = raw;
  return {
    ...(listing as ListingRow),
    seller: required(one<ProfileRow>(seller), `le vendeur de l'annonce ${String(raw.id)}`),
    photos: many(photos),
    editions: many(editions),
    tags: inCatalogueOrder(many(tags)),
  };
}

/* conversations.select("*, listing:listings(…, photos:listing_photos(*)),
   buyer:profiles!buyer_id(*), seller:profiles!seller_id(*), messages(*),
   deal:deals(*, reviews(reviewer_id))") — la RLS laisse les deux parties
   lire l'annonce, même passée « pros » depuis : son absence est une dérive. */
export function toConversationRowWithRelations(raw: RawRow): ConversationRowWithRelations {
  const { listing, buyer, seller, messages, deal, ...conversation } = raw;
  const what = `la conversation ${String(raw.id)}`;
  const { photos, ...listingColumns } = required(one<RawRow>(listing), `l'annonce de ${what}`);
  const closedDeal = one<RawRow>(deal);
  return {
    ...(conversation as ConversationRow),
    listing: { ...(listingColumns as ConversationRowWithRelations["listing"]), photos: many<ListingPhotoRow>(photos) },
    buyer: required(one<ProfileRow>(buyer), `l'acheteur de ${what}`),
    seller: required(one<ProfileRow>(seller), `le vendeur de ${what}`),
    messages: many(messages),
    deal: closedDeal ? { ...(closedDeal as DealRow), reviews: many(closedDeal.reviews) } : null,
  };
}

/* reviews.select("*, listing:listings(slug, title),
   reviewer:profiles!reviewer_id(username, avatar_initials)") — l'annonce est
   null quand le lecteur ne peut pas la lire, l'auteur quand il a supprimé
   son compte : les deux sont des réponses, pas des dérives. */
export function toReviewRowWithRelations(raw: RawRow): ReviewRowWithRelations {
  const { listing, reviewer, ...review } = raw;
  return {
    ...(review as ReviewRow),
    listing: one<NonNullable<ReviewRowWithRelations["listing"]>>(listing),
    reviewer: one<NonNullable<ReviewRowWithRelations["reviewer"]>>(reviewer),
  };
}

/* wanted_listings.select("*, buyer:profiles!buyer_id(*)") */
export function toWantedRowWithRelations(raw: RawRow): WantedRowWithRelations {
  const { buyer, ...wanted } = raw;
  return {
    ...(wanted as WantedRow),
    buyer: required(one<ProfileRow>(buyer), `l'auteur de la demande ${String(raw.id)}`),
  };
}

/* pro_only_count_by_game() : un nombre par jeu, jamais une annonce. */
export type ProOnlyCountRow = { game_id: string; listing_count: number };

/* --- Les colonnes ---

   Un select("*") rend les colonnes que la base a, sans erreur quand il en
   manque : une migration pas encore appliquée ne se voyait qu'à ses effets.
   Sans renewed_at (migration 15), chaque annonce passait pour expirée, et
   toutes sortaient des listes sans un mot. La première ligne de chaque
   lecture, et de chacune de ses jointures, doit donc porter toutes les
   colonnes que créent les migrations ; sinon la lecture lève et nomme ce
   qui manque. tests/schema-sync.test.mjs tient ces listes égales aux
   migrations. */
export const TABLE_COLUMNS = {
  profiles: [
    "id", "username", "city", "postal_code", "avatar_initials", "bio", "account_type", "company_name", "pro_until",
    "siret", "legal_name", "pro_verified_at", "shop_address", "shop_hours", "shop_website", "cardmarket_url",
    "cardnexus_url", "rating_avg", "rating_count", "punctuality_avg", "responsiveness_avg", "reliability_avg",
    "sold_listing_count", "created_at",
  ],
  listings: [
    "id", "slug", "seller_id", "game_id", "title", "description", "lot_type", "card_count", "weight_kg", "condition",
    "language", "price_cents", "previous_price_cents", "city", "postal_code", "department_code", "latitude",
    "longitude", "status", "audience", "open_to_trade", "trade_note", "reserved_for", "featured_until",
    "urgent_until", "bump_started_at", "bump_until", "extra_photos", "view_count", "renewed_at", "sold_at",
    "created_at", "updated_at",
  ],
  listing_photos: ["id", "listing_id", "position", "storage_path"],
  listing_editions: ["listing_id", "edition_id", "position"],
  listing_tags: ["listing_id", "tag"],
  wanted_listings: [
    "id", "slug", "buyer_id", "game_id", "title", "description", "lot_type", "max_price_cents", "min_card_count",
    "city", "postal_code", "department_code", "latitude", "longitude", "max_distance_km", "status", "fulfilled_at",
    "created_at", "updated_at",
  ],
  conversations: ["id", "listing_id", "buyer_id", "seller_id", "buyer_deleted_at", "seller_deleted_at", "last_message_at", "created_at"],
  messages: ["id", "conversation_id", "sender_id", "body", "read_at", "created_at"],
  deals: ["id", "conversation_id", "listing_id", "seller_id", "buyer_id", "kind", "closed_at"],
  reviews: [
    "id", "deal_id", "listing_id", "reviewer_id", "reviewed_id", "reviewed_role", "punctuality", "responsiveness",
    "reliability", "comment", "created_at",
  ],
  notifications: ["id", "user_id", "kind", "listing_id", "deal_id", "wanted_id", "read_at", "created_at"],
  listing_waitlist: ["listing_id", "user_id", "created_at"],
  photo_uploads: ["key", "owner_id", "detached_at", "purge_started_at", "created_at"],
} as const satisfies Record<string, readonly string[]>;

export type ColumnTable = keyof typeof TABLE_COLUMNS;

/* La première ligne d'une relation — un objet, ou le premier d'un tableau. */
function firstOf(value: unknown): RawRow | null {
  const row = Array.isArray(value) ? value[0] : value;
  return typeof row === "object" && row !== null ? (row as RawRow) : null;
}

/* `relations` : les jointures du select, par leur nom — `seller` lu dans
   profiles, `photos` dans listing_photos. Une jointure vide sur la première
   ligne se vérifie sur la première ligne qui en a une. */
export function assertColumns(operation: string, table: ColumnTable, rows: readonly RawRow[], relations: Readonly<Record<string, ColumnTable>> = {}): void {
  const samples: Array<[ColumnTable, RawRow | null]> = [
    [table, rows[0] ?? null],
    ...Object.entries(relations).map(([relation, relationTable]): [ColumnTable, RawRow | null] => [
      relationTable,
      rows.map((row) => firstOf(row[relation])).find((sample) => sample !== null) ?? null,
    ]),
  ];
  const missing = samples.flatMap(([sampleTable, sample]) =>
    sample === null ? [] : TABLE_COLUMNS[sampleTable].filter((column) => !(column in sample)).map((column) => `${sampleTable}.${column}`),
  );
  if (missing.length > 0) {
    throw new Error(
      `Colonnes absentes en base (${operation}) : ${missing.join(", ")}. Une migration n'est pas appliquée — supabase/README.md, « Les migrations ».`,
    );
  }
}

/* --- Une table entière, par pages ---

   Supabase rend au plus 1 000 lignes par réponse (max_rows), sans erreur :
   une lecture d'une table entière en un appel en perdait la suite en
   silence — des annonces introuvables, un pro privé de son accès. On lit
   donc par pages, dans l'ordre d'une clé unique, chacune reprenant après la
   dernière ligne de la précédente (`cursor > after`) plutôt qu'à un rang :
   une ligne ajoutée ou retirée entre deux pages décalerait un rang, et
   doublerait ou sauterait une ligne à la jointure.

   La première page porte aussi le compte total (count: "exact") : une page
   plus courte que demandé ne clôt la lecture que si le compte y est. Sans
   lui, un projet dont max_rows descendrait sous la taille de page
   rendrait des pages courtes dès la première, et la lecture s'y
   arrêterait. Une page vide la clôt toujours. */

export type RowPage = { rows: RawRow[]; count: number | null };

export type PagedRead = {
  /* La clé unique qui ordonne les pages : id, ou la clé du registre. */
  cursor: string;
  /* Assez petite pour qu'une page tienne dans une entrée du cache de Next
     (2 Mo), et sous max_rows. */
  pageSize: number;
};

export async function readAllPages(
  fetchPage: (after: string | null, size: number) => PromiseLike<RowPage>,
  { cursor, pageSize }: PagedRead,
): Promise<RawRow[]> {
  const rows: RawRow[] = [];
  let after: string | null = null;
  let total: number | null = null;
  for (;;) {
    const page: RowPage = await fetchPage(after, pageSize);
    total ??= page.count;
    rows.push(...page.rows);
    const last = page.rows.at(-1);
    if (last === undefined) return rows;
    if (page.rows.length < pageSize && (total === null || rows.length >= total)) return rows;
    const next = String(last[cursor]);
    /* La base n'a pas tenu le curseur : relire la même page tournerait sans
       fin. (Une égalité, pas un ordre : celui d'une clé texte suit la
       collation de la base, pas celle de JavaScript.) */
    if (next === after) throw new Error(`Pagination bloquée sur ${cursor} = ${next}.`);
    after = next;
  }
}
