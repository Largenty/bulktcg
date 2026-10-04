/* Le plan du chargement des données de démonstration : ce qui part dans
   Supabase, avec quels identifiants, et dans quel ordre. Sans réseau — les
   tests le relisent sur les vraies données (tests/supabase-seed.test.mjs).

   Les lignes viennent des tables factices de la phase 1, déjà au format de
   la base ; le plan ne fait que traduire les identifiants (« u-01 »,
   « l-07 ») en UUID, et choisir l'ordre que les déclencheurs acceptent. Les
   photos n'en font pas partie : elles arrivent avec Cloudflare Images, en
   phase 3. */
import { createHash, randomBytes, randomInt } from "node:crypto";

/* L'espace de noms des identifiants de démonstration. Fixe : relancé, le
   script retrouve les mêmes lignes au lieu d'en créer d'autres. */
export const DEMO_NAMESPACE = "3872d364-39bc-4175-8dea-021829f300e7";

/* Un domaine réservé (RFC 2606) : aucun courriel n'y part jamais. */
export const DEMO_EMAIL_DOMAIN = "bulktcg.example";

/* L'ordre du chargement, et ce dont chaque étape dépend. Une clé étrangère
   vise une ligne déjà là ; une annonce naît comme la base la fait naître, puis
   ses mises à jour la finissent — baisse de prix, réservation, vente — avant
   sa vente clôturée, qui la fige (freeze_listing_after_deal), comme ses
   séries et ses produits (freeze_listing_parts_after_deal) ; et le passage en
   « Vendu » est une mise à jour, pour que count_sale compte la vente. */
export const SEED_STEPS = [
  { name: "accounts", dependsOn: [] },
  { name: "profiles", dependsOn: ["accounts"] },
  { name: "listings", dependsOn: ["profiles"] },
  { name: "listing_editions", dependsOn: ["listings"] },
  { name: "listing_tags", dependsOn: ["listings"] },
  { name: "listing_finishes", dependsOn: ["listings"] },
  { name: "wanted_listings", dependsOn: ["profiles"] },
  { name: "conversations", dependsOn: ["listings", "profiles"] },
  { name: "messages", dependsOn: ["conversations"] },
  { name: "deals", dependsOn: ["conversations", "listing_editions", "listing_tags", "listing_finishes"] },
  { name: "reviews", dependsOn: ["deals"] },
  { name: "deleted_account_reviews", dependsOn: ["profiles"] },
  { name: "listing_waitlist", dependsOn: ["listings", "profiles"] },
  { name: "notifications", dependsOn: ["listings", "deals", "wanted_listings", "reviews"] },
];

const hexToBytes = (uuid) => Buffer.from(uuid.replaceAll("-", ""), "hex");

/* UUID version 5 (RFC 9562) : le SHA-1 de l'espace de noms et du nom. */
export function uuidV5(name, namespace = DEMO_NAMESPACE) {
  const bytes = createHash("sha1").update(hexToBytes(namespace)).update(name, "utf8").digest().subarray(0, 16);
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x50, 6);
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const demoId = (mockId) => uuidV5(mockId);
export const demoEmail = (username) => `${username}@${DEMO_EMAIL_DOMAIN}`;

/* Le mot de passe commun des comptes de démonstration : 24 octets tirés au
   hasard, plus une majuscule, une minuscule, un chiffre et un symbole, pour
   passer toute règle de composition que le projet activerait. */
export function generateDemoPassword() {
  const pick = (alphabet) => alphabet.charAt(randomInt(alphabet.length));
  return `${randomBytes(24).toString("base64url")}${pick("ABCDEFGHJKLMNPQRSTUVWXYZ")}${pick("abcdefghijkmnpqrstuvwxyz")}${pick("23456789")}${pick("!#%+=?@")}`;
}

/* Les colonnes du profil que le déclencheur d'inscription ne pose pas. La
   note et l'historique des ventes n'y sont pas : refresh_rating et
   count_sale les tirent des avis et des ventes chargés ensuite. */
const PROFILE_FIELDS = ["avatar_initials", "bio", "account_type", "company_name", "pro_until", "siret", "shop_address", "shop_hours", "shop_website", "created_at"];
/* Ceux qui ne glissent pas avec l'heure : c'est sur eux qu'on reconnaît un
   profil déjà complété. */
export const STABLE_PROFILE_FIELDS = ["avatar_initials", "bio", "account_type", "company_name", "siret", "shop_address", "shop_hours", "shop_website"];

const pickFields = (row, fields) => Object.fromEntries(fields.map((field) => [field, row[field]]));
/* Une annonce qui n'est pas telle que la base la fait naître : réservée,
   vendue, ou au prix baissé. */
