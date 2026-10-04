import "server-only";
import { cache } from "react";
import {
  createAdminClient,
  createPublicClient,
  createUserClient,
  type PublicReadCache,
  type SupabaseClient,
} from "@/lib/data/supabase";
import { readSupabaseConfig, type SupabaseConfig } from "@/lib/env";
import { isOnMarket } from "@/lib/listing-lifecycle";
import { SITE_URL } from "@/lib/site";
import { MOCK_CONVERSATION_ROWS } from "@/lib/mock/conversations.mock";
import { MOCK_DEAL_ROWS, MOCK_EARLIER_CONVERSATION_STARTS } from "@/lib/mock/deals.mock";
import { MOCK_LISTING_ROWS, toJoinedListingRow } from "@/lib/mock/listings.mock";
import { MOCK_NOTIFICATION_ROWS } from "@/lib/mock/notifications.mock";
import { MOCK_PHOTO_UPLOAD_ROWS } from "@/lib/mock/photo-uploads.mock";
import { MOCK_PROFILE_ROWS } from "@/lib/mock/profiles.mock";
import { MOCK_REVIEW_ROWS } from "@/lib/mock/reviews.mock";
import { MOCK_WAITLIST_ROWS } from "@/lib/mock/waitlist.mock";
import { MOCK_WANTED_ROWS } from "@/lib/mock/wanted.mock";
import { CACHE_TAGS } from "@/lib/data/cache-tags";
import type {
  AccountSettingsRow,
  ConversationRow,
  ConversationRowWithRelations,
  DealRow,
  ListingRow,
  ListingRowWithRelations,
  ListingWaitlistRow,
  NotificationRow,
  PhotoUploadRow,
  ProfileRow,
  ReviewRowWithRelations,
  WantedRowWithRelations,
} from "@/lib/data/rows";
import {
  assertColumns,
  readAllPages,
  toConversationRowWithRelations,
  toListingRowWithRelations,
  toReviewRowWithRelations,
  toWantedRowWithRelations,
  type PagedRead,
  type ProOnlyCountRow,
  type RawRow,
} from "@/lib/data/supabase-rows";

/* D'où viennent les données : le seul fichier du projet qui le sait.

   Phase 1 : des tableaux de lignes snake_case, déjà au format des tables.
   Chaque module de lib/data les filtre et les trie comme le fera le WHERE,
   puis les mappers convertissent.

   Phase 2, dès que Supabase est configuré (isSupabaseMode) : les mêmes
   lignes viennent de la base, chargées sous la RLS, et le filtrage de
   chaque module reste celui d'aujourd'hui. Les trois clients naissent ici,
   un par requête :
   - publicClient(cache?) — clé publique, sans cookies : ce qu'un visiteur
     anonyme voit. Avec `{ tags, revalidate }`, la lecture entre dans le
     cache de données de Next (options de fetch) ; une écriture l'invalide
     par updateTag(tag) dans une action serveur — la page suivante attend la
     donnée fraîche —, ou revalidateTag(tag, "max") ailleurs ;
   - userClient() — les cookies de la requête : ce qui dépend de la
     personne, la RLS tranche. Jamais en cache partagé ;
   - adminClient() — la clé secrète, serveur seulement : notifications de
     croisement, vues, suppression de compte. Elle passe outre la RLS.
   Chaque réponse passe par unwrap(). Hors phase 2, les trois lèvent : la
   démonstration lit TABLES.

   Chercher « TABLES. » donne la liste des lectures à brancher, comme
   « deferWrite( » celle des écritures (write-seam.ts). tests/conventions
   refuse qu'un autre fichier lise les données de démonstration, ou
   importe @supabase/* ailleurs que dans lib/data/supabase.ts. */
export const TABLES = {
  listings: MOCK_LISTING_ROWS,
  profiles: MOCK_PROFILE_ROWS,
  conversations: MOCK_CONVERSATION_ROWS,
  /* Le premier message des conversations plus anciennes que les données de
     messagerie : en phase 2, conversations.created_at le porte. */
  conversationStarts: MOCK_EARLIER_CONVERSATION_STARTS,
  deals: MOCK_DEAL_ROWS,
  reviews: MOCK_REVIEW_ROWS,
  notifications: MOCK_NOTIFICATION_ROWS,
  wanted: MOCK_WANTED_ROWS,
  waitlist: MOCK_WAITLIST_ROWS,
  photoUploads: MOCK_PHOTO_UPLOAD_ROWS,
};

