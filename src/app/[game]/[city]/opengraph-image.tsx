import { OgMarketImage, cityShare } from "@/components/og/OgMarketImage";
import { distinguishedName, getCityBySlug } from "@/lib/cities";
import { countListings } from "@/lib/data/listings";
import { countWantedListings } from "@/lib/data/wanted";
import { contentVersion } from "@/lib/metadata";
import { shareImageMetadata, shareImageResponse } from "@/lib/og-fonts";
import { CITY_PAGE_NEARBY_KM } from "@/lib/seo";
import { gameFromSegment } from "@/lib/routes";

/* L'image de partage d'une page de ville : les lots de la commune, ceux à
   moins de trente kilomètres, et les acheteurs dont le rayon couvre la
   ville — les mêmes critères que la page. Une page vide le dit : « aucun
   lot pour l'instant », jamais un chiffre inventé. Toute commune du
   référentiel a la sienne, rendue à la première demande, puis gardée en
   cache ; une adresse inconnue répond 404. */

type ImageParams = { game?: string; city?: string };

async function loadShare(rawGame: string | undefined, rawCity: string | undefined) {
  const gameId = gameFromSegment(rawGame);
  const city = rawCity ? getCityBySlug(rawCity) : null;
  if (!gameId || !city) return null;
  const origin = { latitude: city.latitude, longitude: city.longitude };
  const [inCity, around, wanted] = await Promise.all([
    countListings({ gameId, communeSlug: city.slug }),
    countListings({ gameId, origin, maxDistanceKm: CITY_PAGE_NEARBY_KM }),
    countWantedListings({ gameId, origin, reachableOnly: true }),
  ]);
  return cityShare(gameId, city, { inCity, nearby: Math.max(0, around - inCity), wanted }, distinguishedName(city));
}

export async function generateImageMetadata({ params }: { params: ImageParams }) {
  const share = await loadShare(params?.game, params?.city);
  return share ? shareImageMetadata(contentVersion([JSON.stringify(share)]), `${share.title} — ${share.lines[0]}`) : [];
}

export default async function OpenGraphImage({ params }: { params: Promise<ImageParams> }) {
  const { game, city } = await params;
  const share = await loadShare(game, city);
  if (!share) return new Response("Introuvable", { status: 404 });
  return shareImageResponse((hasBrandFonts) => <OgMarketImage share={share} hasBrandFonts={hasBrandFonts} />);
}
