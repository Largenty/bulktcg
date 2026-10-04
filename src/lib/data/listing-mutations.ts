import "server-only";
import { after } from "next/server";
import type { Listing, ListingStatus } from "@/types/listing";
import { getListingById } from "@/lib/data/listings";
import { findUnattachableUploads } from "@/lib/data/photo-uploads";
import {
  STORED_MATCH_COLUMNS,
  toListingEditionInserts,
  toListingInsert,
  toListingStatusUpdate,
  toListingTagInserts,
  toListingUpdate,
  toMatchRecipient,
  toStoredMatchSubject,
  toWantedMatchNotifications,
  type StoredListingForMatch,
} from "@/lib/data/mappers";
import type { AccessRefusal, MutationResult } from "@/lib/data/mutation-result";
import type { ListingInsert } from "@/lib/data/rows";
import { getCurrentUserId } from "@/lib/data/session";
import { hasClosedDeal } from "@/lib/data/deals";
import { getProfileById } from "@/lib/data/profiles";
import { adminClient, isSupabaseMode } from "@/lib/data/source";
import { getWantedMatches } from "@/lib/data/wanted";
import { deferWrite, performWrite, performWriteReturning } from "@/lib/data/write-seam";
import { allocatePhotos } from "@/lib/photo-allowance";
import { findForeignPhotoRefs } from "@/lib/photo-refs";
import { routes } from "@/lib/routes";
import type { ListingFormValues } from "@/lib/schemas/listing-form";
import { FREE_PHOTOS, MAX_PHOTOS } from "@/lib/site";
import { buildSlug, idSlugSuffix } from "@/lib/slug";

/* Écritures sur les annonces. Chaque fonction vérifie qui écrit et ce qu'il a
   le droit de toucher avant de construire quoi que ce soit : une action
   serveur se déclenche par une simple requête POST, pas seulement depuis
   l'interface.

   Phase 2 : la RLS de Supabase refait ces contrôles côté base
   (seller_id = auth.uid()) ; ceux-ci restent, parce qu'ils rendent une
   réponse lisible au lieu d'une erreur SQL. Le dépôt et la modification
   passent par create_listing et update_listing (migration 11) : l'annonce,
   ses séries et ses produits d'un seul bloc. */

export type ListingWriteResult = {
  slug: string;
  path: string;
  /* Les photos au-delà de la troisième qui attendent le paiement de
     l'option « 8 photos » : zéro quand elle est déjà payée, ou quand il n'y
     en a pas plus de trois. Le récapitulatif le dit au vendeur. */
  photosAwaitingPayment: number;
};

/* Les photos d'une annonce vivent chez Cloudflare Images, qui arrive en
   phase 3. La démonstration garde ses photos restées sur l'appareil ; avec
   la base, une annonce se dépose sans photo jusque-là, et le formulaire le
   dit au lieu d'en accepter qu'il perdrait. */
export function canAttachPhotos(): boolean {
  return !isSupabaseMode();
}

const PHOTOS_UNAVAILABLE = {
  status: "invalid",
  fieldErrors: { photos: "Les photos arrivent bientôt : publiez l'annonce sans photo pour l'instant." },
} as const;

/* Une photo publiée qui n'appartient pas à l'annonce : refusée, et dite. */
const FOREIGN_PHOTO = {
  status: "invalid",
  fieldErrors: { photos: "Une des photos ne provient pas de cette annonce : ajoutez-la depuis votre appareil." },
} as const;

/* Un fichier téléversé qui ne peut pas servir à cette annonce : celui d'un
   autre compte, un fichier que le ménage a pris, ou un fichier qu'une autre
   annonce affiche déjà. Un nouvel envoi depuis l'appareil en fait un
   fichier neuf, à soi. */
const UNATTACHABLE_PHOTO = {
  status: "invalid",
  fieldErrors: { photos: "Une des photos n'est plus disponible pour cette annonce : ajoutez-la de nouveau depuis votre appareil." },
} as const;

/* Plus de trois photos sans l'option ni sa demande. Le schéma le refuse
   déjà ; ceci répond à un appel qui ne serait pas passé par lui. */
