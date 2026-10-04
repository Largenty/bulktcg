import "server-only";
import type { WantedListing, WantedStatus } from "@/types/wanted";
import { toWantedInsert, toWantedStatusUpdate, toWantedUpdate } from "@/lib/data/mappers";
import type { AccessRefusal, MutationResult } from "@/lib/data/mutation-result";
import { getCurrentUserId } from "@/lib/data/session";
import { isSupabaseMode } from "@/lib/data/source";
import { getWantedById } from "@/lib/data/wanted";
import { performWrite, performWriteReturning } from "@/lib/data/write-seam";
import { routes } from "@/lib/routes";
import type { WantedFormValues } from "@/lib/schemas/wanted-form";
import { buildSlug, idSlugSuffix } from "@/lib/slug";

/* Écritures sur les demandes de recherche : mêmes contrôles que pour les
   annonces, dans le sens de l'acheteur. Une demande est une seule ligne :
   insert, update et delete directs, sous la RLS (buyer_id = auth.uid()). */

export type WantedWriteResult = { slug: string; path: string };

/* La demande que vise une écriture, si elle est à la personne connectée ;
   sinon le refus que l'écriture rend tel quel (buyer_id = auth.uid() en
   base). */
async function ownWanted(wantedId: string): Promise<{ wanted: WantedListing } | AccessRefusal> {
  const buyerId = await getCurrentUserId();
  if (!buyerId) return { status: "unauthenticated" };
  const wanted = await getWantedById(wantedId);
  if (!wanted || wanted.buyer.id !== buyerId) return { status: "not-found" };
  return { wanted };
}

/* `draftId`, comme pour une annonce : un double envoi retombe sur la même
   ligne (on conflict (id) do nothing). Rien ne revient alors de l'insertion,
   et la demande déjà déposée doit être celle de l'acheteur connecté — un
   identifiant pris ailleurs ne lui rend rien. */
export async function createWanted(
  values: WantedFormValues,
  draftId: string = crypto.randomUUID(),
): Promise<MutationResult<WantedWriteResult>> {
  const buyerId = await getCurrentUserId();
  if (!buyerId) return { status: "unauthenticated" };

  const slug = buildSlug(values.title, values.city, isSupabaseMode() ? idSlugSuffix(draftId) : "apercu");
  const wanted = toWantedInsert(values, buyerId, slug, draftId);
  const written = (keptSlug: string): WantedWriteResult => ({ slug: keptSlug, path: routes.wanted(keptSlug) });
  return performWriteReturning<{ slug: string } | null, WantedWriteResult>(
    "wanted.insert",
    { wanted },
    written(slug),
    async ({ user }) => {
      const inserted = await user.from("wanted_listings").upsert(wanted, { onConflict: "id", ignoreDuplicates: true }).select("slug");
      if (inserted.error || inserted.data.length > 0) return { data: inserted.data?.[0] ?? null, error: inserted.error };
      return user.from("wanted_listings").select("slug").eq("id", draftId).eq("buyer_id", buyerId).single();
    },
    (kept) => written(kept?.slug ?? slug),
  );
}

export async function updateWanted(
  wantedId: string,
  values: WantedFormValues,
): Promise<MutationResult<WantedWriteResult>> {
  const owned = await ownWanted(wantedId);
  if ("status" in owned) return owned;
  const { wanted } = owned;

  const update = toWantedUpdate(values);
  return performWrite("wanted.update", { id: wanted.id, wanted: update }, { slug: wanted.slug, path: routes.wanted(wanted.slug) }, ({ user }) =>
    user.from("wanted_listings").update(update).eq("id", wanted.id).select("id").single(),
  );
}

export async function setWantedStatus(
  wantedId: string,
  status: WantedStatus,
): Promise<MutationResult<{ status: WantedStatus; path: string }>> {
  const owned = await ownWanted(wantedId);
  if ("status" in owned) return owned;
  const { wanted } = owned;

  const update = toWantedStatusUpdate(status, new Date().toISOString());
  return performWrite("wanted.status", { id: wanted.id, wanted: update }, { status, path: routes.wanted(wanted.slug) }, ({ user }) =>
    user.from("wanted_listings").update(update).eq("id", wanted.id).select("id").single(),
  );
}

export async function deleteWanted(wantedId: string): Promise<MutationResult<{ path: string }>> {
  const owned = await ownWanted(wantedId);
  if ("status" in owned) return owned;
  const { wanted } = owned;

  return performWrite("wanted.delete", { id: wanted.id }, { path: routes.wanted(wanted.slug) }, ({ user }) =>
    user.from("wanted_listings").delete().eq("id", wanted.id).select("id").single(),
  );
}
