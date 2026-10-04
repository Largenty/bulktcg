"use server";

import { refresh, revalidatePath } from "next/cache";
import { revalidateListingPaths, revalidateWantedPaths, updateCachedReads } from "@/app/actions/revalidate";
import type { AlertSettings } from "@/lib/data/account-settings";
import { updateAlertSettings } from "@/lib/data/account-settings-mutations";
import { CACHE_TAGS } from "@/lib/data/cache-tags";
import { getListingsOwnedBy } from "@/lib/data/listings";
import type { MutationResult } from "@/lib/data/mutation-result";
import { deleteAccount, updateProfile } from "@/lib/data/profile-mutations";
import { getProfileById } from "@/lib/data/profiles";
import { getCurrentUserId } from "@/lib/data/session";
import { getWantedListingsByBuyer } from "@/lib/data/wanted";
import { routes } from "@/lib/routes";
import { collectErrors } from "@/lib/schemas/field-errors";
import { alertSettingsSchema } from "@/lib/schemas/alert-settings-form";
import { withKnownCommune } from "@/lib/schemas/commune";
import { COMMUNE_ERROR, profileSchema } from "@/lib/schemas/profile-form";

export async function saveProfile(formData: FormData): Promise<MutationResult<{ username: string }>> {
  const parsed = withKnownCommune(profileSchema, COMMUNE_ERROR).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "invalid", fieldErrors: collectErrors(parsed.error) };

  const userId = await getCurrentUserId();
  const before = userId ? await getProfileById(userId) : null;
  const result = await updateProfile(parsed.data);
  if (result.status === "saved") {
    /* Le pseudo s'affiche aussi sur les vignettes et les demandes, dont les
       lectures portent l'étiquette des profils. */
    updateCachedReads(CACHE_TAGS.profiles);
    revalidatePath(routes.account, "layout");
    /* Un pseudo changé : l'ancienne adresse du profil doit cesser de
       répondre aussi vite que la nouvelle apparaît. */
    for (const username of new Set([result.data.username, before?.username ?? result.data.username])) {
      revalidatePath(routes.profile(username));
    }
  }
  return result;
}

/* Ce que le compte montrait au public part avec lui : ses fiches et leurs
   pages de jeu et de commune, ses demandes, son profil — lus avant la
   suppression, puisqu'ils n'existent plus après. Des chemins concrets, et
   non tout le site : la liste est bornée par ce que le compte avait publié. */
export async function deleteAccountAction(): Promise<MutationResult<null>> {
  const userId = await getCurrentUserId();
  const [profile, listings, wantedListings] = userId
    ? await Promise.all([getProfileById(userId), getListingsOwnedBy(userId), getWantedListingsByBuyer(userId)])
    : [null, [], []];
  const result = await deleteAccount();
  if (result.status === "saved") {
    /* Ses annonces et ses demandes partent avec le compte. */
    updateCachedReads(CACHE_TAGS.profiles, CACHE_TAGS.listings, CACHE_TAGS.wanted);
    for (const listing of listings) revalidateListingPaths(routes.listing(listing.slug), [listing]);
    for (const wanted of wantedListings) revalidateWantedPaths(routes.wanted(wanted.slug), [wanted]);
    if (profile) revalidatePath(routes.profile(profile.username));
  }
  return result;
}

/* Les alertes ne regardent que leur titulaire : refresh() rafraîchit son
   écran, sans toucher au cache des pages publiques. */
export async function saveAlertSettings(formData: FormData): Promise<MutationResult<AlertSettings>> {
  const parsed = alertSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "invalid", fieldErrors: collectErrors(parsed.error) };
  const result = await updateAlertSettings(parsed.data);
  if (result.status === "saved") refresh();
  return result;
}
