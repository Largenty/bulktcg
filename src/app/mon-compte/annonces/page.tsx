import type { Metadata } from "next";
import type { BuyerCandidate } from "@/components/account/BuyerChoices";
import { SellerListingRow } from "@/components/listing/SellerListingRow";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterTabs } from "@/components/filters/FilterTabs";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LISTING_STAGES, STAGE_PARAM, getListingStage, getListingStageUrl, groupListingsByStage, listingStageLabel, resolveListingStage } from "@/lib/account-stages";
import { getConversationsForUser } from "@/lib/data/conversations";
import { getDealsForUser } from "@/lib/data/deals";
import { getListingsOwnedBy } from "@/lib/data/listings";
import { getWaitlistCountsForSeller } from "@/lib/data/waitlist";
import { requireCurrentUserId } from "@/lib/data/session";
import { countWantedMatches } from "@/lib/data/wanted";
import { countLabel } from "@/lib/french";
import { LISTING_LIFECYCLE } from "@/lib/listing-lifecycle";
import type { Listing } from "@/types/listing";
import { routes } from "@/lib/routes";
import type { SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Mes annonces" };

type PageProps = { searchParams: Promise<SearchParams> };

export default async function AccountListingsPage({ searchParams }: PageProps) {
  const userId = await requireCurrentUserId(routes.accountListings);
  const [listings, deals, conversations, waitlistCounts, params] = await Promise.all([
    getListingsOwnedBy(userId, { includeSold: true }),
    getDealsForUser(userId),
    getConversationsForUser(userId),
    getWaitlistCountsForSeller(userId),
    searchParams,
  ]);
  const stage = resolveListingStage(params[STAGE_PARAM]);

  /* Un seul passage sur les demandes ouvertes : le croisement est calculé
     ici, la ligne du tableau ne fait que l'afficher. */
  const matchCounts = new Map(
    await Promise.all(listings.map(async (listing) => [listing.id, await countWantedMatches(listing)] as const)),
  );
  const dealByListing = new Map(deals.map((deal) => [deal.listing.id, deal]));
  /* Ceux qui ont écrit à propos de chaque lot : « Vendu » demande lequel. */
  const threadsByListing = Map.groupBy(
    conversations.filter((conversation) => conversation.seller.id === userId),
    (conversation) => conversation.listing.id,
  );
  const buyersOf = (listing: Listing): BuyerCandidate[] =>
    (threadsByListing.get(listing.id) ?? []).map(({ id, buyer }) => ({ conversationId: id, userId: buyer.id, username: buyer.username }));

  const row = (listing: Listing) => (
    <SellerListingRow
      key={listing.id}
      listing={listing}
      matchCount={matchCounts.get(listing.id) ?? 0}
      buyers={buyersOf(listing)}
      deal={dealByListing.get(listing.id) ?? null}
      waitlistCount={waitlistCounts.get(listing.id) ?? 0}
    />
  );
  /* Une annonce que son vendeur n'a pas prolongée reste disponible ou
     réservée en base : elle est pourtant sortie des listes, et c'est là
     qu'elle se range ici — la règle du suivi de la vue d'ensemble. */
  const now = Date.now();
  const byStage = groupListingsByStage(listings, now);
  /* En ligne : disponibles et réservées mêlées, dans l'ordre de dépôt. */
  const activeListings = listings.filter((listing) => ["available", "reserved"].includes(getListingStage(listing, now)));
  const stageListings = stage ? byStage[stage] : [];

  /* Les étapes d'une annonce, comptées et cliquables : on voit d'un coup
     d'œil ce qui est en ligne, ce qui attend son acheteur, ce qui est parti. */
  const pills = [
    { href: routes.accountListings, label: "Tout", count: listings.length, isCurrent: stage === null },
    ...LISTING_STAGES.map((value) => ({
      href: getListingStageUrl(value),
      label: listingStageLabel(value),
      count: byStage[value].length,
      isCurrent: stage === value,
    })),
  ];

  return (
    <>
      <FilterTabs label="Étapes des annonces" tabs={pills} />
      {stage ? (
        <>
          <SectionHeader size="md" title={listingStageLabel(stage)} description={`${countLabel(stageListings.length, "annonce")} à cette étape.`} />
          {stageListings.length > 0 ? (
            <ul className="flex list-none flex-col gap-3">{stageListings.map(row)}</ul>
          ) : (
            <EmptyState title="Aucune annonce à cette étape" reason="Le compteur au-dessus se remet à jour à chaque changement de statut." />
          )}
        </>
      ) : (
        <>
          <SectionHeader
            size="md"
            title="En ligne"
            description="Le statut se change en un clic et le lien ne bouge jamais. Quand le lot part, « Vendu » demande à qui : c'est ce qui ouvre les avis."
          />
          {activeListings.length > 0 ? (
            <ul className="flex list-none flex-col gap-3">{activeListings.map(row)}</ul>
          ) : (
            <EmptyState
              title="Aucune annonce en ligne"
              reason="Vous n'avez rien à vendre pour le moment, ou tout est déjà parti."
              action={<ButtonLink href={routes.deposit}>Déposer une annonce</ButtonLink>}
            />
          )}
          {byStage.expired.length > 0 ? (
            <div className="mt-12">
              <SectionHeader
                size="md"
                title="Expirées"
                description={`${countLabel(byStage.expired.length, "annonce")} sans prolongation depuis ${LISTING_LIFECYCLE.lifetimeDays} jours : sorties des listes, leur page répond encore. Les remettre en ligne est gratuit ; ${LISTING_LIFECYCLE.archiveAfterDays} jours après l'expiration, leurs photos sont supprimées.`}
              />
              <ul className="flex list-none flex-col gap-3">{byStage.expired.map(row)}</ul>
            </div>
          ) : null}
          {byStage.sold.length > 0 ? (
            <div className="mt-12">
              <SectionHeader
                size="md"
                title="Vendues"
                description={`${countLabel(byStage.sold.length, "annonce passée", "annonces passées")} en « Vendu ». Leur page reste servie : le lien a pu être partagé, et les avis s'y rattachent. Leurs photos sont supprimées ${LISTING_LIFECYCLE.archiveAfterDays} jours après la vente.`}
              />
              <ul className="flex list-none flex-col gap-3">{byStage.sold.map(row)}</ul>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