const OVER_ALLOWANCE = {
  status: "invalid",
  fieldErrors: { photos: `${FREE_PHOTOS} photos sont gratuites : cochez l'option « ${MAX_PHOTOS} photos » ou retirez-en.` },
} as const;

/* Une vente clôturée fige l'annonce : elle est la pièce à laquelle les
   avis se rapportent — « un lot conforme à l'annonce ». Réécrite après
   coup, elle ferait mentir l'avis. */
const CLOSED_DEAL = {
  status: "invalid",
  fieldErrors: {
    listing: "Cette vente a été clôturée avec un acheteur : l'annonce reste telle qu'elle a été vendue, avec les avis qui s'y rapportent.",
  },
} as const;

/* Un particulier déclare au dépôt vendre à titre personnel, après avoir lu
   ce qu'il risque à se présenter comme tel s'il est professionnel (Code de
   la consommation, D111-8) ; un compte professionnel ne déclare rien de
   plus — son statut, vérifié par SIRET, le dit déjà sur l'annonce. */
const PRIVATE_SELLER_REQUIRED = {
  status: "invalid",
  fieldErrors: {
    privateSeller:
      "Cochez la déclaration : vous vendez à titre personnel. Si vous vendez dans le cadre d'une activité, déclarez votre SIRET dans Paramètres.",
  },
} as const;

/* L'annonce que vise une écriture, si elle est à la personne connectée ;
   sinon le refus que l'écriture rend tel quel. La RLS le redit en base
   (seller_id = auth.uid()), mais c'est ici qu'il se dit sans aller-retour. */
async function ownListing(listingId: string): Promise<{ sellerId: string; listing: Listing } | AccessRefusal> {
  const sellerId = await getCurrentUserId();
  if (!sellerId) return { status: "unauthenticated" };
  const listing = await getListingById(listingId);
  if (!listing || listing.seller.id !== sellerId) return { status: "not-found" };
  return { sellerId, listing };
}

/* `draftId` : l'identifiant tiré quand la page du formulaire s'est affichée.
   Un double envoi le répète, et create_listing rend alors l'annonce déjà
   déposée au lieu d'en créer une seconde. Sans lui, le serveur en tire un.
   Le lien permanent en dérive avec la base ; la démonstration, qui n'écrit
   rien, garde son suffixe « apercu ». */
export async function createListing(
  values: ListingFormValues,
  draftId: string = crypto.randomUUID(),
): Promise<MutationResult<ListingWriteResult>> {
  const sellerId = await getCurrentUserId();
  if (!sellerId) return { status: "unauthenticated" };
  const seller = await getProfileById(sellerId);
  if (!seller?.isPro && !values.privateSeller) return PRIVATE_SELLER_REQUIRED;
  if (!canAttachPhotos() && values.photos.length > 0) return PHOTOS_UNAVAILABLE;
  if (findForeignPhotoRefs(values.photos, []).length > 0) return FOREIGN_PHOTO;
  if ((await findUnattachableUploads(values.photos, { ownerId: sellerId, listingId: null })).length > 0) return UNATTACHABLE_PHOTO;
  /* Une annonce qui naît n'a rien payé : l'option cochée est une demande. */
  const photos = allocatePhotos(values.photos, { hasPaidOption: false, wantsOption: values.extraPhotos });
  if (!photos) return OVER_ALLOWANCE;

  const slug = buildSlug(values.title, values.city, isSupabaseMode() ? idSlugSuffix(draftId) : "apercu");
  const listing = toListingInsert(values, sellerId, slug, draftId);
  const editions = toListingEditionInserts(values);
  const tags = toListingTagInserts(values);
  const written = (keptSlug: string): ListingWriteResult => ({
    slug: keptSlug,
    path: routes.listing(keptSlug),
    photosAwaitingPayment: photos.awaitingPayment.length,
  });
  /* Ce que la base répond, lu une fois l'écriture faite : le lien gardé, et
     si l'annonce vient d'être créée. */
  let created = false;
  const result = await performWriteReturning<unknown, ListingWriteResult>(
    "listings.insert",
    { listing, editions, tags, photos: photos.published, photosAwaitingPayment: photos.awaitingPayment },
    written(slug),
    ({ user }) => user.rpc("create_listing", { payload: { listing, editions, tags } }).single(),
    (row) => {
      const outcome = readCreatedListing(row, slug);
      created = outcome.created;
      return written(outcome.slug);
    },
  );
  /* Seule une annonce vraiment créée prévient ceux qui la cherchent : un
     double envoi ne crée rien, et ils l'ont déjà appris. */
  if (result.status === "saved" && created) after(() => notifyStoredListing(listing.id));
  if (result.status === "not-persisted") await deferDemoNotifications(values, listing);
  return result;
}

