import "server-only";
import { adminClient, isSupabaseMode, unwrap, type SourceResponse } from "@/lib/data/source";

/* Ce que fait la tâche quotidienne au cycle de vie des annonces
   (run_listing_lifecycle, migration 15) : prévenir le vendeur d'une annonce
   qui expire dans sept jours, une fois par mise en ligne, puis retirer les
   photos des annonces archivées — trente jours après leur vente ou leur
   expiration, sauf signalement encore ouvert. Le ménage supprime ensuite
   les fichiers chez Cloudflare (supabase/README.md, § 6).

   Rien à faire en démonstration : l'expiration se lit sur les dates, et les
   données de démonstration montrent déjà la base telle que la tâche la
   laisse — une annonce archivée y est sans photo. */
export type ListingLifecycleReport = { warnedListings: number; archivedListings: number; removedPhotos: number };

type LifecycleRow = { warned_listings: number; archived_listings: number; removed_photos: number };

export async function runListingLifecycle(): Promise<ListingLifecycleReport | null> {
  if (!isSupabaseMode()) return null;
  const response = (await adminClient().rpc("run_listing_lifecycle").single()) as SourceResponse<LifecycleRow>;
  const row = unwrap("listings.lifecycle", response);
  return {
    warnedListings: row?.warned_listings ?? 0,
    archivedListings: row?.archived_listings ?? 0,
    removedPhotos: row?.removed_photos ?? 0,
  };
}
