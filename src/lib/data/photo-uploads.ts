import "server-only";
import { photoUploadRows, readableListingRows } from "@/lib/data/source";
import { getStoredPhotoKey } from "@/lib/photo-refs";

/* Le registre des téléversements (photo_uploads) : la seule preuve qu'un
   fichier appartient à un compte (supabase/README.md, § 6). */

/* Les références « storage: » d'un formulaire dont le fichier ne peut pas
   s'accrocher à cette annonce : ce n'est pas un téléversement de ce compte,
   le ménage l'a pris, ou une autre annonce l'affiche déjà — un fichier
   n'affiche qu'une photo. La base refuse les trois
   (listing_photos_check_upload, listing_photos_one_photo_per_file), mais
   trop tard pour les photos 4 à 8 : le webhook de paiement les accroche une
   fois l'option payée, et le vendeur aurait payé pour rien. listingId :
   l'annonce modifiée, dont les photos restent les siennes ; null pour une
   annonce qui naît. Avec Supabase, les fichiers sont ceux que la RLS rend
   au vendeur, et les photos celles des annonces qu'il peut lire : une photo
   d'un lot qu'il ne voit pas échappe à ce contrôle, la base la refuse
   quand même. À volume, une requête ciblée remplacera les deux listes —
   select key, purge_started_at, listing_photos(listing_id) from
   photo_uploads where key = any($1). Phase 3 : aucun fichier n'est encore
   téléversé, la liste est vide. */
export async function findUnattachableUploads(
  refs: string[],
  { ownerId, listingId }: { ownerId: string; listingId: string | null },
): Promise<string[]> {
  const available = new Set(
    (await photoUploadRows()).filter((row) => row.owner_id === ownerId && row.purge_started_at === null).map((row) => row.key),
  );
  const shownElsewhere = new Set(
    (await readableListingRows()).filter((row) => row.id !== listingId).flatMap((row) => row.photos.map((photo) => photo.storage_path)),
  );
  return refs.filter((ref) => {
    const key = getStoredPhotoKey(ref);
    return key !== null && (!available.has(key) || shownElsewhere.has(key));
  });
}
