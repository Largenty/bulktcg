import type { DraftPhoto } from "@/lib/listing-draft";

/* Le téléversement des photos, côté navigateur.

   Phase 1 : il n'y a pas de stockage. Les fichiers restent sur l'appareil,
   leurs références « local:… » partent avec le formulaire, le serveur les
   valide en nombre et en forme, et le récapitulatif dit que rien n'est
   enregistré.

   Phase 2, sur Cloudflare Images : pour chaque photo « local: », l'action
   serveur preparePhotoUploads(count) — bornée à huit, et au débit du
   compte — demande à Cloudflare une adresse de dépôt à usage unique
   (POST /accounts/{id}/images/v2/direct_upload, jeton d'API côté serveur,
   image privée tant que l'annonce n'est pas publiée pour tous, expiration
   à dix minutes : directUploadExpiry, lib/photo-hosting), inscrit
   l'identifiant rendu dans photo_uploads avec la clé de service, et rend
   { key, uploadUrl }. Le navigateur envoie le fichier, déjà recadré et
   converti (lib/photo-convert), directement à Cloudflare — la limite de
   4,5 Mo d'un corps de requête serveur ne s'applique pas —, et la
   référence devient « storage:<identifiant> ». Le formulaire, lui, ne
   change pas. Un fichier jamais accroché part au ménage au bout de sept
   jours : supabase/README.md, § 6. */
export async function uploadPendingPhotos(photos: DraftPhoto[]): Promise<DraftPhoto[]> {
  return photos;
}
