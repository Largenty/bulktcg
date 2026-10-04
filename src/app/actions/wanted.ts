"use server";

import { z } from "@/lib/schemas/zod";
import { revalidateWantedPaths, type Placement } from "@/app/actions/revalidate";
import type { MutationResult } from "@/lib/data/mutation-result";
import { getWantedById } from "@/lib/data/wanted";
import {
  createWanted,
  deleteWanted,
  setWantedStatus,
  updateWanted,
  type WantedWriteResult,
} from "@/lib/data/wanted-mutations";
import { draftIdSchema, recordIdSchema } from "@/lib/schemas/record-id";
import { withKnownCommune } from "@/lib/schemas/commune";
import { WANTED_COMMUNE_ERROR, collectWantedFieldErrors, wantedFormSchema } from "@/lib/schemas/wanted-form";
import { WANTED_STATUSES, type WantedStatus } from "@/types/wanted";

const statusSchema = z.enum(WANTED_STATUSES);

/* Où la demande s'affiche, lu avant l'écriture — qui peut la supprimer ou
   la déplacer. Mémoïsé pour la requête : la couche données relit la même. */
async function placementOf(wantedId: string): Promise<Placement[]> {
  const wanted = await getWantedById(wantedId);
  return wanted ? [wanted] : [];
}

export async function submitWanted(formData: FormData): Promise<MutationResult<WantedWriteResult>> {
  const parsed = withKnownCommune(wantedFormSchema, WANTED_COMMUNE_ERROR).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "invalid", fieldErrors: collectWantedFieldErrors(parsed.error) };

  const placement: Placement = { gameId: parsed.data.gameId, city: parsed.data.city, postalCode: parsed.data.postalCode };
  const rawId = formData.get("wantedId");
  if (rawId === null || rawId === "") {
    /* L'identifiant tiré à l'affichage du formulaire : un double envoi
       retombe sur la même demande. */
    const draftId = draftIdSchema.safeParse(formData.get("draftId"));
    const result = await createWanted(parsed.data, draftId.success ? draftId.data : undefined);
    if (result.status === "saved") revalidateWantedPaths(result.data.path, [placement]);
    return result;
  }

  /* Le champ caché se trafique comme le reste : un identifiant hors forme
     ne mène à rien, comme une demande qui n'existe pas. */
  const id = recordIdSchema.safeParse(rawId);
  if (!id.success) return { status: "not-found" };
  const before = await placementOf(id.data);
  const result = await updateWanted(id.data, parsed.data);
  if (result.status === "saved") revalidateWantedPaths(result.data.path, [placement, ...before]);
  return result;
}

export async function changeWantedStatus(
  wantedId: unknown,
  status: unknown,
): Promise<MutationResult<{ status: WantedStatus; path: string }>> {
  const id = recordIdSchema.safeParse(wantedId);
  const nextStatus = statusSchema.safeParse(status);
  if (!id.success || !nextStatus.success) return { status: "not-found" };

  const placements = await placementOf(id.data);
  const result = await setWantedStatus(id.data, nextStatus.data);
  if (result.status === "saved") revalidateWantedPaths(result.data.path, placements);
  return result;
}

export async function removeWanted(wantedId: unknown): Promise<MutationResult<{ path: string }>> {
  const id = recordIdSchema.safeParse(wantedId);
  if (!id.success) return { status: "not-found" };

  const placements = await placementOf(id.data);
  const result = await deleteWanted(id.data);
  if (result.status === "saved") revalidateWantedPaths(result.data.path, placements);
  return result;
}