const needsFinish = (row) => row.status !== "available" || row.previous_price_cents !== null;
/* La ligne sans ses jointures : la base ne connaît que ses colonnes. */
const omit = (row, keys) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));
const mapOptional = (mockId) => (mockId === null ? null : demoId(mockId));

/* Le compte qui a laissé un avis puis supprimé son compte (r-09) : un avis ne
   s'insère qu'avec sa vente (stamp_review), et c'est la suppression du
   compte qui la lui retire. Le script rejoue donc ce chemin — le compte, son
   lot, la vente, l'avis, puis la suppression. */
function deletedAccountReview(review, profilesById, template) {
  if (review.reviewed_role !== "buyer") {
    throw new Error(`avis ${review.id} : seul un avis laissé par un vendeur supprimé depuis est prévu`);
  }
  const reviewed = profilesById.get(review.reviewed_id);
  if (!reviewed) throw new Error(`avis ${review.id} : profil ${review.reviewed_id} introuvable`);
  const key = (suffix) => demoId(`${review.id}-deleted-account-${suffix}`);
  const closedAt = new Date(new Date(review.created_at).getTime() - 2 * 3_600_000).toISOString();
  const openedAt = new Date(new Date(closedAt).getTime() - 24 * 3_600_000).toISOString();
  return {
    account: {
      id: key("account"),
      email: demoEmail(`compte_supprime_${review.id.replace(/\W/g, "")}`),
      metadata: { username: `compte_supprime_${review.id.replace(/\W/g, "")}`, city: reviewed.city, postal_code: reviewed.postal_code },
    },
    listing: {
      id: key("listing"),
      slug: `lot-d-un-compte-supprime-${review.id.replace(/\W/g, "")}`,
      seller_id: key("account"),
      game_id: template.game_id,
      title: "Lot d'un compte supprimé depuis",
      description: "Lot vendu par un compte qui n'existe plus : seul l'avis laissé à l'acheteur demeure.",
      lot_type: template.lot_type,
      condition: template.condition,
      language: template.language,
      price_cents: 1500,
      city: reviewed.city,
      postal_code: reviewed.postal_code,
      department_code: template.department_code,
      latitude: template.latitude,
      longitude: template.longitude,
      created_at: openedAt,
      updated_at: openedAt,
    },
    conversation: {
      id: key("conversation"),
      listing_id: key("listing"),
      buyer_id: demoId(review.reviewed_id),
      seller_id: key("account"),
      created_at: openedAt,
      last_message_at: openedAt,
    },
    deal: { id: key("deal"), conversation_id: key("conversation"), listing_id: key("listing"), seller_id: key("account"), buyer_id: demoId(review.reviewed_id), kind: "sale", closed_at: closedAt },
    review: {
      id: demoId(review.id),
      deal_id: key("deal"),
      reviewer_id: key("account"),
      punctuality: review.punctuality,
      responsiveness: review.responsiveness,
      reliability: review.reliability,
      comment: review.comment,
      created_at: review.created_at,
    },
  };
}