/* Ce que rend create_listing : le lien, et si l'annonce vient d'être créée
   — un double envoi rend celui de l'annonce déjà déposée, created à faux.
   Une réponse illisible ne vaut pas création : mieux vaut un acheteur
   prévenu une fois de moins que deux fois, ou à tort. */
export function readCreatedListing(row: unknown, fallbackSlug: string): { slug: string; created: boolean } {
  const value: { permalink?: unknown; created?: unknown } = typeof row === "object" && row !== null ? row : {};
  return { slug: typeof value.permalink === "string" ? value.permalink : fallbackSlug, created: value.created === true };
}

/* Les colonnes de l'index qui ne garde qu'une notification par croisement
   (migration 11) : l'écriture les vise pour ignorer un doublon. */
export const MATCH_NOTIFICATION_KEY = "kind,user_id,listing_id,wanted_id";

/* Ceux qui cherchent ce lot l'apprennent : le même croisement que celui qui
   s'affiche au vendeur à la validation, mais sur l'annonce telle que la base
   l'a enregistrée — jamais sur l'envoi. Seule la clé de service écrit dans
   notifications, et hors du temps de réponse : le vendeur voit son annonce
   publiée sans attendre, et une notification perdue se lit dans les
   journaux, pas sur son écran. */
async function notifyStoredListing(listingId: string): Promise<void> {
  const admin = adminClient();
  const stored = await admin.from("listings").select(STORED_MATCH_COLUMNS).eq("id", listingId).single();
  if (stored.error) {
    console.error(`notifications.insert : ${stored.error.message}`);
    return;
  }
  const { listing, matchable } = toStoredMatchSubject(stored.data as StoredListingForMatch);
  const matches = await getWantedMatches(matchable, Number.MAX_SAFE_INTEGER);
  const rows = toWantedMatchNotifications(listing, matches.map(toMatchRecipient));
  if (rows.length === 0) return;
  const { error } = await admin.from("notifications").upsert(rows, { onConflict: MATCH_NOTIFICATION_KEY, ignoreDuplicates: true });
  if (error) console.error(`notifications.insert : ${error.message}`);
}

/* La démonstration n'enregistre rien : elle décrit à la couture les
   notifications que le dépôt aurait écrites. */
async function deferDemoNotifications(values: ListingFormValues, listing: ListingInsert): Promise<void> {
  const matches = await getWantedMatches(
    {
      gameId: values.gameId,
      lotType: values.lotType,
      cardCount: values.cardCount,
      priceCents: listing.price_cents,
      latitude: listing.latitude,
      longitude: listing.longitude,
      seller: { id: listing.seller_id },
    },
    Number.MAX_SAFE_INTEGER,
  );
  const rows = toWantedMatchNotifications({ id: listing.id, sellerId: listing.seller_id, audience: values.audience }, matches.map(toMatchRecipient));
  if (rows.length > 0) await deferWrite("notifications.insert", rows);
}

/* Le lien permanent ne change pas, même si le titre change : c'est la
   promesse du produit. Le slug n'est donc jamais réécrit. */
