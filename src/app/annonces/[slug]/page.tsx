import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/ads/AdSlot";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { StickyColumn } from "@/components/layout/StickyColumn";
import { ListingGrid } from "@/components/listing/ListingGrid";
import { ListingHeadline } from "@/components/listing/ListingHeadline";
import { ListingDetails } from "@/components/listing/ListingDetails";
import { PhotoCredits } from "@/components/listing/PhotoCredits";
import { PhotoGallery } from "@/components/listing/PhotoGallery";
import { ProOnlyNotice } from "@/components/pro/ProOnlyNotice";
import { SafetyNote } from "@/components/listing/SafetyNote";
import { ReportLink } from "@/components/report/ReportLink";
import { SellerCard } from "@/components/listing/SellerCard";
import { ViewerActions } from "@/components/listing/ViewerActions";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { getShownPhotos } from "@/lib/listing-display";
import { isArchived, isExpired } from "@/lib/listing-lifecycle";
import { getListingBySlug, getListingForViewer, getRelatedListings } from "@/lib/data/listings";
import { getCurrentUserId } from "@/lib/data/session";
import { OPEN_GRAPH_BASE, listingRobots, listingShareDescription, listingShareTitle } from "@/lib/metadata";
import { routes } from "@/lib/routes";
import { listingBreadcrumbItems, listingPageJsonLd } from "@/lib/structured-data";
import { buildWatermarkLabel } from "@/lib/watermark";

type PageProps = { params: Promise<{ slug: string }> };

/* Une annonce publique se lit sans session ; seule une annonce absente du
   public — réservée aux pros — passe par l'identité du visiteur. La page,
   elle, est rendue à chaque requête dans tous les cas : le nonce de la CSP. */
async function loadListing(slug: string) {
  return (await getListingBySlug(slug)) ?? getListingForViewer(slug, await getCurrentUserId());
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Annonce introuvable" };

  /* « Vendu — » en tête quand il l'est : collé dans un groupe, l'aperçu
     d'un lot parti montrait encore son prix comme une offre. */
  const now = Date.now();
  const title = listingShareTitle(listing, now);
  const robots = listingRobots(listing, new Date(now));

  /* Réservée aux pros : ni index, ni aperçu de partage — une vignette collée
     dans un groupe afficherait le titre et le prix à tout le monde. */
  if (listing.audience === "pros") return { title, robots };

  const description = listingShareDescription(listing, now);
  const url = routes.listing(listing.slug);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots,
    openGraph: { ...OPEN_GRAPH_BASE, type: "article", title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}

/* Sur téléphone, l'ordre est celui de la lecture d'une annonce : la photo, le
   titre et le prix, le bouton, le vendeur, puis le détail. Avant, le titre
   n'arrivait qu'à 2 133 px, sous toute la description. En grand écran, la
   même source se range en deux colonnes, la seconde suit le défilement.

   La colonne épinglée ne porte que ce qui déclenche l'action. Le pavé
   publicitaire y ajoutait 272 px : haute de 900 px pour une fiche de 1 500,
   elle ne collait que sur 600 px puis repartait sous l'en-tête, au milieu
   de la description qu'elle devait accompagner. */
export default async function ListingPage({ params }: PageProps) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const [relatedListings, viewerId] = await Promise.all([getRelatedListings(listing), getCurrentUserId()]);
  /* Expirée, la page répond encore — son lien a pu être partagé — mais ne
     décrit plus une offre aux moteurs. Archivée, elle ne montre plus de
     photos, même avant le passage de la tâche qui les retire. */
  const now = Date.now();
  const photos = getShownPhotos(listing, now);

  return (
    <div className="container pb-28 pt-5 lg:pb-[var(--section-gap)] lg:pt-8">
      {/* Les données structurées ne décrivent que ce que le public voit. */}
      {listing.audience === "everyone" && !isExpired(listing, now) ? <JsonLd data={listingPageJsonLd(listing)} /> : null}
      {/* Le même fil que celui des données structurées, sans le dernier
          maillon : le titre de la fiche le suit. */}
      <Breadcrumb items={listingBreadcrumbItems(listing).slice(0, -1).map(({ name, path }) => ({ href: path, label: name }))} />

      {listing.audience === "pros" ? <ProOnlyNotice /> : null}

      <div className="grid gap-7 [grid-template-areas:'gallery'_'aside'_'details'] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-x-12 lg:gap-y-8 lg:[grid-template-areas:'gallery_aside'_'details_aside']">
        <div className="min-w-0 [grid-area:gallery]">
          <PhotoGallery
            gameId={listing.gameId}
            photos={photos}
            title={listing.title}
            watermark={buildWatermarkLabel(listing)}
            emptyLabel={isArchived(listing, now) ? "Photos retirées" : undefined}
          />
          {/* Le crédit reste collé à l'image : Unsplash le demande à côté
              d'elle, pas au bas d'un écran qu'on a quitté. */}
          <PhotoCredits photos={photos} />
        </div>

        <div className="min-w-0 [grid-area:aside]">
          <StickyColumn className="flex flex-col gap-5">
            <ListingHeadline listing={listing} />
            <Suspense fallback={<div className="h-28" />}>
              <ViewerActions listing={listing} />
            </Suspense>
            <SellerCard seller={listing.seller} />
            <SafetyNote />
            {viewerId !== listing.seller.id ? <ReportLink target="listing" targetKey={listing.slug} /> : null}
          </StickyColumn>
        </div>

        <ListingDetails listing={listing} className="[grid-area:details]" />
      </div>

      <div className="mt-[var(--section-gap)] hidden lg:block">
        <AdSlot format="leaderboard" slotId="annonce-bas" />
      </div>

      {relatedListings.length > 0 ? (
        <section className="mt-[var(--section-gap)]">
          <SectionHeader eyebrow="À côté" title="Autres lots dans le secteur" size="md" linkHref={routes.listings} linkLabel="Toutes les annonces" />
          <ListingGrid listings={relatedListings} priorityCount={0} />
        </section>
      ) : null}
    </div>
  );
}