/* Les colonnes d'une annonce que joignent une conversation et une vente :
   la requête de la phase 2 fera la même jointure d'un select. */
export const joinListing = toJoinedListingRow;

/* Une réponse de la base, telle que la rend le client Supabase. */
export type SourceResponse<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
};

/* Une lecture qui a échoué — panne, délai, droit refusé —, par opposition à
   une ligne introuvable. */
export class DataSourceError extends Error {
  readonly code: string | undefined;

  constructor(operation: string, cause: { message: string; code?: string }) {
    super(`${operation} : ${cause.message}`);
    this.name = "DataSourceError";
    this.code = cause.code;
  }
}

/* Une lecture qui échoue lève ; elle ne rend jamais null pour « panne ».
   null veut dire « introuvable », et une page qui le reçoit répond 404 :
   pendant une régénération, une panne passagère figerait un 404 et ferait
   désindexer la fiche. Levée, l'erreur garde l'ancienne page servie, et
   l'écran d'erreur propose de réessayer. `operation` nomme la lecture dans
   les journaux (« listings.bySlug »). */
export function unwrap<T>(operation: string, response: SourceResponse<T>): T | null {
  if (response.error) throw new DataSourceError(operation, response.error);
  return response.data;
}

/* La configuration de Supabase, lue une fois : null tant que la base n'est
   pas configurée, et la démonstration lit TABLES. */
let supabaseConfig: SupabaseConfig | null | undefined;

function readConfig(): SupabaseConfig | null {
  supabaseConfig ??= readSupabaseConfig(process.env);
  return supabaseConfig;
}

/* La phase 2 : les lignes viennent de Supabase. Sinon, la démonstration. */
export function isSupabaseMode(): boolean {
  return readConfig() !== null;
}

function requireConfig(client: string): SupabaseConfig {
  const config = readConfig();
  if (!config) throw new Error(`${client} : Supabase n'est pas configuré, la démonstration lit TABLES`);
  return config;
}

/* Le site est-il servi en HTTPS ? Les cookies de session y sont Secure. */
function isHttps(): boolean {
  return SITE_URL.startsWith("https:");
}

export type { PublicReadCache, SupabaseClient };

export function publicClient(readCache?: PublicReadCache): SupabaseClient {
  return createPublicClient(requireConfig("publicClient"), readCache);
}

/* Un client par requête : cache() le partage entre les lectures d'un même
   rendu, qui lisent les mêmes cookies. */
export const userClient = cache(async (): Promise<SupabaseClient> => createUserClient(requireConfig("userClient"), isHttps()));

export function adminClient(): SupabaseClient {
  return createAdminClient(requireConfig("adminClient"));
}

/* --- Les lignes, dans les deux phases ---

   Chaque module de lib/data lit ses lignes par ces chargeurs, et garde son
   filtrage, son tri et sa conversion : une seule logique pour la
   démonstration et pour la base. En démonstration, ils rendent TABLES, et
   chaque lecture applique elle-même la règle de visibilité — le miroir de
   la RLS. Avec Supabase, la RLS a déjà tranché :
   - ce qu'un visiteur anonyme voit passe par le client public, en cache
     sous les étiquettes de ce qu'il lit (cache-tags.ts). Les écritures du
     site les invalident ; celles faites hors du site — le script de
     démonstration, le Studio, le webhook de paiement — non
     (supabase/README.md, § 7) ;
   - ce qui regarde la personne passe par son client, jamais en cache, son
     propre profil compris (profileRowById) ;
   - ce que la RLS cacherait mais qu'on a le droit de compter passe par sa
     fonction (pro_only_count_by_game, waitlist_count).
   cache() partage chaque chargement entre les lectures d'un même rendu.

   Volumes : chaque liste se lit en entier, par pages (readAllPages), puis se
   filtre en mémoire. Rien ne se perd plus au-delà de 1 000 lignes ; c'est le
   coût qui croît avec la table — une requête par page absente du cache, et
   chaque rendu filtre toute la liste. Quand une table dépassera quelques
   milliers de lignes, ses lectures lourdes passeront en SQL
   (supabase/README.md, § 4). */

