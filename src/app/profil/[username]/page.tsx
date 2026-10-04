import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getCurrentUserId } from "@/lib/data/session";
import { countLabel } from "@/lib/french";
import { INDEXABLE, NOT_INDEXABLE, OPEN_GRAPH_BASE, isProfileIndexable } from "@/lib/metadata";
import { REVIEWS_ANCHOR, routes } from "@/lib/routes";
import { storeJsonLd } from "@/lib/structured-data";
import { getListingsBySeller } from "@/lib/data/listings";
import { getProfileByUsername, getReviewsForUser } from "@/lib/data/profiles";
import { RatingBreakdown } from "@/components/review/RatingBreakdown";
import { ReviewList } from "@/components/review/ReviewList";
import { getWantedListings } from "@/lib/data/wanted";
import { WantedGrid } from "@/components/wanted/WantedGrid";

type PageProps = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) return { title: "Profil introuvable" };

  return {
    /* Ni « vendeur » ni « acheteur » : la page montre les deux côtés du
       compte, et sur ce marché tout le monde est tour à tour l'un et
       l'autre. */
    title: `${profile.username} — cartes à ${profile.city}`,
    description: `Ce que ${profile.username} propose à ${profile.city} et ce que ce compte recherche, de la main à la main.`,
    alternates: { canonical: routes.profile(profile.username) },
    robots: isProfileIndexable(profile) ? INDEXABLE : NOT_INDEXABLE,
    openGraph: { ...OPEN_GRAPH_BASE, type: "profile", username: profile.username, url: routes.profile(profile.username) },
  };
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  /* Les demandes ouvertes de ce compte : sur ce marché, tout le monde est
     tour à tour vendeur et acheteur, et voir ce que quelqu'un cherche est
     souvent la meilleure raison de lui écrire. Les demandes closes ne
     remontent pas — elles n'appellent plus rien. */
  const [listings, reviews, wantedListings, viewerId] = await Promise.all([
    getListingsBySeller(profile.id),
    getReviewsForUser(profile.id),
    getWantedListings({ buyerId: profile.id, limit: 12 }),
    getCurrentUserId(),
  ]);

  const store = storeJsonLd(profile);

  return (
    <div className="pb-[var(--section-gap)]">
      {store ? <JsonLd data={store} /> : null}
      <ProfileHeader profile={profile} viewerId={viewerId} />

      <div className="container">
        <section className="mt-10">
          <SectionHeader title="Ses annonces" />
          {listings.length > 0 ? (
            <ListingGrid listings={listings} />
          ) : (
            <EmptyState
              title="Rien en ligne pour le moment"
              reason={`${profile.username} n'a aucune annonce active. Son historique compte ${countLabel(profile.soldListingCount, "vente")}.`}
            />
          )}
        </section>

        {wantedListings.length > 0 ? (
          <section className="mt-[var(--section-gap)]">
            <SectionHeader
              title={`Ce que ${profile.username} cherche`}
              description="Ces demandes ne sont pas des annonces : ni photo, ni état, ni prix ferme. Si vous avez le lot, le bouton est sur la demande."
              linkHref={routes.wantedListings}
              linkLabel="Toutes les demandes"
            />
            <WantedGrid wantedListings={wantedListings} />
          </section>
        ) : null}

        <section id={REVIEWS_ANCHOR} className="mt-[var(--section-gap)] scroll-mt-24">
          <SectionHeader
            title="Avis reçus"
            description={
              profile.ratingCount === 0
                ? "Ce compte est récent : personne n'a encore conclu de vente avec lui."
                : "La note se lit critère par critère. Les avis les plus récents suivent, comme vendeur et comme acheteur."
            }
          />
          <RatingBreakdown ratingAvg={profile.ratingAvg} ratingCount={profile.ratingCount} breakdown={profile.ratingBreakdown} />
          <div className="mt-4">
            {reviews.length > 0 ? (
              <ReviewList reviews={reviews} />
            ) : (
              <EmptyState
                title="Aucun avis à afficher"
                reason={
                  profile.ratingCount === 0
                    ? "Personne n'a encore noté ce compte. Ce n'est pas un mauvais signe, c'est un compte neuf."
                    : "Les avis de ce compte portent sur des ventes plus anciennes, qui ne sont plus affichées ici."
                }
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
