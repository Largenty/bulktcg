import { AdSlot } from "@/components/ads/AdSlot";
import { GameTiles } from "@/components/home/GameTiles";
import { HomeHero } from "@/components/home/HomeHero";
import { PermalinkSection } from "@/components/home/PermalinkSection";
import { ProSection } from "@/components/home/ProSection";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { WantedGrid } from "@/components/wanted/WantedGrid";
import { getGames } from "@/lib/data/games";
import {
  getActiveCityNames,
  getFeaturedListings,
  getLatestListings,
  getListingCountByGame,
  getProOnlyCountByGame,
} from "@/lib/data/listings";
import { countWantedListings, getWantedCountByGame, getWantedListings } from "@/lib/data/wanted";
import { countLabel } from "@/lib/french";
import { routes } from "@/lib/routes";
import { siteJsonLd } from "@/lib/structured-data";

export default async function HomePage() {
  const [
    games,
    countByGame,
    wantedCountByGame,
    cities,
    recentListings,
    featuredListings,
    wantedListings,
    wantedCount,
    reservedCounts,
  ] = await Promise.all([
    getGames(),
    getListingCountByGame(),
    getWantedCountByGame(),
    getActiveCityNames(),
    /* Deux rangées pleines dans l'ordre de dépôt — dix au plus, cinq
       colonnes en très grand écran — sans la remontée payée, et sans les
       annonces à la une, qui ont leur section. */
    getLatestListings(10),
    /* Une rangée pleine : cinq en très grand écran, quatre sur téléphone. */
    getFeaturedListings(5),
    /* Une rangée de demandes : assez pour montrer que le côté acheteur vit,
       pas assez pour concurrencer la grille des lots, qui reste le sujet. */
    getWantedListings({ limit: 5 }),
    countWantedListings(),
    getProOnlyCountByGame(),
  ]);
  const totalCount = Object.values(countByGame).reduce((sum, count) => sum + count, 0);

  return (
    <>
      <JsonLd data={siteJsonLd()} />
      <HomeHero games={games} cities={cities} recentListings={recentListings} countByGame={countByGame} totalCount={totalCount} />

      {/* En deuxième : juste après ce qui se vend, ce qui se cherche. C'est
          ce qui distingue le site d'un tableau d'annonces — et « quelqu'un le
          cherche » se lit mieux quand on vient de voir les lots. La grille
          est celle des demandes, jamais celle des lots : pas de photo, un
          bandeau de couleur pleine, sa propre route. */}
      {wantedListings.length > 0 ? (
        <section className="section pb-0">
          <div className="container">
            <SectionHeader
              eyebrow="Côté acheteur"
              title="Ce qu'on cherche en ce moment"
              description={`${countLabel(wantedCount, "demande ouverte", "demandes ouvertes")} : ce que les acheteurs cherchent, et jusqu'où ils se déplacent. Si vous avez le lot dans un placard, vous savez à qui écrire.`}
              linkHref={routes.wantedListings}
              linkLabel="Toutes les demandes"
            />
            <WantedGrid wantedListings={wantedListings} rows={1} />
            <div className="mt-8">
              <ButtonLink href={routes.depositWanted} variant="secondary">
                Déposer une recherche
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : null}

      {/* Ceux que leur vendeur a mis en avant : c'est ce que la mise à la une
          achète. Aucun ne figure dans les derniers dépôts plus haut. */}
      {featuredListings.length > 0 ? (
        <section className="section pb-0">
          <div className="container">
            <SectionHeader eyebrow="Mises en avant" title="À la une" linkHref={routes.listings} linkLabel="Toutes les annonces" />
            <ListingGrid listings={featuredListings} priorityCount={0} rows={1} />
          </div>
        </section>
      ) : null}

      <section className="section pb-0">
        <div className="container">
          <SectionHeader eyebrow="Parcourir" title="Par jeu" linkHref={routes.listings} linkLabel="Toutes les annonces" />
          <GameTiles games={games} listingCountByGame={countByGame} wantedCountByGame={wantedCountByGame} />
        </div>
      </section>

      <ProSection reservedCounts={reservedCounts} />

      <div className="container pb-[var(--section-gap)]">
        <AdSlot format="leaderboard" slotId="accueil-milieu" />
      </div>

      <PermalinkSection />
    </>
  );
}
