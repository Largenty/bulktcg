import { OgProfileImage, profileShare } from "@/components/og/OgProfileImage";
import { getProfileByUsername } from "@/lib/data/profiles";
import { contentVersion } from "@/lib/metadata";
import { shareImageMetadata, shareImageResponse } from "@/lib/og-fonts";

/* L'image de partage d'un profil : ce qu'un vendeur colle pour montrer
   « toutes mes annonces ». Son adresse porte une version tirée de ce
   qu'elle dessine — un nouvel avis, une annonce de plus, et elle change. */

type ImageParams = { username?: string };

async function loadShare(username: string | undefined) {
  const profile = username ? await getProfileByUsername(username) : null;
  return profile ? profileShare(profile) : null;
}

export async function generateImageMetadata({ params }: { params: ImageParams }) {
  const share = await loadShare(params?.username);
  return share ? shareImageMetadata(contentVersion([JSON.stringify(share)]), `${share.title} sur BulkTCG — ${share.lines[0]}`) : [];
}

export default async function OpenGraphImage({ params }: { params: Promise<ImageParams> }) {
  const share = await loadShare((await params).username);
  if (!share) return new Response("Introuvable", { status: 404 });
  return shareImageResponse((hasBrandFonts) => <OgProfileImage share={share} hasBrandFonts={hasBrandFonts} />);
}
