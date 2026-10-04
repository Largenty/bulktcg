import { OgListingImage } from "@/components/og/OgListingImage";
import { getListingBySlug } from "@/lib/data/listings";
import { formatPrice } from "@/lib/format";
import { atCity } from "@/lib/french";
import { getListingStateLabel, getShownPhotos } from "@/lib/listing-display";
import { shareImageVersion } from "@/lib/metadata";
import { loadOpenGraphPhoto, shareImageMetadata, shareImageResponse } from "@/lib/og-fonts";

/* C'est la vitrine réelle du produit : ce que voit quelqu'un quand le vendeur
   colle son lien dans un groupe Facebook ou une conversation WhatsApp.

   Son adresse porte une version (generateImageMetadata) : Facebook et
   WhatsApp gardent une image tant que son adresse ne change pas, et
   montraient l'ancien prix après une baisse, ou un lot disponible après sa
   vente. La version change dès que ce que l'image montre change ; une
   ancienne adresse répond 404.

   Une annonce réservée aux pros n'a pas d'image : la lecture publique ne la
   connaît pas, et aucune balise og:image n'est émise. */

type ImageParams = { slug?: string };

function shareImageAlt(listing: NonNullable<Awaited<ReturnType<typeof getListingBySlug>>>, now: number): string {
  const state = getListingStateLabel(listing, now);
  return `${listing.title} — ${formatPrice(listing.priceCents)} ${atCity(listing.city)}${state === null ? "" : ` — ${state.toLowerCase()}`}`;
}

export async function generateImageMetadata({ params }: { params: ImageParams }) {
  const listing = params?.slug ? await getListingBySlug(params.slug) : null;
  const now = Date.now();
  return listing ? shareImageMetadata(shareImageVersion(listing, now), shareImageAlt(listing, now)) : [];
}

export default async function OpenGraphImage({ params }: { params: Promise<ImageParams> }) {
  const { slug } = await params;
  const listing = slug ? await getListingBySlug(slug) : null;
  if (!listing) return new Response("Introuvable", { status: 404 });

  /* Expirée, l'image porte son tampon ; archivée, elle n'a plus de photo. */
  const now = Date.now();
  const state = getListingStateLabel(listing, now);
  const photo = await loadOpenGraphPhoto(getShownPhotos(listing, now)[0]?.url ?? null);
  /* Une photo que le moteur refuse malgré sa conversion ne doit pas priver
     l'annonce de son aperçu : l'image repart sans elle. */
  return shareImageResponse(
    (hasBrandFonts) => <OgListingImage listing={listing} state={state} photo={photo} hasBrandFonts={hasBrandFonts} />,
    (hasBrandFonts) => <OgListingImage listing={listing} state={state} photo={null} hasBrandFonts={hasBrandFonts} />,
  );
}
