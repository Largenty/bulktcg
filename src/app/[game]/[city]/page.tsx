import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { CityBuyPanel } from "@/components/market/CityBuyPanel";
import { CityMarket } from "@/components/market/CityMarket";
import { CitySellPanel } from "@/components/market/CitySellPanel";
import { MarketTabs } from "@/components/market/MarketTabs";
import { JsonLd } from "@/components/seo/JsonLd";
import { distinguishedName, getCityByPair, getCityBySlug, isRetiredCommune } from "@/lib/cities";
import { getGameBySegment } from "@/lib/data/games";
import { getListings } from "@/lib/data/listings";
import { getWantedListings } from "@/lib/data/wanted";
import { atCity, capitalize } from "@/lib/french";
import { gamePhrases } from "@/lib/labels";
import { getDistancesFromOrigin } from "@/lib/listing-display";
import { INDEXABLE, NOT_INDEXABLE } from "@/lib/metadata";
import { routes } from "@/lib/routes";
import { CITY_PAGE_NEARBY_KM, buildCityPageContent, getNearbyCities } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/structured-data";

/* Chaque commune de France a sa page, pour chaque jeu : 8 × 34 879
   adresses, rendues à la demande (le nonce de la CSP, lib/csp.ts), aucune
   prérendue. Une adresse qui ne désigne ni un jeu ni une commune du
   référentiel répond 404 (loadPage). Seule une page qui a des lots dans la
   commune même est indexée, et entre dans le plan du site. */

type PageProps = { params: Promise<{ game: string; city: string }> };

/* generateMetadata et la page demandent exactement le même chargement :
   cache() le fait une fois. La clé est scalaire, la mémoïsation est donc
   effective. */
const loadPage = cache(async (rawGame: string, rawCity: string) => {
  const [game, city] = await Promise.all([getGameBySegment(rawGame), getCityBySlug(rawCity)]);
  if (!game || !city) return null;
  const placeName = distinguishedName(city);

  const origin = { latitude: city.latitude, longitude: city.longitude };
  const [listings, aroundListings, wantedListings] = await Promise.all([
    getListings({ gameId: game.id, communeSlug: city.slug, limit: 48 }),
    /* Les lots à côté : sans eux, la page de Carpentras annonçait « rien à
       vendre » avec dix lots à vingt minutes. */
    getListings({ gameId: game.id, origin, maxDistanceKm: CITY_PAGE_NEARBY_KM, sort: "distance", limit: 24 }),
    /* « Qui viendrait jusqu'ici », et non « qui habite ici » : c'est le
       rayon de l'acheteur qui décide. */
    getWantedListings({ gameId: game.id, origin, reachableOnly: true, limit: 24 }),
  ]);
  const cityIds = new Set(listings.map((listing) => listing.id));
  const nearbyListings = aroundListings.filter((listing) => !cityIds.has(listing.id));
  /* Les communes voisines qui ont des lots de ce jeu passent avant les plus
     peuplées dans les liens « Autour de… ». */
  const populatedSlugs = new Set(
    nearbyListings.flatMap((listing) => getCityByPair(listing.city, listing.postalCode)?.slug ?? []),
  );

  return {
    game,
    city,
    placeName,
    listings,
    nearbyListings,
    wantedListings,
    nearbyCities: getNearbyCities(city, populatedSlugs),
    distances: getDistancesFromOrigin(nearbyListings, city),
    content: buildCityPageContent(game, city, listings, nearbyListings.length, { placeName, isRetired: isRetiredCommune(city) }),
  };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { game, city } = await params;
  const page = await loadPage(game, city);
  if (!page) return { title: "Page introuvable" };

  return {
    title: page.content.title,
    description: page.content.description,
    alternates: { canonical: routes.gameCity(page.game.id, page.city.slug) },
    /* Indexable seulement avec des lots dans la commune même : une page qui
       ne montre que ses voisines serait une page passerelle. */
    robots: page.content.isIndexable ? INDEXABLE : NOT_INDEXABLE,
  };
}

export default async function GameCityPage({ params }: PageProps) {
  const { game: rawGame, city: rawCity } = await params;
  const page = await loadPage(rawGame, rawCity);
  if (!page) notFound();

  const { game, city, placeName, listings, nearbyListings, wantedListings, nearbyCities, distances, content } = page;
  /* La première phrase présente la page ; le reste du texte — fourchette de
     prix, formats, rendez-vous — vient après les lots. Il occupait tout le
     haut de la page, à côté d'un titre posé en bas d'un grand vide : sur
     téléphone, la première annonce arrivait à 740 px. */
  const [intro, ...details] = content.paragraphs;

  return (
    <div className="container pb-[var(--section-gap)] pt-6 lg:pt-8">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Annonces", path: routes.listings },
          { name: game.label, path: routes.game(game.id) },
          { name: placeName, path: routes.gameCity(game.id, city.slug) },
        ])}
      />
      <Breadcrumb
        items={[
          { href: routes.listings, label: "Annonces" },
          { href: routes.game(game.id), label: game.label },
          { label: placeName },
        ]}
      />

      <h1 className="display display-h2">{content.heading}</h1>
      {intro ? <p className="lead mt-4 text-[var(--ink-soft)]">{intro}</p> : null}

      <div className="mt-8 lg:mt-10">
        <MarketTabs
          label={`${capitalize(gamePhrases(game.id).cards)} ${atCity(placeName)} : ventes ou recherches`}
          counts={{ sell: listings.length + nearbyListings.length, buy: wantedListings.length }}
          panels={{
            sell: <CitySellPanel game={game} city={city} listings={listings} nearbyListings={nearbyListings} distances={distances} />,
            buy: <CityBuyPanel game={game} city={city} wantedListings={wantedListings} />,
          }}
        />
      </div>

      <CityMarket game={game} city={city} details={details} nearbyCities={nearbyCities} />
    </div>
  );
}
