import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ListingForm } from "@/components/deposit/ListingForm";
import { StatusBadge } from "@/components/listing/StatusBadge";
import { getDealsForUser } from "@/lib/data/deals";
import { canAttachPhotos } from "@/lib/data/listing-mutations";
import { getListingForViewer } from "@/lib/data/listings";
import { getProfileById } from "@/lib/data/profiles";
import { getEditionCatalog } from "@/lib/editions";
import { requireCurrentUserId } from "@/lib/data/session";
import { getWantedListings } from "@/lib/data/wanted";
import { toListingFormDefaults } from "@/lib/form-defaults";
import { routes } from "@/lib/routes";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = { title: "Modifier une annonce" };

type PageProps = { params: Promise<{ slug: string }> };

export default async function EditListingPage({ params }: PageProps) {
  const { slug } = await params;
  const userId = await requireCurrentUserId(routes.editListing(slug));
  /* Lue sous l'identité du vendeur : une annonce réservée aux pros reste
     modifiable par son propriétaire, particulier ou non. */
  const listing = await getListingForViewer(slug, userId);

  /* Une annonce qui n'est pas la sienne se comporte comme une annonce qui
     n'existe pas : répondre « interdit » confirmerait qu'elle existe. */
  if (!listing || listing.seller.id !== userId) notFound();

  const [seller, openWantedListings, deals] = await Promise.all([
    getProfileById(userId),
    getWantedListings({ limit: 100 }),
    getDealsForUser(userId),
  ]);
  if (!seller) notFound();
  /* Une vente clôturée fige l'annonce : les avis s'y rapportent, et la
     couche données refuse de la réécrire. La page le dit au lieu d'offrir
     un formulaire que l'enregistrement refuserait. */
  const deal = deals.find((candidate) => candidate.listing.id === listing.id) ?? null;

  return (
    <>
      <Breadcrumb items={[{ href: routes.accountListings, label: "Mes annonces" }, { label: "Modifier" }]} />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={listing.status} />
        <p className="mono text-[length:var(--text-sm)] text-[var(--muted)]">{listing.reference}</p>
      </div>
      <h2 className="display mt-3 text-[length:var(--text-2xl)]">{listing.title}</h2>
      {deal ? (
        <p data-frozen-listing className="notice mt-6 text-[length:var(--text-md)] leading-relaxed">
          <strong>Vente clôturée avec {deal.buyer.username} : l&apos;annonce ne se modifie plus.</strong> Elle reste
          telle qu&apos;elle a été vendue, parce que les avis s&apos;y rapportent — « un lot conforme à
          l&apos;annonce » ne voudrait plus rien dire si l&apos;annonce changeait après coup.{" "}
          <Link href={routes.deal(deal.id)} className="text-link">
            Voir le récapitulatif de la vente
          </Link>
          {" · "}
          <Link href={routes.listing(listing.slug)} className="text-link">
            Voir la page publique
          </Link>
        </p>
      ) : (
        <>
          <p className="mt-4 text-[length:var(--text-body)] leading-relaxed text-[var(--ink-soft)]">
            Le lien permanent ne bouge pas. Ceux qui l&apos;ont partagé dans un groupe verront la version à
            jour, sans que vous ayez à reposter quoi que ce soit.{" "}
            <Link href={routes.listing(listing.slug)} className="text-link">
              Voir la page publique
            </Link>
          </p>

          <div className="mt-10">
            <ListingForm
              openWantedListings={openWantedListings}
              seller={seller}
              defaults={toListingFormDefaults(listing)}
              editionCatalog={getEditionCatalog(listing.gameId, listing.editions.map((edition) => edition.id))}
              listingId={listing.id}
              permalink={`${SITE_URL}${routes.listing(listing.slug)}`}
              photoUploads={canAttachPhotos()}
              now={listing.createdAt}
            />
          </div>
        </>
      )}
    </>
  );
}