export async function updateListing(
  listingId: string,
  values: ListingFormValues,
): Promise<MutationResult<ListingWriteResult>> {
  const owned = await ownListing(listingId);
  if ("status" in owned) return owned;
  const { sellerId, listing } = owned;
  /* La base le refuse aussi (freeze_listing_after_deal). */
  if (await hasClosedDeal(listing.id)) return CLOSED_DEAL;
  if (!canAttachPhotos() && values.photos.length > 0) return PHOTOS_UNAVAILABLE;
  const ownUrls = listing.photos.flatMap((photo) => (photo.url ? [photo.url] : []));
  if (findForeignPhotoRefs(values.photos, ownUrls).length > 0) return FOREIGN_PHOTO;
  if ((await findUnattachableUploads(values.photos, { ownerId: sellerId, listingId: listing.id })).length > 0) return UNATTACHABLE_PHOTO;
  /* L'option se lit sur l'annonce, pas dans le formulaire. */
  const photos = allocatePhotos(values.photos, { hasPaidOption: listing.hasExtraPhotos, wantsOption: values.extraPhotos });
  if (!photos) return OVER_ALLOWANCE;

  const update = toListingUpdate(values, listing);
  const editions = toListingEditionInserts(values);
  const tags = toListingTagInserts(values);
  return performWrite(
    "listings.update",
    { id: listing.id, listing: update, editions, tags, photos: photos.published, photosAwaitingPayment: photos.awaitingPayment },
    { slug: listing.slug, path: routes.listing(listing.slug), photosAwaitingPayment: photos.awaitingPayment.length },
    ({ user }) => user.rpc("update_listing", { listing: listing.id, payload: { listing: update, editions, tags } }),
  );
}

export async function setListingStatus(
  listingId: string,
  status: ListingStatus,
): Promise<MutationResult<{ status: ListingStatus; path: string }>> {
  const owned = await ownListing(listingId);
  if ("status" in owned) return owned;
  const { listing } = owned;
  /* Une vente clôturée ne se défait pas : le lot repasserait « Disponible »
     avec un acheteur et des avis. La base le refuse aussi. */
  if (status !== "sold" && (await hasClosedDeal(listing.id))) {
    return { status: "invalid", fieldErrors: { status: "Vente clôturée : le lot reste vendu." } };
  }

  const update = toListingStatusUpdate(status, new Date().toISOString());
  return performWrite("listings.status", { id: listing.id, listing: update }, { status, path: routes.listing(listing.slug) }, ({ user }) =>
    user.from("listings").update(update).eq("id", listing.id).select("id").single(),
  );
}

/* « Prolonger » et « Remettre en ligne » : gratuits, en un clic, pour le
   vendeur seul. L'annonce repart pour quatre-vingt-dix jours à compter
   d'aujourd'hui ; archivée, elle repart sans ses photos, que la tâche
   quotidienne a retirées. Une annonce vendue n'expire pas : rien à
   prolonger. renew_listing (migration 15) tient les deux règles en base. */
export async function renewListing(listingId: string): Promise<MutationResult<{ path: string }>> {
  const owned = await ownListing(listingId);
  if ("status" in owned) return owned;
  const { listing } = owned;
  if (listing.status === "sold") {
    return { status: "invalid", fieldErrors: { listing: "Une annonce vendue n'expire pas : elle reste servie telle qu'elle a été vendue." } };
  }

  return performWrite("listings.renew", { id: listing.id }, { path: routes.listing(listing.slug) }, ({ user }) =>
    user.rpc("renew_listing", { listing: listing.id }),
  );
}

export async function deleteListing(listingId: string): Promise<MutationResult<{ path: string }>> {
  const owned = await ownListing(listingId);
  if ("status" in owned) return owned;
  const { listing } = owned;
  /* Une vente conclue est l'affaire de deux personnes : supprimer l'annonce
     emporterait l'avis que l'autre a laissé. */
  if (await hasClosedDeal(listing.id)) {
    return {
      status: "invalid",
      fieldErrors: { listing: "Cette vente a été clôturée avec un acheteur : l'annonce reste, avec les avis qui s'y rattachent." },
    };
  }

  return performWrite("listings.delete", { id: listing.id }, { path: routes.listing(listing.slug) }, ({ user }) =>
    user.from("listings").delete().eq("id", listing.id).select("id").single(),
  );
}
