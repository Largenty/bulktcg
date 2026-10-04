/* Forme des lignes telles qu'elles sortiront de Supabase : snake_case, types
   larges, énumérations en simple texte. Ces types n'apparaissent nulle part
   ailleurs que dans lib/data — aucun composant ne voit jamais un ListingRow.

   Ils existent dès la phase 1 pour que la conversion vers le domaine soit
   réellement exercée à chaque rendu et à chaque test, au lieu d'être une
   promesse qu'on découvrirait fausse le jour de la bascule. */

export type ProfileRow = {
  id: string;
  username: string;
  city: string;
  postal_code: string;
  avatar_initials: string;
  /* Deux lignes de présentation, facultatives : null tant que le vendeur
     n'a rien écrit, jamais une chaîne inventée. */
  bio: string | null;
  /* Dénormalisés par trigger, comme rating_avg dans le schéma. */
  rating_avg: number | null;
  rating_count: number;
  /* La note critère par critère, dénormalisée par le même déclencheur :
     rating_avg en est la moyenne. */
  punctuality_avg: number | null;
  responsiveness_avg: number | null;
  reliability_avg: number | null;
  sold_listing_count: number;
  /* « individual » ou « pro ». Un pro a un nom de boutique, et un forfait
     dont pro_until porte la fin : c'est la date qui décide de ce qu'il voit,
     pas le type de compte. */
  account_type: string;
  company_name: string | null;
  pro_until: string | null;
  /* La fiche boutique d'un pro. Le SIRET est écrit par le service de
     paiement, qui le vérifie à la souscription ; le reste par la boutique. */
  siret: string | null;
  shop_address: string | null;
  shop_hours: string | null;
  shop_website: string | null;
  /* Le statut professionnel, vérifié par le serveur auprès du répertoire des
     entreprises quand la boutique déclare son SIRET (migration 16) : la
     raison sociale — null quand le répertoire la masque — et la date de la
     vérification. Écrits par la clé de service seule. */
  legal_name: string | null;
  pro_verified_at: string | null;
  /* Ses profils sur les places de marché, déclarés par la boutique et
     affichés comme tels : rien ne prouve qu'ils sont les siens. */
  cardmarket_url: string | null;
  cardnexus_url: string | null;
  created_at: string;
};

/* Le registre des photos téléversées chez Cloudflare : le serveur seul y
   écrit, avec la clé de service, en délivrant l'adresse de dépôt. C'est la
   preuve qu'un fichier appartient à un compte, et la liste que le ménage
   parcourt — voir supabase/migrations, migration 4. */
export type PhotoUploadRow = {
  key: string;
  /* null quand le compte a été supprimé : le fichier attend le ménage. */
  owner_id: string | null;
  created_at: string;
  /* Quand la dernière photo qui l'affichait est partie ; null tant qu'une
     photo l'affiche, ou s'il n'a jamais été accroché. Posée par la base. */
  detached_at: string | null;
  /* Le ménage l'a pris : il ne s'accroche plus, et part de chez Cloudflare. */
  purge_started_at: string | null;
};

/* Ce que rend claim_photo_purge, ligne à ligne : un fichier à retirer chez
   Cloudflare, et s'il revient d'un passage qui l'avait pris sans obtenir son
   retrait (une reprise). tests/schema-sync.test.mjs compare ces colonnes à
   celles de la fonction. */
export type PhotoPurgeClaimRow = {
  file_key: string;
  retry: boolean;
};

export type ListingPhotoRow = {
  id: string;
  listing_id: string;
  storage_path: string | null;
  position: number;
};

