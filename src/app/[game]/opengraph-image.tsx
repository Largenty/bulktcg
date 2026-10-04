import { OgMarketImage, gameShare } from "@/components/og/OgMarketImage";
import { getListings } from "@/lib/data/listings";
import { countWantedListings } from "@/lib/data/wanted";
import { contentVersion } from "@/lib/metadata";
import { shareImageMetadata, shareImageResponse } from "@/lib/og-fonts";
import { gameFromSegment } from "@/lib/routes";

/* L'image de partage de la page d'un jeu : ce qui s'y vend, ce qu'on y
   cherche, et la fourchette de prix, comptés au moment où l'image est
   rendue. Son adresse porte une version tirée de ces chiffres. */

type ImageParams = { game?: string };

async function loadShare(rawGame: string | undefined) {
  const gameId = gameFromSegment(rawGame);
  if (!gameId) return null;
  const [listings, wantedCount] = await Promise.all([
    getListings({ gameId, limit: Number.MAX_SAFE_INTEGER }),
    countWantedListings({ gameId }),
  ]);
  return gameShare(gameId, { listingCount: listings.length, wantedCount, prices: listings.map((listing) => listing.priceCents) });
}

export async function generateImageMetadata({ params }: { params: ImageParams }) {
  const share = await loadShare(params?.game);
  return share ? shareImageMetadata(contentVersion([JSON.stringify(share)]), `${share.title} — ${share.lines[0]}`) : [];
}

export default async function OpenGraphImage({ params }: { params: Promise<ImageParams> }) {
  const share = await loadShare((await params).game);
  if (!share) return new Response("Introuvable", { status: 404 });
  return shareImageResponse((hasBrandFonts) => <OgMarketImage share={share} hasBrandFonts={hasBrandFonts} />);
}