const LISTING_SELECT = "*, seller:profiles!seller_id(*), photos:listing_photos(*), editions:listing_editions(*), tags:listing_tags(*)";
const CONVERSATION_SELECT =
  "*, listing:listings(id, slug, title, price_cents, status, reserved_for, game_id, audience, photos:listing_photos(*)), buyer:profiles!buyer_id(*), seller:profiles!seller_id(*), messages(*), deal:deals(*, reviews(reviewer_id))";
const REVIEW_SELECT = "*, listing:listings(slug, title), reviewer:profiles!reviewer_id(username, avatar_initials)";
const WANTED_SELECT = "*, buyer:profiles!buyer_id(*)";

/* Les jointures en « (*) » de ces select, et la table de chacune : leurs
   colonnes se vérifient comme celles de la table lue (assertColumns). */
const LISTING_RELATIONS = { seller: "profiles", photos: "listing_photos", editions: "listing_editions", tags: "listing_tags" } as const;
const CONVERSATION_RELATIONS = { buyer: "profiles", seller: "profiles", messages: "messages", deal: "deals" } as const;

/* Lignes par page. Une page publique tient dans une entrée du cache de Next
   (2 Mo) même aux longueurs maximales que permet le schéma : une annonce et
   ses jointures pèsent au plus 15 Ko environ (description de 4 000 signes,
   profil complet du vendeur, 8 photos, 12 séries) — 1,8 Ko en moyenne
   aujourd'hui —, une demande 8 Ko, un avis 3 Ko, un profil 2,6 Ko. Toutes
   restent sous le max_rows de Supabase (1 000). Les lectures de la personne
   ne vont pas en cache : seule la borne de Supabase les limite. */
export const PAGE_SIZE = { listings: 100, wanted: 200, reviews: 500, profiles: 500, personal: 500 } as const;

/* Ce que rend une page de PostgREST, compte compris. */
type PageResponse = SourceResponse<RawRow[]> & { count?: number | null };

/* Une requête de PostgREST qu'on découpe en pages. */
type Pageable = PromiseLike<unknown> & {
  order(column: string, options: { ascending: boolean }): Pageable;
  limit(count: number): Pageable;
  gt(column: string, value: string): Pageable;
};

const COUNTED = { count: "exact" } as const;

/* Toute une liste : `query(withCount)` construit la requête — le compte
   total, sur la première page seulement —, et chaque page y ajoute l'ordre
   de la clé, sa borne et la reprise après la page précédente. Une page en
   panne lève (unwrap). */
async function readTable(operation: string, query: (withCount: boolean) => Pageable, read: PagedRead): Promise<RawRow[]> {
  return readAllPages(async (after, size) => {
    let page = query(after === null).order(read.cursor, { ascending: true }).limit(size);
    if (after !== null) page = page.gt(read.cursor, after);
    const response = (await page) as PageResponse;
    return { rows: unwrap(operation, response) ?? [], count: response.count ?? null };
  }, read);
}

/* Les annonces qu'un visiteur anonyme peut lire : celles ouvertes à tous.
   listings.ts refait ce tri — il le tient seul en démonstration, et double
   la RLS ensuite. */
export const publicListingRows = cache(async (): Promise<ListingRowWithRelations[]> => {
  if (!isSupabaseMode()) return TABLES.listings.filter((row) => row.audience === "everyone");
  const client = publicClient({ tags: [CACHE_TAGS.listings, CACHE_TAGS.profiles] });
  const rows = await readTable("listings.public", (withCount) => client.from("listings").select(LISTING_SELECT, withCount ? COUNTED : {}), {
    cursor: "id",
    pageSize: PAGE_SIZE.listings,
  });
  assertColumns("listings.public", "listings", rows, LISTING_RELATIONS);
  return rows.map(toListingRowWithRelations);
});

/* Toutes les annonces que la personne peut lire : celles de tout le monde,
   et au-delà ses propres lots réservés aux pros, tous ceux-là pour un pro au
   forfait actif, ceux dont elle a parlé. Les seconds ne vont jamais en
   cache. En démonstration, la table entière : la lecture qui l'appelle
   applique la règle. */
