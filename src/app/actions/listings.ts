"use server";

import { z } from "@/lib/schemas/zod";
import { revalidateListingPaths, updateCachedReads, type Placement } from "@/app/actions/revalidate";
import { CACHE_TAGS } from "@/lib/data/cache-tags";
import { getListingById } from "@/lib/data/listings";
import {
  canAttachPhotos,
  createListing,
  deleteListing,
  renewListing,
  setListingStatus,
  updateListing,
  type ListingWriteResult,
} from "@/lib/data/listing-mutations";
import type { MutationResult } from "@/lib/data/mutation-result";
import { withKnownCommune } from "@/lib/schemas/commune";
import { withKnownEditions } from "@/lib/schemas/editions";
import {
  LISTING_COMMUNE_ERROR,
  collectFieldErrors,
  listingFormSchema,
  listingFormSchemaWithoutPhotos,
  readListingFormData,
} from "@/lib/schemas/listing-form";
import { draftIdSchema, recordIdSchema } from "@/lib/schemas/record-id";
import { LISTING_STATUSES, type ListingStatus } from "@/types/listing";

/* Actions serveur des annonces : minces. Elles relisent l'entrée avec le
   même schéma que le navigateur — un formulaire se trafique —, délèguent à
   la couche données, qui contrôle l'identité et la propriété, puis
   rafraîchissent les pages concernées quand l'écriture a réellement eu
   lieu. */

const statusSchema = z.enum(LISTING_STATUSES);

/* Où l'annonce s'affiche, lu avant l'écriture — qui peut la supprimer, ou
   la changer de jeu ou de commune. La lecture est mémoïsée pour la requête
   (cache) : la couche données relit la même annonce sans seconde requête. */
async function placementOf(listingId: string): Promise<Placement[]> {
  const listing = await getListingById(listingId);
  return listing ? [listing] : [];
}

export async function submitListing(formData: FormData): Promise<MutationResult<ListingWriteResult>> {
  const rawId = formData.get("listingId");
  /* Les séries que l'annonce porte déjà : une série retirée depuis du
     référentiel peut rester cochée en modification. Rien n'est lu au dépôt. */
  const existing = typeof rawId === "string" && recordIdSchema.safeParse(rawId).success ? await getListingById(rawId) : null;
  /* Le même schéma que le formulaire affiché : sans photos tant qu'elles ne
     peuvent pas s'enregistrer (phase 3). */
  const schema = withKnownEditions(
    withKnownCommune(canAttachPhotos() ? listingFormSchema : listingFormSchemaWithoutPhotos, LISTING_COMMUNE_ERROR),
    existing?.editions.map((edition) => edition.id),
  );
  const parsed = schema.safeParse(readListingFormData(formData));
  if (!parsed.success) return { status: "invalid", fieldErrors: collectFieldErrors(parsed.error) };

  const placement: Placement = { gameId: parsed.data.gameId, city: parsed.data.city, postalCode: parsed.data.postalCode };
  if (rawId === null || rawId === "") {
    /* L'identifiant tiré à l'affichage du formulaire ; hors forme, le
       serveur en tire un autre, et seul le double envoi n'est plus couvert. */
    const draftId = draftIdSchema.safeParse(formData.get("draftId"));
    const result = await createListing(parsed.data, draftId.success ? draftId.data : undefined);
    if (result.status === "saved") revalidateListingPaths(result.data.path, [placement]);
    return result;
  }

  /* Le champ caché se trafique comme le reste : un identifiant hors forme
     ne mène à rien, comme une annonce qui n'existe pas. */
  const id = recordIdSchema.safeParse(rawId);
  if (!id.success) return { status: "not-found" };
  const before = await placementOf(id.data);
  const result = await updateListing(id.data, parsed.data);
  if (result.status === "saved") revalidateListingPaths(result.data.path, [placement, ...before]);
  return result;
}

export async function changeListingStatus(
  listingId: unknown,
  status: unknown,
): Promise<MutationResult<{ status: ListingStatus; path: string }>> {
  const id = recordIdSchema.safeParse(listingId);
  const nextStatus = statusSchema.safeParse(status);
  if (!id.success || !nextStatus.success) return { status: "not-found" };

  const placements = await placementOf(id.data);
  const result = await setListingStatus(id.data, nextStatus.data);
  if (result.status === "saved") {
    revalidateListingPaths(result.data.path, placements);
    /* Entrer en « Vendu » ou en sortir change aussi le compte des ventes du
       vendeur (count_sale), lu avec les profils. */
    updateCachedReads(CACHE_TAGS.profiles);
  }
  return result;
}

/* Prolonger, ou remettre en ligne : l'annonce revient dans les listes de
   son jeu et de sa commune, qui se rafraîchissent. */
export async function renewListingAction(listingId: unknown): Promise<MutationResult<{ path: string }>> {
  const id = recordIdSchema.safeParse(listingId);
  if (!id.success) return { status: "not-found" };

  const placements = await placementOf(id.data);
  const result = await renewListing(id.data);
  if (result.status === "saved") revalidateListingPaths(result.data.path, placements);
  return result;
}

export async function removeListing(listingId: unknown): Promise<MutationResult<{ path: string }>> {
  const id = recordIdSchema.safeParse(listingId);
  if (!id.success) return { status: "not-found" };

  const placements = await placementOf(id.data);
  const result = await deleteListing(id.data);
  if (result.status === "saved") revalidateListingPaths(result.data.path, placements);
  return result;
}