export type ListingRow = {
  id: string;
  slug: string;
  seller_id: string;
  game_id: string;
  title: string;
  description: string;
  lot_type: string;
  card_count: number | null;
  weight_kg: number | null;
  condition: string;
  language: string;
  price_cents: number;
  previous_price_cents: number | null;
  city: string;
  postal_code: string;
  department_code: string;
  latitude: number;
  longitude: number;
  status: string;
  /* Pour qui le lot est réservé : posé par reserve_listing(), effacé dès
     qu'il quitte « Réservé ». Ni inséré ni modifié directement. */
  reserved_for: string | null;
  /* « everyone » ou « pros ». */
  audience: string;
  /* Ouvert à l'échange, et contre quoi : la note n'existe que si la case
     est cochée — la base le refuse sinon. */
  open_to_trade: boolean;
  trade_note: string | null;
  featured_until: string | null;
  urgent_until: string | null;
  /* L'option « 8 photos » : écrite par le service de paiement seul, comme
     les deux dates ci-dessus. */
  extra_photos: boolean;
  /* L'option « Remonter » : son début et sa fin, écrits par le service de
     paiement seul — null sans l'option. Le rang se déduit des deux
     (lib/listing-lifecycle, getRankedAt). */
  bump_started_at: string | null;
  bump_until: string | null;
  /* Le dernier geste du vendeur : posé à la création, par une modification
     ou un changement de statut (listings_renew_on_activity), et par
     renew_listing(). L'annonce expire quatre-vingt-dix jours plus tard. Ni
     insérée ni modifiée directement : un vendeur ne repousse pas son
     échéance depuis la console. */
  renewed_at: string;
  view_count: number;
  created_at: string;
  updated_at: string;
  sold_at: string | null;
};

/* Deux tables de liaison, comme listing_photos : une annonce porte
   plusieurs éditions et plusieurs produits. La colonne ne stocke que
   l'identifiant d'édition — le nom et l'année vivent dans le référentiel,
   pas dupliqués sur chaque ligne. */
export type ListingEditionRow = {
  listing_id: string;
  edition_id: string;
  position: number;
};

export type ListingTagRow = {
  listing_id: string;
  tag: string;
};

/* Ce que renvoie un select avec jointures :
   listings.select("*, seller:profiles(*), photos:listing_photos(*),
                    editions:listing_editions(*), tags:listing_tags(*)") */
export type ListingRowWithRelations = ListingRow & {
  seller: ProfileRow;
  photos: ListingPhotoRow[];
  editions: ListingEditionRow[];
  tags: ListingTagRow[];
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type ConversationRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  created_at: string;
  last_message_at: string;
  /* Supprimer une conversation ne la retire que de sa propre boîte :
     l'autre partie garde son fil. Un nouveau message la fait revenir. */
  buyer_deleted_at: string | null;
  seller_deleted_at: string | null;
};

export type DealRow = {
  id: string;
  conversation_id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  kind: string;
  closed_at: string;
};

export type BlockRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

export type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type ConversationRowWithRelations = ConversationRow & {
  listing: Pick<ListingRow, "id" | "slug" | "title" | "price_cents" | "status" | "reserved_for" | "game_id" | "audience"> & {
    photos: ListingPhotoRow[];
  };
  buyer: ProfileRow;
  seller: ProfileRow;
  messages: MessageRow[];
  /* La vente clôturée sur cette conversation, et qui l'a déjà notée. */
  deal: (DealRow & { reviews: Pick<ReviewRow, "reviewer_id">[] }) | null;
};

export type ReviewRow = {
  id: string;
  /* listing_id, reviewed_id et reviewed_role sont posés par la base à partir
     de la vente : le navigateur ne désigne jamais la personne notée.

     La vente, l'annonce et l'auteur peuvent disparaître quand un compte est
     supprimé (on delete set null) : l'avis reste à la personne notée, qui
     l'a reçu. Seule cette dernière est toujours là. */
  deal_id: string | null;
  listing_id: string | null;
  reviewer_id: string | null;
  reviewed_id: string;
  reviewed_role: string;
  punctuality: number;
  responsiveness: number;
  reliability: number;
  comment: string | null;
  created_at: string;
};