export const readableListingRows = cache(async (): Promise<ListingRowWithRelations[]> => {
  if (!isSupabaseMode()) return TABLES.listings;
  const client = await userClient();
  const [everyone, beyond] = await Promise.all([
    publicListingRows(),
    readTable(
      "listings.viewer",
      (withCount) => client.from("listings").select(LISTING_SELECT, withCount ? COUNTED : {}).neq("audience", "everyone"),
      { cursor: "id", pageSize: PAGE_SIZE.listings },
    ),
  ]);
  assertColumns("listings.viewer", "listings", beyond, LISTING_RELATIONS);
  return [...everyone, ...beyond.map(toListingRowWithRelations)];
});

/* Les profils sont publics : pseudo, commune, notes, fiche boutique. Ceux
   des autres : celui de la personne connectée se lit par profileRowById. */
export const profileRows = cache(async (): Promise<ProfileRow[]> => {
  if (!isSupabaseMode()) return TABLES.profiles;
  const client = publicClient({ tags: [CACHE_TAGS.profiles] });
  const rows = await readTable("profiles.public", (withCount) => client.from("profiles").select("*", withCount ? COUNTED : {}), {
    cursor: "id",
    pageSize: PAGE_SIZE.profiles,
  });
  assertColumns("profiles.public", "profiles", rows);
  return rows as ProfileRow[];
});

/* Un profil par son identifiant, lu à la base et jamais en cache : celui de
   la personne connectée — son compte, son en-tête, ses droits de pro. Né à
   l'inscription (handle_new_user), un profil n'entre dans la liste en cache
   (profileRows) qu'à son invalidation ou à son expiration : lu là, un compte
   qui venait de naître répondait introuvable pendant une heure. Un forfait
   que le paiement vient d'écrire prend effet de la même façon, tout de
   suite. */
export const profileRowById = cache(async (id: string): Promise<ProfileRow | null> => {
  if (!isSupabaseMode()) return TABLES.profiles.find((row) => row.id === id) ?? null;
  const response = await publicClient().from("profiles").select("*").eq("id", id).maybeSingle();
  const row = unwrap("profiles.byId", response as SourceResponse<ProfileRow>);
  assertColumns("profiles.byId", "profiles", row ? [row] : []);
  return row;
});

/* Les avis sont publics ; leur annonce ne se joint que si le lecteur peut la
   lire, et le client public lit en anonyme. Un avis change la note de son
   destinataire : il vit sous l'étiquette des profils. */
export const reviewRows = cache(async (): Promise<ReviewRowWithRelations[]> => {
  if (!isSupabaseMode()) return TABLES.reviews;
  const client = publicClient({ tags: [CACHE_TAGS.profiles, CACHE_TAGS.listings] });
  const rows = await readTable("reviews.public", (withCount) => client.from("reviews").select(REVIEW_SELECT, withCount ? COUNTED : {}), {
    cursor: "id",
    pageSize: PAGE_SIZE.reviews,
  });
  assertColumns("reviews.public", "reviews", rows);
  return rows.map(toReviewRowWithRelations);
});

/* Les demandes sont publiques, closes comprises : leur lien répond encore. */
export const wantedRows = cache(async (): Promise<WantedRowWithRelations[]> => {
  if (!isSupabaseMode()) return TABLES.wanted;
  const client = publicClient({ tags: [CACHE_TAGS.wanted, CACHE_TAGS.profiles] });
  const rows = await readTable("wanted.public", (withCount) => client.from("wanted_listings").select(WANTED_SELECT, withCount ? COUNTED : {}), {
    cursor: "id",
    pageSize: PAGE_SIZE.wanted,
  });
  assertColumns("wanted.public", "wanted_listings", rows, { buyer: "profiles" });
  return rows.map(toWantedRowWithRelations);
});

/* Les conversations de la personne — retirées de sa boîte comprises :
   conversations.ts les écarte de la liste, une vente y lit sa date. */
