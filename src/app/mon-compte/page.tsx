import type { Metadata } from "next";
import { ActionList, type AccountAction } from "@/components/account/ActionList";
import { PipelineBoard } from "@/components/account/PipelineBoard";
import { StatList } from "@/components/account/StatList";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { buildPipelineRows } from "@/lib/account-pipeline";
import { countInbox } from "@/lib/conversation-display";
import { getConversationsForUser } from "@/lib/data/conversations";
import { getDealsForUser } from "@/lib/data/deals";
import { getListingsOwnedBy } from "@/lib/data/listings";
import { getProfileById } from "@/lib/data/profiles";
import { requireCurrentUserId } from "@/lib/data/session";
import {
  countListingsMatchingWanted,
  countWantedMatches,
  getWantedListingsByBuyer,
} from "@/lib/data/wanted";
import { getDealViewUrl } from "@/lib/deal-display";
import { formatCount, formatPrice } from "@/lib/format";
import { countLabel, pluralize } from "@/lib/french";
import { UNKNOWN_VALUE } from "@/lib/labels";
import { buildLifecycleActions } from "@/lib/account-lifecycle-actions";
import { isExpired } from "@/lib/listing-lifecycle";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Vue d'ensemble" };

export default async function AccountOverviewPage() {
  const userId = await requireCurrentUserId();
  const [profile, listings, wantedListings, deals, conversations] = await Promise.all([
    getProfileById(userId),
    getListingsOwnedBy(userId, { includeSold: true }),
    getWantedListingsByBuyer(userId),
    getDealsForUser(userId),
    getConversationsForUser(userId),
  ]);

  const now = Date.now();
  const activeListings = listings.filter((listing) => listing.status !== "sold" && !isExpired(listing, now));
  const soldListings = listings.filter((listing) => listing.status === "sold");
  const openWanted = wantedListings.filter((wanted) => wanted.status === "open");

  /* Les deux sens du croisement, comptés ici une fois pour toutes : qui
     cherche ce que je vends, et ce qui est en ligne pour ce que je cherche.
     C'est la seule chose qu'un tableau de bord apporte qu'une liste
     d'annonces n'apporte pas. */
  const [buyerInterestCounts, listingsForMyWanted] = await Promise.all([
    Promise.all(activeListings.map((listing) => countWantedMatches(listing))),
    Promise.all(openWanted.map((wanted) => countListingsMatchingWanted(wanted))),
  ]);

  const listingsWithInterest = buyerInterestCounts.filter((count) => count > 0).length;
  /* Un fil qu'on ne peut plus que relire n'attend pas de réponse. */
  const awaitingReply = countInbox(conversations).awaiting;
  const dealsToReview = deals.filter((deal) => !deal.reviews.some((review) => review.reviewerId === userId)).length;
  const wantedWithAnswers = listingsForMyWanted.filter((count) => count > 0).length;

  const actions: AccountAction[] = [
    ...buildLifecycleActions(listings, now),
    {
      count: dealsToReview,
      sentence: `${dealsToReview > 1 ? "ventes conclues attendent" : "vente conclue attend"} votre avis sur l'autre partie.`,
      href: getDealViewUrl("a-noter"),
      linkLabel: "Noter",
    },
    {
      count: awaitingReply,
      sentence: `${pluralize(awaitingReply, "conversation")} ${awaitingReply > 1 ? "vous attendent" : "vous attend"} sans réponse.`,
      href: routes.inbox,
      linkLabel: "Ouvrir la messagerie",
    },
    {
      count: listingsWithInterest,
      sentence: `${listingsWithInterest > 1 ? "de vos annonces en ligne correspondent" : "de vos annonces en ligne correspond"} à une demande de recherche déposée près de chez vous.`,
      href: routes.accountListings,
      linkLabel: "Voir mes annonces",
    },
    {
      count: wantedWithAnswers,
      sentence: `de vos recherches ${wantedWithAnswers > 1 ? "ont" : "a"} déjà une réponse parmi les lots en ligne.`,
      href: routes.accountWanted,
      linkLabel: "Voir mes recherches",
    },
  ];

  return (
    <>
      <SectionHeader
        size="md"
        eyebrow="Ce qui demande une réponse"
        title="Aujourd'hui"
        description="Les croisements sont recalculés à chaque visite sur les annonces réellement en ligne : rien n'est mis en cache pour faire un chiffre."
      />
      <ActionList
        actions={actions}
        emptyLabel="Rien ne vous attend. Aucun message sans réponse, aucun croisement nouveau entre vos annonces et les recherches en cours."
      />

      <section className="mt-12" aria-label="Suivi">
        <SectionHeader
          size="md"
          eyebrow="Suivi"
          title="Où en est chaque chose"
          description="De la mise en ligne à l'avis : chaque étape se compte, et mène à sa liste."
        />
        <PipelineBoard rows={buildPipelineRows({ userId, listings, wantedListings, deals, conversations, now })} />
      </section>

      <div className="mt-12 rounded-[var(--radius-lg)] border-[length:var(--border-width)] border-[var(--line)] bg-[var(--card)] p-6">
        <SectionHeader size="md" title="Votre activité ici" />
        <StatList
          stats={[
            { label: "Annonces en ligne", value: formatCount(activeListings.length) },
            { label: "Recherches ouvertes", value: formatCount(openWanted.length) },
            {
              label: "Vues cumulées",
              value: formatCount(listings.reduce((sum, listing) => sum + listing.viewCount, 0)),
            },
            {
              label: "Vendu ici",
              value: formatPrice(
                soldListings.reduce((sum, listing) => sum + listing.priceCents, 0),
              ),
              hint: `Sur ${countLabel(soldListings.length, "annonce passée", "annonces passées")} en « Vendu » ici. L'historique complet du compte, ${profile ? countLabel(profile.soldListingCount, "vente") : UNKNOWN_VALUE}, est sur le profil public.`,
            },
          ]}
        />
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href={routes.deposit}>Déposer une annonce</ButtonLink>
        <ButtonLink href={routes.depositWanted} variant="secondary">
          Déposer une recherche
        </ButtonLink>
      </div>
    </>
  );
}
