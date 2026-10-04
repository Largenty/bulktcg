import { OgWantedImage, wantedShare } from "@/components/og/OgWantedImage";
import { getWantedBySlug } from "@/lib/data/wanted";
import { contentVersion } from "@/lib/metadata";
import { shareImageMetadata, shareImageResponse } from "@/lib/og-fonts";

/* L'image de partage d'une demande de recherche. La page est hors index —
   personne ne cherche « quelqu'un cherche du vrac » —, mais c'est elle que
   l'acheteur colle dans les groupes Facebook : l'aperçu montrait la marque
   du site, et non ce qu'il cherche. */

type ImageParams = { slug?: string };

async function loadShare(slug: string | undefined) {
  const wanted = slug ? await getWantedBySlug(slug) : null;
  return wanted ? wantedShare(wanted) : null;
}

export async function generateImageMetadata({ params }: { params: ImageParams }) {
  const share = await loadShare(params?.slug);
  return share ? shareImageMetadata(contentVersion([JSON.stringify(share)]), `Recherche : ${share.title}`) : [];
}

export default async function OpenGraphImage({ params }: { params: Promise<ImageParams> }) {
  const share = await loadShare((await params).slug);
  if (!share) return new Response("Introuvable", { status: 404 });
  return shareImageResponse((hasBrandFonts) => <OgWantedImage share={share} hasBrandFonts={hasBrandFonts} />);
}