export type ReviewRowWithRelations = ReviewRow & {
  /* null quand le lecteur ne peut pas lire l'annonce : la RLS des annonces
     s'applique à la jointure, et le titre d'un lot réservé aux pros ne fuit
     pas par un avis. */
  listing: Pick<ListingRow, "slug" | "title"> | null;
  /* null quand l'auteur a supprimé son compte. */
  reviewer: Pick<ProfileRow, "username" | "avatar_initials"> | null;
};

export type DealRowWithRelations = DealRow & {
  listing: Pick<ListingRow, "id" | "slug" | "title" | "price_cents" | "status" | "reserved_for" | "game_id" | "audience" | "created_at"> & {
    photos: ListingPhotoRow[];
  };
  seller: ProfileRow;
  buyer: ProfileRow;
  conversation: Pick<ConversationRow, "created_at">;
  reviews: ReviewRowWithRelations[];
};

export type ListingWaitlistRow = {
  listing_id: string;
  user_id: string;
  created_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  listing_id: string | null;
  deal_id: string | null;
  wanted_id: string | null;
  created_at: string;
  read_at: string | null;
};

/* Ce dont parle la notification, joint par la requête : le lot et la
   recherche passent par leur propre RLS, et l'autre personne est celle de
   la vente — le vendeur qui a clôturé, celui qui a noté. */
export type NotificationRowWithRelations = NotificationRow & {
  listing: Pick<ListingRow, "slug" | "title"> | null;
  wanted: Pick<WantedRow, "slug" | "title"> | null;
  actor: Pick<ProfileRow, "username"> | null;
};

export type WantedRow = {
  id: string;
  slug: string;
  buyer_id: string;
  game_id: string;
  title: string;
  description: string;
  lot_type: string | null;
  max_price_cents: number | null;
  min_card_count: number | null;
  city: string;
  postal_code: string;
  department_code: string;
  latitude: number;
  longitude: number;
  max_distance_km: number;
  status: string;
  created_at: string;
  updated_at: string;
  fulfilled_at: string | null;
};

export type WantedRowWithRelations = WantedRow & {
  buyer: ProfileRow;
};

/* --- Écritures ---
   Ce que la couche données enverra à Supabase : les colonnes que l'on
   fournit, pas celles que la base remplit seule (identifiant, horodatages,
   compteurs dénormalisés). Construites par mappers.ts, dans le sens inverse
   des lectures, et testées dès la phase 1. */

/* Les options payantes (featured_until, urgent_until, extra_photos, et les
   deux dates de la remontée) ne sont ni insérées ni modifiées par le
   vendeur : seul le service de paiement les écrit, et la migration retire
   ces colonnes des droits du rôle connecté. La date du dernier geste
   (renewed_at) non plus : la base la pose, sinon un vendeur repousserait son
   échéance à 2099. Ces deux types en sont la liste exacte —
   tests/schema-security.test.mjs les compare aux droits de la migration.
   L'identifiant, lui, part du formulaire : tiré à l'affichage de la page, il
   fait retomber un double envoi sur la même ligne (migration 11). */
export type ListingInsert = Omit<
  ListingRow,
  | "created_at"
  | "updated_at"
  | "view_count"
  | "featured_until"
  | "urgent_until"
  | "extra_photos"
  | "bump_started_at"
  | "bump_until"
  | "renewed_at"
  | "sold_at"
  | "previous_price_cents"
  | "reserved_for"
>;

export type ListingUpdate = Partial<
  Omit<
    ListingRow,
    | "id"
    | "slug"
    | "seller_id"
    | "created_at"
    | "updated_at"
    | "view_count"
    | "featured_until"
    | "urgent_until"
    | "extra_photos"
    | "bump_started_at"
    | "bump_until"
    | "renewed_at"
    | "reserved_for"
  >
>;

export type ListingEditionInsert = Pick<ListingEditionRow, "edition_id" | "position">;
export type ListingTagInsert = Pick<ListingTagRow, "tag">;
export type ListingPhotoInsert = Pick<ListingPhotoRow, "storage_path" | "position">;