export const conversationRows = cache(async (): Promise<ConversationRowWithRelations[]> => {
  if (!isSupabaseMode()) return TABLES.conversations;
  const client = await userClient();
  const rows = await readTable(
    "conversations.viewer",
    (withCount) => client.from("conversations").select(CONVERSATION_SELECT, withCount ? COUNTED : {}),
    { cursor: "id", pageSize: PAGE_SIZE.personal },
  );
  assertColumns("conversations.viewer", "conversations", rows, CONVERSATION_RELATIONS);
  return rows.map(toConversationRowWithRelations);
});

/* Le premier message des conversations antérieures aux données de
   messagerie de la démonstration. Avec Supabase, conversations.created_at
   le porte : rien à ajouter. */
export const conversationStartRows = cache(async (): Promise<ReadonlyMap<string, string>> => {
  return isSupabaseMode() ? new Map() : TABLES.conversationStarts;
});

/* Les ventes dont la personne est partie. */
export const dealRows = cache(async (): Promise<DealRow[]> => {
  if (!isSupabaseMode()) return TABLES.deals;
  const client = await userClient();
  const rows = await readTable("deals.viewer", (withCount) => client.from("deals").select("*", withCount ? COUNTED : {}), {
    cursor: "id",
    pageSize: PAGE_SIZE.personal,
  });
  assertColumns("deals.viewer", "deals", rows);
  return rows as DealRow[];
});

/* Les notifications de la personne : elles s'accumulent, et un compte actif
   en aura vite plus de 1 000. */
export const notificationRows = cache(async (): Promise<NotificationRow[]> => {
  if (!isSupabaseMode()) return TABLES.notifications;
  const client = await userClient();
  const rows = await readTable("notifications.viewer", (withCount) => client.from("notifications").select("*", withCount ? COUNTED : {}), {
    cursor: "id",
    pageSize: PAGE_SIZE.personal,
  });
  assertColumns("notifications.viewer", "notifications", rows);
  return rows as NotificationRow[];
});

/* --- Les compteurs de l'en-tête ---

   Lus sur chaque page qu'ouvre un compte connecté : ils ne chargent ni toute
   la messagerie, messages compris, ni toutes les notifications avec leurs
   jointures — c'est ce qu'ils faisaient, et le coût grandissait avec
   l'ancienneté du compte, à chaque page. */

/* Ses notifications non lues, comptées par la base : aucune ligne ne part. */
export const unreadNotificationCount = cache(async (userId: string): Promise<number> => {
  if (!isSupabaseMode()) return TABLES.notifications.filter((row) => row.user_id === userId && row.read_at === null).length;
  const response = await (await userClient())
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  unwrap("notifications.unreadCount", response);
  return response.count ?? 0;
});

/* Ce que lit le compteur des messages d'un fil : ses participants, et de
   quoi savoir s'il est encore dans la boîte de la personne. */
export type UnreadThreadRow = Pick<
  ConversationRow,
  "id" | "buyer_id" | "seller_id" | "buyer_deleted_at" | "seller_deleted_at" | "last_message_at"
>;

const UNREAD_THREAD_COLUMNS = "id, buyer_id, seller_id, buyer_deleted_at, seller_deleted_at, last_message_at";

/* Les seuls fils de la personne qui ont un message reçu et non lu — pas
   les messages : la jointure !inner ne garde que les fils dont un message
   répond aux deux filtres, et un seul message en revient par fil. Qu'ils
   soient encore dans sa boîte, conversations.ts le décide. */
export const unreadThreadRows = cache(async (userId: string): Promise<UnreadThreadRow[]> => {
  if (!isSupabaseMode()) {
    return TABLES.conversations.filter(
      (row) =>
        (row.buyer_id === userId || row.seller_id === userId) &&
        row.messages.some((message) => message.read_at === null && message.sender_id !== userId),
    );
  }
  const client = await userClient();
  const rows = await readTable(
    "conversations.unread",
    (withCount) =>
      client
        .from("conversations")
        .select(`${UNREAD_THREAD_COLUMNS}, messages!inner(id)`, withCount ? COUNTED : {})
        .is("messages.read_at", null)
        .neq("messages.sender_id", userId)
        .limit(1, { referencedTable: "messages" }),
    { cursor: "id", pageSize: PAGE_SIZE.personal },
  );
  return rows.map(({ messages: _messages, ...thread }) => thread as UnreadThreadRow);
});

