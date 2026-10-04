import type { MatchCandidate } from "@/lib/match-candidate";
import { IntentLink } from "@/components/ui/IntentLink";
import { CrossingPanel } from "@/components/wanted/CrossingPanel";
import { formatDistance, formatPrice } from "@/lib/format";
import { countLabel } from "@/lib/french";
import { LOT_TYPE_LABELS } from "@/lib/labels";
import { routes } from "@/lib/routes";

type MatchingListingsProps = {
  listings: MatchCandidate[];
  totalCount: number;
  distanceByListingId: Map<string, number>;
};

/* Le pendant acheteur de MatchingWanted : ce qui est déjà en ligne et répond
   à la demande, montré au moment où elle est validée. Sans ça, un acheteur
   déposerait une recherche et attendrait, alors que son lot existe peut-être
   à vingt minutes depuis trois semaines. */
export function MatchingListings({
  listings,
  totalCount,
  distanceByListingId,
}: MatchingListingsProps) {
  const hidden = totalCount - listings.length;

  return (
    <CrossingPanel
      eyebrow="Déjà en ligne"
      title={
        <>
          {countLabel(totalCount, "lot")} {totalCount > 1 ? "correspondent" : "correspond"} déjà à ce que vous cherchez
        </>
      }
      note="Croisement sur le jeu, le format, votre budget et la distance que vous acceptez. Rien ne vous oblige à attendre une proposition."
      items={listings.map((listing) => (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[length:var(--text-lg)] font-semibold">
              <IntentLink href={routes.listing(listing.slug)} className="text-[var(--chalk)] underline-offset-4 hover:underline">
                {listing.title}
              </IntentLink>
            </h3>
            <span className="price text-[length:var(--text-lg)] font-bold">{formatPrice(listing.priceCents)}</span>
          </div>
          <p className="mono mt-2 text-[length:var(--text-xs)] text-[var(--chalk-soft)]">
            {LOT_TYPE_LABELS[listing.lotType]} · {listing.city} · à{" "}
            {formatDistance(distanceByListingId.get(listing.id) ?? null)} de vous ·{" "}
            {listing.sellerUsername}
          </p>
        </>
      ))}
      footer={
        hidden > 0 ? (
          <p className="label mt-4 text-[var(--chalk-muted)]">
            et {countLabel(hidden, "autre", "autres")}
          </p>
        ) : null
      }
    />
  );
}