/* Comme une annonce, une demande porte l'identifiant tiré par son formulaire. */
export type WantedInsert = Omit<WantedRow, "created_at" | "updated_at" | "fulfilled_at">;
export type WantedUpdate = Partial<Omit<WantedRow, "id" | "slug" | "buyer_id" | "created_at" | "updated_at">>;

export type ConversationInsert = Pick<ConversationRow, "listing_id" | "buyer_id" | "seller_id">;
export type MessageInsert = Pick<MessageRow, "conversation_id" | "sender_id" | "body">;
/* Clôturer passe par close_deal() : le vendeur ne désigne que la
   conversation et la nature de l'accord, la base déduit le reste. */
export type CloseDealArgs = { conversation: string; deal_kind: string };
/* Les notifications ne s'écrivent jamais depuis le navigateur : par
   déclencheur, ou avec la clé de service pour le croisement d'un dépôt. */
export type NotificationInsert = Pick<NotificationRow, "user_id" | "kind" | "listing_id" | "deal_id" | "wanted_id">;
/* Le navigateur ne fournit que la vente et les notes : la personne notée,
   son rôle et l'annonce sont posés par la base. tests/schema-security.test.mjs
   compare cette liste aux droits de la migration. */
export type ReviewInsert = Pick<
  ReviewRow,
  "deal_id" | "reviewer_id" | "punctuality" | "responsiveness" | "reliability" | "comment"
>;
export type BlockInsert = Pick<BlockRow, "blocker_id" | "blocked_id">;
export type ReportInsert = Pick<ReportRow, "reporter_id" | "target_type" | "target_id" | "reason" | "details">;

export type ProfileUpdate = Partial<Pick<ProfileRow, "username" | "city" | "postal_code" | "avatar_initials">> & {
  bio?: string | null;
  /* Envoyés pour un pro seulement : la base refuse une fiche boutique sur
     un compte de particulier. */
  shop_address?: string | null;
  shop_hours?: string | null;
  shop_website?: string | null;
  cardmarket_url?: string | null;
  cardnexus_url?: string | null;
};

/* --- Référentiels et réglages ---
   Trois listes que le code tient aujourd'hui à la main (lib/cities.ts,
   lib/editions.ts, lib/product-tags.ts) existent aussi en base, pour que la
   base refuse ce que les formulaires refusent : une commune, une série ou un
   produit inconnus. Elles se lisent comme n'importe quelle table en phase 2 ;
   tests/schema-sync.test.mjs compare leur contenu au code. */

/* La forme du type City : la table des communes le remplace en phase 2. */
export type CommuneRow = {
  slug: string;
  name: string;
  postal_code: string;
  department_code: string;
  department_name: string;
  latitude: number;
  longitude: number;
};

/* La forme du type Edition, plus son rang dans le référentiel : l'ordre
   d'affichage du formulaire de dépôt, que l'année ne rend pas. */
export type EditionRow = {
  id: string;
  game_id: string;
  code: string;
  name: string;
  year: number;
  block: string;
  sort_order: number;
};

/* Un produit existe pour un jeu : « UPC » chez Pokémon, « Structure Deck »
   chez Yu-Gi-Oh. */
export type ProductTagGameRow = {
  tag: string;
  game_id: string;
};

/* Les alertes de /mon-compte/parametres. Hors du profil, qui se lit en
   entier par n'importe qui : elles ne regardent que leur titulaire. */
export type AccountSettingsRow = {
  user_id: string;
  alert_matches: boolean;
  alert_messages: boolean;
  updated_at: string;
};

/* Les réglages naissent avec le profil ; le titulaire ne modifie que ses
   deux cases. tests/schema-security.test.mjs compare cette liste aux droits. */
export type AccountSettingsUpdate = Partial<Pick<AccountSettingsRow, "alert_matches" | "alert_messages">>;
