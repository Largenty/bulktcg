import type { MetadataRoute } from "next";
import type { Listing } from "@/types/listing";
import { getGames } from "@/lib/data/games";
import { getListings } from "@/lib/data/listings";
import { getWantedListings } from "@/lib/data/wanted";
import { isListingIndexable, listingLastModified } from "@/lib/metadata";
import { routes } from "@/lib/routes";
import { getPopulatedCities } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

/* L'accueil s'écrit sans barre finale, comme sa balise canonique. */
const absolute = (path: string) => (path === "/" ? SITE_URL : new URL(path, `${SITE_URL}/`).toString());

/* La date la plus récente d'un ensemble d'annonces, ou rien. Tout le plan
   portait l'heure du build, la même pour chaque adresse : un moteur à qui
   l'on dit que tout change tout le temps cesse de lire la date. Une page
   sans date réelle n'en déclare pas. */
function latestChange(listings: Listing[]): Date | undefined {
  if (listings.length === 0) return undefined;
  return new Date(Math.max(...listings.map((listing) => listingLastModified(listing).getTime())));
}

/* Le plan de site ne liste que ce qui a du contenu, et ce qui est indexable :
   - une annonce vendue y reste trente jours, le temps que les moteurs
     voient « vendu », puis en sort — la page reste servie, hors index ;
   - un profil n'y figure que s'il a une annonce en ligne : le plan publiait
     le pseudo de chaque compte, même sans rien de public (audit, F10) ;
   - les demandes de recherche en sont absentes : servies en noindex,
     personne ne cherche « quelqu'un cherche du vrac ». Seul le hub y est ;
   - un croisement jeu × ville n'y entre qu'avec des lots dans la commune,
     retrouvée par le couple (commune, code postal) de chaque annonce — sur
     les 8 × 34 879 pages servies, seules celles-là ; une commune retirée
     garde sa page, hors index.
   Chaque annonce déclare ses photos : Google Images les trouve sans avoir à
   rendre la page. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [games, publicListings, wantedListings] = await Promise.all([
    getGames(),
    getListings({ includeSold: true, limit: Number.MAX_SAFE_INTEGER }),
    getWantedListings({ limit: Number.MAX_SAFE_INTEGER }),
  ]);
  const listings = publicListings.filter((listing) => isListingIndexable(listing, now));
  const online = listings.filter((listing) => listing.status !== "sold");
  const wantedChange = wantedListings.length > 0
    ? new Date(Math.max(...wantedListings.map((wanted) => new Date(wanted.updatedAt).getTime())))
    : undefined;

  const staticEntries: MetadataRoute.Sitemap = [
    { url: absolute("/"), lastModified: latestChange(online), changeFrequency: "hourly", priority: 1 },
    { url: absolute(routes.listings), lastModified: latestChange(online), changeFrequency: "hourly", priority: 0.9 },
    { url: absolute(routes.wantedListings), lastModified: wantedChange, changeFrequency: "daily", priority: 0.5 },
    { url: absolute(routes.pro), changeFrequency: "monthly", priority: 0.4 },
    { url: absolute(routes.safety), changeFrequency: "monthly", priority: 0.4 },
  ];

  const listingEntries: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: absolute(routes.listing(listing.slug)),
    lastModified: listingLastModified(listing),
    changeFrequency: "daily",
    priority: listing.status === "sold" ? 0.3 : 0.8,
    images: listing.photos.flatMap((photo) => (photo.url ? [absolute(photo.url)] : [])),
  }));

  const bySeller = Map.groupBy(online, (listing) => listing.seller.username);
  const profileEntries: MetadataRoute.Sitemap = [...bySeller].map(([username, sellerListings]) => ({
    url: absolute(routes.profile(username)),
    lastModified: latestChange(sellerListings),
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const byGame = Map.groupBy(online, (listing) => listing.gameId);
  const gameEntries: MetadataRoute.Sitemap = games.map((game) => ({
    url: absolute(routes.game(game.id)),
    lastModified: latestChange(byGame.get(game.id) ?? []),
    changeFrequency: "daily",
    priority: 0.7,
  }));

  /* Les mêmes communes que les liens de ville d'une page de jeu
     (getPopulatedCities) : leur couple, jamais leur nom. */
  const cityEntries: MetadataRoute.Sitemap = [...byGame].flatMap(([gameId, gameListings]) =>
    getPopulatedCities(gameListings).map(({ city, listings: cityListings }) => ({
      url: absolute(routes.gameCity(gameId, city.slug)),
      lastModified: latestChange(cityListings),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  );

  return [...staticEntries, ...listingEntries, ...profileEntries, ...gameEntries, ...cityEntries];
}