/* Tout ce qui part, ligne à ligne, identifiants traduits. */
export function buildSeedPlan(tables) {
  const profilesById = new Map(tables.profiles.map((profile) => [profile.id, profile]));
  const accounts = tables.profiles.map((profile) => ({
    id: demoId(profile.id),
    email: demoEmail(profile.username),
    metadata: { username: profile.username, city: profile.city, postal_code: profile.postal_code },
  }));
  const profiles = tables.profiles.map((profile) => ({ id: demoId(profile.id), ...pickFields(profile, PROFILE_FIELDS) }));

  /* Une annonce naît « Disponible », sans réservation ni prix d'avant, quoi
     qu'on envoie, clé de service comprise (derive_listing_display,
     migration 11). Celle de la démonstration qui n'est pas dans cet état naît
     donc dans celui-là — au prix d'avant quand elle a baissé, et sans vues —,
     puis ses mises à jour la finissent (listingFinishes) : le prix baisse, et
     la base en garde l'ancien ; elle est réservée, ou vendue, et count_sale
     compte la vente ; ses vues et sa date de mise à jour reviennent en
     dernier. Les autres naissent telles qu'en démonstration. */
  const listings = tables.listings.map((listing) => {
    const row = omit(listing, ["seller", "photos", "editions", "tags"]);
    const born = { ...row, id: demoId(row.id), seller_id: demoId(row.seller_id), status: "available", reserved_for: null, sold_at: null, previous_price_cents: null };
    return needsFinish(row) ? { ...born, price_cents: row.previous_price_cents ?? row.price_cents, view_count: 0 } : born;
  });
  const listingFinishes = tables.listings.filter(needsFinish).map((listing) => ({
    id: demoId(listing.id),
    price_cents: listing.price_cents,
    previous_price_cents: listing.previous_price_cents,
    status: listing.status,
    reserved_for: mapOptional(listing.reserved_for),
    sold_at: listing.sold_at,
    view_count: listing.view_count,
    updated_at: listing.updated_at,
  }));
  const listingEditions = tables.listings.flatMap((listing) =>
    listing.editions.map((edition) => ({ listing_id: demoId(listing.id), edition_id: edition.edition_id, position: edition.position })),
  );
  const listingTags = tables.listings.flatMap((listing) => listing.tags.map((tag) => ({ listing_id: demoId(listing.id), tag: tag.tag })));
  const wanted = tables.wanted.map((row) => ({ ...omit(row, ["buyer"]), id: demoId(row.id), buyer_id: demoId(row.buyer_id) }));

  /* Les conversations plus anciennes que les données de messagerie n'ont,
     dans la démonstration, ni message ni place dans les boîtes : seules les
     ventes les citent. Elles naissent donc masquées des deux côtés — vides,
     elles n'encombrent aucune messagerie, et un nouveau message les ferait
     revenir comme n'importe quelle autre. */
  const earlierConversations = tables.deals
    .filter((deal) => tables.conversationStarts.has(deal.conversation_id))
    .map((deal) => {
      const start = tables.conversationStarts.get(deal.conversation_id);
      return {
        id: demoId(deal.conversation_id),
        listing_id: demoId(deal.listing_id),
        buyer_id: demoId(deal.buyer_id),
        seller_id: demoId(deal.seller_id),
        created_at: start,
        last_message_at: start,
        buyer_deleted_at: start,
        seller_deleted_at: start,
      };
    });
  const conversations = [
    ...tables.conversations.map((row) => ({
      ...omit(row, ["listing", "buyer", "seller", "messages", "deal"]),
      id: demoId(row.id),
      listing_id: demoId(row.listing_id),
      buyer_id: demoId(row.buyer_id),
      seller_id: demoId(row.seller_id),
    })),
    ...earlierConversations,
  ];
  /* Dans l'ordre chronologique : touch_conversation pose la date du dernier
     message inséré sur sa conversation. */
  const messages = tables.conversations
    .flatMap((conversation) => conversation.messages)
    .map((message) => ({ ...message, id: demoId(message.id), conversation_id: demoId(message.conversation_id), sender_id: demoId(message.sender_id) }))
    .toSorted((a, b) => a.created_at.localeCompare(b.created_at));
  const deals = tables.deals.map((deal) => ({
    ...deal,
    id: demoId(deal.id),
    conversation_id: demoId(deal.conversation_id),
    listing_id: demoId(deal.listing_id),
    seller_id: demoId(deal.seller_id),
    buyer_id: demoId(deal.buyer_id),
  }));

  /* stamp_review pose la personne notée, son rôle et l'annonce : on n'envoie
     que ce qu'enverrait le navigateur, et l'on garde l'attendu pour vérifier. */
  const reviews = tables.reviews
    .filter((review) => review.deal_id !== null)
    .map((review) => ({
      row: {
        id: demoId(review.id),
        deal_id: demoId(review.deal_id),
        reviewer_id: mapOptional(review.reviewer_id),
        punctuality: review.punctuality,
        responsiveness: review.responsiveness,
        reliability: review.reliability,
        comment: review.comment,
        created_at: review.created_at,
      },
      expected: { reviewed_id: demoId(review.reviewed_id), reviewed_role: review.reviewed_role, listing_id: mapOptional(review.listing_id) },
    }));
  const [template] = tables.listings;
  if (!template) throw new Error("aucune annonce de démonstration");
  const deletedAccountReviews = tables.reviews
    .filter((review) => review.deal_id === null)
    .map((review) => deletedAccountReview(review, profilesById, template));

  const waitlist = tables.waitlist.map((row) => ({ ...row, listing_id: demoId(row.listing_id), user_id: demoId(row.user_id) }));
  /* Un avis reçu se signale par notify_review, à l'insertion de l'avis : la
     notification de la démonstration n'est pas recopiée, elle est déjà là. */
  const notifications = tables.notifications
    .filter((notification) => notification.kind !== "review_received")
    .map((notification) => ({
      ...notification,
      id: demoId(notification.id),
      user_id: demoId(notification.user_id),
      listing_id: mapOptional(notification.listing_id),
      deal_id: mapOptional(notification.deal_id),
      wanted_id: mapOptional(notification.wanted_id),
    }));
  const reviewNotifications = tables.notifications
    .filter((notification) => notification.kind === "review_received")
    .map((notification) => ({ user_id: demoId(notification.user_id), deal_id: mapOptional(notification.deal_id) }));

  return {
    accounts,
    profiles,
    listings,
    listingFinishes,
    listingEditions,
    listingTags,
    wanted,
    conversations,
    messages,
    deals,
    reviews,
    deletedAccountReviews,
    waitlist,
    notifications,
    reviewNotifications,
  };
}
