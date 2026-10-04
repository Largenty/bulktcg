"use server";

import { revalidatePath } from "next/cache";
import { updateCachedReads } from "@/app/actions/revalidate";
import { CACHE_TAGS } from "@/lib/data/cache-tags";
import type { MutationResult } from "@/lib/data/mutation-result";
import { declareProStatus, leaveProStatus, type ProStatusResult } from "@/lib/data/pro-status-mutations";
import { getProfileById } from "@/lib/data/profiles";
import { getCurrentUserId } from "@/lib/data/session";
import { routes } from "@/lib/routes";
import { collectErrors } from "@/lib/schemas/field-errors";
import { proStatusSchema } from "@/lib/schemas/pro-status-form";

/* Le statut professionnel change le badge et l'enseigne partout où le
   compte apparaît — vignettes, demandes, fil de messagerie —, que les
   lectures publiques portent sous l'étiquette des profils ; et sa page de
   profil, avec la fiche boutique. */
async function refreshProfileReads() {
  updateCachedReads(CACHE_TAGS.profiles);
  revalidatePath(routes.account, "layout");
  const userId = await getCurrentUserId();
  const profile = userId ? await getProfileById(userId) : null;
  if (profile) revalidatePath(routes.profile(profile.username));
}

/* Déclarer son SIRET : la forme se relit ici — un formulaire se trafique —,
   la couche données interroge le répertoire et écrit le statut. */
export async function declareProStatusAction(formData: FormData): Promise<MutationResult<ProStatusResult>> {
  const parsed = proStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "invalid", fieldErrors: collectErrors(parsed.error) };

  const result = await declareProStatus(parsed.data);
  if (result.status === "saved") await refreshProfileReads();
  return result;
}

export async function leaveProStatusAction(): Promise<MutationResult<null>> {
  const result = await leaveProStatus();
  if (result.status === "saved") await refreshProfileReads();
  return result;
}