/* Ses propres inscriptions en liste d'attente, et rien d'autre : la RLS ne
   rend que les siennes, une par lot — listing_id les ordonne. */
export const waitlistRows = cache(async (): Promise<ListingWaitlistRow[]> => {
  if (!isSupabaseMode()) return TABLES.waitlist;
  const client = await userClient();
  const rows = await readTable("waitlist.viewer", (withCount) => client.from("listing_waitlist").select("*", withCount ? COUNTED : {}), {
    cursor: "listing_id",
    pageSize: PAGE_SIZE.personal,
  });
  assertColumns("waitlist.viewer", "listing_waitlist", rows);
  return rows as ListingWaitlistRow[];
});

/* Combien de personnes attendent chacun de ces lots, pour leur vendeur :
   jamais les noms. Avec Supabase, waitlist_count() ne répond qu'au vendeur,
   et seul un lot réservé a une liste — elle se vide dès qu'il quitte
   « Réservé ». La réponse ne porte que les lots attendus. */
export async function waitlistCountsFor(listings: Pick<ListingRow, "id" | "status">[]): Promise<Map<string, number>> {
  if (!isSupabaseMode()) {
    const ids = new Set(listings.map((listing) => listing.id));
    const counts = new Map<string, number>();
    for (const row of TABLES.waitlist) {
      if (ids.has(row.listing_id)) counts.set(row.listing_id, (counts.get(row.listing_id) ?? 0) + 1);
    }
    return counts;
  }
  const supabase = await userClient();
  const counted = await Promise.all(
    listings
      .filter((listing) => listing.status === "reserved")
      .map(async (listing) => [listing.id, Number(unwrap("waitlist.count", await supabase.rpc("waitlist_count", { listing: listing.id })) ?? 0)] as const),
  );
  return new Map(counted.filter(([, count]) => count > 0));
}

/* Les lots réservés aux pros, comptés par jeu pour tout visiteur : sous la
   RLS, un particulier n'en compterait aucun. Seuls les lots en ligne y
   sont — ni vendus, ni expirés. Une ligne par jeu : rien à découper. */
export const proOnlyCountRows = cache(async (): Promise<ProOnlyCountRow[]> => {
  if (!isSupabaseMode()) {
    const counts = new Map<string, number>();
    const now = Date.now();
    for (const row of TABLES.listings) {
      if (row.audience === "pros" && isOnMarket({ status: row.status, renewedAt: row.renewed_at }, now)) {
        counts.set(row.game_id, (counts.get(row.game_id) ?? 0) + 1);
      }
    }
    return [...counts].map(([game_id, listing_count]) => ({ game_id, listing_count }));
  }
  const query = publicClient({ tags: [CACHE_TAGS.listings] }).rpc("pro_only_count_by_game", {}, { get: true });
  return (unwrap("listings.proOnlyCount", (await query) as SourceResponse<RawRow[]>) ?? []) as ProOnlyCountRow[];
});

/* Ses propres téléversements (phase 3 : aucun tant que les photos ne
   partent pas chez Cloudflare). */
export const photoUploadRows = cache(async (): Promise<PhotoUploadRow[]> => {
  if (!isSupabaseMode()) return TABLES.photoUploads;
  const client = await userClient();
  const rows = await readTable("photoUploads.viewer", (withCount) => client.from("photo_uploads").select("*", withCount ? COUNTED : {}), {
    cursor: "key",
    pageSize: PAGE_SIZE.personal,
  });
  assertColumns("photoUploads.viewer", "photo_uploads", rows);
  return rows as PhotoUploadRow[];
});

/* Les réglages d'alerte de la personne (/mon-compte/parametres) : la RLS ne
   rend que les siens, d'où maybeSingle sans filtre. La démonstration n'en a
   pas en mémoire : null, et la lecture montre ceux d'un compte qui naît. */
export const accountSettingsRow = cache(async (): Promise<Pick<AccountSettingsRow, "alert_matches" | "alert_messages"> | null> => {
  if (!isSupabaseMode()) return null;
  const response = await (await userClient()).from("account_settings").select("alert_matches, alert_messages").maybeSingle();
  return unwrap("accountSettings.mine", response as SourceResponse<Pick<AccountSettingsRow, "alert_matches" | "alert_messages">>);
});
